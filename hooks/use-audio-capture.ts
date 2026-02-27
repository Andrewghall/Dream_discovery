'use client';

/**
 * useAudioCapture — mic test, CaptureAPI WebSocket streaming, live audio level.
 *
 * Extracted from live/page.tsx for reuse on the cognitive-guidance page.
 * Handles: getUserMedia → PCM resampling (16kHz) → CaptureAPIStream WS → ingest POST.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { CaptureAPIStream, type StreamTranscript } from '@/lib/captureapi/client';

// ── Types ────────────────────────────────────────────────
export interface AudioCaptureOptions {
  workshopId: string;
  /** Current dialogue phase — included in ingest POST so the server can tag the DataPoint */
  getDialoguePhase: () => string;
  /** Called on EVERY progressive transcript update (including partials).
   *  Enables the page to create/update live hemisphere nodes in real-time
   *  as CaptureAPI streams growing text. */
  onTranscriptStream?: (msg: StreamTranscript) => void;
}

export interface AudioCaptureReturn {
  // Mic test state
  micPermission: 'unknown' | 'granted' | 'denied';
  micDevices: { deviceId: string; label: string }[];
  selectedMicId: string;
  setSelectedMicId: (id: string) => void;
  micLevel: number;        // 0-1 scaled for level bar
  micTesting: boolean;
  // Live capture state
  audioLevel: number;      // 0-100 scaled for sound bar
  capturing: boolean;
  captureError: string | null;
  // Actions
  refreshMicDevices: () => Promise<void>;
  startMicTest: () => Promise<void>;
  stopMicTest: () => Promise<void>;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
}

// ── Hook ─────────────────────────────────────────────────
export function useAudioCapture({ workshopId, getDialoguePhase, onTranscriptStream }: AudioCaptureOptions): AudioCaptureReturn {
  // ── State ──
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [micDevices, setMicDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // ── Refs ──
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const captureWSRef = useRef<CaptureAPIStream | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureAudioCtxRef = useRef<AudioContext | null>(null);
  const captureRafRef = useRef<number | null>(null);

  const ingestUrl = `/api/workshops/${encodeURIComponent(workshopId)}/transcript`;

  // ── refreshMicDevices ──
  const refreshMicDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }))
        .filter((d) => d.deviceId && d.deviceId !== '__none');
      setMicDevices(mics);
      setSelectedMicId((prev) => {
        const stillValid = prev && mics.some((m) => m.deviceId === prev);
        if (stillValid) return prev;
        return mics.length > 0 ? mics[0].deviceId : '';
      });
    } catch {
      setMicDevices([]);
    }
  }, []);

  // ── stopMicTest ──
  const stopMicTest = useCallback(async () => {
    setMicTesting(false);
    setMicLevel(0);
    try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch { /* ignore */ }
    rafRef.current = null;
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    micStreamRef.current = null;
    try { await audioContextRef.current?.close(); } catch { /* ignore */ }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  // ── startMicTest ──
  const startMicTest = useCallback(async () => {
    setCaptureError(null);
    try {
      await stopMicTest();
      setMicTesting(true);

      const constraints: MediaStreamConstraints = {
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;
      setMicPermission('granted');
      await refreshMicDevices();

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(Math.min(1, rms * 2.5));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setMicTesting(false);
      setMicPermission('denied');
      setCaptureError(`Microphone access failed: ${e instanceof Error ? e.message : String(e)}`);
      await stopMicTest();
    }
  }, [selectedMicId, stopMicTest, refreshMicDevices]);

  // ── stopCapture ──
  const stopCapture = useCallback(() => {
    try { if (captureRafRef.current) cancelAnimationFrame(captureRafRef.current); } catch { /* ignore */ }
    captureRafRef.current = null;
    try { captureStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    captureStreamRef.current = null;
    try { captureAudioCtxRef.current?.close(); } catch { /* ignore */ }
    captureAudioCtxRef.current = null;
    try { captureWSRef.current?.close(); } catch { /* ignore */ }
    captureWSRef.current = null;
    setCapturing(false);
    setAudioLevel(0);
  }, []);

  // ── startCapture ──
  const startCapture = useCallback(async () => {
    setCaptureError(null);
    await stopMicTest(); // Stop any running mic test

    // 1. Connect CaptureAPI WebSocket
    try {
      const stream = new CaptureAPIStream({
        onTranscript: async (msg: StreamTranscript) => {
          const text = (msg.rawText?.trim() || msg.cleanText?.trim() || '');
          if (!text) return;

          // Stream ALL updates to the page for live hemisphere positioning
          // (CaptureAPI sends growing text: "Okay" → "Okay. Let's have a test" → etc.)
          onTranscriptStream?.(msg);

          // Only ingest FINAL transcripts to backend
          if (msg.isFinal === false) return;

          const speakerId = msg.speaker !== null ? `speaker_${msg.speaker}` : null;
          const now = Date.now();
          try {
            await fetch(ingestUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                speakerId,
                startTime: now - 5000,
                endTime: now,
                text,
                rawText: msg.rawText,
                confidence: msg.confidence,
                source: 'deepgram' as const,
                dialoguePhase: getDialoguePhase(),
                flush: false,
                slmMetadata: {
                  entities: msg.entities,
                  emotionalTone: msg.emotionalTone,
                  slmConfidence: msg.slmConfidence,
                  slmUsed: msg.slmUsed,
                },
              }),
            });
          } catch {
            // Ingest errors are non-fatal — SSE will still propagate to cognitive guidance
          }

          // When speaker finishes utterance, flush buffer
          if (msg.speechFinal) {
            fetch(ingestUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ flush: true, text: '__flush__', speakerId, dialoguePhase: getDialoguePhase() }),
            }).catch(() => {});
          }
        },
        onError: (err) => {
          setCaptureError(`CaptureAPI stream error — ${err}`);
        },
      });

      await stream.connect();
      captureWSRef.current = stream;
    } catch (err) {
      setCaptureError(`Cannot connect to CaptureAPI — ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    // 2. Start audio capture
    try {
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      };
      if (selectedMicId) {
        audioConstraints.deviceId = { exact: selectedMicId };
      }

      const captureStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      captureStreamRef.current = captureStream;

      const ctx = new AudioContext();
      captureAudioCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const source = ctx.createMediaStreamSource(captureStream);

      // Audio level monitoring (for live sound bar)
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(freqData);
        const avg = freqData.reduce((a, b) => a + b) / freqData.length;
        setAudioLevel(Math.min(100, (avg / 255) * 100 * 1.5));
        captureRafRef.current = requestAnimationFrame(updateLevel);
      };
      captureRafRef.current = requestAnimationFrame(updateLevel);

      // PCM resampling (native → 16kHz) via ScriptProcessor → send to CaptureAPI WS
      const pcmProcessor = ctx.createScriptProcessor(4096, 1, 1);
      source.connect(pcmProcessor);
      pcmProcessor.connect(ctx.destination);

      const nativeSR = ctx.sampleRate;
      const targetSR = 16000;
      const resampleRatio = nativeSR / targetSR;

      pcmProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
        const ws = captureWSRef.current;
        if (!ws || !ws.isReady) return;
        const input = e.inputBuffer.getChannelData(0);

        // Linear-interpolation resampling to 16kHz
        const outLen = Math.round(input.length / resampleRatio);
        const pcm = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const srcIdx = i * resampleRatio;
          const idx = Math.floor(srcIdx);
          const frac = srcIdx - idx;
          const s0 = idx < input.length ? input[idx] : 0;
          const s1 = idx + 1 < input.length ? input[idx + 1] : s0;
          const sample = s0 + frac * (s1 - s0);
          const clamped = Math.max(-1, Math.min(1, sample));
          pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
        }
        try {
          ws.sendBuffer(pcm.buffer);
        } catch {
          // ignore
        }
      };

      setCapturing(true);
    } catch (e) {
      setCaptureError(`Audio capture failed: ${e instanceof Error ? e.message : String(e)}`);
      stopCapture();
    }
  }, [selectedMicId, stopMicTest, stopCapture, ingestUrl, getDialoguePhase]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      stopMicTest();
      stopCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    micPermission, micDevices, selectedMicId, setSelectedMicId,
    micLevel, micTesting,
    audioLevel, capturing, captureError,
    refreshMicDevices, startMicTest, stopMicTest,
    startCapture, stopCapture,
  };
}

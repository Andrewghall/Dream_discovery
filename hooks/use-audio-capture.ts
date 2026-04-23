'use client';

/**
 * useAudioCapture — mic test, CaptureAPI WebSocket streaming, live audio level.
 *
 * Extracted from live/page.tsx for reuse on the cognitive-guidance page.
 * Handles: getUserMedia → PCM resampling (16kHz) → CaptureAPIStream WS →
 * ThoughtStateMachine accumulation → ingest POST (one post per resolved thought).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { CaptureAPIStream, type StreamTranscript } from '@/lib/captureapi/client';
import { ThoughtStateMachine } from '@/lib/ethentaflow/thought-state-machine';
import { DEFAULT_LENS_PACK } from '@/lib/ethentaflow/lens-pack-ontology';
import { domainIdToLiveDomain } from '@/lib/ethentaflow/domain-scoring-engine';
import type { CommitCandidate, LensPack, ThoughtAttempt } from '@/lib/ethentaflow/types';
import { emitDebug } from '@/lib/debug/pipeline-debug-bus';
import { cleanLiveWorkingChunk } from '@/lib/live/transcript-cleaning';
import { interpretLiveUtterance } from '@/lib/live/intent-interpretation';

// ── Types ────────────────────────────────────────────────
export interface AudioCaptureOptions {
  workshopId: string;
  /** Current dialogue phase — included in ingest POST so the server can tag the DataPoint */
  getDialoguePhase: () => string;
  /** Called on EVERY progressive transcript update (including partials).
   *  Enables the page to create/update live hemisphere nodes in real-time
   *  as CaptureAPI streams growing text. */
  onTranscriptStream?: (msg: StreamTranscript) => void;
  /** Called whenever the current in-memory utterance evolves for a speaker. */
  onPendingUtteranceUpdate?: (pending: {
    id: string;
    speakerId: string;
    domain: string;
    startedAtMs: number;
    workingText: string;
    domainConfidence: number | null;
    dialoguePhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null;
    intent: string | null;
    semanticConfidence: number | null;
  }) => void;
  /** Called when a pending utterance is resolved or discarded. */
  onUtteranceResolved?: (utteranceId: string) => void;
  /** Workshop-specific lens pack for ThoughtStateMachine domain scoring.
   *  Defaults to DEFAULT_LENS_PACK when not provided. */
  lensPack?: LensPack;
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
export function useAudioCapture({
  workshopId,
  getDialoguePhase,
  onTranscriptStream,
  onPendingUtteranceUpdate,
  onUtteranceResolved,
  lensPack,
}: AudioCaptureOptions): AudioCaptureReturn {
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
  // Per-speaker ThoughtStateMachines — persist across WebSocket reconnects within a session.
  // Flushed and destroyed on stopCapture so each capture session starts clean.
  const stateMachinesRef = useRef<Map<string, ThoughtStateMachine>>(new Map());
  const rawTranscriptSeqRef = useRef(0);
  // Lens pack ref — updated when lensPack prop changes; read inside startCapture closure.
  const lensPackRef = useRef<LensPack>(lensPack ?? DEFAULT_LENS_PACK);

  useEffect(() => {
    lensPackRef.current = lensPack ?? DEFAULT_LENS_PACK;
  }, [lensPack]);

  // Browser-relay ingest URL
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

  // ── stopCapture ──
  const stopCapture = useCallback(() => {
    // Flush any in-progress thoughts before tearing down
    stateMachinesRef.current.forEach((m) => { m.forceFlush(); m.destroy(); });
    stateMachinesRef.current.clear();

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

  // ── startCapture ──
  const startCapture = useCallback(async () => {
    setCaptureError(null);
    await stopMicTest(); // Stop any running mic test

    // 1. Connect CaptureAPI WebSocket
    try {
      const stream = new CaptureAPIStream({
        workshopId,
        dialoguePhase: getDialoguePhase(),
        onTranscript: (msg: StreamTranscript) => {
          const sourceChunkId = msg.sourceChunkId || crypto.randomUUID();
          if (typeof msg.rawText === 'string' && msg.rawText.length > 0) {
            const rawSeq = rawTranscriptSeqRef.current++;
            void fetch(`/api/workshops/${encodeURIComponent(workshopId)}/raw-transcript`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                speakerId: msg.speaker !== null ? `speaker_${msg.speaker}` : null,
                sourceChunkId,
                capturedAt: new Date().toISOString(),
                text: msg.rawText,
                startTimeMs: msg.startTimeMs ?? Date.now(),
                endTimeMs: msg.endTimeMs ?? Date.now(),
                confidence: msg.confidence ?? null,
                speechFinal: msg.speechFinal ?? false,
                sequence: rawSeq,
              }),
            }).catch(() => {
              // Raw transcript persistence is intentionally independent from processing.
            });
          }

          const rawWorkingText =
            (typeof msg.rawText === 'string' && msg.rawText.trim()) ||
            (typeof msg.text === 'string' && msg.text.trim()) ||
            '';
          const text = cleanLiveWorkingChunk(rawWorkingText);
          if (!text) return;

          // Stream ALL updates to the page for live hemisphere positioning.
          onTranscriptStream?.(msg);

          // Only isFinal messages feed into the ThoughtStateMachine.
          // Partials are used only for the streaming preview above.
          if (msg.isFinal === false) return;

          const speakerId = msg.speaker !== null ? `speaker_${msg.speaker}` : 'speaker_unknown';

          // Create state machine for this speaker if not yet present.
          if (!stateMachinesRef.current.has(speakerId)) {
            const machine = new ThoughtStateMachine(speakerId, lensPackRef.current, {
              onPendingUpdate: (attempt: ThoughtAttempt) => {
                const workingText = cleanLiveWorkingChunk(attempt.full_text);
                if (!workingText) return;
                const liveInterpretation = interpretLiveUtterance(workingText);
                const deterministicDomain =
                  attempt.domain?.primary_domain
                    ? domainIdToLiveDomain(attempt.domain.primary_domain)
                    : null;
                const domain = liveInterpretation.domain || deterministicDomain || 'General';
                onPendingUtteranceUpdate?.({
                  id: attempt.id,
                  speakerId,
                  domain,
                  startedAtMs: attempt.start_time_ms,
                  workingText,
                  domainConfidence: Math.max(
                    attempt.domain?.confidence ?? 0,
                    liveInterpretation.confidence ?? 0,
                  ),
                  dialoguePhase: liveInterpretation.hemispherePhase,
                  intent: `${liveInterpretation.temporalIntent} / ${liveInterpretation.intentType} / ${liveInterpretation.domain}`,
                  semanticConfidence: liveInterpretation.confidence,
                });
              },
              onCommitCandidate: (candidate: CommitCandidate) => {
                const attempt = candidate.attempt;
                const commitNow = Date.now();
                const spokenRecords = attempt.chunks.map((chunkText, i) => ({
                  text: chunkText,
                  startTimeMs: attempt.chunk_times[i] ?? attempt.start_time_ms,
                  endTimeMs: attempt.chunk_times[i + 1] ?? commitNow,
                  confidence: null as number | null,
                  source: 'deepgram' as const,
                }));

                console.log('WINDOW_START→COMMIT', {
                  speakerId,
                  windowId: attempt.id,
                  chunks: attempt.chunks.length,
                  text: attempt.full_text.substring(0, 80),
                });

                // ── Debug: TSM COMMIT ──────────────────────────
                emitDebug({
                  stage: 'tsm',
                  event: 'COMMIT',
                  status: 'pass',
                  thoughtWindowId: attempt.id,
                  text: attempt.full_text.substring(0, 80),
                  chunks: attempt.chunks.length,
                });

                const requestBody = JSON.stringify({
                  speakerId,
                  startTime: attempt.start_time_ms,
                  endTime: commitNow,
                  text: attempt.full_text,
                  rawText: attempt.full_text,
                  confidence: null,
                  source: 'deepgram' as const,
                  dialoguePhase: getDialoguePhase(),
                  flush: candidate.merge_expired,
                  spokenRecords,
                  clientDomainHint: attempt.domain ? {
                    primaryDomain: attempt.domain.primary_domain ?? 'General',
                    secondaryDomain: attempt.domain.secondary_domain ?? null,
                    confidence: attempt.domain.confidence ?? 0,
                    decisionPath: attempt.domain.decision_path ?? '',
                  } : null,
                });

                // ── Debug: INGEST sent ─────────────────────────
                emitDebug({
                  stage: 'ingest',
                  event: 'SENT',
                  status: 'info',
                  thoughtWindowId: attempt.id,
                  requestText: attempt.full_text.substring(0, 60),
                });

                fetch(ingestUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: requestBody,
                })
                .then(async r => {
                  const body = await r.json().catch(() => null) as {
                    result?: {
                      dataPointId?: string;
                      dataPoint?: { id: string; rawText?: string };
                      thoughtWindowId?: string;
                      blocked?: boolean;
                      reason?: string;
                    } | null;
                    results?: Array<{
                      dataPointId?: string;
                      dataPoint?: { id: string; rawText?: string };
                      thoughtWindowId?: string;
                      blocked?: boolean;
                      reason?: string;
                    }>;
                  } | null;

                  const results = body?.results ?? (body?.result ? [body.result] : []);
                  const serverWinId = results[0]?.thoughtWindowId;
                  const dpIds = results
                    .map(res => res.dataPointId ?? res.dataPoint?.id)
                    .filter((id): id is string => !!id);
                  const wasSplit = results.length > 1;
                  const units = results
                    .map(res => res.dataPoint?.rawText)
                    .filter((t): t is string => !!t);

                  // ── Debug: INGEST response ─────────────────────
                  emitDebug({
                    stage: 'ingest',
                    event: r.ok ? 'RESPONSE' : 'RESPONSE_ERROR',
                    status: r.ok ? 'pass' : 'error',
                    thoughtWindowId: serverWinId,
                    httpStatus: r.status,
                    dataPointIds: dpIds,
                    requestText: attempt.full_text.substring(0, 60),
                  });

                  // ── Debug: SPLIT ───────────────────────────────
                  emitDebug({
                    stage: 'split',
                    event: wasSplit ? 'SEMANTIC_SPLIT' : 'NO_SPLIT',
                    status: 'info',
                    thoughtWindowId: serverWinId,
                    wasSplit,
                    unitCount: results.length,
                    originalText: attempt.full_text.substring(0, 70),
                    units: units.map(u => u.substring(0, 70)),
                  });

                  // ── Debug: blocked units ───────────────────────
                  results.forEach((res, i) => {
                    if (res.blocked) {
                      emitDebug({
                        stage: 'ingest',
                        event: `UNIT_${i}_BLOCKED`,
                        status: 'blocked',
                        thoughtWindowId: serverWinId,
                        guardReason: res.reason ?? 'unknown',
                      });
                    }
                  });
                  if (dpIds.length > 0 || results.some((res) => res.blocked)) {
                    onUtteranceResolved?.(attempt.id);
                  }
                })
                .catch(err => {
                  emitDebug({
                    stage: 'ingest',
                    event: 'FETCH_ERROR',
                    status: 'error',
                    thoughtWindowId: attempt.id,
                    guardReason: err instanceof Error ? err.message : String(err),
                  });
                });
              },
              onDiscard: (attempt: ThoughtAttempt) => {
                console.log('[EthentaFlow] Discarded —', speakerId,
                  '| text:', attempt.full_text.substring(0, 80),
                  '| guard:', attempt.validity?.reasons?.slice(0, 2).join('; '));
                onUtteranceResolved?.(attempt.id);

                // ── Debug: TSM DISCARD ─────────────────────────
                emitDebug({
                  stage: 'tsm',
                  event: 'DISCARD',
                  status: 'blocked',
                  thoughtWindowId: attempt.id,
                  text: attempt.full_text.substring(0, 80),
                  chunks: attempt.chunks.length,
                  guardReason: attempt.validity?.reasons?.slice(0, 2).join('; ') ?? 'unknown',
                });
                // Raw transcript already stored at receipt — nothing to do on discard.
              },
            });
            stateMachinesRef.current.set(speakerId, machine);
          }

          stateMachinesRef.current.get(speakerId)!.chunkArrived(text, msg.speechFinal ?? false);
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
  }, [selectedMicId, stopMicTest, stopCapture, workshopId, getDialoguePhase, ingestUrl, onTranscriptStream]);

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

'use client';

/**
 * GTM Free-Flow Conversation View
 *
 * A voice-first, ambient conversation UI for GTM discovery sessions.
 * The conversation flows naturally — no chat transcript is displayed.
 * Recording and transcription happen silently in the background.
 *
 * State machine:
 *   idle → (user taps Start) → ai-speaking
 *   ai-speaking → (TTS ends) → awaiting-speech
 *   awaiting-speech → (VAD: energy > threshold) → user-speaking
 *   user-speaking → (silence 2.5s after speech) → processing
 *   user-speaking → (45s max) → processing
 *   processing → (AI replies, TTS starts) → ai-speaking
 *   processing → (session COMPLETED) → done
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { speakWithOpenAI, stopSpeaking } from '@/lib/utils/openai-tts';
import type { Message } from '@/lib/types/conversation';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConvState =
  | 'idle'            // before the user clicks Start
  | 'ai-speaking'     // TTS is playing
  | 'awaiting-speech' // mic open, waiting for participant to start talking
  | 'user-speaking'   // participant is actively speaking (VAD detected)
  | 'processing'      // Whisper transcription + AI API call in progress
  | 'done';           // session COMPLETED

interface GtmFreeFlowViewProps {
  sessionId: string;
  initialMessages: Message[];
  sessionStatus: 'IN_PROGRESS' | 'COMPLETED';
  primaryColor?: string | null;
  organizationName?: string | null;
  logoUrl?: string | null;
  onSessionComplete: () => void;
}

// ── VAD constants ─────────────────────────────────────────────────────────────

const VAD_ENERGY_SPEAK  = 0.018;  // RMS above → participant is speaking
const VAD_ENERGY_NOISE  = 0.010;  // RMS below this counts as silence
const VAD_SILENCE_MS    = 2500;   // ms of silence after speech → stop & submit
const VAD_MAX_RECORD_MS = 45_000; // safety ceiling — never record longer than this
const VAD_POLL_MS       = 80;     // how often we check the analyser (ms)

// ── Helper: submit audio to Whisper ──────────────────────────────────────────

async function transcribeBlob(blob: Blob): Promise<string | null> {
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  formData.append('language', 'en');

  try {
    const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
    if (!res.ok) return null;
    const data = await res.json() as { text?: string };
    return data.text?.trim() || null;
  } catch {
    return null;
  }
}

// ── Animated orb ─────────────────────────────────────────────────────────────

function Orb({ state, energyLevel }: { state: ConvState; energyLevel: number }) {
  const scale = state === 'user-speaking'
    ? 1 + energyLevel * 0.35
    : state === 'awaiting-speech'
    ? 1.04
    : 1;

  const ringColor = state === 'ai-speaking'
    ? '#3b82f6'
    : (state === 'awaiting-speech' || state === 'user-speaking')
    ? '#22c55e'
    : state === 'processing'
    ? '#6366f1'
    : state === 'done'
    ? '#10b981'
    : '#94a3b8';

  const coreColor = state === 'ai-speaking'
    ? '#eff6ff'
    : (state === 'awaiting-speech' || state === 'user-speaking')
    ? '#f0fdf4'
    : state === 'processing'
    ? '#eef2ff'
    : state === 'done'
    ? '#ecfdf5'
    : '#f8fafc';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {/* Outer pulse ring */}
      {(state === 'awaiting-speech' || state === 'user-speaking' || state === 'ai-speaking') && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `3px solid ${ringColor}`,
            opacity: 0.25,
            transform: `scale(${state === 'user-speaking' ? 1.15 + energyLevel * 0.4 : 1.15})`,
            transition: 'transform 0.08s ease-out',
          }}
        />
      )}

      {/* Second pulse ring */}
      {(state === 'awaiting-speech' || state === 'user-speaking') && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            border: `2px solid ${ringColor}`,
            opacity: 0.12,
            animationDuration: '2s',
          }}
        />
      )}

      {/* AI-speaking slow-breathe ring */}
      {state === 'ai-speaking' && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            border: `3px solid ${ringColor}`,
            opacity: 0.3,
            animationDuration: '1.8s',
          }}
        />
      )}

      {/* Processing spinner ring */}
      {state === 'processing' && (
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            border: `3px solid transparent`,
            borderTopColor: ringColor,
            borderRightColor: `${ringColor}88`,
            animationDuration: '1s',
          }}
        />
      )}

      {/* Core circle */}
      <div
        className="relative rounded-full shadow-lg flex items-center justify-center"
        style={{
          width: 160,
          height: 160,
          background: coreColor,
          border: `3px solid ${ringColor}`,
          transform: `scale(${scale})`,
          transition: 'transform 0.1s ease-out, background 0.4s ease, border-color 0.4s ease',
          boxShadow: `0 0 40px ${ringColor}33, 0 4px 20px rgba(0,0,0,0.08)`,
        }}
      >
        {/* Inner icon */}
        {state === 'idle' && (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="1.5">
            <path d="M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z" />
            <polygon points="10,8 16,12 10,16" fill={ringColor} stroke="none" />
          </svg>
        )}
        {state === 'ai-speaking' && (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )}
        {(state === 'awaiting-speech' || state === 'user-speaking') && (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="1.5">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        )}
        {state === 'processing' && (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        )}
        {state === 'done' && (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Status label ──────────────────────────────────────────────────────────────

function StatusLabel({ state }: { state: ConvState }) {
  const labels: Record<ConvState, string> = {
    idle:            '',
    'ai-speaking':   'Speaking…',
    'awaiting-speech': 'Listening…',
    'user-speaking': 'Listening…',
    processing:      'Just a moment…',
    done:            'Thank you — that\'s all we need.',
  };

  return (
    <p className="text-sm text-slate-500 h-5 text-center transition-opacity duration-300">
      {labels[state]}
    </p>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GtmFreeFlowView({
  sessionId,
  initialMessages,
  sessionStatus,
  primaryColor,
  organizationName,
  logoUrl,
  onSessionComplete,
}: GtmFreeFlowViewProps) {
  const [convState, setConvState] = useState<ConvState>(
    sessionStatus === 'COMPLETED' ? 'done' : 'idle'
  );
  const [energyLevel, setEnergyLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Audio refs
  const streamRef            = useRef<MediaStream | null>(null);
  const mediaRecorderRef     = useRef<MediaRecorder | null>(null);
  const chunksRef            = useRef<BlobPart[]>([]);
  const audioCtxRef          = useRef<AudioContext | null>(null);
  const analyserRef          = useRef<AnalyserNode | null>(null);
  const vadIntervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convStateRef         = useRef<ConvState>(convState);
  const hasSpeechRef         = useRef(false);
  const silenceStartRef      = useRef<number | null>(null);
  const sessionEpochRef      = useRef(0);
  const currentSessionIdRef  = useRef(sessionId);

  // Keep ref in sync with state
  useEffect(() => { convStateRef.current = convState; }, [convState]);
  useEffect(() => { currentSessionIdRef.current = sessionId; }, [sessionId]);

  // ── Cleanup audio resources ─────────────────────────────────────────────────
  const stopAudioCapture = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (audioCtxRef.current) {
      try { void audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    setEnergyLevel(0);
  }, []);

  // ── Submit recorded audio to Whisper + AI ──────────────────────────────────
  const submitRecording = useCallback(async (blob: Blob, epoch: number) => {
    if (epoch !== sessionEpochRef.current) return;

    stopAudioCapture();
    setConvState('processing');

    // Whisper transcription
    const transcript = await transcribeBlob(blob);

    if (epoch !== sessionEpochRef.current) return;

    if (!transcript) {
      // Nothing intelligible — go back to listening
      setError('Didn\'t catch that. Starting to listen again…');
      setTimeout(() => {
        if (epoch === sessionEpochRef.current) {
          setError(null);
          void startListening(epoch);
        }
      }, 1500);
      return;
    }

    // Send to conversation API
    try {
      const res = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionIdRef.current, userMessage: transcript }),
      });

      if (epoch !== sessionEpochRef.current) return;

      if (!res.ok) throw new Error('API error');

      const data = await res.json() as {
        message: Message;
        status?: string;
        currentPhase?: string;
      };

      if (epoch !== sessionEpochRef.current) return;

      // Speak the AI response
      setConvState('ai-speaking');
      void speakWithOpenAI(data.message.content).catch(() => {});

      if (data.status === 'COMPLETED') {
        // Wait for TTS to finish, then show done
        const onEnd = () => {
          window.removeEventListener('dream-tts-end', onEnd);
          if (epoch === sessionEpochRef.current) {
            setConvState('done');
            onSessionComplete();
          }
        };
        window.addEventListener('dream-tts-end', onEnd);
      }
    } catch {
      if (epoch !== sessionEpochRef.current) return;
      setError('Connection issue — starting to listen again…');
      setTimeout(() => {
        if (epoch === sessionEpochRef.current) {
          setError(null);
          void startListening(epoch);
        }
      }, 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAudioCapture, onSessionComplete]);

  // ── Start listening (mic + VAD) ────────────────────────────────────────────
  const startListening = useCallback(async (epoch: number) => {
    if (epoch !== sessionEpochRef.current) return;
    stopAudioCapture();

    setConvState('awaiting-speech');
    hasSpeechRef.current = false;
    silenceStartRef.current = null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setError('Microphone access is required for the conversation. Please allow microphone and refresh.');
      return;
    }

    if (epoch !== sessionEpochRef.current) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    streamRef.current = stream;

    // Set up analyser for VAD
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    // Set up MediaRecorder for capturing audio
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      if (epoch !== sessionEpochRef.current) return;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      void submitRecording(blob, epoch);
    };

    recorder.start(200); // collect data every 200ms
    mediaRecorderRef.current = recorder;

    const buf = new Uint8Array(analyser.fftSize);

    // VAD polling
    vadIntervalRef.current = setInterval(() => {
      if (epoch !== sessionEpochRef.current) {
        clearInterval(vadIntervalRef.current!);
        return;
      }

      const a = analyserRef.current;
      if (!a) return;

      a.getByteTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      setEnergyLevel(Math.min(1, rms / 0.15));

      if (rms > VAD_ENERGY_SPEAK) {
        // Participant speaking
        hasSpeechRef.current = true;
        silenceStartRef.current = null;
        if (convStateRef.current === 'awaiting-speech') {
          setConvState('user-speaking');
        }
      } else if (rms < VAD_ENERGY_NOISE) {
        // Silence
        if (hasSpeechRef.current) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > VAD_SILENCE_MS) {
            // Sufficient silence after speech — stop and submit
            clearInterval(vadIntervalRef.current!);
            vadIntervalRef.current = null;
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
          }
        }
      } else {
        // Between thresholds — don't reset silence timer
      }
    }, VAD_POLL_MS);

    // Safety max-duration timer
    maxDurationTimerRef.current = setTimeout(() => {
      if (epoch !== sessionEpochRef.current) return;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }, VAD_MAX_RECORD_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAudioCapture, submitRecording]);

  // ── Listen for TTS end → start listening ──────────────────────────────────
  useEffect(() => {
    const onTtsEnd = () => {
      if (convStateRef.current === 'ai-speaking') {
        const epoch = sessionEpochRef.current;
        void startListening(epoch);
      }
    };

    window.addEventListener('dream-tts-end', onTtsEnd);
    return () => window.removeEventListener('dream-tts-end', onTtsEnd);
  }, [startListening]);

  // ── Start conversation ─────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    const epoch = ++sessionEpochRef.current;
    stopSpeaking();
    stopAudioCapture();
    setConvState('ai-speaking');

    // Find the last AI message to speak
    const lastAi = [...initialMessages].reverse().find(m => m.role === 'AI');
    if (lastAi) {
      void speakWithOpenAI(lastAi.content).catch(() => {
        if (epoch === sessionEpochRef.current) void startListening(epoch);
      });
    } else {
      void startListening(epoch);
    }
  }, [initialMessages, stopAudioCapture, startListening]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      sessionEpochRef.current = -1;
      stopSpeaking();
      stopAudioCapture();
    };
  }, [stopAudioCapture]);

  const accent = primaryColor || '#1E3A5F';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fafafa' }}>
      {/* Header */}
      <div className="border-b bg-white px-6 py-3 flex items-center gap-3">
        {logoUrl && (
          <Image src={logoUrl} alt={organizationName || 'Logo'} width={120} height={32} className="h-8 w-auto" priority />
        )}
        {!logoUrl && organizationName && (
          <span className="text-sm font-medium text-slate-700">{organizationName}</span>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        {convState === 'idle' ? (
          // Landing state
          <div className="flex flex-col items-center gap-8 text-center max-w-md">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800 mb-2">
                Discovery Conversation
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                We&apos;ll have a natural conversation about your go-to-market context.
                Just speak freely — there&apos;s no script to follow.
              </p>
            </div>

            <Orb state="idle" energyLevel={0} />

            <button
              type="button"
              onClick={handleStart}
              className="px-10 py-4 rounded-xl text-white font-semibold text-base shadow-md hover:opacity-90 active:scale-95 transition-all"
              style={{ backgroundColor: accent }}
            >
              Begin Conversation
            </button>

            <p className="text-xs text-slate-400">
              Your microphone will be used to capture your responses.
            </p>
          </div>
        ) : convState === 'done' ? (
          // Done state
          <div className="flex flex-col items-center gap-6 text-center max-w-md">
            <Orb state="done" energyLevel={0} />
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">All done — thank you.</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Your responses have been captured. The facilitation team will incorporate
                your insights into the session.
              </p>
            </div>
          </div>
        ) : (
          // Active conversation state
          <div className="flex flex-col items-center gap-6">
            <Orb state={convState} energyLevel={energyLevel} />
            <StatusLabel state={convState} />
            {error && (
              <p className="text-xs text-amber-600 text-center max-w-xs animate-pulse">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-xs text-slate-400">
        © {organizationName || 'DREAM Discovery'}
      </div>
    </div>
  );
}

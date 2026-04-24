'use client';

/**
 * GTM Free-Flow Conversation View
 *
 * Voice-first discovery UI for GTM workshops. The current question is always
 * visible on screen. Participants can respond by voice (auto-recorded via VAD)
 * or by typing. Triple-rating questions always show the visual widget.
 *
 * TTS: OpenAI tts-1-hd + nova (warm, natural) via /api/speak-discovery.
 * No browser TTS, no transcript shown — just the current question + state orb.
 *
 * State machine:
 *   idle → (tap Begin) → welcome → first-question → listening loop
 *   listening → (silence after speech) → processing → speaking → listening → ...
 *   → done
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { speakGtm, stopGtmAudio } from '@/lib/utils/gtm-tts';
import { ProgressIndicator } from '@/components/chat/progress-indicator';
import { TripleRatingInput } from '@/components/chat/triple-rating-input';
import { normalizeConversationPhase } from '@/lib/types/conversation';
import type { Message } from '@/lib/types/conversation';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConvState =
  | 'idle'
  | 'ai-speaking'
  | 'awaiting-speech'   // mic open, waiting for participant to start
  | 'user-speaking'     // VAD detected active speech
  | 'processing'
  | 'done';

type QuestionMeta = {
  kind: 'question';
  phase: string;
  index: number;
  tag?: string;
  maturityScale?: string[];
};

function isQuestionMeta(meta: unknown): meta is QuestionMeta {
  if (!meta || typeof meta !== 'object') return false;
  const r = meta as Record<string, unknown>;
  return r.kind === 'question' && typeof r.phase === 'string' && typeof r.index === 'number';
}

interface LensLabel { key: string; label: string }

interface GtmFreeFlowViewProps {
  token: string;
  sessionId: string;
  initialMessages: Message[];
  sessionStatus: 'IN_PROGRESS' | 'COMPLETED';
  initialPhase: string;
  initialPhaseProgress: number;
  lensLabels: LensLabel[] | null;
  clientName: string | null;
  primaryColor?: string | null;
  organizationName?: string | null;
  logoUrl?: string | null;
  onSessionComplete: () => void;
}

// ── VAD constants ─────────────────────────────────────────────────────────────

const VAD_ENERGY_SPEAK  = 0.018;
const VAD_ENERGY_NOISE  = 0.010;
const VAD_SILENCE_MS    = 2500;
const VAD_MAX_RECORD_MS = 45_000;
const VAD_POLL_MS       = 80;

// ── Build welcome text ────────────────────────────────────────────────────────

function buildWelcome(clientName: string | null, lensLabels: LensLabel[] | null): string {
  const client = clientName ? `for ${clientName}` : '';
  const lensCount = lensLabels?.length ?? 6;
  const durationMin = Math.round(lensCount * 4);

  const areaNames = lensLabels && lensLabels.length > 0
    ? lensLabels.map((l, i) => {
        if (i === lensLabels.length - 1 && lensLabels.length > 1) return `and ${l.label}`;
        return l.label;
      }).join(lensLabels.length > 2 ? ', ' : ' ')
    : 'People, Operations, Technology, Commercial, Risk and Compliance, and Partners';

  return [
    `Hi — welcome to the discovery conversation${client ? ' ' + client : ''}.`,
    `Today we'll explore ${lensCount} areas together: ${areaNames}.`,
    `The whole session takes around ${durationMin} to ${durationMin + 5} minutes, and there are no right or wrong answers — just speak freely about your real experience.`,
    `I'll ask each question out loud, and you can respond by speaking or by typing below. Let's get started.`,
  ].join(' ');
}

// ── Animated orb ─────────────────────────────────────────────────────────────

function Orb({ state, energyLevel }: { state: ConvState; energyLevel: number }) {
  const ringColor =
    state === 'ai-speaking'    ? '#3b82f6' :
    state === 'awaiting-speech' || state === 'user-speaking' ? '#22c55e' :
    state === 'processing'     ? '#6366f1' :
    state === 'done'           ? '#10b981' : '#94a3b8';

  const scale = state === 'user-speaking' ? 1 + energyLevel * 0.3 : 1;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 96, height: 96 }}>
      {/* Outer ping */}
      {(state === 'awaiting-speech' || state === 'user-speaking') && (
        <div className="absolute inset-0 rounded-full animate-ping"
          style={{ border: `2px solid ${ringColor}`, opacity: 0.15, animationDuration: '2s' }} />
      )}
      {/* Slow breathe for AI speaking */}
      {state === 'ai-speaking' && (
        <div className="absolute inset-0 rounded-full animate-pulse"
          style={{ border: `2px solid ${ringColor}`, opacity: 0.25, animationDuration: '1.8s' }} />
      )}
      {/* Spin for processing */}
      {state === 'processing' && (
        <div className="absolute inset-0 rounded-full animate-spin"
          style={{ border: '2px solid transparent', borderTopColor: ringColor, borderRightColor: `${ringColor}88`, animationDuration: '0.9s' }} />
      )}
      {/* Core */}
      <div
        className="rounded-full flex items-center justify-center shadow-md"
        style={{
          width: 64, height: 64,
          background: state === 'ai-speaking' ? '#eff6ff' : state === 'awaiting-speech' || state === 'user-speaking' ? '#f0fdf4' : state === 'processing' ? '#eef2ff' : state === 'done' ? '#ecfdf5' : '#f8fafc',
          border: `2px solid ${ringColor}`,
          transform: `scale(${scale})`,
          transition: 'transform 0.08s ease-out',
          boxShadow: `0 0 20px ${ringColor}40`,
        }}
      >
        {(state === 'awaiting-speech' || state === 'user-speaking') && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="1.5">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        )}
        {state === 'ai-speaking' && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="1.5">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
        {state === 'processing' && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
          </svg>
        )}
        {state === 'done' && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {state === 'idle' && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ringColor} strokeWidth="1.5">
            <polygon points="5,3 19,12 5,21" fill={ringColor} stroke="none" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Submit audio to Whisper ────────────────────────────────────────────────────

async function transcribeBlob(blob: Blob): Promise<string | null> {
  const fd = new FormData();
  fd.append('audio', blob, 'recording.webm');
  fd.append('language', 'en');
  try {
    const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
    if (!res.ok) return null;
    const d = await res.json() as { text?: string };
    return d.text?.trim() || null;
  } catch { return null; }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GtmFreeFlowView({
  token,
  sessionId,
  initialMessages,
  sessionStatus,
  initialPhase,
  initialPhaseProgress,
  lensLabels,
  clientName,
  primaryColor,
  organizationName,
  logoUrl,
  onSessionComplete,
}: GtmFreeFlowViewProps) {
  const [convState, setConvState]             = useState<ConvState>(sessionStatus === 'COMPLETED' ? 'done' : 'idle');
  const [energyLevel, setEnergyLevel]         = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(() => {
    const last = [...initialMessages].reverse().find(m => m.role === 'AI');
    return last?.content ?? null;
  });
  const [currentMeta, setCurrentMeta]         = useState<QuestionMeta | null>(() => {
    const last = [...initialMessages].reverse().find(m => m.role === 'AI' && isQuestionMeta(m.metadata));
    return last && isQuestionMeta(last.metadata) ? last.metadata : null;
  });
  const [currentPhase, setCurrentPhase]       = useState(initialPhase || 'intro');
  const [phaseProgress, setPhaseProgress]     = useState(initialPhaseProgress || 0);
  const [textDraft, setTextDraft]             = useState('');
  const [errorMsg, setErrorMsg]               = useState<string | null>(null);

  const isTripleRating = currentMeta?.tag === 'triple_rating';

  // Refs
  const sessionEpochRef        = useRef(0);
  const streamRef              = useRef<MediaStream | null>(null);
  const mediaRecorderRef       = useRef<MediaRecorder | null>(null);
  const chunksRef              = useRef<BlobPart[]>([]);
  const audioCtxRef            = useRef<AudioContext | null>(null);
  const analyserRef            = useRef<AnalyserNode | null>(null);
  const vadIntervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpeechRef           = useRef(false);
  const silenceStartRef        = useRef<number | null>(null);
  const convStateRef           = useRef<ConvState>(convState);
  useEffect(() => { convStateRef.current = convState; }, [convState]);

  // ── Stop audio capture ────────────────────────────────────────────────────
  const stopAudioCapture = useCallback(() => {
    if (vadIntervalRef.current)       { clearInterval(vadIntervalRef.current);   vadIntervalRef.current = null; }
    if (maxDurationTimerRef.current)  { clearTimeout(maxDurationTimerRef.current); maxDurationTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (audioCtxRef.current)          { void audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (streamRef.current)            { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    analyserRef.current = null;
    setEnergyLevel(0);
  }, []);

  // ── Send a message and speak the AI reply ────────────────────────────────
  const sendMessage = useCallback(async (content: string, epoch: number) => {
    if (epoch !== sessionEpochRef.current) return;

    stopAudioCapture();
    setConvState('processing');

    try {
      const res = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage: content }),
      });
      if (epoch !== sessionEpochRef.current) return;
      if (!res.ok) throw new Error('API error');

      const data = await res.json() as {
        message: Message;
        status?: string;
        currentPhase?: string;
        phaseProgress?: number;
      };
      if (epoch !== sessionEpochRef.current) return;

      // Update progress
      if (data.currentPhase)   setCurrentPhase(data.currentPhase);
      if (typeof data.phaseProgress === 'number') setPhaseProgress(data.phaseProgress);

      // Update current question display
      if (data.message.role === 'AI') {
        setCurrentQuestion(data.message.content);
        setCurrentMeta(isQuestionMeta(data.message.metadata) ? data.message.metadata : null);
      }

      const isComplete = data.status === 'COMPLETED';
      setConvState('ai-speaking');

      // Speak the response with natural OpenAI TTS
      try {
        await speakGtm(data.message.content, token);
      } catch {
        // TTS failed — still continue the conversation
      }

      if (epoch !== sessionEpochRef.current) return;

      if (isComplete) {
        setConvState('done');
        onSessionComplete();
      } else {
        // Start listening again
        void startListening(epoch); // eslint-disable-line @typescript-eslint/no-use-before-define
      }
    } catch {
      if (epoch !== sessionEpochRef.current) return;
      setErrorMsg('Connection issue — starting to listen again…');
      setTimeout(() => {
        if (epoch === sessionEpochRef.current) {
          setErrorMsg(null);
          void startListening(epoch); // eslint-disable-line @typescript-eslint/no-use-before-define
        }
      }, 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token, stopAudioCapture, onSessionComplete]);

  // ── Handle text submit ────────────────────────────────────────────────────
  const handleTextSubmit = useCallback(() => {
    const text = textDraft.trim();
    if (!text) return;
    stopAudioCapture();
    setTextDraft('');
    const epoch = sessionEpochRef.current;
    void sendMessage(text, epoch);
  }, [textDraft, stopAudioCapture, sendMessage]);

  // ── Submit recorded audio ─────────────────────────────────────────────────
  const submitRecording = useCallback(async (blob: Blob, epoch: number) => {
    if (epoch !== sessionEpochRef.current) return;
    stopAudioCapture();
    setConvState('processing');

    const transcript = await transcribeBlob(blob);
    if (epoch !== sessionEpochRef.current) return;

    if (!transcript) {
      setErrorMsg('Didn\'t catch that — listening again…');
      setTimeout(() => {
        if (epoch === sessionEpochRef.current) {
          setErrorMsg(null);
          void startListening(epoch); // eslint-disable-line @typescript-eslint/no-use-before-define
        }
      }, 1500);
      return;
    }

    void sendMessage(transcript, epoch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAudioCapture, sendMessage]);

  // ── Start listening (mic + VAD) ───────────────────────────────────────────
  // eslint-disable-next-line prefer-const
  let startListening: (epoch: number) => Promise<void>;

  // eslint-disable-next-line prefer-const
  startListening = useCallback(async (epoch: number) => {
    if (epoch !== sessionEpochRef.current) return;
    stopAudioCapture();
    setConvState('awaiting-speech');
    hasSpeechRef.current   = false;
    silenceStartRef.current = null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setErrorMsg('Microphone access is required. Please allow microphone and refresh.');
      return;
    }
    if (epoch !== sessionEpochRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

    streamRef.current = stream;

    const ctx      = new AudioContext();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    audioCtxRef.current  = ctx;
    analyserRef.current  = analyser;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      if (epoch !== sessionEpochRef.current) return;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      void submitRecording(blob, epoch);
    };
    recorder.start(200);
    mediaRecorderRef.current = recorder;

    const buf = new Uint8Array(analyser.fftSize);

    vadIntervalRef.current = setInterval(() => {
      if (epoch !== sessionEpochRef.current) { clearInterval(vadIntervalRef.current!); return; }
      const a = analyserRef.current;
      if (!a) return;

      a.getByteTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sumSq += v * v; }
      const rms = Math.sqrt(sumSq / buf.length);
      setEnergyLevel(Math.min(1, rms / 0.15));

      if (rms > VAD_ENERGY_SPEAK) {
        hasSpeechRef.current   = true;
        silenceStartRef.current = null;
        if (convStateRef.current === 'awaiting-speech') setConvState('user-speaking');
      } else if (rms < VAD_ENERGY_NOISE && hasSpeechRef.current) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = Date.now();
        } else if (Date.now() - silenceStartRef.current > VAD_SILENCE_MS) {
          clearInterval(vadIntervalRef.current!);
          vadIntervalRef.current = null;
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }
      }
    }, VAD_POLL_MS);

    maxDurationTimerRef.current = setTimeout(() => {
      if (epoch !== sessionEpochRef.current) return;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }, VAD_MAX_RECORD_MS);
  }, [stopAudioCapture, submitRecording]);

  // ── Begin conversation ─────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const epoch = ++sessionEpochRef.current;
    stopGtmAudio();
    stopAudioCapture();
    setConvState('ai-speaking');

    // 1. Welcome
    const welcomeText = buildWelcome(clientName, lensLabels);
    try { await speakGtm(welcomeText, token); } catch { /* continue */ }
    if (epoch !== sessionEpochRef.current) return;

    // 2. First question (already in initialMessages)
    const firstAi = initialMessages.find(m => m.role === 'AI');
    if (firstAi) {
      setCurrentQuestion(firstAi.content);
      setCurrentMeta(isQuestionMeta(firstAi.metadata) ? firstAi.metadata : null);
      try { await speakGtm(firstAi.content, token); } catch { /* continue */ }
      if (epoch !== sessionEpochRef.current) return;
    }

    // 3. Start listening
    void startListening(epoch);
  }, [clientName, lensLabels, token, initialMessages, stopAudioCapture, startListening]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      sessionEpochRef.current = -1;
      stopGtmAudio();
      stopAudioCapture();
    };
  }, [stopAudioCapture]);

  const accent = primaryColor || '#1E3A5F';
  const normalizedPhase = normalizeConversationPhase(currentPhase);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Main area */}
      <div className="flex flex-col flex-1 lg:mr-80 min-w-0">

        {/* Header */}
        <div className="flex-shrink-0 border-b bg-white px-6 py-3 flex items-center gap-3">
          {logoUrl && (
            <Image src={logoUrl} alt={organizationName || 'Logo'} width={120} height={32} className="h-8 w-auto" priority />
          )}
          {!logoUrl && organizationName && (
            <span className="text-sm font-medium text-slate-700">{organizationName}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6 overflow-y-auto">

          {convState === 'idle' ? (
            // ── Landing ───────────────────────────────────────────────────
            <div className="flex flex-col items-center gap-8 text-center max-w-lg w-full">
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 mb-2">Discovery Conversation</h1>
                <p className="text-slate-500 text-sm leading-relaxed">
                  A relaxed, natural conversation about your go-to-market reality.
                  You can respond by speaking or typing — whichever feels easier.
                </p>
              </div>
              <Orb state="idle" energyLevel={0} />
              <button
                type="button"
                onClick={() => void handleStart()}
                className="px-10 py-4 rounded-xl text-white font-semibold text-base shadow-md hover:opacity-90 active:scale-95 transition-all"
                style={{ backgroundColor: accent }}
              >
                Begin Conversation
              </button>
              <p className="text-xs text-slate-400">
                Your microphone will be used to capture your voice responses.
              </p>
            </div>

          ) : convState === 'done' ? (
            // ── Done ──────────────────────────────────────────────────────
            <div className="flex flex-col items-center gap-6 text-center max-w-md">
              <Orb state="done" energyLevel={0} />
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">All done — thank you.</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Your responses have been captured and will shape the workshop session.
                </p>
              </div>
            </div>

          ) : (
            // ── Active conversation ────────────────────────────────────────
            <div className="flex flex-col items-center gap-6 w-full max-w-xl">

              {/* Current question */}
              {currentQuestion && (
                <div className="w-full rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Question</p>
                  <p className="text-slate-800 text-base leading-relaxed font-medium">
                    {currentQuestion}
                  </p>
                </div>
              )}

              {/* Orb + status */}
              <div className="flex flex-col items-center gap-3">
                <Orb state={convState} energyLevel={energyLevel} />
                <p className="text-sm text-slate-500 h-5 text-center">
                  {convState === 'ai-speaking'    ? 'Speaking…' :
                   convState === 'awaiting-speech' || convState === 'user-speaking' ? 'Listening…' :
                   convState === 'processing'     ? 'Just a moment…' : ''}
                </p>
                {errorMsg && (
                  <p className="text-xs text-amber-600 animate-pulse text-center">{errorMsg}</p>
                )}
              </div>

              {/* Triple-rating visual — always on screen */}
              {isTripleRating && currentMeta && (convState === 'awaiting-speech' || convState === 'user-speaking' || convState === 'processing' || convState === 'ai-speaking') && (
                <div className="w-full">
                  <TripleRatingInput
                    questionText={currentQuestion ?? ''}
                    maturityScale={currentMeta.maturityScale}
                    disabled={convState === 'processing' || convState === 'ai-speaking'}
                    onSubmit={(value) => {
                      stopAudioCapture();
                      const epoch = sessionEpochRef.current;
                      void sendMessage(value, epoch);
                    }}
                  />
                </div>
              )}

              {/* Text input — always available as fallback */}
              {!isTripleRating && convState !== 'processing' && convState !== 'ai-speaking' && (
                <div className="w-full flex gap-2">
                  <input
                    type="text"
                    value={textDraft}
                    onChange={e => setTextDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } }}
                    placeholder="Or type your response here…"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    type="button"
                    onClick={handleTextSubmit}
                    disabled={!textDraft.trim()}
                    className="px-4 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-40 transition-opacity"
                    style={{ backgroundColor: accent }}
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 py-3 text-center text-xs text-slate-400 border-t bg-white">
          © {organizationName || 'DREAM Discovery'}
        </div>
      </div>

      {/* Progress panel — reuses the existing ProgressIndicator */}
      {convState !== 'idle' && (
        <ProgressIndicator
          currentPhase={normalizedPhase}
          phaseProgress={phaseProgress}
          includeRegulation={false}
          lensLabels={lensLabels}
        />
      )}
    </div>
  );
}

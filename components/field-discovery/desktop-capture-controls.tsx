'use client';

// Web Speech API type declarations (not always included in TypeScript DOM types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionResultEvent = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionErrEvent = any;

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  Square,
  Pause,
  Play,
  Trash2,
  CheckCircle2,
  Radio,
  Loader2,
  AlertCircle,
  WifiOff,
  FileText,
} from 'lucide-react';
import { savePendingUpload, savePendingTextTranscript } from '@/lib/field-discovery/offline-store';
import { cleanTranscript } from '@/lib/captureapi/transcript-cleaner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecordingState = 'idle' | 'recording' | 'paused';

type SegmentData = {
  index: number;
  blob: Blob | null;
  startedAt: number;
  stoppedAt: number | null;
  transcript?: string;
  transcribing?: boolean;
  transcriptionError?: string;
};

type DesktopCaptureControlsProps = {
  sessionId: string;
  workshopId: string;
  /** When set, uses token-based routes. Segments fall back to IndexedDB when offline. */
  captureToken?: string;
  /** True when session was created locally offline — all segments go to IndexedDB. */
  isLocalSession?: boolean;
  onSegmentComplete?: (segmentIndex: number) => void;
  onSessionComplete?: (analysisResult?: unknown) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DesktopCaptureControls({
  sessionId,
  workshopId,
  captureToken,
  isLocalSession = false,
  onSegmentComplete,
  onSessionComplete,
}: DesktopCaptureControlsProps) {
  const [state, setState] = React.useState<RecordingState>('idle');
  const [segments, setSegments] = React.useState<SegmentData[]>([]);
  const [elapsed, setElapsed] = React.useState(0);
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [analysing, setAnalysing] = React.useState(false);
  const [analysisComplete, setAnalysisComplete] = React.useState(false);

  // Speech API state (used when isLocalSession && speechSupported)
  const [interimText, setInterimText] = React.useState('');
  const [segmentText, setSegmentText] = React.useState('');

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const segmentStartRef = React.useRef<number>(0);
  const pendingTranscriptionsRef = React.useRef<Set<number>>(new Set());
  const sessionFinishingRef = React.useRef(false);
  const segmentsRef = React.useRef<SegmentData[]>([]);

  // Speech API refs (stable across callbacks)
  const recognitionRef = React.useRef<SpeechRecognitionInstance>(null);
  const segmentTextRef = React.useRef('');
  const recordingStateRef = React.useRef<RecordingState>('idle');

  // Keep segmentsRef in sync with segments state
  React.useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Keep recordingStateRef in sync with state
  React.useEffect(() => {
    recordingStateRef.current = state;
  }, [state]);

  const currentSegmentIndex = segments.length;

  // Detect Web Speech API support
  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Use speech path when offline local session AND speech API is supported
  const useSpeechPath = isLocalSession && speechSupported;

  // -----------------------------------------------------------------------
  // Audio level monitoring
  // -----------------------------------------------------------------------

  const startLevelMonitoring = React.useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        // Normalise to 0-100 range
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(tick);
      }

      tick();
    } catch {
      // Audio level monitoring is non-critical
    }
  }, []);

  const stopLevelMonitoring = React.useCallback(() => {
    analyserRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // -----------------------------------------------------------------------
  // Timer
  // -----------------------------------------------------------------------

  const startTimer = React.useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Background transcription (online MediaRecorder path)
  // -----------------------------------------------------------------------

  // Build API base path depending on auth mode
  const analyseUrl = captureToken
    ? `/api/capture/${captureToken}/sessions/${sessionId}/analyse`
    : `/api/admin/workshops/${workshopId}/capture-sessions/${sessionId}/analyse`;

  const transcribeUrl = captureToken
    ? `/api/capture/${captureToken}/sessions/${sessionId}/segments/transcribe`
    : `/api/admin/workshops/${workshopId}/capture-sessions/${sessionId}/segments/transcribe`;

  const triggerAnalysis = React.useCallback(async () => {
    // Skip server analysis for local (offline) sessions — will run after sync
    if (isLocalSession) {
      onSessionComplete?.();
      return;
    }
    setAnalysing(true);
    try {
      const res = await fetch(analyseUrl, { method: 'POST' });
      let analysisResult: unknown = undefined;
      if (res.ok) {
        try {
          analysisResult = await res.json();
        } catch {
          // Response may not be JSON
        }
      }
      setAnalysing(false);
      setAnalysisComplete(true);
      setTimeout(() => {
        setAnalysisComplete(false);
        onSessionComplete?.(analysisResult);
      }, 1500);
    } catch {
      setAnalysing(false);
      onSessionComplete?.();
    }
  }, [analyseUrl, isLocalSession, onSessionComplete]);

  const checkAllTranscriptionsComplete = React.useCallback(() => {
    if (!sessionFinishingRef.current) return;
    if (pendingTranscriptionsRef.current.size === 0) {
      sessionFinishingRef.current = false;
      triggerAnalysis();
    }
  }, [triggerAnalysis]);

  const transcribeSegmentInBackground = React.useCallback(
    async (
      segmentIndex: number,
      blob: Blob,
      startedAt: number,
      stoppedAt: number
    ) => {
      pendingTranscriptionsRef.current.add(segmentIndex);

      // Mark segment as transcribing
      setSegments((prev) =>
        prev.map((seg) =>
          seg.index === segmentIndex ? { ...seg, transcribing: true } : seg
        )
      );

      // For local (offline) sessions, save to IndexedDB and treat as queued
      if (isLocalSession || !navigator.onLine) {
        await savePendingUpload(`${sessionId}-seg-${segmentIndex}`, blob, {
          sessionId,
          workshopId,
          segmentIndex,
          startedAt,
          stoppedAt,
        }).catch(() => { /* best effort */ });
        setSegments((prev) =>
          prev.map((seg) =>
            seg.index === segmentIndex
              ? { ...seg, transcribing: false, transcript: '(queued — will upload when online)' }
              : seg,
          ),
        );
        pendingTranscriptionsRef.current.delete(segmentIndex);
        checkAllTranscriptionsComplete();
        return;
      }

      try {
        const formData = new FormData();
        formData.append('audio', blob, `segment-${segmentIndex}.webm`);
        formData.append('segmentIndex', String(segmentIndex));
        formData.append('startedAt', new Date(startedAt).toISOString());
        formData.append('stoppedAt', new Date(stoppedAt).toISOString());

        const res = await fetch(transcribeUrl, { method: 'POST', body: formData });

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Transcription failed');
          setSegments((prev) =>
            prev.map((seg) =>
              seg.index === segmentIndex
                ? {
                    ...seg,
                    transcribing: false,
                    transcriptionError: errorText,
                  }
                : seg
            )
          );
        } else {
          let transcript = '';
          try {
            const data = await res.json();
            transcript = data.transcript || '';
          } catch {
            transcript = '';
          }
          setSegments((prev) =>
            prev.map((seg) =>
              seg.index === segmentIndex
                ? { ...seg, transcribing: false, transcript }
                : seg
            )
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Transcription request failed';
        setSegments((prev) =>
          prev.map((seg) =>
            seg.index === segmentIndex
              ? { ...seg, transcribing: false, transcriptionError: msg }
              : seg
          )
        );
      } finally {
        pendingTranscriptionsRef.current.delete(segmentIndex);
        checkAllTranscriptionsComplete();
      }
    },
    [transcribeUrl, isLocalSession, sessionId, workshopId, checkAllTranscriptionsComplete]
  );

  // -----------------------------------------------------------------------
  // Speech API helpers (offline path)
  // -----------------------------------------------------------------------

  const createRecognition = React.useCallback((): SpeechRecognitionInstance | null => {
    if (!speechSupported) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionClass = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return null;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    return recognition;
  }, [speechSupported]);

  const attachRecognitionHandlers = React.useCallback(
    (recognition: SpeechRecognitionInstance) => {
      recognition.onresult = (event: SpeechRecognitionResultEvent) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            segmentTextRef.current += (segmentTextRef.current ? ' ' : '') + result[0].transcript;
            setSegmentText(segmentTextRef.current);
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        setInterimText(interimTranscript);
      };

      recognition.onend = () => {
        // Auto-restart if still actively recording (handles iOS 60-second timeout)
        if (recordingStateRef.current === 'recording') {
          try {
            recognition.start();
          } catch {
            // Recognition may not be restartable in all browsers; ignore
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrEvent) => {
        // 'no-speech' and 'aborted' are expected — not real errors
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(`Speech recognition error: ${event.error}`);
        }
      };
    },
    []
  );

  // -----------------------------------------------------------------------
  // Recording controls — SPEECH PATH (isLocalSession && speechSupported)
  // -----------------------------------------------------------------------

  const startRecordingSpeech = React.useCallback(async () => {
    setError(null);
    const recognition = createRecognition();
    if (!recognition) {
      setError('Speech recognition not available');
      return;
    }
    attachRecognitionHandlers(recognition);
    recognitionRef.current = recognition;
    segmentTextRef.current = '';
    setSegmentText('');
    setInterimText('');
    segmentStartRef.current = Date.now();

    try {
      recognition.start();
      setState('recording');
      startTimer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start speech recognition';
      setError(msg);
    }
  }, [createRecognition, attachRecognitionHandlers, startTimer]);

  const stopSegmentSpeech = React.useCallback(async () => {
    if (!recognitionRef.current) return;

    // Stop recognition — don't auto-restart (onend will check recordingStateRef)
    setState('paused'); // pause first so onend doesn't restart
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;

    const rawText = segmentTextRef.current;
    const cleanedText = rawText.trim() ? cleanTranscript(rawText) : '';
    const segmentIndex = segmentsRef.current.length;
    const startedAt = segmentStartRef.current;
    const stoppedAt = Date.now();

    const segmentData: SegmentData = {
      index: segmentIndex,
      blob: null,
      startedAt,
      stoppedAt,
      transcript: cleanedText || '(no speech detected)',
    };
    setSegments((prev) => [...prev, segmentData]);
    stopTimer();
    setElapsed(0);

    // Save to IndexedDB
    if (cleanedText) {
      await savePendingTextTranscript(
        `${sessionId}-txt-${segmentIndex}`,
        cleanedText,
        { sessionId, workshopId, segmentIndex, startedAt, stoppedAt }
      ).catch(() => { /* best effort */ });
    }

    // Clear for next segment
    segmentTextRef.current = '';
    setSegmentText('');
    setInterimText('');

    onSegmentComplete?.(segmentIndex);

    // Restart recognition for next segment
    const nextRecognition = createRecognition();
    if (nextRecognition) {
      attachRecognitionHandlers(nextRecognition);
      recognitionRef.current = nextRecognition;
      segmentStartRef.current = Date.now();
      try {
        nextRecognition.start();
        setState('recording');
        startTimer();
      } catch {
        setState('idle');
      }
    } else {
      setState('idle');
    }
  }, [
    sessionId,
    workshopId,
    stopTimer,
    startTimer,
    onSegmentComplete,
    createRecognition,
    attachRecognitionHandlers,
  ]);

  const finishSessionSpeech = React.useCallback(async () => {
    setState('idle'); // stop onend from restarting
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    stopTimer();
    setElapsed(0);

    // Save any remaining accumulated text as a final segment
    const rawText = segmentTextRef.current;
    const cleanedText = rawText.trim() ? cleanTranscript(rawText) : '';
    if (cleanedText) {
      const segmentIndex = segmentsRef.current.length;
      const startedAt = segmentStartRef.current;
      const stoppedAt = Date.now();
      const segmentData: SegmentData = {
        index: segmentIndex,
        blob: null,
        startedAt,
        stoppedAt,
        transcript: cleanedText,
      };
      setSegments((prev) => [...prev, segmentData]);
      await savePendingTextTranscript(
        `${sessionId}-txt-${segmentIndex}`,
        cleanedText,
        { sessionId, workshopId, segmentIndex, startedAt, stoppedAt }
      ).catch(() => { /* best effort */ });
    }

    segmentTextRef.current = '';
    setSegmentText('');
    setInterimText('');

    // Complete immediately — analysis will happen server-side after sync
    onSessionComplete?.();
  }, [sessionId, workshopId, stopTimer, onSessionComplete]);

  // -----------------------------------------------------------------------
  // Recording controls — MEDIA RECORDER PATH (online or no speech support)
  // -----------------------------------------------------------------------

  const startRecording = React.useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      segmentStartRef.current = Date.now();

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(1000); // collect data every second
      setState('recording');
      startTimer();
      startLevelMonitoring(stream);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to access microphone';
      setError(msg);
    }
  }, [startTimer, startLevelMonitoring]);

  const pauseRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      stopTimer();
      stopLevelMonitoring();
    }
  }, [state, stopTimer, stopLevelMonitoring]);

  const resumeRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      // Resume timer from where it was
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      if (streamRef.current) {
        startLevelMonitoring(streamRef.current);
      }
    }
  }, [state, startLevelMonitoring]);

  const stopSegment = React.useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        const segmentIndex = currentSegmentIndex;
        const startedAt = segmentStartRef.current;
        const stoppedAt = Date.now();
        const segmentData: SegmentData = {
          index: segmentIndex,
          blob,
          startedAt,
          stoppedAt,
        };

        setSegments((prev) => [...prev, segmentData]);
        stopTimer();
        stopLevelMonitoring();
        setElapsed(0);
        chunksRef.current = [];

        // Transcribe in background (non-blocking)
        transcribeSegmentInBackground(segmentIndex, blob, startedAt, stoppedAt);

        onSegmentComplete?.(segmentIndex);

        // Re-start recording for the next segment
        chunksRef.current = [];
        segmentStartRef.current = Date.now();
        recorder.start(1000);
        setState('recording');
        timerRef.current = setInterval(() => {
          setElapsed((prev) => prev + 1);
        }, 1000);
        if (streamRef.current) {
          startLevelMonitoring(streamRef.current);
        }

        resolve();
      };

      recorder.stop();
    });
  }, [
    currentSegmentIndex,
    onSegmentComplete,
    stopTimer,
    stopLevelMonitoring,
    startLevelMonitoring,
    transcribeSegmentInBackground,
  ]);

  const finishSession = React.useCallback(() => {
    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        if (blob.size > 0) {
          const segmentIndex = currentSegmentIndex;
          const startedAt = segmentStartRef.current;
          const stoppedAt = Date.now();
          const segmentData: SegmentData = {
            index: segmentIndex,
            blob,
            startedAt,
            stoppedAt,
          };
          setSegments((prev) => [...prev, segmentData]);

          // Transcribe final segment in background
          transcribeSegmentInBackground(
            segmentIndex,
            blob,
            startedAt,
            stoppedAt
          );
        }

        // Release microphone
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;

        stopTimer();
        stopLevelMonitoring();
        setElapsed(0);
        setState('idle');
        chunksRef.current = [];

        // Mark session as finishing -- analysis will trigger once
        // all pending transcriptions complete
        sessionFinishingRef.current = true;

        // If there are no pending transcriptions (e.g. the final segment
        // had zero size and was not sent), trigger analysis immediately
        if (pendingTranscriptionsRef.current.size === 0) {
          sessionFinishingRef.current = false;
          // If there are any segments at all, run analysis; otherwise just complete
          if (segmentsRef.current.length > 0 || blob.size > 0) {
            triggerAnalysis();
          } else {
            onSessionComplete?.();
          }
        }
      };

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }
  }, [
    currentSegmentIndex,
    onSessionComplete,
    stopTimer,
    stopLevelMonitoring,
    transcribeSegmentInBackground,
    triggerAnalysis,
  ]);

  const discardLastSegment = React.useCallback(() => {
    setSegments((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopTimer();
      stopLevelMonitoring();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, [stopTimer, stopLevelMonitoring]);

  // -----------------------------------------------------------------------
  // Status indicator colours
  // -----------------------------------------------------------------------

  const statusColor =
    state === 'recording'
      ? 'bg-red-500'
      : state === 'paused'
        ? 'bg-amber-500'
        : 'bg-gray-400';

  const statusLabel =
    state === 'recording'
      ? 'Recording'
      : state === 'paused'
        ? 'Paused'
        : 'Idle';

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="size-5" />
          Capture Controls
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block size-3 rounded-full ${statusColor} ${
                state === 'recording' ? 'animate-pulse' : ''
              }`}
            />
            <span className="text-sm font-medium">{statusLabel}</span>
            {useSpeechPath && state !== 'idle' && (
              <Badge variant="secondary" className="text-xs">
                <FileText className="mr-1 size-3" />
                Speech-to-text
              </Badge>
            )}
          </div>

          <span className="font-mono text-2xl tabular-nums tracking-wider">
            {formatDuration(elapsed)}
          </span>
        </div>

        {/* Live transcript preview (speech path) OR audio level bar (media recorder path) */}
        {useSpeechPath ? (
          state !== 'idle' && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Live Transcript</span>
              <div className="min-h-[3rem] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed">
                {segmentText && (
                  <span className="text-gray-900">{segmentText} </span>
                )}
                {interimText && (
                  <span className="italic text-gray-400">{interimText}</span>
                )}
                {!segmentText && !interimText && (
                  <span className="italic text-gray-400">Listening…</span>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Input Level</span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${audioLevel}%`,
                  backgroundColor:
                    audioLevel > 80
                      ? '#ef4444'
                      : audioLevel > 50
                        ? '#f59e0b'
                        : '#22c55e',
                }}
              />
            </div>
          </div>
        )}

        {/* Segment counter */}
        {(state !== 'idle' || segments.length > 0) && (
          <div className="flex items-center gap-2">
            <Radio className="text-muted-foreground size-4" />
            <span className="text-sm">
              Segment {currentSegmentIndex + (state !== 'idle' ? 1 : 0)} of
              current session
            </span>
            {segments.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {segments.length} saved
              </Badge>
            )}
          </div>
        )}

        {/* Offline speech: no speech support warning */}
        {isLocalSession && !speechSupported && (
          <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
            <AlertCircle className="size-4 shrink-0" />
            Speech recognition not available — recording audio for later upload.
          </div>
        )}

        {/* Control buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {state === 'idle' && !analysing && !analysisComplete && (
            <Button
              onClick={useSpeechPath ? startRecordingSpeech : startRecording}
              className="gap-2"
            >
              <Mic className="size-4" />
              Start Recording
            </Button>
          )}

          {state === 'recording' && (
            <>
              {/* Pause only available for media recorder path */}
              {!useSpeechPath && (
                <Button
                  variant="outline"
                  onClick={pauseRecording}
                  className="gap-2"
                >
                  <Pause className="size-4" />
                  Pause
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={useSpeechPath ? stopSegmentSpeech : stopSegment}
                className="gap-2"
              >
                <Square className="size-4" />
                Stop Segment
              </Button>
            </>
          )}

          {state === 'paused' && !useSpeechPath && (
            <>
              <Button onClick={resumeRecording} className="gap-2">
                <Play className="size-4" />
                Resume
              </Button>
              <Button
                variant="secondary"
                onClick={stopSegment}
                className="gap-2"
              >
                <Square className="size-4" />
                Stop Segment
              </Button>
            </>
          )}

          {state !== 'idle' && (
            <Button
              variant="destructive"
              onClick={useSpeechPath ? finishSessionSpeech : finishSession}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              Finish Session
            </Button>
          )}

          {segments.length > 0 &&
            state === 'idle' &&
            !analysing &&
            !analysisComplete && (
              <Button
                variant="outline"
                onClick={discardLastSegment}
                className="gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="size-4" />
                Discard Last Segment
              </Button>
            )}
        </div>

        {/* Saved segments list */}
        {segments.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Saved Segments
            </span>
            <div className="flex flex-col gap-1">
              {segments.map((seg) => (
                <div
                  key={seg.index}
                  className="flex flex-col gap-1 rounded bg-gray-50 px-3 py-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      Segment {seg.index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {seg.transcribing && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 text-xs"
                        >
                          <Loader2 className="size-3 animate-spin" />
                          Transcribing...
                        </Badge>
                      )}
                      {seg.transcriptionError && (
                        <Badge
                          variant="destructive"
                          className="flex items-center gap-1 text-xs"
                        >
                          <AlertCircle className="size-3" />
                          Error
                        </Badge>
                      )}
                      {seg.transcript !== undefined &&
                        !seg.transcribing &&
                        !seg.transcriptionError && (
                          <CheckCircle2 className="size-3.5 text-green-600" />
                        )}
                      {seg.blob ? (
                        <span className="text-muted-foreground">
                          {`${(seg.blob.size / 1024).toFixed(0)} KB`}
                        </span>
                      ) : useSpeechPath ? (
                        <Badge variant="secondary" className="text-xs">
                          <FileText className="mr-1 size-3" />
                          text
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {seg.transcript && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {truncateText(seg.transcript, 150)}
                    </p>
                  )}
                  {seg.transcriptionError && (
                    <p className="text-xs leading-relaxed text-red-600">
                      {seg.transcriptionError}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis indicator */}
        {analysing && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex items-center gap-3 py-3">
              <Loader2 className="size-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                Extracting findings from transcripts...
              </span>
            </CardContent>
          </Card>
        )}

        {analysisComplete && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-3 py-3">
              <CheckCircle2 className="size-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                Analysis complete
              </span>
            </CardContent>
          </Card>
        )}

        {/* Offline / local session notice */}
        {isLocalSession && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            <WifiOff className="size-4 shrink-0" />
            {useSpeechPath
              ? 'Recording offline — transcript is saved locally and will sync when you reconnect.'
              : 'Recording offline — segments are saved locally and will upload when you\'re back online.'}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

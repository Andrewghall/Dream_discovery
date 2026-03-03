'use client';

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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecordingState = 'idle' | 'recording' | 'paused';

type SegmentData = {
  index: number;
  blob: Blob | null;
  startedAt: number;
  stoppedAt: number | null;
};

type DesktopCaptureControlsProps = {
  sessionId: string;
  workshopId: string;
  onSegmentComplete?: (segmentIndex: number) => void;
  onSessionComplete?: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DesktopCaptureControls({
  sessionId,
  workshopId,
  onSegmentComplete,
  onSessionComplete,
}: DesktopCaptureControlsProps) {
  const [state, setState] = React.useState<RecordingState>('idle');
  const [segments, setSegments] = React.useState<SegmentData[]>([]);
  const [elapsed, setElapsed] = React.useState(0);
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const segmentStartRef = React.useRef<number>(0);

  const currentSegmentIndex = segments.length;

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
  // Recording controls
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

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        const segmentIndex = currentSegmentIndex;
        const segmentData: SegmentData = {
          index: segmentIndex,
          blob,
          startedAt: segmentStartRef.current,
          stoppedAt: Date.now(),
        };

        setSegments((prev) => [...prev, segmentData]);
        stopTimer();
        stopLevelMonitoring();
        setElapsed(0);
        chunksRef.current = [];

        // POST segment metadata to API
        try {
          await fetch(
            `/api/admin/workshops/${workshopId}/capture-sessions/${sessionId}/segments`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                segmentIndex,
                startedAt: new Date(segmentData.startedAt).toISOString(),
                stoppedAt: new Date(segmentData.stoppedAt!).toISOString(),
                mimeType: recorder.mimeType,
                sizeBytes: blob.size,
              }),
            }
          );
        } catch {
          // Segment metadata upload failure is non-blocking
        }

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
    workshopId,
    sessionId,
    onSegmentComplete,
    stopTimer,
    stopLevelMonitoring,
    startLevelMonitoring,
  ]);

  const finishSession = React.useCallback(() => {
    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        if (blob.size > 0) {
          const segmentData: SegmentData = {
            index: currentSegmentIndex,
            blob,
            startedAt: segmentStartRef.current,
            stoppedAt: Date.now(),
          };
          setSegments((prev) => [...prev, segmentData]);

          try {
            await fetch(
              `/api/admin/workshops/${workshopId}/capture-sessions/${sessionId}/segments`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  segmentIndex: currentSegmentIndex,
                  startedAt: new Date(segmentData.startedAt).toISOString(),
                  stoppedAt: new Date(segmentData.stoppedAt!).toISOString(),
                  mimeType: recorder.mimeType,
                  sizeBytes: blob.size,
                }),
              }
            );
          } catch {
            // Non-blocking
          }
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

        onSessionComplete?.();
      };

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }
  }, [
    currentSegmentIndex,
    workshopId,
    sessionId,
    onSessionComplete,
    stopTimer,
    stopLevelMonitoring,
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
          </div>

          <span className="font-mono text-2xl tabular-nums tracking-wider">
            {formatDuration(elapsed)}
          </span>
        </div>

        {/* Audio level indicator */}
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

        {/* Control buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {state === 'idle' && (
            <Button onClick={startRecording} className="gap-2">
              <Mic className="size-4" />
              Start Recording
            </Button>
          )}

          {state === 'recording' && (
            <>
              <Button
                variant="outline"
                onClick={pauseRecording}
                className="gap-2"
              >
                <Pause className="size-4" />
                Pause
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

          {state === 'paused' && (
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
              onClick={finishSession}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              Finish Session
            </Button>
          )}

          {segments.length > 0 && state === 'idle' && (
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
                  className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-xs"
                >
                  <span>Segment {seg.index + 1}</span>
                  <span className="text-muted-foreground">
                    {seg.blob
                      ? `${(seg.blob.size / 1024).toFixed(0)} KB`
                      : '--'}
                  </span>
                </div>
              ))}
            </div>
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

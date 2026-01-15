'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NormalizedTranscriptChunk } from '@/lib/transcription/types';

type PageProps = {
  params: Promise<{ id: string }>;
};

type RealtimeEvent = {
  id: string;
  type: string;
  createdAt: number;
  payload: unknown;
};

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const v = value as { error?: unknown; detail?: unknown };
    const e = v.error;
    const d = v.detail;
    const eStr = typeof e === 'string' ? e : '';
    const dStr = typeof d === 'string' ? d : '';
    if (eStr && dStr) return `${eStr}: ${dStr}`;
    if (eStr) return eStr;
    if (dStr) return dStr;

    // Generic object error (e.g. Zoom SDK errors)
    try {
      return JSON.stringify(value);
    } catch {
      return 'Unknown error';
    }
  }
  return 'Unknown error';
}

export default function WorkshopLivePage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [consent, setConsent] = useState(false);

  const [status, setStatus] = useState<'idle' | 'capturing' | 'stopped' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [forwardedCount, setForwardedCount] = useState(0);
  const [debugTrace, setDebugTrace] = useState<string[]>([]);
  const [tabHiddenWarning, setTabHiddenWarning] = useState(false);

  const statusRef = useRef<'idle' | 'capturing' | 'stopped' | 'error'>('idle');

  const [micDialogOpen, setMicDialogOpen] = useState(false);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [micDevices, setMicDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [micLevel, setMicLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const captureStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderMimeTypeRef = useRef<string>('');
  const recorderGenerationRef = useRef(0);
  const captureT0Ref = useRef<number>(0);
  const queueRef = useRef<Array<{ blob: Blob; t: number }>>([]);
  const processingRef = useRef(false);
  const stopProcessingRef = useRef(false);
  const lastTranscriptionErrorRef = useRef<string>('');
  const lastEmptyDeepgramRef = useRef<string>('');
  const chunkIntervalRef = useRef<number | null>(null);
  const whisperDisabledRef = useRef(false);
  const watchdogIntervalRef = useRef<number | null>(null);
  const lastChunkAtRef = useRef<number>(0);
  const lastHealthyAtRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);

  const esRef = useRef<EventSource | null>(null);

  const eventUrl = useMemo(() => `/api/workshops/${encodeURIComponent(workshopId)}/events`, [workshopId]);
  const ingestUrl = useMemo(() => `/api/workshops/${encodeURIComponent(workshopId)}/transcript`, [workshopId]);
  const deepgramUrl = useMemo(
    () => `/api/workshops/${encodeURIComponent(workshopId)}/deepgram/transcribe`,
    [workshopId]
  );
  const whisperUrl = useMemo(() => `/api/transcribe`, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (watchdogIntervalRef.current) window.clearInterval(watchdogIntervalRef.current);
      } catch {
        // ignore
      }
      watchdogIntervalRef.current = null;

      try {
        if (chunkIntervalRef.current) window.clearInterval(chunkIntervalRef.current);
      } catch {
        // ignore
      }
      chunkIntervalRef.current = null;

      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      recorderRef.current = null;

      try {
        captureStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      captureStreamRef.current = null;

      try {
        esRef.current?.close();
      } catch {
        // ignore
      }
      esRef.current = null;
    };

    try {
      window.addEventListener('beforeunload', handleBeforeUnload);
    } catch {
      // ignore
    }

    return () => {
      try {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      } catch {
        // ignore
      }

      try {
        esRef.current?.close();
      } catch {
        // ignore
      }
      esRef.current = null;

      try {
        if (watchdogIntervalRef.current) window.clearInterval(watchdogIntervalRef.current);
      } catch {
        // ignore
      }
      watchdogIntervalRef.current = null;

      try {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } catch {
        // ignore
      }
      rafRef.current = null;

      try {
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      micStreamRef.current = null;

      try {
        audioContextRef.current?.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
      analyserRef.current = null;

      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      recorderRef.current = null;

      try {
        if (chunkIntervalRef.current) window.clearInterval(chunkIntervalRef.current);
      } catch {
        // ignore
      }
      chunkIntervalRef.current = null;

      try {
        captureStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      captureStreamRef.current = null;

      try {
        void wakeLockRef.current?.release?.();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      const hidden = typeof document !== 'undefined' ? document.hidden : false;
      setTabHiddenWarning(Boolean(hidden));
      if (hidden && statusRef.current === 'capturing') {
        setDebugTrace((t) => [...t, 'Warning: tab is hidden; background throttling may reduce capture quality.']);
      }
      if (!hidden && statusRef.current === 'capturing') {
        void requestWakeLock();
      }
    };

    try {
      document.addEventListener('visibilitychange', onVisibilityChange);
    } catch {
      // ignore
    }

    onVisibilityChange();

    return () => {
      try {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      } catch {
        // ignore
      }
    };
  }, []);

  const requestWakeLock = async () => {
    try {
      if (typeof navigator === 'undefined') return;
      if (!('wakeLock' in navigator)) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        await wakeLockRef.current?.release?.();
      } catch {
        // ignore
      }
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
    } catch {
      // ignore
    }
  };

  const processQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (!stopProcessingRef.current) {
        const item = queueRef.current.shift();
        if (!item) break;
        await transcribeAndForward(item.blob, item.t);
      }
    } finally {
      processingRef.current = false;
    }
  };

  const transcribeAndForward = async (blob: Blob, t: number) => {
    const asFile = new File([blob], 'chunk', { type: blob.type || 'application/octet-stream' });

    let text = '';
    let confidence: number | null = null;
    let source: NormalizedTranscriptChunk['source'] = 'deepgram';
    let dgErr: string | null = null;
    let wErr: string | null = null;

    try {
      const fd = new FormData();
      fd.append('audio', asFile);
      const dgRes = await fetch(deepgramUrl, { method: 'POST', body: fd });
      const dgPayload = (await dgRes.json().catch(() => ({}))) as {
        text?: string;
        confidence?: number | null;
        error?: unknown;
        detail?: unknown;
      };
      if (dgRes.ok && dgPayload?.text) {
        text = String(dgPayload.text).trim();
        confidence = typeof dgPayload.confidence === 'number' ? dgPayload.confidence : null;
        source = 'deepgram';
      } else if (!dgRes.ok) {
        dgErr = errorMessage(dgPayload) || `Deepgram failed (${dgRes.status})`;
      }
    } catch {
      dgErr = 'Deepgram request failed';
    }

    if (!text && !dgErr) {
      const msg = 'Deepgram returned empty transcript (likely silence / low audio)';
      if (msg !== lastEmptyDeepgramRef.current) {
        lastEmptyDeepgramRef.current = msg;
        setDebugTrace((t) => [...t, msg]);
      }
      return;
    }

    if (!text && dgErr) {
      if (whisperDisabledRef.current) {
        wErr = 'Whisper disabled (previous OpenAI 401)';
      } else {
        try {
          const fd = new FormData();
          fd.append('audio', asFile);
          const wRes = await fetch(whisperUrl, { method: 'POST', body: fd });
          const wPayload = (await wRes.json().catch(() => ({}))) as { text?: string; error?: unknown; detail?: unknown };
          if (wRes.ok && wPayload?.text) {
            text = String(wPayload.text).trim();
            confidence = null;
            source = 'whisper';
          } else if (!wRes.ok) {
            wErr = errorMessage(wPayload) || `Whisper failed (${wRes.status})`;
            if (wRes.status === 401) {
              whisperDisabledRef.current = true;
              setDebugTrace((t) => [...t, 'Whisper disabled due to OpenAI 401 (invalid API key)']);
            }
          }
        } catch {
          wErr = 'Whisper request failed';
        }
      }
    }

    if (!text) {
      const msg = `Transcription failed (Deepgram: ${dgErr || 'no transcript'}; Whisper: ${wErr || 'no transcript'})`;
      if (msg !== lastTranscriptionErrorRef.current) {
        lastTranscriptionErrorRef.current = msg;
        setError(msg);
        setDebugTrace((t) => [...t, msg]);
      }
      return;
    }

    if (lastTranscriptionErrorRef.current) {
      lastTranscriptionErrorRef.current = '';
      setError(null);
    }

    const chunk: NormalizedTranscriptChunk = {
      speakerId: null,
      startTime: t,
      endTime: t,
      text,
      confidence,
      source,
    };

    lastHealthyAtRef.current = Date.now();

    try {
      const r = await fetch(ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (r.ok) {
        setForwardedCount((n) => n + 1);
        lastHealthyAtRef.current = Date.now();
      }
    } catch {
      // ignore
    }
  };

  const startRecorderOnCurrentStream = (mimeType: string) => {
    const stream = captureStreamRef.current;
    if (!stream) throw new Error('No capture stream');

    recorderGenerationRef.current += 1;
    const gen = recorderGenerationRef.current;

    try {
      if (chunkIntervalRef.current) window.clearInterval(chunkIntervalRef.current);
    } catch {
      // ignore
    }
    chunkIntervalRef.current = null;

    try {
      const prev = recorderRef.current;
      if (prev && prev.state === 'recording') prev.stop();
    } catch {
      // ignore
    }
    recorderRef.current = null;

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      const blob = e.data;
      if (!blob || blob.size < 1000) return;
      lastChunkAtRef.current = Date.now();

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const t = Math.max(0, Math.round(now - captureT0Ref.current));
      queueRef.current.push({ blob, t });
      void processQueue();
    };

    recorder.onerror = () => {
      setStatus('error');
      setError('Audio recorder error');
    };

    const attachAndStartRecorder = (r: MediaRecorder) => {
      r.ondataavailable = recorder.ondataavailable;
      r.onerror = recorder.onerror;
      r.onstop = () => {
        if (stopProcessingRef.current) return;
        if (gen !== recorderGenerationRef.current) return;
        if (!captureStreamRef.current) return;
        try {
          const mt = recorderMimeTypeRef.current;
          const next = new MediaRecorder(captureStreamRef.current, mt ? { mimeType: mt } : undefined);
          recorderRef.current = next;
          attachAndStartRecorder(next);
        } catch {
          // ignore
        }
      };

      r.start();
    };

    attachAndStartRecorder(recorder);

    const chunkMs = 10_000;
    chunkIntervalRef.current = window.setInterval(() => {
      try {
        const r = recorderRef.current;
        if (r && r.state === 'recording') r.stop();
      } catch {
        // ignore
      }
    }, chunkMs);
  };

  const forceRestartRecorder = () => {
    try {
      recorderGenerationRef.current += 1;
      const mt = recorderMimeTypeRef.current;
      startRecorderOnCurrentStream(mt);
      setDebugTrace((t) => [...t, 'Recorder restarted (watchdog)']);
    } catch {
      setDebugTrace((t) => [...t, 'Recorder restart failed']);
    }
  };

  const refreshMicDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }));
    setMicDevices(mics);
    if (!selectedMicId && mics.length > 0) setSelectedMicId(mics[0].deviceId);
  };

  const stopMicTest = async () => {
    setMicTesting(false);
    setMicLevel(0);

    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } catch {
      // ignore
    }
    rafRef.current = null;

    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    micStreamRef.current = null;

    try {
      await audioContextRef.current?.close();
    } catch {
      // ignore
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const startMicTest = async () => {
    setError(null);
    setMicTesting(true);

    try {
      await stopMicTest();

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
        const scaled = Math.min(1, rms * 2.5);
        setMicLevel(scaled);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setMicTesting(false);
      setMicPermission('denied');
      setError(`Microphone access failed: ${errorMessage(e)}`);
      await stopMicTest();
    }
  };

  const appendEvent = (evt: RealtimeEvent) => {
    setEvents((prev) => {
      const next = [...prev, evt];
      return next.slice(-200);
    });
  };

  const startSse = () => {
    try {
      esRef.current?.close();
    } catch {
      // ignore
    }

    const es = new EventSource(eventUrl);
    esRef.current = es;

    es.addEventListener('datapoint.created', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        appendEvent(evt);
      } catch {
        // ignore
      }
    });

    es.addEventListener('classification.updated', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        appendEvent(evt);
      } catch {
        // ignore
      }
    });

    es.addEventListener('open', () => {
      // ignore
    });

    es.onerror = () => {
      // keep trying; browser auto-reconnects
    };
  };

  const startCapture = async () => {
    setError(null);
    setDebugTrace([]);

    if (!consent) {
      setError('Consent is required to start/join the live session.');
      return;
    }

    if (micPermission !== 'granted') {
      setError('Please run the microphone check before joining.');
      setMicDialogOpen(true);
      return;
    }

    setStatus('capturing');
    stopProcessingRef.current = false;
    queueRef.current = [];
    whisperDisabledRef.current = false;
    lastChunkAtRef.current = Date.now();
    lastHealthyAtRef.current = Date.now();

    try {
      setDebugTrace((t) => [
        ...t,
        `Env: protocol=${typeof window !== 'undefined' ? window.location.protocol : 'n/a'} online=${
          typeof navigator !== 'undefined' ? String(navigator.onLine) : 'n/a'
        }`,
      ]);

      setDebugTrace((t) => [
        ...t,
        `Env: host=${typeof window !== 'undefined' ? window.location.host : 'n/a'} secureContext=${
          typeof window !== 'undefined' ? String(window.isSecureContext) : 'n/a'
        }`,
      ]);

      // 1) Start SSE first so we can see events immediately
      setDebugTrace((t) => [...t, 'Starting SSE…']);
      startSse();
      setDebugTrace((t) => [...t, 'SSE started']);

      void requestWakeLock();

      // 2) Start capture
      setDebugTrace((t) => [...t, 'Requesting microphone for capture…']);
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
      captureT0Ref.current = typeof performance !== 'undefined' ? performance.now() : Date.now();

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const mimeType = preferredTypes.find((t) => {
        try {
          return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t);
        } catch {
          return false;
        }
      });

      recorderMimeTypeRef.current = mimeType || '';
      startRecorderOnCurrentStream(recorderMimeTypeRef.current);

      try {
        if (watchdogIntervalRef.current) window.clearInterval(watchdogIntervalRef.current);
      } catch {
        // ignore
      }
      watchdogIntervalRef.current = window.setInterval(() => {
        try {
          if (statusRef.current !== 'capturing') return;
          const now = Date.now();
          const stalledChunks = lastChunkAtRef.current && now - lastChunkAtRef.current > 25_000;
          const stalledHealth = lastHealthyAtRef.current && now - lastHealthyAtRef.current > 70_000;
          if (stalledChunks || stalledHealth) {
            forceRestartRecorder();
            lastChunkAtRef.current = now;
            lastHealthyAtRef.current = now;
          }
        } catch {
          // ignore
        }
      }, 10_000);

      setDebugTrace((t) => [...t, `Capture started (${recorderMimeTypeRef.current || 'default'})`]);
    } catch (e) {
      setStatus('error');
      setError(errorMessage(e));
    }
  };

  const stopCapture = async () => {
    stopProcessingRef.current = true;
    queueRef.current = [];

    try {
      if (watchdogIntervalRef.current) window.clearInterval(watchdogIntervalRef.current);
    } catch {
      // ignore
    }
    watchdogIntervalRef.current = null;

    try {
      if (chunkIntervalRef.current) window.clearInterval(chunkIntervalRef.current);
    } catch {
      // ignore
    }
    chunkIntervalRef.current = null;

    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
    recorderRef.current = null;

    try {
      captureStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    captureStreamRef.current = null;

    try {
      esRef.current?.close();
    } catch {
      // ignore
    }
    esRef.current = null;

    try {
      await wakeLockRef.current?.release?.();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;

    setStatus('stopped');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
        {status === 'capturing' && tabHiddenWarning && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle>Recording warning</CardTitle>
              <CardDescription>
                This tab is hidden. Browsers may throttle background tabs which can reduce capture quality. Keep this tab in the foreground.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Workshop Live (MVP)</h1>
            <p className="text-sm text-muted-foreground">
              Captures room audio and transcribes live → DataPoints
            </p>
          </div>
          <Link href={`/admin/workshops/${workshopId}`}>
            <Button variant="outline">Back to Workshop</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consent</CardTitle>
            <CardDescription>
              This workshop is transcribed and analysed live to generate insights and reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              I consent to transcription and analysis
            </label>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Capture</CardTitle>
              <CardDescription>Start capture to transcribe room audio in real time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog open={micDialogOpen} onOpenChange={(open) => {
                setMicDialogOpen(open);
                if (!open) {
                  void stopMicTest();
                }
              }}>
                <DialogTrigger asChild>
                  <Button type="button" variant={micPermission === 'granted' ? 'outline' : 'default'}>
                    {micPermission === 'granted' ? 'Microphone checked' : 'Microphone check'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Microphone check</DialogTitle>
                    <DialogDescription>
                      Grant microphone permission and confirm audio input is working before going live.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Input device</Label>
                      <Select
                        value={selectedMicId}
                        onValueChange={(v) => {
                          setSelectedMicId(v);
                          void stopMicTest();
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select microphone" />
                        </SelectTrigger>
                        <SelectContent>
                          {micDevices.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              No devices found
                            </SelectItem>
                          ) : (
                            micDevices.map((d) => (
                              <SelectItem key={d.deviceId} value={d.deviceId}>
                                {d.label}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground">
                        Permission: {micPermission}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Level</Label>
                      <div className="h-3 w-full rounded bg-muted overflow-hidden">
                        <div
                          className="h-full bg-green-600 transition-[width]"
                          style={{ width: `${Math.round(micLevel * 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">Speak and watch the bar move.</div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void refreshMicDevices();
                      }}
                    >
                      Refresh devices
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void stopMicTest();
                      }}
                      disabled={!micTesting}
                    >
                      Stop
                    </Button>
                    <Button type="button" onClick={() => void startMicTest()}>
                      {micTesting ? 'Testing…' : 'Start test'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setMicDialogOpen(false);
                      }}
                      disabled={micPermission !== 'granted'}
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="flex gap-2">
                <Button onClick={startCapture} disabled={status === 'capturing'}>
                  {status === 'capturing' ? 'Capturing…' : 'Start Capture'}
                </Button>
                <Button variant="outline" onClick={stopCapture} disabled={status !== 'capturing'}>
                  Stop Capture
                </Button>
              </div>

              {status === 'capturing' ? (
                <div className="text-sm font-medium">Live session is capturing room audio</div>
              ) : null}

              <div className="text-xs text-muted-foreground">
                <div>Status: {status}</div>
                <div>Forwarded transcript chunks: {forwardedCount}</div>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              {debugTrace.length > 0 ? (
                <div className="rounded-md border bg-muted/10 p-3">
                  <div className="text-xs font-medium mb-2">Debug trace</div>
                  <pre className="text-xs whitespace-pre-wrap break-words">{debugTrace.join('\n')}</pre>
                </div>
              ) : null}

            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Realtime events</CardTitle>
              <CardDescription>
                Listening to {eventUrl} (SSE). Expect nodes within seconds as people speak.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[420px] overflow-auto border rounded-md p-3 bg-muted/20">
                {events.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No events yet.</div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {events
                      .slice()
                      .reverse()
                      .map((evt) => (
                        <div key={evt.id} className="border-b pb-2">
                          <div className="font-medium">{evt.type}</div>
                          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(evt.payload, null, 2)}</pre>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

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
import {
  HemisphereNodes,
  type HemisphereDialoguePhase,
  type HemisphereNodeDatum,
  type HemispherePrimaryType,
} from '@/components/live/hemisphere-nodes';

type PageProps = {
  params: Promise<{ id: string }>;
};

type RealtimeEvent = {
  id: string;
  type: string;
  createdAt: number;
  payload: unknown;
};

type DataPointCreatedPayload = {
  dataPoint: {
    id: string;
    rawText: string;
    source: string;
    createdAt: string | Date;
    dialoguePhase?: HemisphereDialoguePhase | null;
  };
  transcriptChunk?: {
    startTimeMs: number;
    endTimeMs: number;
    confidence: number | null;
    source: string;
  };
};

type ClassificationUpdatedPayload = {
  dataPointId: string;
  classification: {
    primaryType: HemispherePrimaryType;
    confidence: number;
    keywords: string[];
    suggestedArea: string | null;
    updatedAt: string;
  };
};

type AnnotationUpdatedPayload = {
  dataPointId: string;
  annotation: {
    dialoguePhase?: HemisphereDialoguePhase | null;
    intent?: string | null;
    updatedAt: string | Date;
  };
};

type ReimagineSummaryContent = {
  generatedAt: string;
  organisationTheyDescribed: {
    People: { futureState: string; wantsToBeAbleToDo: string[]; believesMustChange: string[] };
    Organisation: { futureState: string; wantsToBeAbleToDo: string[]; believesMustChange: string[] };
    Technology: { futureState: string; wantsToBeAbleToDo: string[]; believesMustChange: string[] };
    Customer: { futureState: string; wantsToBeAbleToDo: string[]; believesMustChange: string[] };
    Regulation: { futureState: string; wantsToBeAbleToDo: string[]; believesMustChange: string[] };
  };
  keyPressurePoints: string[];
  dependencyMap: string[];
};

function normalizeContentType(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const semi = raw.indexOf(';');
  if (semi >= 0) return raw.slice(0, semi).trim();
  return raw;
}

function extensionForContentType(contentType: string): string {
  const t = normalizeContentType(contentType);
  if (t === 'audio/webm') return 'webm';
  if (t === 'audio/wav') return 'wav';
  if (t === 'audio/ogg' || t === 'audio/oga') return 'ogg';
  if (t === 'audio/mpeg') return 'mp3';
  if (t === 'audio/mp4') return 'm4a';
  return 'webm';
}

async function sniffAudioContainer(blob: Blob): Promise<{
  headerHex: string;
  detectedType: string | null;
  detectedExt: string | null;
}> {
  try {
    const buf = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const headerHex = Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const ascii4 = (i: number) =>
      String.fromCharCode(buf[i] || 0, buf[i + 1] || 0, buf[i + 2] || 0, buf[i + 3] || 0);

    // WAV: "RIFF....WAVE"
    if (ascii4(0) === 'RIFF' && ascii4(8) === 'WAVE') {
      return { headerHex, detectedType: 'audio/wav', detectedExt: 'wav' };
    }

    // OGG: "OggS"
    if (ascii4(0) === 'OggS') {
      return { headerHex, detectedType: 'audio/ogg', detectedExt: 'ogg' };
    }

    // MP4/M4A: box header then "ftyp" at offset 4
    if (ascii4(4) === 'ftyp') {
      return { headerHex, detectedType: 'audio/mp4', detectedExt: 'm4a' };
    }

    // WebM/Matroska: EBML header 1A45DFA3
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      return { headerHex, detectedType: 'audio/webm', detectedExt: 'webm' };
    }

    return { headerHex, detectedType: null, detectedExt: null };
  } catch {
    return { headerHex: '', detectedType: null, detectedExt: null };
  }
}

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
  const [forwardedCount, setForwardedCount] = useState(0);
  const [debugTrace, setDebugTrace] = useState<string[]>([]);
  const [tabHiddenWarning, setTabHiddenWarning] = useState(false);

  const [reimagineLoading, setReimagineLoading] = useState(false);
  const [reimagineError, setReimagineError] = useState<string | null>(null);
  const [reimagineSummary, setReimagineSummary] = useState<ReimagineSummaryContent | null>(null);

  const [nodesById, setNodesById] = useState<Record<string, HemisphereNodeDatum>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'room' | 'facilitator' | 'split'>('split');
  const [dialoguePhase, setDialoguePhase] = useState<HemisphereDialoguePhase>('REIMAGINE');

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
  const queueRef = useRef<Array<{ blob: Blob; startTime: number; endTime: number }>>([]);
  const processingRef = useRef(false);
  const stopProcessingRef = useRef(false);
  const lastTranscriptionErrorRef = useRef<string>('');
  const lastEmptyDeepgramRef = useRef<string>('');
  const chunkIntervalRef = useRef<number | null>(null);
  const lastChunkEndRef = useRef<number>(0);
  const whisperDisabledRef = useRef(false);
  const watchdogIntervalRef = useRef<number | null>(null);
  const lastChunkAtRef = useRef<number>(0);
  const lastHealthyAtRef = useRef<number>(0);
  const wakeLockRef = useRef<null | { release?: () => Promise<void> }>(null);

  const esRef = useRef<EventSource | null>(null);

  const pendingPhaseByKeyRef = useRef<Map<string, HemisphereDialoguePhase>>(new Map());

  const safePhase = (v: unknown): HemisphereDialoguePhase | null => {
    if (v == null) return null;
    const s = String(v).trim().toUpperCase();
    if (s === 'REIMAGINE') return 'REIMAGINE';
    if (s === 'CONSTRAINTS') return 'CONSTRAINTS';
    if (s === 'DEFINE_APPROACH') return 'DEFINE_APPROACH';
    return null;
  };

  const phaseKey = (p: {
    startTimeMs: number;
    endTimeMs: number;
    text: string;
    source: string;
  }) => `${p.startTimeMs}:${p.endTimeMs}:${p.source}:${p.text}`;

  const nodes = useMemo(() => {
    const arr = Object.values(nodesById);
    arr.sort((a, b) => a.createdAtMs - b.createdAtMs);
    return arr;
  }, [nodesById]);

  const originTimeMs = useMemo(() => (nodes.length ? nodes[0].createdAtMs : null), [nodes]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodesById[selectedNodeId] ?? null : null),
    [nodesById, selectedNodeId]
  );

  const workboard = useMemo(() => {
    const byType: Record<string, number> = {};
    let unclassified = 0;

    for (const n of nodes) {
      const t = n.classification?.primaryType;
      if (!t) {
        unclassified += 1;
      } else {
        byType[t] = (byType[t] || 0) + 1;
      }
    }

    const recent = nodes.slice(-6).reverse();
    const last = nodes.length ? nodes[nodes.length - 1] : null;

    return {
      total: nodes.length,
      unclassified,
      byType,
      recent,
      lastAtMs: last?.createdAtMs ?? null,
    };
  }, [nodes]);

  const phaseLabel = useMemo(() => {
    switch (dialoguePhase) {
      case 'REIMAGINE':
        return 'Reimagine';
      case 'CONSTRAINTS':
        return 'Constraints';
      case 'DEFINE_APPROACH':
        return 'Define approach';
      default:
        return 'Reimagine';
    }
  }, [dialoguePhase]);

  const eventUrl = useMemo(() => `/api/workshops/${encodeURIComponent(workshopId)}/events`, [workshopId]);
  const ingestUrl = useMemo(() => `/api/workshops/${encodeURIComponent(workshopId)}/transcript`, [workshopId]);
  const deepgramUrl = useMemo(
    () => `/api/workshops/${encodeURIComponent(workshopId)}/deepgram/transcribe`,
    [workshopId]
  );
  const whisperUrl = useMemo(() => `/api/transcribe`, []);
  const reimagineSummaryUrl = useMemo(
    () => `/api/admin/workshops/${encodeURIComponent(workshopId)}/reimagine/summary`,
    [workshopId]
  );

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
      const nav = navigator as unknown as {
        wakeLock?: {
          request: (type: 'screen') => Promise<{ release?: () => Promise<void> }>;
        };
      };
      if (!nav.wakeLock) return;
      wakeLockRef.current = await nav.wakeLock.request('screen');
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
        await transcribeAndForward(item.blob, item.startTime, item.endTime);
      }
    } finally {
      processingRef.current = false;
    }
  };

  const CHUNK_MS = 15_000;

  const transcribeAndForward = async (blob: Blob, startTime: number, endTime: number) => {
    const sniffed = await sniffAudioContainer(blob);
    const normalizedType =
      normalizeContentType(sniffed.detectedType) ||
      normalizeContentType(blob.type) ||
      normalizeContentType(recorderMimeTypeRef.current) ||
      'audio/webm';
    const ext = sniffed.detectedExt || extensionForContentType(normalizedType);
    const filename = `chunk_${startTime}_${endTime}.${ext}`;
    const asFile = new File([blob], filename, { type: normalizedType });

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
      dgErr = msg;
      if (msg !== lastEmptyDeepgramRef.current) {
        lastEmptyDeepgramRef.current = msg;
        setDebugTrace((t) => [...t, msg]);
      }
    }

    if (!text && dgErr) {
      if (whisperDisabledRef.current) {
        wErr = 'Whisper disabled (previous OpenAI 401)';
      } else {
        if (asFile.size < 3000) {
          return;
        }
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
        setDebugTrace((t) => [
          ...t,
          msg,
          `Chunk debug: blobType=${blob.type || 'n/a'} recorderType=${recorderMimeTypeRef.current || 'n/a'} chosenType=${normalizedType} filename=${filename} size=${asFile.size} headerHex=${sniffed.headerHex || 'n/a'}`,
        ]);
      }
      return;
    }

    if (lastTranscriptionErrorRef.current) {
      lastTranscriptionErrorRef.current = '';
      setError(null);
    }

    const startTimeMs = startTime;
    const endTimeMs = endTime;

    pendingPhaseByKeyRef.current.set(
      phaseKey({ startTimeMs, endTimeMs, text, source }),
      dialoguePhase
    );
    if (pendingPhaseByKeyRef.current.size > 500) {
      const first = pendingPhaseByKeyRef.current.keys().next().value as string | undefined;
      if (first) pendingPhaseByKeyRef.current.delete(first);
    }

    const chunk: NormalizedTranscriptChunk = {
      speakerId: null,
      startTime,
      endTime,
      text,
      confidence,
      source,
    };

    lastHealthyAtRef.current = Date.now();

    try {
      const r = await fetch(ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...chunk, dialoguePhase }),
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
      const endTime = Math.max(0, Math.round(now - captureT0Ref.current));
      const startTime = Math.max(lastChunkEndRef.current, Math.max(0, endTime - CHUNK_MS));
      lastChunkEndRef.current = endTime;
      queueRef.current.push({ blob, startTime, endTime });
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

    chunkIntervalRef.current = window.setInterval(() => {
      try {
        const r = recorderRef.current;
        if (r && r.state === 'recording') r.stop();
      } catch {
        // ignore
      }
    }, CHUNK_MS);
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
    if (typeof navigator === 'undefined') return;
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError('Microphone devices are not supported in this browser.');
      return;
    }

    setError(null);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === 'audioinput' && typeof d.deviceId === 'string' && d.deviceId.trim())
        .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }));
      setMicDevices(mics);

      const stillValid = selectedMicId && mics.some((m) => m.deviceId === selectedMicId);
      if (!stillValid) {
        setSelectedMicId(mics.length > 0 ? mics[0].deviceId : '');
      }
    } catch (e) {
      setMicDevices([]);
      setSelectedMicId('');
      setError(`Microphone device refresh failed: ${errorMessage(e)}`);
    }
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
      try {
        await ctx.resume();
      } catch {}
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
        const p = evt.payload as DataPointCreatedPayload;
        const dataPointId = p?.dataPoint?.id;
        if (!dataPointId) return;
        const createdAtMs =
          typeof p.dataPoint.createdAt === 'string'
            ? Date.parse(p.dataPoint.createdAt)
            : p.dataPoint.createdAt instanceof Date
              ? p.dataPoint.createdAt.getTime()
              : Date.now();

        const phaseFromServer = safePhase((p.dataPoint as { dialoguePhase?: unknown } | undefined)?.dialoguePhase);
        const dpPhase =
          phaseFromServer ??
          (p.transcriptChunk
            ? (pendingPhaseByKeyRef.current.get(
                phaseKey({
                  startTimeMs: Number(p.transcriptChunk.startTimeMs ?? 0),
                  endTimeMs: Number(p.transcriptChunk.endTimeMs ?? 0),
                  text: String(p.dataPoint.rawText ?? ''),
                  source: String(p.transcriptChunk.source ?? ''),
                })
              ) ?? null)
            : null);

        const node: HemisphereNodeDatum = {
          dataPointId,
          createdAtMs,
          rawText: String(p.dataPoint.rawText ?? ''),
          dataPointSource: String(p.dataPoint.source ?? ''),
          dialoguePhase: dpPhase,
          transcriptChunk: p.transcriptChunk
            ? {
                startTimeMs: Number(p.transcriptChunk.startTimeMs ?? 0),
                endTimeMs: Number(p.transcriptChunk.endTimeMs ?? 0),
                confidence:
                  typeof p.transcriptChunk.confidence === 'number' ? p.transcriptChunk.confidence : null,
                source: String(p.transcriptChunk.source ?? ''),
              }
            : null,
          classification: null,
        };
        if (p.transcriptChunk) {
          pendingPhaseByKeyRef.current.delete(
            phaseKey({
              startTimeMs: Number(p.transcriptChunk.startTimeMs ?? 0),
              endTimeMs: Number(p.transcriptChunk.endTimeMs ?? 0),
              text: String(p.dataPoint.rawText ?? ''),
              source: String(p.transcriptChunk.source ?? ''),
            })
          );
        }
        setNodesById((prev) => {
          if (prev[dataPointId]) return prev;
          return { ...prev, [dataPointId]: node };
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener('classification.updated', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const p = evt.payload as ClassificationUpdatedPayload;
        const dataPointId = p?.dataPointId;
        if (!dataPointId) return;

        const cls = p.classification;
        setNodesById((prev) => {
          const existing = prev[dataPointId];
          if (!existing) return prev;
          return {
            ...prev,
            [dataPointId]: {
              ...existing,
              classification: {
                primaryType: cls.primaryType,
                confidence: cls.confidence,
                keywords: Array.isArray(cls.keywords) ? cls.keywords : [],
                suggestedArea: cls.suggestedArea ?? null,
                updatedAt: cls.updatedAt,
              },
            },
          };
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener('annotation.updated', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const p = evt.payload as AnnotationUpdatedPayload;
        const dataPointId = p?.dataPointId;
        if (!dataPointId) return;
        const intent = typeof p.annotation?.intent === 'string' ? p.annotation.intent.trim() : '';
        const phaseFromServer = safePhase((p.annotation as { dialoguePhase?: unknown } | undefined)?.dialoguePhase);

        setNodesById((prev) => {
          const existing = prev[dataPointId];
          if (!existing) return prev;

          const nextIntent = intent || null;
          const nextPhase = existing.dialoguePhase ?? phaseFromServer;

          if (existing.intent === nextIntent && existing.dialoguePhase === nextPhase) return prev;

          return {
            ...prev,
            [dataPointId]: {
              ...existing,
              intent: nextIntent,
              dialoguePhase: nextPhase,
            },
          };
        });
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
    lastChunkEndRef.current = 0;
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
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
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
          const stalledChunks = lastChunkAtRef.current && now - lastChunkAtRef.current > 40_000;
          const stalledHealth = lastHealthyAtRef.current && now - lastHealthyAtRef.current > 90_000;
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

  const generateReimagineSummary = async () => {
    setReimagineError(null);
    setReimagineLoading(true);
    try {
      const res = await fetch(reimagineSummaryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: unknown; content?: unknown };
      if (!res.ok || !json.ok) {
        setReimagineSummary(null);
        setReimagineError(typeof json.error === 'string' ? json.error : `Failed to generate summary (${res.status})`);
        return;
      }
      const content = json.content as ReimagineSummaryContent | null;
      if (!content || typeof content !== 'object') {
        setReimagineSummary(null);
        setReimagineError('Summary unavailable');
        return;
      }
      setReimagineSummary(content);
    } catch (e) {
      setReimagineSummary(null);
      setReimagineError(e instanceof Error ? e.message : 'Summary unavailable');
    } finally {
      setReimagineLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
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
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-md border bg-muted/20 p-1">
              <Button
                type="button"
                variant={dialoguePhase === 'REIMAGINE' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDialoguePhase('REIMAGINE')}
              >
                Reimagine
              </Button>
              <Button
                type="button"
                variant={dialoguePhase === 'CONSTRAINTS' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDialoguePhase('CONSTRAINTS')}
              >
                Constraints
              </Button>
              <Button
                type="button"
                variant={dialoguePhase === 'DEFINE_APPROACH' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDialoguePhase('DEFINE_APPROACH')}
              >
                Define approach
              </Button>
            </div>
            <div className="flex items-center gap-1 rounded-md border bg-muted/20 p-1">
              <Button
                type="button"
                variant={viewMode === 'room' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('room')}
              >
                Room
              </Button>
              <Button
                type="button"
                variant={viewMode === 'facilitator' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('facilitator')}
              >
                Facilitator
              </Button>
              <Button
                type="button"
                variant={viewMode === 'split' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('split')}
              >
                Split
              </Button>
            </div>
            <Link href={`/admin/workshops/${workshopId}`}>
              <Button variant="outline">Back to Workshop</Button>
            </Link>
          </div>
        </div>

        <div className="sm:hidden">
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            Phase: <span className="font-medium">{phaseLabel}</span>
          </div>
        </div>

        {viewMode === 'room' ? null : (
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
        )}

        <div
          className={
            viewMode === 'split'
              ? 'grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-4'
              : viewMode === 'facilitator'
                ? 'space-y-4'
                : 'space-y-4'
          }
        >
          {viewMode !== 'facilitator' ? (
            <Card>
              <CardHeader>
                <CardTitle>Hemisphere</CardTitle>
                {viewMode === 'room' ? null : (
                  <CardDescription>
                    Listening to {eventUrl} (SSE). New utterances appear immediately.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div
                  className={
                    viewMode === 'room'
                      ? 'h-[70vh] border rounded-md p-3 bg-muted/20'
                      : 'h-[520px] border rounded-md p-3 bg-muted/20'
                  }
                >
                  {nodes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No datapoints yet.</div>
                  ) : (
                    <HemisphereNodes
                      nodes={nodes}
                      originTimeMs={originTimeMs}
                      onNodeClick={(n) => setSelectedNodeId(n.dataPointId)}
                      className="h-full w-full"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {viewMode !== 'room' ? (
            <div className={viewMode === 'split' ? 'space-y-4' : 'space-y-4'}>
              <Card>
                <CardHeader>
                  <CardTitle>Capture</CardTitle>
                  <CardDescription>Start capture to transcribe room audio in real time</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Dialog
                    open={micDialogOpen}
                    onOpenChange={(open) => {
                      setMicDialogOpen(open);
                      if (!open) {
                        void stopMicTest();
                      }
                    }}
                  >
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
                          <div className="text-xs text-muted-foreground">Permission: {micPermission}</div>
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
                      Stop
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Workboard</CardTitle>
                  <CardDescription>{phaseLabel} • What’s happening in the room</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Utterances</div>
                      <div className="text-2xl font-bold">{workboard.total}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Unclassified</div>
                      <div className="text-2xl font-bold">{workboard.unclassified}</div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground mb-2">Types</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.keys(workboard.byType).length === 0 ? (
                        <div className="text-muted-foreground">No classifications yet.</div>
                      ) : (
                        Object.entries(workboard.byType)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between">
                              <div className="font-medium">{k}</div>
                              <div className="tabular-nums">{v}</div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground mb-2">Selected</div>
                    {selectedNode ? (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">
                          {selectedNode.classification?.primaryType ?? 'UNCLASSIFIED'}
                          {selectedNode.classification?.confidence != null
                            ? ` • ${(selectedNode.classification.confidence * 100).toFixed(0)}%`
                            : ''}
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">{selectedNode.rawText}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Click a node to select it.</div>
                    )}
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground mb-2">Recent</div>
                    <div className="space-y-2">
                      {workboard.recent.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No utterances yet.</div>
                      ) : (
                        workboard.recent.map((n) => (
                          <button
                            key={n.dataPointId}
                            type="button"
                            className="w-full text-left rounded-md border bg-background px-2 py-2 hover:bg-muted/40"
                            onClick={() => setSelectedNodeId(n.dataPointId)}
                          >
                            <div className="text-xs text-muted-foreground">
                              {n.classification?.primaryType ?? 'UNCLASSIFIED'}
                            </div>
                            <div className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                              {n.rawText}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reimagine summary</CardTitle>
                  <CardDescription>Generate a future-state narrative from live session signals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => void generateReimagineSummary()} disabled={reimagineLoading}>
                      {reimagineLoading ? 'Generating…' : 'Generate summary'}
                    </Button>
                    {reimagineSummary ? (
                      <Button type="button" variant="outline" onClick={() => setReimagineSummary(null)} disabled={reimagineLoading}>
                        Clear
                      </Button>
                    ) : null}
                  </div>

                  {reimagineError ? <div className="text-sm text-red-600">{reimagineError}</div> : null}

                  {reimagineSummary ? (
                    <div className="space-y-4">
                      <div className="text-xs text-muted-foreground">Generated: {reimagineSummary.generatedAt}</div>

                      {(
                        [
                          ['People', reimagineSummary.organisationTheyDescribed.People],
                          ['Organisation', reimagineSummary.organisationTheyDescribed.Organisation],
                          ['Technology', reimagineSummary.organisationTheyDescribed.Technology],
                          ['Customer', reimagineSummary.organisationTheyDescribed.Customer],
                          ['Regulation', reimagineSummary.organisationTheyDescribed.Regulation],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="rounded-md border p-3 space-y-2">
                          <div className="text-sm font-medium">{k}</div>
                          {v.futureState ? <div className="text-sm whitespace-pre-wrap break-words">{v.futureState}</div> : null}
                          {v.wantsToBeAbleToDo?.length ? (
                            <div className="text-sm">
                              <div className="text-xs text-muted-foreground mb-1">What they want to be able to do</div>
                              <div className="space-y-1">
                                {v.wantsToBeAbleToDo.map((x, i) => (
                                  <div key={i}>{x}</div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {v.believesMustChange?.length ? (
                            <div className="text-sm">
                              <div className="text-xs text-muted-foreground mb-1">What they believe must change</div>
                              <div className="space-y-1">
                                {v.believesMustChange.map((x, i) => (
                                  <div key={i}>{x}</div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}

                      {reimagineSummary.keyPressurePoints?.length ? (
                        <div className="rounded-md border p-3 space-y-2">
                          <div className="text-sm font-medium">Key pressure points</div>
                          <div className="space-y-1 text-sm">
                            {reimagineSummary.keyPressurePoints.map((x, i) => (
                              <div key={i}>{x}</div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {reimagineSummary.dependencyMap?.length ? (
                        <div className="rounded-md border p-3 space-y-2">
                          <div className="text-sm font-medium">Dependency map</div>
                          <div className="space-y-1 text-sm">
                            {reimagineSummary.dependencyMap.map((x, i) => (
                              <div key={i}>{x}</div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {debugTrace.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Debug</CardTitle>
                    <CardDescription>Only visible in Facilitator/Split modes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs whitespace-pre-wrap break-words">{debugTrace.join('\n')}</pre>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>

        <Dialog
          open={viewMode !== 'room' && !!selectedNode}
          onOpenChange={(open) => {
            if (!open) setSelectedNodeId(null);
          }}
        >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Datapoint</DialogTitle>
                <DialogDescription>
                  {selectedNode?.classification?.primaryType ?? 'UNCLASSIFIED'}
                  {selectedNode?.classification?.confidence != null
                    ? ` • ${(selectedNode.classification.confidence * 100).toFixed(0)}%`
                    : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-md border p-3 text-sm whitespace-pre-wrap break-words">
                  {selectedNode?.rawText || ''}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <div className="font-medium mb-1">Transcript</div>
                    <div className="text-muted-foreground">
                      Start: {selectedNode?.transcriptChunk?.startTimeMs ?? '—'}ms
                    </div>
                    <div className="text-muted-foreground">
                      End: {selectedNode?.transcriptChunk?.endTimeMs ?? '—'}ms
                    </div>
                    <div className="text-muted-foreground">
                      Deepgram conf:{' '}
                      {selectedNode?.transcriptChunk?.confidence == null
                        ? '—'
                        : `${(selectedNode.transcriptChunk.confidence * 100).toFixed(0)}%`}
                    </div>
                    <div className="text-muted-foreground">
                      Source: {selectedNode?.transcriptChunk?.source ?? '—'}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="font-medium mb-1">Classification</div>
                    <div className="text-muted-foreground">
                      Type: {selectedNode?.classification?.primaryType ?? '—'}
                    </div>
                    <div className="text-muted-foreground">
                      Conf:{' '}
                      {selectedNode?.classification?.confidence == null
                        ? '—'
                        : `${(selectedNode.classification.confidence * 100).toFixed(0)}%`}
                    </div>
                    <div className="text-muted-foreground">
                      Suggested area: {selectedNode?.classification?.suggestedArea ?? '—'}
                    </div>
                    <div className="text-muted-foreground">
                      Keywords: {selectedNode?.classification?.keywords?.length ? selectedNode.classification.keywords.join(', ') : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelectedNodeId(null)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

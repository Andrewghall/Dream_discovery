'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { LiveDomainRadar } from '@/components/live/live-domain-radar';
import { interpretLiveUtterance, type LiveDomain } from '@/lib/live/intent-interpretation';

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

type LiveSnapshotMeta = {
  id: string;
  name: string;
  dialoguePhase: string;
  createdAt: string | Date;
  updatedAt: string | Date;
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
  const [forwardedCount, setForwardedCount] = useState(0);
  const [debugTrace, setDebugTrace] = useState<string[]>([]);
  const [tabHiddenWarning, setTabHiddenWarning] = useState(false);

  const [nodesById, setNodesById] = useState<Record<string, HemisphereNodeDatum>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'room' | 'facilitator' | 'split'>('split');
  const [dialoguePhase, setDialoguePhase] = useState<HemisphereDialoguePhase>('REIMAGINE');

  type LiveTheme = {
    id: string;
    label: string;
    domain: LiveDomain;
    intentType: string;
    strength: number;
    centroidEmbedding: number[];
    supportingUtteranceIds: string[];
  };

  type LiveDependencyEdge = {
    id: string;
    fromDomain: LiveDomain;
    toDomain: LiveDomain;
    count: number;
    aspirationCount: number;
    constraintCount: number;
    firstSeenAtMs: number;
    lastSeenAtMs: number;
  };

  const [themesById, setThemesById] = useState<Record<string, LiveTheme>>({});
  const themesRef = useRef<Record<string, LiveTheme>>({});
  const [nodeThemeById, setNodeThemeById] = useState<Record<string, string>>({});
  const nodeThemeRef = useRef<Record<string, string>>({});
  const embeddingCacheRef = useRef<Map<string, number[]>>(new Map());
  const embeddingInFlightRef = useRef<Set<string>>(new Set());

  const [lensDomain, setLensDomain] = useState<LiveDomain | null>(null);

  const [dependencyEdgesById, setDependencyEdgesById] = useState<Record<string, LiveDependencyEdge>>({});
  const dependencyEdgesRef = useRef<Record<string, LiveDependencyEdge>>({});

  const dependencyProcessedRef = useRef<Set<string>>(new Set());
  const [dependencyProcessedCount, setDependencyProcessedCount] = useState(0);

  const [snapshots, setSnapshots] = useState<LiveSnapshotMeta[]>([]);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const lastDefaultSnapshotNameRef = useRef<string>('');

  const statusRef = useRef<'idle' | 'capturing' | 'stopped' | 'error'>('idle');

  const [micDialogOpen, setMicDialogOpen] = useState(false);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [micDevices, setMicDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [micLevel, setMicLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);

  const [revealOpen, setRevealOpen] = useState(false);

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

  const confidenceWeightNumber = (w: string | null | undefined) => {
    const s = String(w || '').trim().toLowerCase();
    if (s === 'high') return 1.4;
    if (s === 'mid') return 1.0;
    return 0.6;
  };

  const classificationFromInterpretation = (text: string, nowIso: string): {
    primaryType: HemispherePrimaryType;
    confidence: number;
    keywords: string[];
    suggestedArea: string | null;
    updatedAt: string;
  } => {
    const i = interpretLiveUtterance(text);

    const has = (k: string) => i.cognitiveTypes.some((x) => String(x).toUpperCase() === k);

    const primaryType: HemispherePrimaryType = has('QUESTION')
      ? 'QUESTION'
      : i.temporalIntent === 'LIMIT' || has('BLOCKER')
        ? 'CONSTRAINT'
        : i.temporalIntent === 'METHOD'
          ? 'ACTION'
          : has('ENABLER')
            ? 'ENABLER'
            : has('OPPORTUNITY')
              ? 'OPPORTUNITY'
              : has('VISION') || has('OUTCOME')
                ? 'VISIONARY'
                : 'INSIGHT';

    const w = confidenceWeightNumber(i.confidenceWeight);
    const raw = (typeof i.confidence === 'number' ? i.confidence : 0.55) * (0.85 + 0.25 * w);
    const scaled = Math.max(0, Math.min(1, raw));

    return {
      primaryType,
      confidence: scaled,
      keywords: [],
      suggestedArea: null,
      updatedAt: nowIso,
    };
  };

  const phaseKey = (p: {
    startTimeMs: number;
    endTimeMs: number;
    text: string;
    source: string;
  }) => `${p.startTimeMs}:${p.endTimeMs}:${p.source}:${p.text}`;

  const snapshotUrl = useMemo(
    () => `/api/admin/workshops/${encodeURIComponent(workshopId)}/live/snapshots`,
    [workshopId]
  );

  const defaultSnapshotName = useMemo(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    const phase =
      dialoguePhase === 'CONSTRAINTS'
        ? 'constraints'
        : dialoguePhase === 'DEFINE_APPROACH'
          ? 'define-approach'
          : 'reimagine';
    return `Live-v1-${dd}${mm}${yy}-${phase}-workshop`;
  }, [dialoguePhase]);

  useEffect(() => {
    const current = snapshotName.trim();
    if (!current || current === lastDefaultSnapshotNameRef.current) {
      setSnapshotName(defaultSnapshotName);
      lastDefaultSnapshotNameRef.current = defaultSnapshotName;
    }
  }, [defaultSnapshotName]);

  const fetchSnapshots = async () => {
    try {
      setSnapshotsError(null);
      const r = await fetch(`${snapshotUrl}?bust=${Date.now()}`, { cache: 'no-store' });
      const json = (await r.json().catch(() => null)) as
        | { ok?: boolean; snapshots?: LiveSnapshotMeta[]; error?: string; detail?: string }
        | null;
      if (!r.ok || !json || json.ok !== true) {
        const msg = json?.error || 'Failed to load snapshots';
        const detail = json?.detail ? `: ${json.detail}` : '';
        setSnapshots([]);
        setSnapshotsError(`${msg}${detail}`);
        return;
      }
      const list = Array.isArray(json.snapshots) ? json.snapshots : [];
      setSnapshots(list);
      setSelectedSnapshotId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? ''));
    } catch (e) {
      setSnapshots([]);
      setSnapshotsError(e instanceof Error ? e.message : 'Failed to load snapshots');
    }
  };

  useEffect(() => {
    void fetchSnapshots();
  }, [snapshotUrl]);

  const saveSnapshot = async () => {
    const name = snapshotName.trim();
    if (!name) {
      setSnapshotsError('Snapshot name is required');
      return;
    }

    const payload = {
      v: 1,
      dialoguePhase,
      nodesById,
      selectedNodeId,
      themesById,
      nodeThemeById,
      dependencyEdgesById,
      dependencyProcessedIds: Array.from(dependencyProcessedRef.current),
      dependencyProcessedCount,
    };

    try {
      setSnapshotsError(null);
      const r = await fetch(snapshotUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dialoguePhase, payload }),
      });
      const json = (await r.json().catch(() => null)) as
        | { ok?: boolean; snapshot?: { id: string }; error?: string; detail?: string }
        | null;
      if (!r.ok || !json || json.ok !== true || !json.snapshot?.id) {
        const msg = json?.error || 'Failed to save snapshot';
        const detail = json?.detail ? `: ${json.detail}` : '';
        setSnapshotsError(`${msg}${detail}`);
        return;
      }
      await fetchSnapshots();
      setSelectedSnapshotId(json.snapshot.id);
    } catch (e) {
      setSnapshotsError(e instanceof Error ? e.message : 'Failed to save snapshot');
    }
  };

  const loadSnapshot = async () => {
    const id = selectedSnapshotId;
    if (!id) return;
    try {
      setSnapshotsError(null);
      const r = await fetch(`${snapshotUrl}/${encodeURIComponent(id)}?bust=${Date.now()}`, { cache: 'no-store' });
      const json = (await r.json().catch(() => null)) as
        | { ok?: boolean; snapshot?: { payload?: unknown; dialoguePhase?: string }; error?: string; detail?: string }
        | null;
      if (!r.ok || !json || json.ok !== true || !json.snapshot) {
        const msg = json?.error || 'Failed to load snapshot';
        const detail = json?.detail ? `: ${json.detail}` : '';
        setSnapshotsError(`${msg}${detail}`);
        return;
      }

      const p = (json.snapshot as { payload?: any }).payload;
      if (!p || typeof p !== 'object') {
        setSnapshotsError('Snapshot payload is invalid');
        return;
      }

      const phaseFromSnap = safePhase((p as any).dialoguePhase) ?? safePhase(json.snapshot.dialoguePhase);
      if (phaseFromSnap) setDialoguePhase(phaseFromSnap);

      const nextNodesById = (p as any).nodesById;
      const nextThemesById = (p as any).themesById;
      const nextNodeThemeById = (p as any).nodeThemeById;
      const nextDependencyEdgesById = (p as any).dependencyEdgesById;

      if (nextNodesById && typeof nextNodesById === 'object') setNodesById(nextNodesById);
      if (typeof (p as any).selectedNodeId === 'string' || (p as any).selectedNodeId === null) {
        setSelectedNodeId((p as any).selectedNodeId);
      }
      if (nextThemesById && typeof nextThemesById === 'object') setThemesById(nextThemesById);
      if (nextNodeThemeById && typeof nextNodeThemeById === 'object') setNodeThemeById(nextNodeThemeById);
      if (nextDependencyEdgesById && typeof nextDependencyEdgesById === 'object') setDependencyEdgesById(nextDependencyEdgesById);

      const processed = Array.isArray((p as any).dependencyProcessedIds) ? (p as any).dependencyProcessedIds : [];
      const ids = processed.filter((x: unknown) => typeof x === 'string') as string[];
      dependencyProcessedRef.current = new Set(ids);
      setDependencyProcessedCount(typeof (p as any).dependencyProcessedCount === 'number' ? (p as any).dependencyProcessedCount : ids.length);
    } catch (e) {
      setSnapshotsError(e instanceof Error ? e.message : 'Failed to load snapshot');
    }
  };

  const nodes = useMemo(() => {
    const arr = Object.values(nodesById);
    arr.sort((a, b) => a.createdAtMs - b.createdAtMs);
    return arr;
  }, [nodesById]);

  const utteranceNodes = useMemo(() => {
    const out: HemisphereNodeDatum[] = [];

    for (const n of nodes) {
      const parts = splitIntoUtterances(n.rawText);
      if (parts.length <= 1) {
        out.push(n);
        continue;
      }

      const startMs = n.transcriptChunk?.startTimeMs ?? 0;
      const endMs = n.transcriptChunk?.endTimeMs ?? startMs;
      const span = Math.max(500, endMs - startMs);
      const step = span / Math.max(1, parts.length);

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const virtualId = `${n.dataPointId}::u${i}`;
        const createdAtMs = n.createdAtMs + Math.floor(i * Math.max(250, step));
        out.push({
          ...n,
          dataPointId: virtualId,
          rawText: p,
          createdAtMs,
        });
      }
    }

    out.sort((a, b) => a.createdAtMs - b.createdAtMs);
    return out;
  }, [nodes]);

  const clamp01 = (n: number) => {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  };

  const dot = (a: number[], b: number[]) => {
    const n = Math.min(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += a[i] * b[i];
    return s;
  };

  const norm = (a: number[]) => Math.sqrt(dot(a, a));

  const cosine = (a: number[], b: number[]) => {
    const na = norm(a);
    const nb = norm(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb) || na <= 0 || nb <= 0) return 0;
    return dot(a, b) / (na * nb);
  };

  const shortLabel = (text: string, maxWords: number) => {
    const w = String(text || '')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean);
    return w.length <= maxWords ? w.join(' ') : w.slice(0, maxWords).join(' ');
  };

  function splitIntoUtterances(text: string): string[] {
    const t = String(text || '').trim();
    if (!t) return [];

    const normalized = t.replace(/\s+/g, ' ').trim();
    const parts = normalized
      .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/g)
      .map((s) => s.trim())
      .filter(Boolean);

    return parts.length ? parts : [normalized];
  }

  const hash01 = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10_000) / 10_000;
  };

  const themeAnchorPosition = (params: { themeId: string; domain: LiveDomain; intentType: string }) => {
    const W = 1000;
    const H = 520;
    const pad = 32;
    const cx = W / 2;
    const cy = H - pad;
    const R = Math.min(cx - pad, cy - pad);

    const domainAngles: Record<LiveDomain, number> = {
      People: (5 * Math.PI) / 6,
      Operations: (3 * Math.PI) / 4,
      Customer: Math.PI / 2,
      Technology: Math.PI / 3,
      Regulation: Math.PI / 6,
    };

    const intentRadius = (intentType: string) => {
      const s = String(intentType || '').toUpperCase();
      if (s === 'VISIONARY' || s === 'VISION' || s === 'DREAM') return 0.85;
      if (s === 'OPPORTUNITY' || s === 'IDEA') return 0.78;
      if (s === 'ENABLER' || s === 'WHAT_WORKS') return 0.66;
      if (s === 'INSIGHT' || s === 'ASSUMPTION') return 0.56;
      if (s === 'CONSTRAINT' || s === 'RISK') return 0.42;
      return 0.62;
    };

    const theta = domainAngles[params.domain] + (hash01(params.themeId) - 0.5) * 0.32;
    const radial = R * intentRadius(params.intentType) + (hash01(`r:${params.themeId}`) - 0.5) * 24;
    return {
      x: cx + radial * Math.cos(theta),
      y: cy - radial * Math.sin(theta),
    };
  };

  const domainCenterPosition = (domain: LiveDomain) => {
    const W = 1000;
    const H = 520;
    const pad = 32;
    const cx = W / 2;
    const cy = H - pad;
    const R = Math.min(cx - pad, cy - pad);

    const domainAngles: Record<LiveDomain, number> = {
      People: (5 * Math.PI) / 6,
      Operations: (3 * Math.PI) / 4,
      Customer: Math.PI / 2,
      Technology: Math.PI / 3,
      Regulation: Math.PI / 6,
    };

    const theta = domainAngles[domain];
    const radial = R * 0.64;
    return {
      x: cx + radial * Math.cos(theta),
      y: cy - radial * Math.sin(theta),
    };
  };

  const normalizeText = (text: string) => String(text || '').trim().toLowerCase();

  const themeSignature = (text: string) => {
    const t = normalizeText(text).replace(/[^a-z0-9\s]/g, ' ');
    const stop = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'so',
      'because',
      'to',
      'of',
      'in',
      'on',
      'for',
      'with',
      'as',
      'at',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'we',
      'our',
      'us',
      'you',
      'your',
      'they',
      'their',
      'it',
      'this',
      'that',
      'these',
      'those',
      'will',
      'would',
      'should',
      'could',
      'can',
      'cannot',
      "can't",
      'not',
      'no',
      'yes',
      'do',
      'does',
      'did',
      'done',
      'have',
      'has',
      'had',
      'more',
      'most',
      'less',
      'very',
      'really',
      'just',
      'rather',
      'than',
      'into',
      'from',
      'across',
    ]);

    const tokens = t
      .split(/\s+/g)
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => x.length >= 3)
      .filter((x) => !stop.has(x));

    const uniq: string[] = [];
    for (const w of tokens) {
      if (uniq.includes(w)) continue;
      uniq.push(w);
      if (uniq.length >= 6) break;
    }

    const sig = (uniq.length ? uniq : tokens.slice(0, 4)).join('-') || 'misc';
    return sig.slice(0, 42);
  };

  const inferMentionedDomains = (text: string): LiveDomain[] => {
    const t = normalizeText(text);
    const matches: Array<{ d: LiveDomain; score: number }> = [
      {
        d: 'People',
        score: (t.match(/\b(people|team|staff|skills?|culture|leadership)\b/g) || []).length,
      },
      {
        d: 'Operations',
        score: (t.match(/\b(ops|operations?|process(es)?|workflow|governance|decision(s)?|organisation|organization)\b/g) || [])
          .length,
      },
      {
        d: 'Customer',
        score: (t.match(/\b(customer(s)?|client(s)?|user(s)?|service|experience)\b/g) || []).length,
      },
      {
        d: 'Technology',
        score: (t.match(/\b(tech|technology|system(s)?|platform|tool(s)?|software|data|ai)\b/g) || []).length,
      },
      {
        d: 'Regulation',
        score: (t.match(/\b(regulation(s)?|regulatory|compliance|legal|policy|audit|risk)\b/g) || []).length,
      },
    ];

    return matches
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.d);
  };

  const hasDependencyLanguage = (text: string) => {
    const t = normalizeText(text);
    if (!t) return false;
    return /\b(depends? on|dependent on|blocked by|bottleneck|requires?|need(s)?|must|approval|sign[- ]off|compliance|governance|legal)\b/i.test(
      t
    );
  };

  const dependencySignalKind = (n: HemisphereNodeDatum, interpretedIntentType: string) => {
    const cls = String(n.classification?.primaryType || '').trim().toUpperCase();
    if (cls === 'CONSTRAINT' || cls === 'RISK') return 'constraint';
    if (cls === 'VISIONARY' || cls === 'OPPORTUNITY') return 'aspiration';

    const ii = String(interpretedIntentType || '').trim().toUpperCase();
    if (ii === 'CONSTRAINT') return 'constraint';
    if (ii === 'DREAM' || ii === 'IDEA') return 'aspiration';
    return 'neutral';
  };

  const dependencySignalKindFromInterpretation = (text: string) => {
    const i = interpretLiveUtterance(text);
    const isConstraint = i.temporalIntent === 'LIMIT' || i.cognitiveTypes.includes('BLOCKER');
    const isAspiration =
      i.temporalIntent === 'FUTURE' &&
      (i.cognitiveTypes.includes('VISION') ||
        i.cognitiveTypes.includes('OUTCOME') ||
        i.cognitiveTypes.includes('OPPORTUNITY') ||
        i.cognitiveTypes.includes('ENABLER'));
    if (isConstraint) return 'constraint';
    if (isAspiration) return 'aspiration';
    return 'neutral';
  };

  const embeddingUrl = useMemo(
    () => `/api/admin/workshops/${encodeURIComponent(workshopId)}/live/embedding`,
    [workshopId]
  );

  const getEmbeddingForText = async (text: string): Promise<number[] | null> => {
    const resp = await fetch(embeddingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) return null;
    const json = (await resp.json().catch(() => null)) as { embedding?: unknown } | null;
    const emb = json?.embedding;
    if (!Array.isArray(emb)) return null;
    if (!emb.every((v) => typeof v === 'number')) return null;
    return emb as number[];
  };

  useEffect(() => {
    themesRef.current = themesById;
  }, [themesById]);

  useEffect(() => {
    nodeThemeRef.current = nodeThemeById;
  }, [nodeThemeById]);

  useEffect(() => {
    dependencyEdgesRef.current = dependencyEdgesById;
  }, [dependencyEdgesById]);

  useEffect(() => {
    const recent = utteranceNodes.slice(-220);
    let changed = false;

    for (const n of recent) {
      if (!n?.dataPointId) continue;
      if (dependencyProcessedRef.current.has(n.dataPointId)) continue;
      dependencyProcessedRef.current.add(n.dataPointId);
      changed = true;

      const i = interpretLiveUtterance(n.rawText);
      const domain = i.domain;

      const mentioned = (i.domains || []).filter((d) => d !== domain);
      const fallbackMentioned = inferMentionedDomains(n.rawText).filter((d) => d !== domain);
      const candidates = mentioned.length ? mentioned : fallbackMentioned;

      const shouldInfer = hasDependencyLanguage(n.rawText) || candidates.length > 0;
      if (!shouldInfer) continue;

      const toDomain = candidates.length ? candidates[0] : null;
      if (!toDomain) continue;

      const id = `dep:${domain}->${toDomain}`;
      const now = Date.now();
      const kind = dependencySignalKindFromInterpretation(n.rawText);
      const prev = dependencyEdgesRef.current[id];
      const next: LiveDependencyEdge = prev
        ? {
            ...prev,
            count: prev.count + 1,
            aspirationCount: prev.aspirationCount + (kind === 'aspiration' ? 1 : 0),
            constraintCount: prev.constraintCount + (kind === 'constraint' ? 1 : 0),
            lastSeenAtMs: now,
          }
        : {
            id,
            fromDomain: domain,
            toDomain,
            count: 1,
            aspirationCount: kind === 'aspiration' ? 1 : 0,
            constraintCount: kind === 'constraint' ? 1 : 0,
            firstSeenAtMs: now,
            lastSeenAtMs: now,
          };

      dependencyEdgesRef.current[id] = next;
    }

    if (changed) {
      setDependencyEdgesById({ ...dependencyEdgesRef.current });
      setDependencyProcessedCount(dependencyProcessedRef.current.size);
    }
  }, [utteranceNodes]);

  useEffect(() => {
    let cancelled = false;

    const maybeProcess = async (n: HemisphereNodeDatum) => {
      if (cancelled) return;
      if (!n?.dataPointId) return;

      if (nodeThemeRef.current[n.dataPointId]) return;
      if (embeddingCacheRef.current.has(n.dataPointId)) return;
      if (embeddingInFlightRef.current.has(n.dataPointId)) return;
      embeddingInFlightRef.current.add(n.dataPointId);

      try {
        const emb = await getEmbeddingForText(n.rawText);
        if (!emb || cancelled) return;
        embeddingCacheRef.current.set(n.dataPointId, emb);

        const i = interpretLiveUtterance(n.rawText);
        const domain = i.domain;
        const intentType = classificationFromInterpretation(n.rawText, new Date().toISOString()).primaryType;

        const existingThemes = Object.values(themesRef.current).filter(
          (t) => t.domain === domain && t.intentType === intentType
        );

        let best: { id: string; sim: number } | null = null;
        for (const t of existingThemes) {
          const sim = cosine(emb, t.centroidEmbedding);
          if (!best || sim > best.sim) best = { id: t.id, sim };
        }

        const threshold = 0.78;
        const pickThemeId = best && best.sim >= threshold ? best.id : null;

        const themeId =
          pickThemeId ??
          `theme:${domain}:${String(intentType)}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`;

        const prevTheme = themesRef.current[themeId] || null;
        const prevStrength = prevTheme?.strength ?? 0;
        const nextStrength = prevStrength + 1;

        const prevCentroid = prevTheme?.centroidEmbedding ?? emb;
        const nextCentroid = prevCentroid.map((v, idx) => {
          const next = emb[idx] ?? 0;
          const a = Number.isFinite(v) ? v : 0;
          return (a * prevStrength + next) / Math.max(1, nextStrength);
        });

        const nextTheme: LiveTheme = {
          id: themeId,
          label: prevTheme?.label ?? shortLabel(n.rawText, 7),
          domain,
          intentType: String(intentType),
          strength: nextStrength,
          centroidEmbedding: nextCentroid,
          supportingUtteranceIds: [
            ...(prevTheme?.supportingUtteranceIds || []),
            n.dataPointId,
          ].slice(-50),
        };

        if (!cancelled) {
          setThemesById((prev) => ({ ...prev, [themeId]: nextTheme }));
          setNodeThemeById((prev) => ({ ...prev, [n.dataPointId]: themeId }));
        }
      } finally {
        embeddingInFlightRef.current.delete(n.dataPointId);
      }
    };

    const recent = nodes.slice(-12);
    void Promise.all(recent.map((n) => maybeProcess(n)));

    return () => {
      cancelled = true;
    };
  }, [nodes, embeddingUrl]);

  const derivedThemes = useMemo(() => {
    const themes: Record<string, LiveTheme> = {};
    const nodeTheme: Record<string, string> = {};

    for (const n of utteranceNodes) {
      const i = interpretLiveUtterance(n.rawText);
      const cls = classificationFromInterpretation(n.rawText, new Date().toISOString());
      const domain = i.domain;
      const intentType = cls.primaryType;
      const sig = themeSignature(n.rawText);
      const themeId = `auto:${domain}:${intentType}:${sig}`;

      const prev = themes[themeId];
      const nextStrength = (prev?.strength ?? 0) + 1;
      themes[themeId] = {
        id: themeId,
        label: prev?.label ?? shortLabel(n.rawText, 12),
        domain,
        intentType: String(intentType),
        strength: nextStrength,
        centroidEmbedding: prev?.centroidEmbedding ?? [],
        supportingUtteranceIds: [...(prev?.supportingUtteranceIds || []), n.dataPointId].slice(-50),
      };
      nodeTheme[n.dataPointId] = themeId;
    }

    return { themesById: themes, nodeThemeById: nodeTheme };
  }, [utteranceNodes]);

  const usingDerivedThemes = Object.keys(themesById).length === 0;
  const effectiveThemesById = usingDerivedThemes ? derivedThemes.themesById : themesById;
  const effectiveNodeThemeById = usingDerivedThemes ? derivedThemes.nodeThemeById : nodeThemeById;

  const interpretedNodes = useMemo(() => {
    return utteranceNodes.map((n) => {
      const i = interpretLiveUtterance(n.rawText);
      const cls = classificationFromInterpretation(n.rawText, new Date().toISOString());
      const themeId = effectiveNodeThemeById[n.dataPointId] || null;
      const theme = themeId ? effectiveThemesById[themeId] : null;
      const labelDomain = (i.domains || []).slice(0, 2).join('+');
      const labelType = (i.cognitiveTypes || [])[0] ?? '—';
      return {
        ...n,
        dialoguePhase: i.hemispherePhase,
        classification: cls,
        intent: `${i.temporalIntent} / ${labelType} / ${labelDomain || i.domain}`,
        themeId,
        themeLabel: theme?.label ?? null,
      };
    });
  }, [effectiveNodeThemeById, effectiveThemesById, utteranceNodes]);

  const themeAttractors = useMemo(() => {
    const out: Record<string, { x: number; y: number; strength: number; label: string }> = {};
    for (const t of Object.values(effectiveThemesById)) {
      const pos = themeAnchorPosition({ themeId: t.id, domain: t.domain, intentType: t.intentType });
      out[t.id] = { ...pos, strength: t.strength, label: t.label };
    }
    return out;
  }, [effectiveThemesById]);

  const dependencyLinks = useMemo(() => {
    const edges = Object.values(dependencyEdgesById);
    if (!edges.length)
      return [] as Array<{
        id: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        strength: number;
        color?: string;
        width?: number;
      }>;

    const now = Date.now();
    const threshold = 3;
    const pressureThreshold = 3;

    return edges
      .filter((e) => e.count >= threshold)
      .map((e) => {
        const a = domainCenterPosition(e.fromDomain);
        const b = domainCenterPosition(e.toDomain);
        const ageMs = Math.max(0, now - e.lastSeenAtMs);
        const decay01 = clamp01(ageMs / (6 * 60 * 1000));
        const base = clamp01((e.count - threshold) / 6);
        const strength = clamp01(base * (1 - decay01));

        const isPressure =
          e.count >= pressureThreshold &&
          e.constraintCount >= 2 &&
          e.constraintCount > e.aspirationCount &&
          strength > 0.08;

        const alpha = clamp01(0.18 + 0.35 * strength);

        return {
          id: e.id,
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          strength,
          ...(isPressure
            ? {
                color: `rgba(249,115,22,${alpha})`,
                width: Math.max(2.5, Math.min(5.5, 2.5 + 3.0 * strength)),
              }
            : {}),
        };
      })
      .filter((l) => l.strength > 0.02);
  }, [dependencyEdgesById]);

  const pressurePoints = useMemo(() => {
    const edges = Object.values(dependencyEdgesById);
    const viaEdges = edges
      .map((e) => {
        const delta = e.constraintCount - e.aspirationCount;
        const score = delta * 3 + Math.max(0, e.count - 2);
        return {
          id: e.id,
          fromDomain: e.fromDomain,
          toDomain: e.toDomain,
          score,
          constraintCount: e.constraintCount,
          aspirationCount: e.aspirationCount,
          count: e.count,
        };
      })
      .filter((p) => p.count >= 3 && p.constraintCount >= 2 && p.constraintCount > p.aspirationCount)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (viaEdges.length) return viaEdges;

    const counts: Record<LiveDomain, { constraintCount: number; aspirationCount: number }> = {
      People: { constraintCount: 0, aspirationCount: 0 },
      Operations: { constraintCount: 0, aspirationCount: 0 },
      Customer: { constraintCount: 0, aspirationCount: 0 },
      Technology: { constraintCount: 0, aspirationCount: 0 },
      Regulation: { constraintCount: 0, aspirationCount: 0 },
    };

    for (const n of utteranceNodes) {
      const i = interpretLiveUtterance(n.rawText);
      const d = i.domain;
      const isConstraint = i.temporalIntent === 'LIMIT' || i.cognitiveTypes.includes('BLOCKER');
      const isAspiration =
        i.temporalIntent === 'FUTURE' &&
        (i.cognitiveTypes.includes('VISION') || i.cognitiveTypes.includes('OUTCOME') || i.cognitiveTypes.includes('OPPORTUNITY'));
      if (isConstraint) counts[d].constraintCount += 1;
      if (isAspiration) counts[d].aspirationCount += 1;
    }

    return (Object.keys(counts) as LiveDomain[])
      .map((d) => {
        const c = counts[d];
        const delta = c.constraintCount - c.aspirationCount;
        const score = delta * 3 + Math.max(0, c.constraintCount - 1);
        return {
          id: `pp:${d}`,
          fromDomain: d,
          toDomain: d,
          score,
          constraintCount: c.constraintCount,
          aspirationCount: c.aspirationCount,
          count: c.constraintCount,
        };
      })
      .filter((p) => p.constraintCount >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [dependencyEdgesById, utteranceNodes]);

  const synthesisByDomain = useMemo(() => {
    type SynthesisItem = {
      themeId: string;
      label: string;
      intentType: string;
      strength: number;
      lastSeenAtMs: number;
      weight: number;
      examples: string[];
    };

    const empty = () => ({
      aspirations: [] as SynthesisItem[],
      constraints: [] as SynthesisItem[],
      enablers: [] as SynthesisItem[],
      opportunities: [] as SynthesisItem[],
    });

    const out: Record<LiveDomain, ReturnType<typeof empty>> = {
      People: empty(),
      Operations: empty(),
      Customer: empty(),
      Technology: empty(),
      Regulation: empty(),
    };

    const nodeById: Record<string, HemisphereNodeDatum> = {};
    for (const n of interpretedNodes) nodeById[n.dataPointId] = n;

    const now = Date.now();
    const tauMs = 12 * 60 * 1000;

    const normalizeIntent = (s: string) => String(s || '').trim().toUpperCase();

    for (const t of Object.values(effectiveThemesById)) {
      if (!t || !t.id) continue;
      if (t.strength < (usingDerivedThemes ? 1 : 2)) continue;

      const utterances = (t.supportingUtteranceIds || [])
        .map((id) => nodeById[id])
        .filter(Boolean);

      if (!utterances.length) continue;

      let lastSeenAtMs = 0;
      for (const u of utterances) {
        if (u.createdAtMs > lastSeenAtMs) lastSeenAtMs = u.createdAtMs;
      }

      const ageMs = Math.max(0, now - lastSeenAtMs);
      const recency = Math.exp(-ageMs / Math.max(1, tauMs));
      const weight = t.strength * (0.4 + 0.6 * recency);

      utterances.sort((a, b) => a.createdAtMs - b.createdAtMs);
      const examples = utterances
        .slice(Math.max(0, utterances.length - 3))
        .reverse()
        .map((u) => shortLabel(u.rawText, 16));

      const intentType = normalizeIntent(t.intentType);

      const item: SynthesisItem = {
        themeId: t.id,
        label: t.label,
        intentType,
        strength: t.strength,
        lastSeenAtMs,
        weight,
        examples,
      };

      const isAspiration =
        intentType === 'VISIONARY' || intentType === 'DREAM' || intentType === 'OPPORTUNITY' || intentType === 'IDEA';
      const isConstraint = intentType === 'CONSTRAINT' || intentType === 'RISK';
      const isEnabler = intentType === 'ENABLER' || intentType === 'WHAT_WORKS';
      const isOpportunity = intentType === 'OPPORTUNITY' || intentType === 'IDEA';

      if (isAspiration) out[t.domain].aspirations.push(item);
      if (isConstraint) out[t.domain].constraints.push(item);
      if (isEnabler) out[t.domain].enablers.push(item);
      if (isOpportunity) out[t.domain].opportunities.push(item);
    }

    const sortAndSlice = (arr: SynthesisItem[]) =>
      arr
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);

    for (const d of Object.keys(out) as LiveDomain[]) {
      out[d] = {
        aspirations: sortAndSlice(out[d].aspirations),
        constraints: sortAndSlice(out[d].constraints),
        enablers: sortAndSlice(out[d].enablers),
        opportunities: sortAndSlice(out[d].opportunities),
      };
    }

    return out;
  }, [effectiveThemesById, interpretedNodes, usingDerivedThemes]);

  const lensInsights = useMemo(() => {
    if (!lensDomain) return null;

    const outcomes = [
      ...(synthesisByDomain[lensDomain]?.aspirations || []),
      ...(synthesisByDomain[lensDomain]?.opportunities || []),
    ]
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    const deps = Object.values(dependencyEdgesById)
      .filter((e) => e.fromDomain === lensDomain)
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const blockers = deps
      .filter((e) => e.count >= 3 && e.constraintCount >= 2 && e.constraintCount > e.aspirationCount)
      .slice(0, 5);

    const enablers = deps
      .filter((e) => e.count >= 3 && e.aspirationCount >= 2 && e.aspirationCount >= e.constraintCount)
      .slice(0, 5);

    const inbound = Object.values(dependencyEdgesById)
      .filter((e) => e.toDomain === lensDomain)
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      lensDomain,
      outcomes,
      dependencies: deps,
      blockers,
      enablers,
      inbound,
    };
  }, [dependencyEdgesById, lensDomain, synthesisByDomain]);

  const visionNarrative = useMemo(() => {
    const picks: Array<{ domain: LiveDomain; label: string; example?: string | null }> = [];
    for (const d of ['People', 'Operations', 'Customer', 'Technology', 'Regulation'] as LiveDomain[]) {
      const top = (synthesisByDomain[d]?.aspirations || [])[0] ?? (synthesisByDomain[d]?.opportunities || [])[0] ?? null;
      if (!top) continue;
      picks.push({ domain: d, label: top.label, example: top.examples?.[0] ?? null });
    }

    if (picks.length < 2) return null;

    const headline = picks
      .slice(0, 3)
      .map((p) => p.label)
      .filter(Boolean)
      .join('; ');

    const lines = picks
      .slice(0, 5)
      .map((p) => `${p.domain}: ${p.example || p.label}`)
      .filter(Boolean);

    const text = `Future state narrative (draft): The group repeatedly described a future state anchored by ${headline}. Key phrases by domain: ${lines.join(' • ')}.`;
    return text;
  }, [synthesisByDomain]);

  const revealReadiness = useMemo(() => {
    const total = utteranceNodes.length;

    const confidentEnough = utteranceNodes.reduce((acc, x) => {
      if (!x.rawText?.trim()) return acc;
      const i = interpretLiveUtterance(x.rawText);
      return acc + (confidenceWeightNumber(i.confidenceWeight) >= 1.0 ? 1 : 0);
    }, 0);

    const intentExtractionReady = total > 0 && confidentEnough >= Math.min(total, 10);
    const dependencyInferenceReady = total > 0 && dependencyProcessedCount >= Math.min(total, 12);

    const synthesisTotal = (['People', 'Operations', 'Customer', 'Technology', 'Regulation'] as LiveDomain[]).reduce(
      (acc, d) => {
        const s = synthesisByDomain[d];
        return (
          acc +
          (s?.aspirations?.length || 0) +
          (s?.constraints?.length || 0) +
          (s?.enablers?.length || 0) +
          (s?.opportunities?.length || 0)
        );
      },
      0
    );
    const domainSynthesisReady = synthesisTotal >= 4;

    const dependencyLinesVisible = dependencyLinks.length > 0;
    const pressurePointsDetected = pressurePoints.length > 0;
    const visionNarrativeReady = Boolean(visionNarrative && visionNarrative.trim().length >= 40);

    const revealReady = intentExtractionReady && dependencyInferenceReady && domainSynthesisReady && visionNarrativeReady;

    return {
      revealReady,
      checks: {
        intentExtractionReady,
        dependencyInferenceReady,
        domainSynthesisReady,
        dependencyLinesVisible,
        pressurePointsDetected,
        visionNarrativeReady,
      },
    };
  }, [dependencyLinks.length, dependencyProcessedCount, pressurePoints.length, synthesisByDomain, utteranceNodes, visionNarrative]);

  const domainNarratives = useMemo(() => {
    const domains = ['People', 'Operations', 'Customer', 'Technology', 'Regulation'] as LiveDomain[];

    const joinLabels = (items: Array<{ label: string }>) =>
      items
        .map((x) => x.label)
        .filter(Boolean)
        .slice(0, 2)
        .join('; ');

    return domains.map((d) => {
      const s = synthesisByDomain[d];
      const aspirations = joinLabels(s?.aspirations || []);
      const opportunities = joinLabels(s?.opportunities || []);
      const constraints = joinLabels(s?.constraints || []);
      const enablers = joinLabels(s?.enablers || []);

      const lines: string[] = [];
      if (aspirations) lines.push(`Aspirations: ${aspirations}.`);
      if (opportunities) lines.push(`Opportunities: ${opportunities}.`);
      if (constraints) lines.push(`Constraints: ${constraints}.`);
      if (enablers) lines.push(`Enablers: ${enablers}.`);

      return {
        domain: d,
        narrative: lines.join(' '),
        hasAny: Boolean(lines.length),
      };
    });
  }, [synthesisByDomain]);

  const keyDependencies = useMemo(() => {
    return Object.values(dependencyEdgesById)
      .filter((e) => e.count >= 3)
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [dependencyEdgesById]);

  const domainCounts = useMemo(() => {
    const counts: Record<LiveDomain, number> = {
      People: 0,
      Operations: 0,
      Customer: 0,
      Technology: 0,
      Regulation: 0,
    };

    const now = Date.now();
    const tauMs = 10 * 60 * 1000;

    for (const n of utteranceNodes) {
      const i = interpretLiveUtterance(n.rawText);
      const w = confidenceWeightNumber(i.confidenceWeight);
      const ageMs = Math.max(0, now - (n.createdAtMs || now));
      const recency = Math.exp(-ageMs / Math.max(1, tauMs));
      const ww = w * (0.5 + 0.5 * recency);
      for (const d of i.domains || []) {
        counts[d] = (counts[d] || 0) + ww;
      }
    }
    return counts;
  }, [utteranceNodes]);

  const originTimeMs = useMemo(
    () => (utteranceNodes.length ? utteranceNodes[0].createdAtMs : null),
    [utteranceNodes]
  );

  const hemisphereTimeScaleMs = useMemo(() => {
    if (!utteranceNodes.length) return 10 * 60 * 1000;
    const t0 = utteranceNodes[0].createdAtMs;
    const t1 = utteranceNodes[utteranceNodes.length - 1].createdAtMs;
    const span = Math.max(1, t1 - t0);
    return Math.max(45_000, Math.min(10 * 60 * 1000, span + 20_000));
  }, [utteranceNodes]);

  const selectedNode = useMemo(
    () => {
      if (!selectedNodeId) return null;
      const exact = interpretedNodes.find((n) => n.dataPointId === selectedNodeId) ?? null;
      if (exact) return exact;

      // If a chunk was split into sentence-level virtual utterances, map legacy IDs to the first split.
      const prefix = `${selectedNodeId}::`;
      return interpretedNodes.find((n) => String(n.dataPointId).startsWith(prefix)) ?? null;
    },
    [interpretedNodes, selectedNodeId]
  );

  const workboard = useMemo(() => {
    const byType: Record<string, number> = {};
    let unclassified = 0;

    for (const n of utteranceNodes) {
      if (!n.rawText?.trim()) {
        unclassified += 1;
      } else {
        const i = interpretLiveUtterance(n.rawText);
        for (const ct of i.cognitiveTypes || []) {
          byType[ct] = (byType[ct] || 0) + 1;
        }
      }
    }

    const recent = utteranceNodes.slice(-6).reverse();
    const last = utteranceNodes.length ? utteranceNodes[utteranceNodes.length - 1] : null;

    return {
      total: utteranceNodes.length,
      unclassified,
      byType,
      recent,
      lastAtMs: last?.createdAtMs ?? null,
    };
  }, [utteranceNodes]);

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

  const CHUNK_MS = 10_000;

  const transcribeAndForward = async (blob: Blob, startTime: number, endTime: number) => {
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
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }))
        .filter((d) => d.deviceId && d.deviceId !== '__none');

      setMicDevices(mics);

      const stillValid = selectedMicId && mics.some((m) => m.deviceId === selectedMicId);
      if (!stillValid) {
        setSelectedMicId(mics.length > 0 ? mics[0].deviceId : '');
      }
    } catch {
      setMicDevices([]);
      if (selectedMicId) setSelectedMicId('');
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
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
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
              ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4'
              : viewMode === 'facilitator'
                ? 'space-y-4'
                : 'space-y-4'
          }
        >
          {viewMode !== 'facilitator' ? (
            <Card className={viewMode === 'split' ? 'min-w-0 lg:sticky lg:top-4 lg:self-start' : undefined}>
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
                  {utteranceNodes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No datapoints yet.</div>
                  ) : (
                    <HemisphereNodes
                      nodes={interpretedNodes}
                      originTimeMs={originTimeMs}
                      timeScaleMs={hemisphereTimeScaleMs}
                      onNodeClick={(n) => setSelectedNodeId(n.dataPointId)}
                      themeAttractors={themeAttractors}
                      links={dependencyLinks}
                      className="h-full w-full"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {viewMode !== 'room' ? (
            <div className={(viewMode === 'split' ? 'space-y-4 min-w-0' : 'space-y-4') + ' min-w-0'}>
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
                  <CardTitle>Snapshots</CardTitle>
                  <CardDescription>Save/load versioned Live states per phase</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input value={snapshotName} onChange={(e) => setSnapshotName(e.target.value)} />
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setSnapshotName(defaultSnapshotName)}>
                      Use default
                    </Button>
                    <Button type="button" onClick={() => void saveSnapshot()}>
                      Save snapshot
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label>Load</Label>
                    <Select value={selectedSnapshotId || '__none'} onValueChange={(v) => setSelectedSnapshotId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a snapshot" />
                      </SelectTrigger>
                      <SelectContent>
                        {snapshots.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No snapshots yet
                          </SelectItem>
                        ) : (
                          snapshots.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => void fetchSnapshots()}>
                      Refresh
                    </Button>
                    <Button type="button" disabled={!selectedSnapshotId} onClick={() => void loadSnapshot()}>
                      Load snapshot
                    </Button>
                  </div>

                  {snapshotsError ? <div className="text-sm text-red-600">{snapshotsError}</div> : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reveal readiness</CardTitle>
                  <CardDescription>Reveal stays locked until synthesis and relationships are populated</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className={revealReadiness.checks.intentExtractionReady ? 'text-foreground' : 'text-muted-foreground'}>
                      Intent extraction
                    </div>
                    <div className={revealReadiness.checks.dependencyInferenceReady ? 'text-foreground' : 'text-muted-foreground'}>
                      Dependency inference
                    </div>
                    <div className={revealReadiness.checks.domainSynthesisReady ? 'text-foreground' : 'text-muted-foreground'}>
                      Domain synthesis cards
                    </div>
                    <div className={revealReadiness.checks.dependencyLinesVisible ? 'text-foreground' : 'text-muted-foreground'}>
                      Dependency lines visible
                    </div>
                    <div className={revealReadiness.checks.pressurePointsDetected ? 'text-foreground' : 'text-muted-foreground'}>
                      Pressure points detected
                    </div>
                    <div className={revealReadiness.checks.visionNarrativeReady ? 'text-foreground' : 'text-muted-foreground'}>
                      Vision narrative generated
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={!revealReadiness.revealReady}
                    onClick={() => {
                      if (!revealReadiness.revealReady) return;
                      setRevealOpen(true);
                    }}
                  >
                    Open Reveal
                  </Button>

                  {visionNarrative ? (
                    <div className="rounded-md border p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                      {visionNarrative}
                    </div>
                  ) : null}

                  <Dialog
                    open={revealOpen}
                    onOpenChange={(open) => {
                      setRevealOpen(open);
                    }}
                  >
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Reveal</DialogTitle>
                        <DialogDescription>
                          This view unlocks once synthesis and relationships are present.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-6">
                        <div className="rounded-md border p-4">
                          <div className="text-sm font-medium mb-2">Future state narrative</div>
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {visionNarrative || '—'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {domainNarratives.map((d) => (
                            <div key={d.domain} className="rounded-md border p-4">
                              <div className="text-sm font-medium mb-2">{d.domain}</div>
                              <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                                {d.hasAny ? d.narrative : 'No synthesis yet.'}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-md border p-4">
                            <div className="text-sm font-medium mb-2">Systemic pressure points</div>
                            {pressurePoints.length === 0 ? (
                              <div className="text-sm text-muted-foreground">None detected yet.</div>
                            ) : (
                              <div className="space-y-2">
                                {pressurePoints.map((p) => (
                                  <div key={p.id} className="rounded-md border px-3 py-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm font-medium">
                                        {p.fromDomain} → {p.toDomain}
                                      </div>
                                      <div className="text-xs text-muted-foreground tabular-nums">{p.count}</div>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                                      constraints: {p.constraintCount} • aspirations: {p.aspirationCount}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="rounded-md border p-4">
                            <div className="text-sm font-medium mb-2">Key dependencies</div>
                            {keyDependencies.length === 0 ? (
                              <div className="text-sm text-muted-foreground">None detected yet.</div>
                            ) : (
                              <div className="space-y-2">
                                {keyDependencies.map((e) => (
                                  <div key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <div className="text-sm font-medium">
                                      {e.fromDomain} → {e.toDomain}
                                    </div>
                                    <div className="text-xs text-muted-foreground tabular-nums">{e.count}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setRevealOpen(false)}>
                            Close
                          </Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lens</CardTitle>
                  <CardDescription>Pick a domain and interpret outcomes, blockers, enablers, and dependencies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Domain</Label>
                    <Select
                      value={lensDomain ?? 'none'}
                      onValueChange={(v) => {
                        if (v === 'none') {
                          setLensDomain(null);
                          return;
                        }
                        setLensDomain(v as LiveDomain);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a domain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="People">People</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Customer">Customer</SelectItem>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Regulation">Regulation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!lensInsights ? (
                    <div className="text-sm text-muted-foreground">Select a domain to view lens-based interpretation.</div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Outcomes (aspirations + opportunities)</div>
                        {lensInsights.outcomes.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No outcomes yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {lensInsights.outcomes.map((x) => (
                              <div key={x.themeId} className="rounded-md border bg-background px-2 py-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">{x.label}</div>
                                  <div className="text-xs text-muted-foreground tabular-nums">×{x.strength}</div>
                                </div>
                                {x.examples?.[0] ? (
                                  <div className="mt-1 text-xs text-muted-foreground">{x.examples[0]}</div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Blockers (constraints dominating dependencies)</div>
                        {lensInsights.blockers.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No blockers detected yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {lensInsights.blockers.map((e) => (
                              <div key={e.id} className="rounded-md border px-2 py-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">{e.toDomain}</div>
                                  <div className="text-xs text-muted-foreground tabular-nums">mentions: {e.count}</div>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                                  constraints: {e.constraintCount} • aspirations: {e.aspirationCount}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Enablers (aspirations dominating dependencies)</div>
                        {lensInsights.enablers.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No enablers detected yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {lensInsights.enablers.map((e) => (
                              <div key={e.id} className="rounded-md border px-2 py-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">{e.toDomain}</div>
                                  <div className="text-xs text-muted-foreground tabular-nums">mentions: {e.count}</div>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                                  aspirations: {e.aspirationCount} • constraints: {e.constraintCount}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Dependencies mentioned (what this domain references)</div>
                        {lensInsights.dependencies.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No dependencies detected yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {lensInsights.dependencies.map((e) => (
                              <div key={e.id} className="flex items-center justify-between rounded-md border px-2 py-2">
                                <div className="text-sm font-medium">{e.toDomain}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">{e.count}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Inbound (other domains referencing this one)</div>
                        {lensInsights.inbound.length === 0 ? (
                          <div className="text-sm text-muted-foreground">None yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {lensInsights.inbound.map((e) => (
                              <div key={e.id} className="flex items-center justify-between rounded-md border px-2 py-2">
                                <div className="text-sm font-medium">{e.fromDomain}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">{e.count}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Synthesis</CardTitle>
                  <CardDescription>Dominant themes by domain (weighted by repetition and recency)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['People', 'Operations', 'Customer', 'Technology', 'Regulation'] as LiveDomain[]).map((d) => {
                    const s = synthesisByDomain[d];
                    const hasAny =
                      (s?.aspirations?.length || 0) +
                        (s?.constraints?.length || 0) +
                        (s?.enablers?.length || 0) +
                        (s?.opportunities?.length || 0) >
                      0;

                    return (
                      <div key={d} className="rounded-md border p-3">
                        <div className="text-sm font-medium mb-2">{d}</div>
                        {!hasAny ? (
                          <div className="text-sm text-muted-foreground">No synthesis yet.</div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Aspirations</div>
                              <div className="space-y-2">
                                {(s?.aspirations || []).length === 0 ? (
                                  <div className="text-sm text-muted-foreground">—</div>
                                ) : (
                                  (s?.aspirations || []).map((x) => (
                                    <div key={x.themeId} className="rounded-md border bg-background px-2 py-2">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-medium">{x.label}</div>
                                        <div className="text-xs text-muted-foreground tabular-nums">×{x.strength}</div>
                                      </div>
                                      {x.examples?.[0] ? (
                                        <div className="mt-1 text-xs text-muted-foreground">{x.examples[0]}</div>
                                      ) : null}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Constraints</div>
                              <div className="space-y-2">
                                {(s?.constraints || []).length === 0 ? (
                                  <div className="text-sm text-muted-foreground">—</div>
                                ) : (
                                  (s?.constraints || []).map((x) => (
                                    <div key={x.themeId} className="rounded-md border bg-background px-2 py-2">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-medium">{x.label}</div>
                                        <div className="text-xs text-muted-foreground tabular-nums">×{x.strength}</div>
                                      </div>
                                      {x.examples?.[0] ? (
                                        <div className="mt-1 text-xs text-muted-foreground">{x.examples[0]}</div>
                                      ) : null}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Enablers</div>
                              <div className="space-y-2">
                                {(s?.enablers || []).length === 0 ? (
                                  <div className="text-sm text-muted-foreground">—</div>
                                ) : (
                                  (s?.enablers || []).map((x) => (
                                    <div key={x.themeId} className="rounded-md border bg-background px-2 py-2">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-medium">{x.label}</div>
                                        <div className="text-xs text-muted-foreground tabular-nums">×{x.strength}</div>
                                      </div>
                                      {x.examples?.[0] ? (
                                        <div className="mt-1 text-xs text-muted-foreground">{x.examples[0]}</div>
                                      ) : null}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Opportunities</div>
                              <div className="space-y-2">
                                {(s?.opportunities || []).length === 0 ? (
                                  <div className="text-sm text-muted-foreground">—</div>
                                ) : (
                                  (s?.opportunities || []).map((x) => (
                                    <div key={x.themeId} className="rounded-md border bg-background px-2 py-2">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-medium">{x.label}</div>
                                        <div className="text-xs text-muted-foreground tabular-nums">×{x.strength}</div>
                                      </div>
                                      {x.examples?.[0] ? (
                                        <div className="mt-1 text-xs text-muted-foreground">{x.examples[0]}</div>
                                      ) : null}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Live spider (domains)</CardTitle>
                  <CardDescription>Distribution across People / Operations / Customer / Technology / Regulation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-w-0">
                    <LiveDomainRadar counts={domainCounts} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pressure points</CardTitle>
                  <CardDescription>Recurring blockers where constraints dominate aspirations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pressurePoints.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No pressure points detected yet.</div>
                  ) : (
                    pressurePoints.map((p) => (
                      <div key={p.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">
                            {p.fromDomain} → {p.toDomain}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">mentions: {p.count}</div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                          constraints: {p.constraintCount} • aspirations: {p.aspirationCount}
                        </div>
                      </div>
                    ))
                  )}
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
                            className="w-full min-w-0 text-left rounded-md border bg-background px-2 py-2 hover:bg-muted/40"
                            onClick={() => setSelectedNodeId(n.dataPointId)}
                          >
                            <div className="text-xs text-muted-foreground">
                              {n.classification?.primaryType ?? 'UNCLASSIFIED'}
                            </div>
                            <div className="min-w-0 text-sm font-medium whitespace-normal break-words">
                              {n.rawText}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
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

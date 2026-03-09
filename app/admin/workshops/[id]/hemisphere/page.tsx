'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AgentOrchestrationPanel,
  type AgentConversationEntry,
} from '@/components/cognitive-guidance/agent-orchestration-panel';
import { HemisphereDiagnosticPanel } from '@/components/hemisphere/hemisphere-diagnostic';
import type { HemisphereDiagnostic, DiagnosticDelta } from '@/lib/types/hemisphere-diagnostic';
import { HemisphereGuide } from '@/components/help/HemisphereGuide';
import {
  DEMO_DIAGNOSTIC_BEFORE,
  DEMO_DIAGNOSTIC_AFTER,
  DEMO_DIAGNOSTIC_DELTA,
} from '@/lib/hemisphere-diagnostic/demo-diagnostic';

/* ─────────────────────────── Types ─────────────────────────── */

type NodeType = 'VISION' | 'BELIEF' | 'CHALLENGE' | 'FRICTION' | 'CONSTRAINT' | 'ENABLER' | 'EVIDENCE';
type HemisphereLayer = 'H1' | 'H2' | 'H3' | 'H4';

type HemisphereNode = {
  id: string;
  type: NodeType;
  label: string;
  summary?: string;
  phaseTags: string[];
  layer: HemisphereLayer;
  weight: number;
  severity?: number;
  confidence?: number;
  sources: { sessionId: string; participantName: string }[];
  evidence?: { quote?: string; qaTag?: string; createdAt?: string; chunkId?: string }[];
};

type HemisphereEdge = {
  id: string;
  source: string;
  target: string;
  strength: number;
  kind: 'EQUIVALENT' | 'REINFORCING' | 'DERIVATIVE' | 'EVIDENCE_LINK';
};

type HemisphereGraph = {
  nodes: HemisphereNode[];
  edges: HemisphereEdge[];
  coreTruthNodeId: string;
};

type IndustryDimension = {
  name: string;
  description: string;
  keywords: string[];
  color: string;
};

type HemisphereResponse = {
  ok: boolean;
  workshopId: string;
  runType: 'BASELINE' | 'FOLLOWUP';
  generatedAt: string;
  sessionCount: number;
  participantCount: number;
  hemisphereGraph: HemisphereGraph;
  snapshotId?: string;
  snapshotName?: string;
  error?: string;
  industryDimensions?: IndustryDimension[] | null;
};

type Snapshot = { id: string; name: string; dialoguePhase: string; createdAt: string };

type ActorJourneyStep = {
  order: number;
  action: string;
  channel?: string;
  actors: string[];
  sentiment: string;
  insights: string[];
  painPoints: string[];
};

type ActorSummary = {
  name: string;
  role: string;
  mentionCount: number;
  domains: string[];
  sentimentBreakdown: Record<string, number>;
  keyInteractions: Array<{ withActor: string; frequency: number; primaryAction: string; primarySentiment: string }>;
};

type ActorJourneyResponse = {
  ok: boolean;
  journey: { centralActor: string; steps: ActorJourneyStep[] } | null;
  actors: ActorSummary[];
  generatedAt: string;
};

type PageProps = { params: Promise<{ id: string }> };

/* ─────────────────────────── Constants ─────────────────────────── */

const ALL_DOMAIN_TAB: { key: string; label: string; color: string } = { key: 'all', label: 'All Lenses', color: '#94a3b8' };
const ALL_TYPES: NodeType[] = ['VISION', 'BELIEF', 'CHALLENGE', 'FRICTION', 'CONSTRAINT', 'ENABLER'];

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','has','have','i','if','in','into','is','it','its','me','my','no','not','of','on','or','our','so','that','the','their','then','there','these','they','this','to','too','up','us','was','we','were','what','when','where','which','who','why','will','with','you','your',
]);

/* ─────────────────────────── Utility Functions ─────────────────────────── */

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function colorForType(type: NodeType): { fill: string; glow: string } {
  switch (type) {
    case 'VISION': return { fill: '#60a5fa', glow: 'rgba(96,165,250,0.85)' };
    case 'BELIEF': return { fill: '#a78bfa', glow: 'rgba(167,139,250,0.85)' };
    case 'CHALLENGE': return { fill: '#fb7185', glow: 'rgba(251,113,133,0.85)' };
    case 'FRICTION': return { fill: '#f97316', glow: 'rgba(249,115,22,0.85)' };
    case 'CONSTRAINT': return { fill: '#ef4444', glow: 'rgba(239,68,68,0.85)' };
    case 'ENABLER': return { fill: '#34d399', glow: 'rgba(52,211,153,0.85)' };
    case 'EVIDENCE': return { fill: '#94a3b8', glow: 'rgba(148,163,184,0.75)' };
  }
}

function labelForType(type: NodeType) {
  return type[0] + type.slice(1).toLowerCase();
}

function uniq<T>(arr: T[]) {
  return [...new Set(arr)];
}

function words(text: string): string[] {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).map((s) => s.trim()).filter(Boolean).filter((w) => w.length >= 3).filter((w) => !STOPWORDS.has(w));
}

function tokenSet(text: string): Set<string> {
  return new Set(words(text));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni <= 0 ? 0 : inter / uni;
}

function sentimentColor(sentiment: string): string {
  const s = (sentiment || '').toLowerCase();
  if (s.includes('frustrat') || s.includes('critical') || s.includes('angry') || s.includes('negative')) return '#ef4444';
  if (s.includes('concern') || s.includes('delay') || s.includes('slow') || s.includes('anxious')) return '#f59e0b';
  if (s.includes('positive') || s.includes('smooth') || s.includes('empower') || s.includes('satisfied')) return '#34d399';
  return '#94a3b8';
}

/* ─────────────────────────── 3D Hemisphere Types ─────────────────────────── */

type Vec3 = { x: number; y: number; z: number };
type NodePose = { id: string; p: Vec3; clusterId: string; layer: HemisphereLayer; type: NodeType };

/* ─────────────────────────── Mini Hemisphere Canvas ─────────────────────────── */

function MiniHemisphere({
  nodes,
  edges,
  coreTruthNodeId,
  label,
  nodeCount,
  color,
  active,
  onClick,
}: {
  nodes: HemisphereNode[];
  edges: HemisphereEdge[];
  coreTruthNodeId: string;
  label: string;
  nodeCount: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (tMs: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = 180 * dpr;
      const h = 120 * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // Full sphere: center in middle
      const cx = w / 2;
      const cy = h * 0.50;
      const R = Math.min(w, h) * 0.36;

      ctx.clearRect(0, 0, w, h);

      // Background
      const bg = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.2);
      bg.addColorStop(0, 'rgba(2,6,23,1)');
      bg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Full sphere outline
      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Nodes
      const spin = tMs * 0.00003;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);

      for (const n of nodes) {
        if (n.id === coreTruthNodeId) continue;
        const u = hash01(`u:${n.id}`);
        const v = hash01(`v:${n.id}`);
        const theta = u * Math.PI * 2;
        // Full sphere: phi from 0 to π
        const phi = Math.PI * clamp01(0.05 + v * 0.9);
        const radial = Math.sin(phi);
        const py = Math.cos(phi);
        const px = Math.cos(theta) * radial;
        const pz = Math.sin(theta) * radial;

        const rx = px * cs - pz * sn;
        const rz = px * sn + pz * cs;
        const depth = (rz + 1) / 2;
        const persp = 0.7 + depth * 0.5;

        const sx = cx + rx * R * persp;
        const sy = cy - py * R * persp;
        const r = (1.0 + Math.sqrt(Math.max(1, n.weight || 1)) * 0.45) * dpr * persp;

        const palette = colorForType(n.type);
        const alpha = 0.4 + depth * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = palette.fill;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [nodes, coreTruthNodeId]);

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center rounded-lg border transition-all ${
        active
          ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
          : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/5'
      }`}
      style={{ width: 180, height: 150 }}
    >
      <canvas ref={canvasRef} className="w-full rounded-t-lg" style={{ height: 110 }} />
      <div className="flex items-center gap-1.5 py-1">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-medium text-slate-200">{label}</span>
        <Badge variant="outline" className="h-4 border-white/20 px-1 text-[10px] text-slate-300">
          {nodeCount}
        </Badge>
      </div>
    </button>
  );
}

/* ─────────────────────────── Insight Interpretation Panel ─────────────────────────── */

function DomainSynthesisCard({
  domain,
  nodes,
  edges,
  allNodes,
  domainTabs,
}: {
  domain: string;
  nodes: HemisphereNode[];
  edges: HemisphereEdge[];
  allNodes: HemisphereNode[];
  domainTabs: { key: string; label: string; color: string }[];
}) {
  const nonEvidence = useMemo(() => nodes.filter((n) => n.type !== 'EVIDENCE'), [nodes]);

  const visionNodes = useMemo(
    () => nonEvidence.filter((n) => n.type === 'VISION' || n.type === 'BELIEF')
      .sort((a, b) => (b.weight || 0) - (a.weight || 0)),
    [nonEvidence],
  );
  const enablerNodes = useMemo(
    () => nonEvidence.filter((n) => n.type === 'ENABLER')
      .sort((a, b) => (b.weight || 0) - (a.weight || 0)),
    [nonEvidence],
  );
  const frictionNodes = useMemo(
    () => nonEvidence.filter((n) => n.type === 'CONSTRAINT' || n.type === 'FRICTION')
      .sort((a, b) => (b.weight || 0) - (a.weight || 0)),
    [nonEvidence],
  );
  const challengeNodes = useMemo(
    () => nonEvidence.filter((n) => n.type === 'CHALLENGE')
      .sort((a, b) => (b.weight || 0) - (a.weight || 0)),
    [nonEvidence],
  );

  // ── 1. Organisational Mindset ──
  const mindsetInsight = useMemo(() => {
    const total = Math.max(1, nonEvidence.length);
    const vPct = Math.round((visionNodes.length / total) * 100);
    const ePct = Math.round((enablerNodes.length / total) * 100);
    const fPct = Math.round(((frictionNodes.length + challengeNodes.length) / total) * 100);
    const top2 = (arr: HemisphereNode[]) => arr.slice(0, 2).map((n) => n.label).filter(Boolean);

    if (vPct >= fPct && vPct >= ePct && visionNodes.length > 0) {
      const tv = top2(visionNodes);
      return `Participant thinking is strongly oriented toward future possibility — ${vPct}% of signals describe aspirational states.${tv.length ? ` The clearest ambitions centre on ${tv.join(' and ')}.` : ''}${fPct > 30 ? ' Significant friction exists alongside this ambition.' : ' Enabling signals suggest confidence in delivery capability.'}`;
    }
    if (ePct >= fPct && enablerNodes.length > 0) {
      const te = top2(enablerNodes);
      return `The organisation's thinking is grounded in operational capability${te.length ? `, particularly ${te.join(' and ')}` : ''}.${vPct > 20 ? ' Vision signals are present but secondary to practical enablement thinking.' : ' Aspirational thinking is limited — participants focus on what is achievable now rather than what is possible.'}`;
    }
    if (frictionNodes.length + challengeNodes.length > 0) {
      const tf = top2(frictionNodes);
      return `Participant thinking is dominated by friction and constraint — ${fPct}% of signals identify barriers rather than possibilities${tf.length ? `, principally ${tf.join(' and ')}` : ''}.${vPct > 15 ? ' Some aspirational signal exists but is outweighed by systemic concern.' : ' Vision signals are weak, suggesting the organisation struggles to look beyond immediate problems.'}`;
    }
    return 'Insufficient signal to determine dominant organisational mindset.';
  }, [visionNodes, enablerNodes, frictionNodes, challengeNodes, nonEvidence]);

  // ── 2. Primary Frictions ──
  const topFrictions = useMemo(
    () => [...frictionNodes, ...challengeNodes]
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, 4),
    [frictionNodes, challengeNodes],
  );

  // ── 3. Vision Signals ──
  const topVisions = useMemo(() => visionNodes.slice(0, 4), [visionNodes]);

  // ── 4. Transformation Readiness ──
  const readiness = useMemo(() => {
    const forward = visionNodes.length + enablerNodes.length;
    const friction = frictionNodes.length + challengeNodes.length;
    const ratio = forward / Math.max(1, friction);
    const en0 = enablerNodes[0]?.label;
    if (ratio >= 1.8)
      return {
        level: 'Strong Potential',
        color: '#10b981',
        bg: 'rgba(16,185,129,0.12)',
        border: 'rgba(16,185,129,0.25)',
        text: `Enabling and aspirational signals outweigh barriers${en0 ? ` — "${en0}" represents genuine operational capability to act` : ''}. The organisation demonstrates real transformation potential.`,
      };
    if (ratio >= 0.8)
      return {
        level: 'Moderate Readiness',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.25)',
        text: 'Vision and friction signals are in close balance. Genuine transformation ambition exists but structural barriers will slow delivery — execution will require deliberate focus on resolving constraints before scaling change.',
      };
    return {
      level: 'Structural Resistance',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.25)',
      text: "Friction and constraint signals significantly outweigh forward-looking signals. The organisation's capacity for self-directed transformation appears limited — systemic barriers must be addressed before vision can be meaningfully pursued.",
    };
  }, [visionNodes, enablerNodes, frictionNodes, challengeNodes]);

  // ── 5. Critical Dependency — most-connected friction/challenge node ──
  const criticalDep = useMemo(() => {
    const frAll = [...frictionNodes, ...challengeNodes];
    if (frAll.length === 0) return null;
    const nodeIds = new Set(nonEvidence.map((n) => n.id));
    const degree = new Map<string, number>();
    for (const e of edges) {
      if (nodeIds.has(e.source)) degree.set(e.source, (degree.get(e.source) || 0) + 1);
      if (nodeIds.has(e.target)) degree.set(e.target, (degree.get(e.target) || 0) + 1);
    }
    return frAll.sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))[0];
  }, [frictionNodes, challengeNodes, edges, nonEvidence]);

  if (nonEvidence.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-slate-400">
          No signals in {domainTabs.find((d) => d.key === domain)?.label || 'this domain'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── 1. Organisational Mindset ── */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] text-violet-400">◈</span>
          <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Organisational Mindset</span>
        </div>
        <p className="text-[10px] text-slate-500 mb-2.5">What the organisation collectively thinks about most</p>
        <p className="text-xs text-slate-200 leading-relaxed">{mindsetInsight}</p>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {visionNodes.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
              {visionNodes.length} vision signal{visionNodes.length !== 1 ? 's' : ''}
            </span>
          )}
          {enablerNodes.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">
              {enablerNodes.length} enabler{enablerNodes.length !== 1 ? 's' : ''}
            </span>
          )}
          {(frictionNodes.length + challengeNodes.length) > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300">
              {frictionNodes.length + challengeNodes.length} friction signal{(frictionNodes.length + challengeNodes.length) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Primary Frictions ── */}
      {topFrictions.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] text-red-400">▲</span>
            <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Primary Frictions</span>
          </div>
          <p className="text-[10px] text-slate-500 mb-2.5">Where the organisation is blocked</p>
          <div>
            {topFrictions.map((n) => (
              <div key={n.id} className="flex items-start gap-2 py-1.5 border-t border-white/5 first:border-t-0">
                <span className="w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0 bg-red-400" />
                <span className="text-xs text-slate-300 leading-snug">{n.summary || n.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Vision Signals ── */}
      {topVisions.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] text-emerald-400">◎</span>
            <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Vision Signals</span>
          </div>
          <p className="text-[10px] text-slate-500 mb-2.5">What the organisation wants to become</p>
          <div>
            {topVisions.map((n) => (
              <div key={n.id} className="flex items-start gap-2 py-1.5 border-t border-white/5 first:border-t-0">
                <span className="w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0 bg-emerald-400" />
                <span className="text-xs text-slate-300 leading-snug">{n.summary || n.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Transformation Readiness ── */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px]" style={{ color: readiness.color }}>≡</span>
          <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Transformation Readiness</span>
        </div>
        <p className="text-[10px] text-slate-500 mb-2.5">Whether the organisation appears capable of change</p>
        <div className="mb-2.5">
          <span
            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: readiness.bg, color: readiness.color, border: `1px solid ${readiness.border}` }}
          >
            {readiness.level}
          </span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed">{readiness.text}</p>
      </div>

      {/* ── 5. Critical Dependency ── */}
      {criticalDep && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] text-amber-400">⊕</span>
            <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Critical Dependency</span>
          </div>
          <p className="text-[10px] text-slate-500 mb-2.5">The most important prerequisite for achieving the vision</p>
          <p className="text-xs text-slate-200 leading-relaxed">{criticalDep.summary || criticalDep.label}</p>
        </div>
      )}

    </div>
  );
}

/* ─────────────────────────── Actor Journey Panel ─────────────────────────── */

function ActorJourneyPanel({ workshopId, snapshotId, domainTabs }: { workshopId: string; snapshotId?: string; domainTabs: Array<{ key: string; label: string; color: string }> }) {
  const [data, setData] = useState<ActorJourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActors = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (snapshotId) params.set('snapshotId', snapshotId);
        const r = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere/actors?${params.toString()}`,
          { cache: 'no-store' }
        );
        const json = (await r.json().catch(() => null)) as ActorJourneyResponse | null;
        if (!r.ok || !json?.ok) {
          setError('Failed to load actor journey');
          return;
        }
        setData(json);
      } catch {
        setError('Failed to load actor journey');
      } finally {
        setLoading(false);
      }
    };
    void fetchActors();
  }, [workshopId, snapshotId]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-sm text-slate-400">Synthesising actor journey...</div></div>;
  if (error) return <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>;
  if (!data?.actors?.length) return <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-400">No actors detected in workshop data. Actors are extracted from live workshop conversations about business roles and personas.</div>;

  const journey = data.journey;
  const actors = data.actors;

  return (
    <div className="space-y-4">
      {/* Journey Flow */}
      {journey && journey.steps.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
          <div className="mb-3 text-[11px] font-medium text-slate-300">
            Customer Journey Flow
          </div>
          <div className="relative pl-4">
            {/* Vertical spine line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-blue-400/50 via-slate-500/30 to-slate-500/10" />

            {journey.steps.map((step, idx) => (
              <div key={idx} className="relative mb-4 last:mb-0">
                {/* Dot on the spine */}
                <div
                  className="absolute -left-[9px] top-1 h-3 w-3 rounded-full border-2 border-black"
                  style={{ backgroundColor: sentimentColor(step.sentiment) }}
                />

                <div className="ml-3 rounded-md border border-white/10 bg-black/30 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-200">{step.order}. {step.action}</span>
                    {step.channel && (
                      <Badge variant="outline" className="h-4 border-white/15 px-1 text-[9px] text-slate-400">
                        {step.channel}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-1">
                    {step.actors.map((a) => (
                      <span key={a} className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {a}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 mb-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sentimentColor(step.sentiment) }} />
                    <span className="text-[10px] text-slate-400 capitalize">{step.sentiment}</span>
                  </div>

                  {step.insights.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {step.insights.slice(0, 2).map((ins, i) => (
                        <div key={i} className="text-[10px] text-slate-400 italic">&quot;{ins}&quot;</div>
                      ))}
                    </div>
                  )}

                  {step.painPoints.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {step.painPoints.slice(0, 2).map((pp, i) => (
                        <div key={i} className="text-[10px] text-red-400/80">! {pp}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actor Cards */}
      <div className="space-y-3">
        <div className="text-[11px] font-medium text-slate-300">Actor Summary</div>
        {actors.map((actor) => {
          const total = Object.values(actor.sentimentBreakdown || {}).reduce((a, b) => a + b, 0);
          return (
            <div key={actor.name} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100">{actor.name}</span>
                  <Badge variant="outline" className="h-4 border-white/15 px-1.5 text-[10px] text-slate-400">
                    {actor.mentionCount} mention{actor.mentionCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 mb-2">{actor.role}</div>

              {actor.domains.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {actor.domains.map((d) => {
                    const tab = domainTabs.find((t) => t.key === d);
                    return (
                      <span key={d} className="rounded-full px-1.5 py-0.5 text-[10px] text-slate-300 capitalize" style={{ backgroundColor: `${tab?.color || '#94a3b8'}20`, border: `1px solid ${tab?.color || '#94a3b8'}40` }}>
                        {tab?.label || d}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Sentiment bar */}
              {total > 0 && (
                <div className="mb-2">
                  <div className="flex h-2 overflow-hidden rounded-full bg-black/20">
                    {Object.entries(actor.sentimentBreakdown).map(([sentiment, count]) => (
                      <div
                        key={sentiment}
                        className="h-full"
                        style={{ width: `${(count / total) * 100}%`, backgroundColor: sentimentColor(sentiment) }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    {Object.entries(actor.sentimentBreakdown).map(([sentiment, count]) => (
                      <span key={sentiment} className="flex items-center gap-0.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sentimentColor(sentiment) }} />
                        {sentiment}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key interactions */}
              {actor.keyInteractions?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500">Key Interactions</div>
                  {actor.keyInteractions.slice(0, 3).map((ki, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                      <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: sentimentColor(ki.primarySentiment) }} />
                      <span className="text-slate-300">{ki.primaryAction}</span>
                      <span className="text-slate-500">with</span>
                      <span className="text-slate-300">{ki.withActor}</span>
                      <span className="text-slate-500">({ki.frequency}x)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Main Page Component ─────────────────────────── */

type AccessibleWorkshop = {
  id: string;
  name: string;
  status: string;
  scheduledDate: string | null;
  snapshotCount: number;
};

export default function WorkshopHemispherePage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [runType, setRunType] = useState<'BASELINE' | 'FOLLOWUP'>('BASELINE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HemisphereResponse | null>(null);

  // Access denial state — when 403, show workshop picker instead of error
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedOrgName, setAccessDeniedOrgName] = useState<string | null>(null);
  const [accessibleWorkshops, setAccessibleWorkshops] = useState<AccessibleWorkshop[]>([]);

  // Snapshot management
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [showSnapshotDropdown, setShowSnapshotDropdown] = useState(false);

  // Report generation
  const [generating, setGenerating] = useState(false);

  // Agent orchestration panel for synthesis
  const [agentConversation, setAgentConversation] = useState<AgentConversationEntry[]>([]);
  const [agentPanelCollapsed, setAgentPanelCollapsed] = useState(false);

  // Domain tabs — dynamic from research dimensions
  const [activeDomain, setActiveDomain] = useState<string>('all');
  const [rightTab, setRightTab] = useState<'synthesis' | 'actors' | 'diagnostic'>('synthesis');

  // Diagnostic state
  const [diagnosticBefore, setDiagnosticBefore] = useState<HemisphereDiagnostic | null>(null);
  const [diagnosticAfter, setDiagnosticAfter] = useState<HemisphereDiagnostic | null>(null);
  const [diagnosticDelta, setDiagnosticDelta] = useState<DiagnosticDelta | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  // Canvas & interaction
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const hitMapRef = useRef<Map<string, { x: number; y: number; r: number }>>(new Map());

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoomClusterId, setZoomClusterId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const prevRunTypeRef = useRef<'BASELINE' | 'FOLLOWUP'>('BASELINE');
  const transitionRef = useRef<{ startMs: number; from: Map<string, NodePose> } | null>(null);
  const prevPositionsRef = useRef<Map<string, NodePose>>(new Map());

  const [phaseFilter, setPhaseFilter] = useState<Record<string, boolean>>({});
  const [typeFilter, setTypeFilter] = useState<Record<NodeType, boolean>>({
    VISION: true, BELIEF: true, CHALLENGE: true, FRICTION: true, CONSTRAINT: true, ENABLER: true, EVIDENCE: false,
  });
  const [minWeight, setMinWeight] = useState(0);
  const [nodeSizeScale, setNodeSizeScale] = useState(50); // 0-100 slider, 50 = default

  // Fetch snapshots
  useEffect(() => {
    const fetchSnapshots = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/live/snapshots`);
        const json = await r.json().catch(() => null);
        if (json?.ok && Array.isArray(json.snapshots)) {
          setSnapshots(json.snapshots);
        }
      } catch { /* ignore */ }
    };
    void fetchSnapshots();
  }, [workshopId]);

  // Auto-select snapshot from URL query parameter (e.g. from "Review in Hemisphere" button)
  useEffect(() => {
    const snapshotIdFromUrl = searchParams.get('snapshotId');
    if (snapshotIdFromUrl && snapshots.length > 0 && snapshots.some(s => s.id === snapshotIdFromUrl)) {
      setSelectedSnapshotId(snapshotIdFromUrl);
    }
  }, [searchParams, snapshots]);

  // Auto-select most recent snapshot when no URL param specified
  useEffect(() => {
    if (searchParams.get('snapshotId')) return;  // URL param takes priority
    if (selectedSnapshotId) return;               // Already selected
    if (snapshots.length === 0) return;           // No snapshots yet
    // snapshots are ordered by createdAt desc from the API
    setSelectedSnapshotId(snapshots[0].id);
  }, [snapshots, searchParams, selectedSnapshotId]);

  // Fetch hemisphere data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        let url: string;
        if (selectedSnapshotId) {
          url = `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?source=snapshot&snapshotId=${encodeURIComponent(selectedSnapshotId)}&bust=${Date.now()}`;
        } else {
          url = `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?runType=${encodeURIComponent(runType)}&bust=${Date.now()}`;
        }
        const r = await fetch(url, { cache: 'no-store' });
        const json = (await r.json().catch(() => null)) as (HemisphereResponse & { workshopOrgName?: string }) | null;
        if (!r.ok || !json || !json.ok) {
          // On 403, fetch accessible workshops and show picker instead of error
          if (r.status === 403) {
            setAccessDenied(true);
            setAccessDeniedOrgName(json?.workshopOrgName || null);
            try {
              const wRes = await fetch('/api/admin/workshops?limit=100', { cache: 'no-store' });
              const wJson = await wRes.json().catch(() => null);
              if (wJson?.workshops) {
                setAccessibleWorkshops(wJson.workshops as AccessibleWorkshop[]);
              }
            } catch { /* ignore */ }
            return;
          }
          setData(null);
          setError(json && typeof json.error === 'string' ? json.error : 'Failed to load hemisphere');
          return;
        }
        setAccessDenied(false);
        setData(json);
      } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load hemisphere');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [workshopId, runType, selectedSnapshotId]);

  useEffect(() => {
    setHoveredNodeId(null);
    setSelectedNodeId(null);
    setZoomClusterId(null);
  }, [runType, workshopId, selectedSnapshotId]);

  useEffect(() => {
    if (prevRunTypeRef.current !== runType) {
      prevRunTypeRef.current = runType;
      transitionRef.current = { startMs: performance.now(), from: new Map(prevPositionsRef.current) };
    }
  }, [runType]);

  // Fetch diagnostic data when diagnostic tab is selected
  const isRetailDemo = workshopId === 'retail-cx-workshop';
  useEffect(() => {
    if (rightTab !== 'diagnostic') return;
    if (diagnosticLoading) return;
    // Already loaded (including demo data)
    if (diagnosticBefore || diagnosticAfter) return;

    // Use instant demo data for the retail workshop
    if (isRetailDemo) {
      setDiagnosticBefore(DEMO_DIAGNOSTIC_BEFORE);
      setDiagnosticAfter(DEMO_DIAGNOSTIC_AFTER);
      setDiagnosticDelta(DEMO_DIAGNOSTIC_DELTA);
      return;
    }

    const fetchDiagnostic = async () => {
      try {
        setDiagnosticLoading(true);
        let url = `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere/diagnostic`;
        if (selectedSnapshotId) {
          url += `?snapshotId=${encodeURIComponent(selectedSnapshotId)}`;
        }
        const r = await fetch(url, { cache: 'no-store' });
        const json = await r.json().catch(() => null);
        if (json?.ok) {
          setDiagnosticBefore(json.before || null);
          setDiagnosticAfter(json.after || null);
          setDiagnosticDelta(json.delta || null);
        }
      } catch (e) {
        console.warn('[Diagnostic] Fetch failed:', e);
      } finally {
        setDiagnosticLoading(false);
      }
    };
    void fetchDiagnostic();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightTab, workshopId, selectedSnapshotId, isRetailDemo]);


  // Generate report handler — streams agent conversation via SSE
  const handleGenerateReport = async () => {
    if (generating) return;
    setGenerating(true);
    setAgentConversation([]);
    setAgentPanelCollapsed(false);

    try {
      const res = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere/synthesise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: selectedSnapshotId }),
      });

      if (!res.ok || !res.body) {
        // Non-streaming error — try parse JSON
        const json = await res.json().catch(() => null);
        alert(json?.error || 'Failed to generate report');
        setGenerating(false);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let synthesisResult: { ok?: boolean; error?: string } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'agent.conversation') {
                setAgentConversation((prev) => [...prev, data as AgentConversationEntry]);
              } else if (eventType === 'synthesis.complete') {
                synthesisResult = data;
              } else if (eventType === 'synthesis.error') {
                synthesisResult = { ok: false, error: data?.error || 'Synthesis failed' };
              }
            } catch {
              // Ignore parse errors
            }
            eventType = '';
          } else if (line === '') {
            eventType = '';
          }
        }
      }

      // Handle result
      if (synthesisResult && synthesisResult.ok) {
        window.open(`/admin/workshops/${encodeURIComponent(workshopId)}/intelligence`, '_blank');
      } else if (synthesisResult?.error) {
        alert(`Synthesis failed: ${synthesisResult.error}`);
      }
    } catch (e) {
      alert('Failed to generate report. Check the console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const graph = data?.hemisphereGraph || null;
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const maxWeight = useMemo(() => nodes.reduce((m, n) => Math.max(m, n.weight || 0), 1), [nodes]);

  // Domain tabs — built from blueprint/research lenses returned by the API.
  // No hardcoded list: if the API returns no industryDimensions, only "All" is shown.
  const domainTabs = useMemo(() => {
    if (data?.industryDimensions?.length) {
      return [
        ALL_DOMAIN_TAB,
        ...data.industryDimensions.map(d => ({
          key: d.name.toLowerCase().replace(/\s+/g, '_'),
          label: d.name,
          color: d.color,
        })),
      ];
    }
    // Data not loaded yet or workshop has no blueprint lenses — show only "All"
    return [ALL_DOMAIN_TAB];
  }, [data?.industryDimensions]);

  const allPhases = useMemo(() => domainTabs.filter(t => t.key !== 'all').map(t => t.key), [domainTabs]);

  // Filter nodes for active domain
  const domainFilteredNodes = useMemo(() => {
    if (activeDomain === 'all') return nodes;
    return nodes.filter((n) => {
      const tags = (n.phaseTags || []).map((t) => String(t).toLowerCase());
      return tags.includes(activeDomain);
    });
  }, [nodes, activeDomain]);

  // Nodes per domain for mini-hemispheres
  const nodesPerDomain = useMemo(() => {
    const map: Record<string, HemisphereNode[]> = {};
    for (const domain of allPhases) {
      map[domain] = nodes.filter((n) => {
        const tags = (n.phaseTags || []).map((t) => String(t).toLowerCase());
        return tags.includes(domain);
      });
    }
    return map;
  }, [nodes]);

  const clusterByNodeId = useMemo(() => {
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x);
      if (!p) { parent.set(x, x); return x; }
      if (p === x) return x;
      const r = find(p); parent.set(x, r); return r;
    };
    const union = (a: string, b: string) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    for (const n of domainFilteredNodes) parent.set(n.id, n.id);
    for (const e of edges) {
      if (e.kind !== 'EQUIVALENT') continue;
      if (e.strength < 0.28) continue;
      if (!parent.has(e.source) || !parent.has(e.target)) continue;
      union(e.source, e.target);
    }
    const out = new Map<string, string>();
    for (const n of domainFilteredNodes) out.set(n.id, find(n.id));
    return out;
  }, [domainFilteredNodes, edges]);

  const degreeById = useMemo(() => {
    const deg = new Map<string, number>();
    for (const e of edges) {
      const w = Number.isFinite(e.strength) ? e.strength : 0;
      deg.set(e.source, (deg.get(e.source) || 0) + w);
      deg.set(e.target, (deg.get(e.target) || 0) + w);
    }
    return deg;
  }, [edges]);

  const baseVisibleNodes = useMemo(() => {
    const phaseOk = (n: HemisphereNode) => {
      if (activeDomain !== 'all') {
        const tags = (n.phaseTags || []).map((t) => String(t).toLowerCase());
        return tags.includes(activeDomain);
      }
      const tags = Array.isArray(n.phaseTags) ? n.phaseTags : [];
      if (tags.length === 0) return true;
      return tags.some((t) => {
        const key = String(t).toLowerCase();
        return (phaseFilter as Record<string, boolean>)[key] !== false;
      });
    };
    const typeOk = (n: HemisphereNode) => typeFilter[n.type] !== false;
    const weightOk = (n: HemisphereNode) => (n.weight || 0) >= minWeight;
    const base = domainFilteredNodes.filter((n) => n.type !== 'EVIDENCE' && phaseOk(n) && typeOk(n) && weightOk(n));
    base.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    return base;
  }, [domainFilteredNodes, phaseFilter, typeFilter, minWeight, activeDomain]);

  const selectedEvidenceNodes = useMemo(() => {
    if (!selectedNodeId) return [] as HemisphereNode[];
    const selected = nodeById.get(selectedNodeId);
    if (!selected || selected.type === 'EVIDENCE') return [] as HemisphereNode[];
    const sessionIds = new Set((selected.sources || []).map((s) => s.sessionId).filter(Boolean));
    if (sessionIds.size === 0) return [] as HemisphereNode[];
    const selectedTokens = tokenSet(`${selected.label} ${selected.summary || ''}`);
    return nodes
      .filter((n) => n.type === 'EVIDENCE' && (n.sources || []).some((s) => sessionIds.has(s.sessionId)))
      .map((n) => ({ n, sim: jaccard(selectedTokens, tokenSet(`${n.label} ${n.summary || ''}`)) }))
      .filter((r) => r.sim >= 0.08)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 12)
      .map((r) => r.n);
  }, [selectedNodeId, nodeById, nodes]);

  const visibleNodes = useMemo(() => {
    if (!selectedNodeId) return baseVisibleNodes;
    const ids = new Set(baseVisibleNodes.map((n) => n.id));
    const merged = [...baseVisibleNodes];
    for (const n of selectedEvidenceNodes) { if (!ids.has(n.id)) { merged.push(n); ids.add(n.id); } }
    return merged;
  }, [baseVisibleNodes, selectedEvidenceNodes, selectedNodeId]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const evidenceEdges = useMemo(() => {
    if (!selectedNodeId) return [] as HemisphereEdge[];
    return selectedEvidenceNodes.map((n) => ({
      id: `EVIDENCE_LINK:${selectedNodeId}:${n.id}`, source: selectedNodeId, target: n.id, strength: 0.9, kind: 'EVIDENCE_LINK' as const,
    }));
  }, [selectedEvidenceNodes, selectedNodeId]);

  const visibleEdges = useMemo(() => {
    const base = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
    return [...base, ...evidenceEdges];
  }, [edges, visibleNodeIds, evidenceEdges]);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) || null : null;

  const positions = useMemo(() => {
    const out = new Map<string, NodePose>();
    // Full sphere: phi ranges from 0 (top) to π (bottom)
    // Layer bands spread across the full sphere with spacing
    // Since EVIDENCE (H4) nodes are filtered out, spread H1-H3 across the FULL sphere
    const bandForLayer = (layer: HemisphereLayer): { a: number; b: number } => {
      if (layer === 'H1') return { a: 0.05, b: 0.28 };   // Top: Imagine & Design (Vision, Belief)
      if (layer === 'H2') return { a: 0.38, b: 0.62 };   // Middle: Transform & Enable (Enabler)
      if (layer === 'H3') return { a: 0.72, b: 0.95 };   // Bottom: Challenges & Constraints (Challenge, Friction, Constraint)
      return { a: 0.78, b: 0.95 };                        // H4 fallback (rarely visible)
    };
    const clusterTheta = new Map<string, number>();
    for (const n of visibleNodes) {
      const cid = clusterByNodeId.get(n.id) || n.id;
      if (!clusterTheta.has(cid)) clusterTheta.set(cid, hash01(cid) * Math.PI * 2);
    }
    for (const n of visibleNodes) {
      const cid = clusterByNodeId.get(n.id) || n.id;
      const baseTheta = clusterTheta.get(cid) || 0;
      const u = hash01(`u:${n.id}`);
      const v = hash01(`v:${n.id}`);
      const band = bandForLayer(n.layer);
      const phiT = lerp(band.a, band.b, v);
      // Full sphere: phi goes from 0 to π (not just 0 to π/2)
      const phi = Math.PI * clamp01(phiT);
      const theta = baseTheta + (u - 0.5) * 1.2;
      const radial = Math.sin(phi);
      const y = Math.cos(phi);
      const x = Math.cos(theta) * radial;
      const z = Math.sin(theta) * radial;
      const coreId = graph?.coreTruthNodeId;
      if (coreId && n.id === coreId) {
        out.set(n.id, { id: n.id, clusterId: 'CORE', layer: n.layer, type: n.type, p: { x: 0, y: 0, z: 0 } });
      } else {
        out.set(n.id, { id: n.id, clusterId: cid, layer: n.layer, type: n.type, p: { x, y, z } });
      }
    }
    return out;
  }, [visibleNodes, clusterByNodeId, graph?.coreTruthNodeId]);

  useEffect(() => { prevPositionsRef.current = positions; }, [positions]);

  const clusterCenters = useMemo(() => {
    const acc = new Map<string, { x: number; y: number; z: number; n: number }>();
    for (const pose of positions.values()) {
      const prev = acc.get(pose.clusterId) || { x: 0, y: 0, z: 0, n: 0 };
      prev.x += pose.p.x; prev.y += pose.p.y; prev.z += pose.p.z; prev.n += 1;
      acc.set(pose.clusterId, prev);
    }
    const out = new Map<string, Vec3>();
    for (const [cid, a] of acc.entries()) out.set(cid, { x: a.x / Math.max(1, a.n), y: a.y / Math.max(1, a.n), z: a.z / Math.max(1, a.n) });
    return out;
  }, [positions]);

  const adjacency = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of visibleEdges) {
      const a = m.get(e.source) || []; a.push(e.target); m.set(e.source, a);
      const b = m.get(e.target) || []; b.push(e.source); m.set(e.target, b);
    }
    return m;
  }, [visibleEdges]);

  const activeNodeSet = useMemo(() => {
    const id = hoveredNodeId || selectedNodeId;
    if (!id) return new Set<string>();
    const set = new Set<string>([id]);
    for (const other of adjacency.get(id) || []) set.add(other);
    return set;
  }, [hoveredNodeId, selectedNodeId, adjacency]);

  const activeEdgeSet = useMemo(() => {
    const id = hoveredNodeId || selectedNodeId;
    const set = new Set<string>();
    if (!id) return set;
    for (const e of visibleEdges) {
      if ((e.source === id && activeNodeSet.has(e.target)) || (e.target === id && activeNodeSet.has(e.source))) set.add(e.id);
    }
    return set;
  }, [hoveredNodeId, selectedNodeId, visibleEdges, activeNodeSet]);

  const updateHoverFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    let best: { id: string; d2: number } | null = null;
    for (const [id, p] of hitMapRef.current.entries()) {
      const dx = p.x - x; const dy = p.y - y; const d2 = dx * dx + dy * dy;
      if (d2 <= p.r * p.r && (!best || d2 < best.d2)) best = { id, d2 };
    }
    setHoveredNodeId(best ? best.id : null);
  }, []);

  /* ─── Canvas draw loop ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

    const project = (p: Vec3, w: number, h: number, tMs: number) => {
      // Full sphere: center in the middle of the canvas
      const cx = w / 2; const cy = h * 0.48; const R = Math.min(w, h) * 0.40;
      const spin = reduceMotion ? 0 : tMs * 0.00004;
      const cs = Math.cos(spin); const sn = Math.sin(spin);
      const x = p.x * cs - p.z * sn;
      const z = p.x * sn + p.z * cs;
      const y = p.y + (reduceMotion ? 0 : Math.sin(tMs * 0.001 + (x + z) * 3) * 0.012);
      const depth = (z + 1) / 2;
      const persp = 0.70 + depth * 0.55;
      return { x: cx + x * R * persp, y: cy - y * R * persp, z, persp };
    };

    const draw = (tMs: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

      // Full sphere: center in the middle of the canvas
      const cx = w / 2; const cy = h * 0.48; const R = Math.min(w, h) * 0.40;
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.35);
      bg.addColorStop(0, 'rgba(2,6,23,1)');
      bg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Full sphere wireframe guides
      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.lineWidth = Math.max(1, 1.1 * dpr);
      // Outer circle (full sphere silhouette)
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      // Concentric rings
      ctx.lineWidth = Math.max(1, 0.7 * dpr);
      ctx.strokeStyle = 'rgba(148,163,184,0.12)';
      for (const rr of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.arc(cx, cy, R * rr, 0, Math.PI * 2); ctx.stroke(); }
      // Equator line (horizontal ellipse to suggest 3D)
      ctx.strokeStyle = 'rgba(148,163,184,0.14)';
      ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      const cam = zoomClusterId ? clusterCenters.get(zoomClusterId) : null;
      const zoom = zoomClusterId ? 1.7 : 1;
      const hoverActive = !!hoveredNodeId;

      const proj = new Map<string, { x: number; y: number; z: number; s: number }>();
      const hit = new Map<string, { x: number; y: number; r: number }>();

      const trans = transitionRef.current;
      const transT = trans ? clamp01((tMs - trans.startMs) / 900) : 1;
      const transEase = easeInOutCubic(transT);
      if (trans && transT >= 1) transitionRef.current = null;

      const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
      const poseFor = (id: string): { p: Vec3 } | null => {
        const toPose = positions.get(id);
        if (!toPose) return null;
        const fromPose = trans?.from.get(id);
        if (!trans || !fromPose) return { p: toPose.p };
        return { p: lerpVec(fromPose.p, toPose.p, transEase) };
      };

      for (const n of visibleNodes) {
        const posed = poseFor(n.id);
        if (!posed) continue;
        const base = posed.p;
        const p = cam ? { x: base.x - cam.x, y: base.y - cam.y, z: base.z - cam.z } : base;
        const q = project(p, w, h, tMs);
        const x = (q.x - cx) * zoom + cx;
        const y = (q.y - cy) * zoom + cy;
        proj.set(n.id, { x, y, z: q.z, s: q.persp * zoom });
      }

      // Draw edges
      for (const e of visibleEdges) {
        const a = proj.get(e.source); const b = proj.get(e.target);
        if (!a || !b) continue;
        const active = activeEdgeSet.has(e.id);
        const alpha = active ? 0.82 : 0.26;
        const baseWidth = 0.75 + 1.55 * clamp01(e.strength);
        const unrelatedFade = hoverActive && hoveredNodeId && !(activeNodeSet.has(e.source) && activeNodeSet.has(e.target)) ? 0.30 : 1;
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(148,163,184,${clamp01(alpha) * unrelatedFade})`;
        ctx.lineWidth = Math.max(1, Math.min(2.8, baseWidth) * dpr * (active ? 1.25 : 1));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw nodes
      const ordered = [...visibleNodes]
        .map((n) => ({ n, q: proj.get(n.id) }))
        .filter((x): x is { n: HemisphereNode; q: { x: number; y: number; z: number; s: number } } => !!x.q)
        .sort((a, b) => a.q.z - b.q.z);

      // User-controlled size: slider 0-100, mapped to 0.3x – 2.5x multiplier (50 = 1x)
      const userScale = nodeSizeScale <= 50
        ? 0.3 + (nodeSizeScale / 50) * 0.7   // 0→0.3, 50→1.0
        : 1.0 + ((nodeSizeScale - 50) / 50) * 1.5; // 50→1.0, 100→2.5

      const influenceRadius = (n: HemisphereNode, q: { z: number; s: number }) => {
        const sev = typeof n.severity === 'number' ? clamp01((n.severity - 1) / 4) : 0.5;
        const conf = typeof n.confidence === 'number' ? clamp01(n.confidence) : 0.7;
        const cross = uniq((n.phaseTags || []).map((t) => String(t).toLowerCase())).length;
        const crossMult = 1 + 0.20 * Math.min(3, Math.max(0, cross - 1));
        const freq = Math.sqrt(Math.max(1, n.weight || 1));
        const depth = clamp01((q.z + 1) / 2);
        const depthMult = 0.85 + depth * 0.55;
        const sharpMult = 0.92 + conf * 0.16;
        return (1.6 + freq * 1.1) * (1 + sev * 0.8) * crossMult * depthMult * sharpMult * userScale;
      };

      let maxNormal = 1;
      const normalRadii: number[] = [];
      for (const { n, q } of ordered) {
        if (graph?.coreTruthNodeId && n.id === graph.coreTruthNodeId) continue;
        const rr = influenceRadius(n, q);
        maxNormal = Math.max(maxNormal, rr);
        normalRadii.push(rr);
      }
      normalRadii.sort((a, b) => a - b);
      const p90 = normalRadii.length ? normalRadii[Math.max(0, Math.min(normalRadii.length - 1, Math.floor(normalRadii.length * 0.9)))] : maxNormal;
      const normalRef = Math.max(1, p90 || maxNormal);

      for (const { n, q } of ordered) {
        const palette = colorForType(n.type);
        const active = activeNodeSet.has(n.id);
        const core = graph?.coreTruthNodeId && n.id === graph.coreTruthNodeId;
        const sev = typeof n.severity === 'number' ? clamp01((n.severity - 1) / 4) : 0.5;
        const conf = typeof n.confidence === 'number' ? clamp01(n.confidence) : 0.7;

        const baseSize = influenceRadius(n, q);
        const heartbeat = core && !reduceMotion ? 1 + 0.035 * Math.sin((tMs / 3800) * Math.PI * 2) : 1;
        const hoverScale = hoveredNodeId && n.id === hoveredNodeId ? 1.15 : 1;
        const size = (core ? normalRef * 2.35 * heartbeat : baseSize) * hoverScale;
        const r = size * q.s;
        hit.set(n.id, { x: q.x, y: q.y, r: r + 8 * q.s });

        const zoomedOut = !!zoomClusterId;
        const zoomClusterMatch = zoomClusterId ? (clusterByNodeId.get(n.id) || null) === zoomClusterId : true;
        const dimmed = zoomedOut && !zoomClusterMatch && !active;
        const unrelated = hoverActive && hoveredNodeId && !activeNodeSet.has(n.id);
        const unrelatedAlpha = unrelated ? 0.30 : 1;
        const baseGlow = 0.14 + sev * 0.62;
        const glowAlpha = core ? 0.98 : baseGlow + (active ? 0.28 : 0);
        const blur = (1 - conf) * 10 + (1 - clamp01((q.z + 1) / 2)) * 6;

        ctx.save();
        ctx.globalAlpha = clamp01((dimmed ? glowAlpha * 0.25 : glowAlpha) * unrelatedAlpha);
        ctx.fillStyle = core ? 'rgba(248,250,252,0.95)' : palette.glow;
        ctx.shadowColor = core ? 'rgba(191,219,254,0.95)' : palette.glow;
        ctx.shadowBlur = (reduceMotion ? 8 : 12) * q.s + blur;
        ctx.beginPath(); ctx.arc(q.x, q.y, r * (core ? 1.22 : 1.1), 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.save();
        const depth = clamp01((q.z + 1) / 2);
        const depthAlpha = 0.40 + depth * 0.60;
        ctx.globalAlpha = (dimmed ? 0.20 : active ? 1 : 0.92) * depthAlpha * unrelatedAlpha;
        ctx.fillStyle = core ? '#f8fafc' : palette.fill;
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = active ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.45)';
        ctx.lineWidth = Math.max(1, (active ? 1.4 : 1) * dpr);
        ctx.stroke();
        ctx.restore();
      }

      hitMapRef.current = hit;

      // Hover label
      if (hoveredNodeId) {
        const hn = nodeById.get(hoveredNodeId);
        const hp = proj.get(hoveredNodeId);
        if (hn && hp) {
          ctx.save();
          ctx.font = `${Math.max(12, 13 * dpr)}px ui-sans-serif, system-ui, -apple-system, Segoe UI`;
          const metrics = ctx.measureText(hn.label);
          const pad = 10 * dpr;
          const tw = metrics.width; const th = 16 * dpr;
          const boxW = tw + pad * 2; const boxH = th + pad;
          const x = Math.min(w - boxW - 6 * dpr, hp.x + 10 * dpr);
          const y = Math.max(6 * dpr, hp.y - boxH - 10 * dpr);
          ctx.fillStyle = 'rgba(15,23,42,0.92)';
          ctx.strokeStyle = 'rgba(148,163,184,0.35)';
          ctx.lineWidth = Math.max(1, 1 * dpr);
          const r0 = 8 * dpr;
          ctx.beginPath();
          ctx.moveTo(x + r0, y); ctx.lineTo(x + boxW - r0, y);
          ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + r0);
          ctx.lineTo(x + boxW, y + boxH - r0);
          ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - r0, y + boxH);
          ctx.lineTo(x + r0, y + boxH);
          ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r0);
          ctx.lineTo(x, y + r0); ctx.quadraticCurveTo(x, y, x + r0, y);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(226,232,240,0.95)';
          ctx.fillText(hn.label, x + pad, y + pad + th);
          ctx.restore();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [visibleNodes, visibleEdges, positions, activeNodeSet, activeEdgeSet, clusterCenters, zoomClusterId, graph?.coreTruthNodeId, hoveredNodeId, nodeById, clusterByNodeId, nodeSizeScale]);

  /* ─── Render ─── */
  // ── Access Denied: Show accessible workshop picker ──
  if (accessDenied) {
    const workshopsWithSnapshots = accessibleWorkshops.filter(w => w.snapshotCount > 0);
    const workshopsWithoutSnapshots = accessibleWorkshops.filter(w => w.snapshotCount === 0);
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="flex items-center border-b border-white/10 bg-black/80 px-4 py-2.5 flex-shrink-0">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-slate-200 hover:text-white hover:bg-white/10">
              ← Dashboard
            </Button>
          </Link>
          <h1 className="ml-4 text-sm font-medium text-white">Hemisphere</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-lg w-full mx-4">
            <div className="rounded-xl border border-white/10 bg-[#0f172a] p-8">
              <h2 className="text-xl font-semibold text-white mb-2">Select a Workshop</h2>
              <p className="text-sm text-slate-400 mb-1">
                {accessDeniedOrgName
                  ? `This workshop belongs to "${accessDeniedOrgName}" — you don't have access to it.`
                  : "You don't have access to this workshop."}
              </p>
              <p className="text-sm text-slate-500 mb-6">Choose one of your accessible workshops below:</p>

              {accessibleWorkshops.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">No workshops available.</p>
                  <p className="text-slate-500 text-xs mt-1">Create a workshop from the dashboard to get started.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {workshopsWithSnapshots.map(w => (
                    <button
                      key={w.id}
                      onClick={() => router.push(`/admin/workshops/${encodeURIComponent(w.id)}/hemisphere`)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{w.name}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                          {w.snapshotCount} snapshot{w.snapshotCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {w.scheduledDate && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          {new Date(w.scheduledDate).toLocaleDateString()}
                        </div>
                      )}
                    </button>
                  ))}
                  {workshopsWithoutSnapshots.length > 0 && workshopsWithSnapshots.length > 0 && (
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider px-2 pt-3 pb-1">Other workshops (no Insight Map data yet)</div>
                  )}
                  {workshopsWithoutSnapshots.map(w => (
                    <button
                      key={w.id}
                      onClick={() => router.push(`/admin/workshops/${encodeURIComponent(w.id)}/hemisphere`)}
                      className="w-full rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/5 px-4 py-3 text-left transition-colors opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">{w.name}</span>
                        <span className="text-[10px] text-slate-600">No snapshots</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/admin/workshops/${encodeURIComponent(workshopId)}`}>
            <Button variant="ghost" size="sm" className="text-slate-200 hover:text-white hover:bg-white/10">
              ← Back
            </Button>
          </Link>
          <div className="h-4 w-px bg-white/15" />
          <h1 className="text-sm font-semibold text-slate-100">Insight Map</h1>
          {data?.generatedAt && (
            <span className="text-[11px] text-slate-500">
              Generated {new Date(data.generatedAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Snapshot dropdown */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="bg-black/30 text-slate-200 border-white/20 hover:bg-white/10 text-xs"
              onClick={() => setShowSnapshotDropdown(!showSnapshotDropdown)}
            >
              {selectedSnapshotId
                ? snapshots.find((s) => s.id === selectedSnapshotId)?.name || 'Snapshot'
                : 'Load Live Session ▾'}
            </Button>
            {showSnapshotDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border border-white/15 bg-[#0f172a] shadow-xl">
                <div className="p-2 border-b border-white/10">
                  <div className="text-[11px] text-slate-400 px-2 py-1">Available Snapshots</div>
                </div>
                <div className="max-h-64 overflow-auto p-1">
                  <button
                    className={`w-full rounded-md px-3 py-2 text-left text-xs hover:bg-white/10 ${
                      !selectedSnapshotId ? 'bg-white/10 text-white' : 'text-slate-300'
                    }`}
                    onClick={() => { setSelectedSnapshotId(null); setShowSnapshotDropdown(false); }}
                  >
                    Discovery Sessions (Default)
                  </button>
                  {snapshots.map((snap) => (
                    <button
                      key={snap.id}
                      className={`w-full rounded-md px-3 py-2 text-left text-xs hover:bg-white/10 ${
                        selectedSnapshotId === snap.id ? 'bg-white/10 text-white' : 'text-slate-300'
                      }`}
                      onClick={() => { setSelectedSnapshotId(snap.id); setShowSnapshotDropdown(false); }}
                    >
                      <div className="font-medium">{snap.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(snap.createdAt).toLocaleString()} · {snap.dialoguePhase}
                      </div>
                    </button>
                  ))}
                  {snapshots.length === 0 && (
                    <div className="px-3 py-4 text-center text-[11px] text-slate-500">
                      No live session snapshots available
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Run type toggle (only when not viewing snapshot) */}
          {!selectedSnapshotId && (
            <>
              <div className="h-4 w-px bg-white/15" />
              <Button
                size="sm"
                variant={runType === 'BASELINE' ? 'default' : 'outline'}
                className={runType === 'BASELINE' ? 'text-xs' : 'bg-black/30 text-slate-200 border-white/20 hover:bg-white/10 text-xs'}
                onClick={() => setRunType('BASELINE')}
              >
                Baseline
              </Button>
              <Button
                size="sm"
                variant={runType === 'FOLLOWUP' ? 'default' : 'outline'}
                className={runType === 'FOLLOWUP' ? 'text-xs' : 'bg-black/30 text-slate-200 border-white/20 hover:bg-white/10 text-xs'}
                onClick={() => setRunType('FOLLOWUP')}
              >
                Follow-up
              </Button>
            </>
          )}

          {/* Primary action */}
          <div className="h-4 w-px bg-white/15" />
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4"
            onClick={handleGenerateReport}
            disabled={generating}
          >
            {generating ? 'Synthesising…' : '✦ Synthesise'}
          </Button>
          <div className="h-4 w-px bg-white/15" />
          <HemisphereGuide />
        </div>
      </div>

      {/* ─── Agent Orchestration Panel (appears during report generation) ─── */}
      {(generating || agentConversation.length > 0) && (
        <div className="flex-shrink-0 border-b border-white/10 max-h-[40vh]">
          <AgentOrchestrationPanel
            entries={agentConversation}
            collapsed={agentPanelCollapsed}
            onToggleCollapse={() => setAgentPanelCollapsed(!agentPanelCollapsed)}
            isLive={generating}
            title="SYNTHESIS"
          />
        </div>
      )}

      {/* ─── Main content (two columns) ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Hemisphere canvas */}
        <div className="relative flex-1 min-w-0">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            onMouseMove={(e) => updateHoverFromPointer(e.clientX, e.clientY)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => {
              if (hoveredNodeId) { setSelectedNodeId(hoveredNodeId); return; }
              setSelectedNodeId(null); setZoomClusterId(null);
            }}
            onDoubleClick={() => {
              if (!hoveredNodeId) return;
              const cid = clusterByNodeId.get(hoveredNodeId) || null;
              if (!cid) return;
              setZoomClusterId((prev) => (prev === cid ? null : cid));
            }}
          />

          {/* Filter overlay (bottom-left of canvas) */}
          <div className="pointer-events-none absolute inset-0">

            {/* Zone annotations — explains the vertical spatial meaning of the sphere */}
            <div className="absolute left-5 top-[9%] flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <div className="h-px w-3 bg-blue-400/80" />
                <span className="text-[9px] font-semibold text-blue-300 uppercase tracking-[0.12em]">Aspiration</span>
              </div>
              <span className="pl-[18px] text-[8px] text-blue-300/70">Vision · Beliefs · Future goals</span>
            </div>

            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <div className="h-px w-3 bg-emerald-400/80" />
                <span className="text-[9px] font-semibold text-emerald-300 uppercase tracking-[0.12em]">Enablers</span>
              </div>
              <span className="pl-[18px] text-[8px] text-emerald-300/70">Action · Transformation</span>
            </div>

            <div className="absolute left-5 bottom-[14%] flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <div className="h-px w-3 bg-red-400/80" />
                <span className="text-[9px] font-semibold text-red-300 uppercase tracking-[0.12em]">Friction</span>
              </div>
              <span className="pl-[18px] text-[8px] text-red-300/70">Constraints · Barriers</span>
            </div>

            <div className="pointer-events-auto absolute left-3 bottom-3">
              <Button
                size="sm"
                variant="outline"
                className="bg-black/50 text-slate-200 border-white/20 hover:bg-white/10 text-xs"
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters ({visibleNodes.length})
              </Button>
            </div>

            {showFilters && (
              <div className="pointer-events-auto absolute left-3 bottom-12 w-[300px] rounded-lg border border-white/10 bg-black/80 backdrop-blur px-3 py-3">
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-slate-300">Node types</div>
                    <div className="flex flex-wrap gap-1">
                      {ALL_TYPES.map((t) => (
                        <Button
                          key={t} size="sm"
                          variant={typeFilter[t] ? 'default' : 'outline'}
                          className={typeFilter[t] ? 'h-6 px-2 text-[11px]' : 'h-6 px-2 text-[11px] bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'}
                          onClick={() => setTypeFilter((prev) => ({ ...prev, [t]: !prev[t] }))}
                        >
                          {labelForType(t)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {maxWeight > 1 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-300">
                      <span>Min weight</span>
                      <span className="text-slate-200">≥ {minWeight}</span>
                    </div>
                    <input type="range" min={0} max={Math.max(1, Math.round(maxWeight))} value={minWeight} onChange={(e) => setMinWeight(Number(e.target.value) || 0)} className="w-full" />
                  </div>
                  )}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-300">
                      <span>Node size</span>
                      <span className="text-slate-200">{nodeSizeScale}%</span>
                    </div>
                    <input type="range" min={5} max={100} value={nodeSizeScale} onChange={(e) => setNodeSizeScale(Number(e.target.value) || 50)} className="w-full" />
                  </div>
                </div>
              </div>
            )}

            {/* Legend (bottom-right of canvas) */}
            <div className="pointer-events-auto absolute right-3 bottom-3 flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 backdrop-blur px-3 py-2">
              {ALL_TYPES.map((t) => {
                const c = colorForType(t);
                return (
                  <div key={t} className="flex items-center gap-1 text-[10px] text-slate-300">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.fill }} />
                    <span>{labelForType(t)}</span>
                  </div>
                );
              })}
            </div>

            {/* Loading/error indicator */}
            {(loading || error) && (
              <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
                <div className={`rounded-md px-3 py-1.5 text-xs ${error ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-black/60 text-slate-300 border border-white/10'}`}>
                  {loading ? 'Loading hemisphere...' : error}
                </div>
              </div>
            )}

            {/* Snapshot info banner — confirms what data the user is viewing */}
            {!loading && !error && selectedSnapshotId && data?.snapshotName && (
              <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
                <div className="rounded-md px-3 py-1.5 text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  Viewing: {data.snapshotName} · {nodes.length} node{nodes.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Zoom reset */}
            {zoomClusterId && (
              <div className="pointer-events-auto absolute left-3 top-3">
                <Button size="sm" variant="outline" className="bg-black/50 text-slate-200 border-white/20 hover:bg-white/10 text-xs" onClick={() => setZoomClusterId(null)}>
                  Reset Zoom
                </Button>
              </div>
            )}
          </div>

          {/* Selected node detail overlay */}
          {selectedNode && (
            <div className="pointer-events-auto absolute right-0 top-0 h-full w-[360px] border-l border-white/10 bg-black/70 backdrop-blur overflow-auto p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">{labelForType(selectedNode.type)}</div>
                  <div className="mt-1 text-base font-semibold text-slate-50 truncate">{selectedNode.label}</div>
                </div>
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10" onClick={() => setSelectedNodeId(null)}>
                  ✕
                </Button>
              </div>
              {selectedNode.summary && <div className="mt-3 text-sm text-slate-200 whitespace-pre-wrap">{selectedNode.summary}</div>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {uniq((selectedNode.phaseTags || []).map((p) => String(p).toLowerCase())).slice(0, 10).map((p) => (
                  <Badge key={p} variant="outline" className="border-white/15 text-slate-200 text-[11px]">{p}</Badge>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                  <div className="text-slate-400">Weight</div>
                  <div className="text-slate-50 font-medium">{selectedNode.weight}</div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                  <div className="text-slate-400">Severity</div>
                  <div className="text-slate-50 font-medium">{typeof selectedNode.severity === 'number' ? selectedNode.severity.toFixed(1) : '—'}</div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                  <div className="text-slate-400">Confidence</div>
                  <div className="text-slate-50 font-medium">{typeof selectedNode.confidence === 'number' ? `${Math.round(selectedNode.confidence * 100)}%` : '—'}</div>
                </div>
              </div>
              {Array.isArray(selectedNode.evidence) && selectedNode.evidence.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-200">Supporting quotes</div>
                  <div className="mt-2 space-y-1.5">
                    {selectedNode.evidence.filter((e) => e?.quote).slice(0, 4).map((e, idx) => (
                      <div key={idx} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5">
                        {e.qaTag && <div className="mb-0.5 text-[10px] text-slate-400">{e.qaTag}</div>}
                        <div className="text-xs text-slate-200 whitespace-pre-wrap">{e.quote}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: Synthesis / Actor Journey */}
        <div className="w-[420px] flex-shrink-0 border-l border-white/10 bg-[#0a0f1a] flex flex-col overflow-hidden">
          {/* Domain tabs */}
          <div className="flex flex-wrap gap-1 border-b border-white/10 px-3 py-2">
            {domainTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveDomain(tab.key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  activeDomain === tab.key
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: tab.color, opacity: activeDomain === tab.key ? 1 : 0.5 }} />
                {tab.label}
                {tab.key !== 'all' && (
                  <span className="ml-1 text-[10px] text-slate-500">
                    {(nodesPerDomain[tab.key] || []).filter((n) => n.type !== 'EVIDENCE').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Synthesis / Actors / Diagnostic toggle */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setRightTab('synthesis')}
              className={`flex-1 py-2 text-xs font-medium transition-all ${
                rightTab === 'synthesis' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Synthesis
            </button>
            <button
              onClick={() => setRightTab('actors')}
              className={`flex-1 py-2 text-xs font-medium transition-all ${
                rightTab === 'actors' ? 'text-white border-b-2 border-purple-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Actors
            </button>
            <button
              onClick={() => setRightTab('diagnostic')}
              className={`flex-1 py-2 text-xs font-medium transition-all ${
                rightTab === 'diagnostic' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Diagnostic
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-auto px-3 py-3">
            {rightTab === 'synthesis' ? (
              <DomainSynthesisCard
                domain={activeDomain}
                nodes={activeDomain === 'all' ? nodes.filter((n) => n.type !== 'EVIDENCE') : (nodesPerDomain[activeDomain] || []).filter((n) => n.type !== 'EVIDENCE')}
                edges={edges}
                allNodes={nodes}
                domainTabs={domainTabs}
              />
            ) : rightTab === 'actors' ? (
              <ActorJourneyPanel
                workshopId={workshopId}
                snapshotId={selectedSnapshotId || undefined}
                domainTabs={domainTabs}
              />
            ) : (
              <HemisphereDiagnosticPanel
                before={diagnosticBefore}
                after={diagnosticAfter}
                delta={diagnosticDelta}
                loading={diagnosticLoading}
              />
            )}
          </div>
        </div>
      </div>

      {/* ─── Domain Lens Strip (bottom) ─── */}
      <div className="flex-shrink-0 border-t border-white/10 bg-[#060a14] px-4 py-3">
        <div className="flex items-center gap-3 overflow-x-auto">
          {domainTabs.filter((d) => d.key !== 'all').map((tab) => {
            const domainNodes = nodesPerDomain[tab.key] || [];
            return (
              <MiniHemisphere
                key={tab.key}
                nodes={domainNodes}
                edges={edges}
                coreTruthNodeId={graph?.coreTruthNodeId || ''}
                label={tab.label}
                nodeCount={domainNodes.filter((n) => n.type !== 'EVIDENCE').length}
                color={tab.color}
                active={activeDomain === tab.key}
                onClick={() => setActiveDomain(tab.key)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

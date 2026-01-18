'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  kind: 'SIMILAR' | 'COOCCUR' | 'CAUSE_HINT';
};

type HemisphereGraph = {
  nodes: HemisphereNode[];
  edges: HemisphereEdge[];
  coreTruthNodeId: string;
};

type HemisphereResponse = {
  ok: boolean;
  workshopId: string;
  runType: 'BASELINE' | 'FOLLOWUP';
  generatedAt: string;
  sessionCount: number;
  participantCount: number;
  hemisphereGraph: HemisphereGraph;
  error?: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

const ALL_PHASES = ['people', 'corporate', 'customer', 'technology', 'regulation'] as const;
const ALL_TYPES: NodeType[] = ['VISION', 'BELIEF', 'CHALLENGE', 'FRICTION', 'CONSTRAINT', 'ENABLER'];

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','has','have','i','if','in','into','is','it','its','me','my','no','not','of','on','or','our','so','that','the','their','then','there','these','they','this','to','too','up','us','was','we','were','what','when','where','which','who','why','will','with','you','your',
]);

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
    case 'VISION':
      return { fill: '#60a5fa', glow: 'rgba(96,165,250,0.85)' };
    case 'BELIEF':
      return { fill: '#a78bfa', glow: 'rgba(167,139,250,0.85)' };
    case 'CHALLENGE':
      return { fill: '#fb7185', glow: 'rgba(251,113,133,0.85)' };
    case 'FRICTION':
      return { fill: '#f97316', glow: 'rgba(249,115,22,0.85)' };
    case 'CONSTRAINT':
      return { fill: '#ef4444', glow: 'rgba(239,68,68,0.85)' };
    case 'ENABLER':
      return { fill: '#34d399', glow: 'rgba(52,211,153,0.85)' };
    case 'EVIDENCE':
      return { fill: '#94a3b8', glow: 'rgba(148,163,184,0.75)' };
  }
}

function labelForType(type: NodeType) {
  return type[0] + type.slice(1).toLowerCase();
}

function uniq<T>(arr: T[]) {
  return [...new Set(arr)];
}

function words(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOPWORDS.has(w));
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

type Vec3 = { x: number; y: number; z: number };
type NodePose = { id: string; p: Vec3; clusterId: string; layer: HemisphereLayer; type: NodeType };

export default function WorkshopHemispherePage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [runType, setRunType] = useState<'BASELINE' | 'FOLLOWUP'>('BASELINE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HemisphereResponse | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const hitMapRef = useRef<Map<string, { x: number; y: number; r: number }>>(new Map());

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoomClusterId, setZoomClusterId] = useState<string | null>(null);

  const [highlightDominantDrivers, setHighlightDominantDrivers] = useState(false);
  const [showCausalChains, setShowCausalChains] = useState(false);

  const prevRunTypeRef = useRef<'BASELINE' | 'FOLLOWUP'>('BASELINE');
  const transitionRef = useRef<{ startMs: number; from: Map<string, NodePose> } | null>(null);
  const prevPositionsRef = useRef<Map<string, NodePose>>(new Map());

  const [phaseFilter, setPhaseFilter] = useState<Record<(typeof ALL_PHASES)[number], boolean>>({
    people: true,
    corporate: true,
    customer: true,
    technology: true,
    regulation: true,
  });

  const [typeFilter, setTypeFilter] = useState<Record<NodeType, boolean>>({
    VISION: true,
    BELIEF: true,
    CHALLENGE: true,
    FRICTION: true,
    CONSTRAINT: true,
    ENABLER: true,
    EVIDENCE: false,
  });

  const [minWeight, setMinWeight] = useState(0);
  const [onlyCrossDomain, setOnlyCrossDomain] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?runType=${encodeURIComponent(runType)}&bust=${Date.now()}`,
          { cache: 'no-store' }
        );
        const json = (await r.json().catch(() => null)) as HemisphereResponse | null;
        if (!r.ok || !json || !json.ok) {
          setData(null);
          setError(json && typeof json.error === 'string' ? json.error : 'Failed to load hemisphere');
          return;
        }
        setData(json);
      } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load hemisphere');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [workshopId, runType]);

  useEffect(() => {
    setHoveredNodeId(null);
    setSelectedNodeId(null);
    setZoomClusterId(null);
  }, [runType, workshopId]);

  useEffect(() => {
    if (prevRunTypeRef.current !== runType) {
      // Start a transition between the prior layout and the new layout.
      prevRunTypeRef.current = runType;
      transitionRef.current = { startMs: performance.now(), from: new Map(prevPositionsRef.current) };
    }
  }, [runType]);

  const graph = data?.hemisphereGraph || null;
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const maxWeight = useMemo(() => nodes.reduce((m, n) => Math.max(m, n.weight || 0), 1), [nodes]);

  const clusterByNodeId = useMemo(() => {
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x);
      if (!p) {
        parent.set(x, x);
        return x;
      }
      if (p === x) return x;
      const r = find(p);
      parent.set(x, r);
      return r;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    for (const n of nodes) parent.set(n.id, n.id);
    for (const e of edges) {
      if (e.kind !== 'SIMILAR') continue;
      if (e.strength < 0.28) continue;
      union(e.source, e.target);
    }

    const out = new Map<string, string>();
    for (const n of nodes) out.set(n.id, find(n.id));
    return out;
  }, [nodes, edges]);

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
      const tags = Array.isArray(n.phaseTags) ? n.phaseTags : [];
      if (tags.length === 0) return true;
      return tags.some((t) => {
        const key = String(t).toLowerCase();
        return (phaseFilter as Record<string, boolean>)[key] !== false;
      });
    };
    const typeOk = (n: HemisphereNode) => typeFilter[n.type] !== false;
    const weightOk = (n: HemisphereNode) => (n.weight || 0) >= minWeight;
    const crossDomainOk = (n: HemisphereNode) => {
      if (!onlyCrossDomain) return true;
      const tags = uniq((n.phaseTags || []).map((t) => String(t).toLowerCase()));
      return tags.length >= 2;
    };

    // Option A: keep evidence nodes out of the base view; they appear only when you select a node.
    let base = nodes.filter((n) => n.type !== 'EVIDENCE' && phaseOk(n) && typeOk(n) && weightOk(n) && crossDomainOk(n));

    if (highlightDominantDrivers && base.length) {
      const influence = (n: HemisphereNode) => {
        const sev = typeof n.severity === 'number' ? clamp01((n.severity - 1) / 4) : 0.5;
        const cross = uniq((n.phaseTags || []).map((t) => String(t).toLowerCase())).length;
        const crossMult = 1 + 0.35 * Math.min(3, Math.max(0, cross - 1));
        const deg = degreeById.get(n.id) || 0;
        return (Math.max(1, n.weight || 1) * (1 + sev * 1.6) * crossMult) + deg * 2.2;
      };
      const scores = base.map(influence).sort((a, b) => b - a);
      const threshold = scores[Math.max(0, Math.floor(scores.length * 0.18))] || scores[0] || 0;
      base = base.filter((n) => influence(n) >= threshold);
    }

    base.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    return base.slice(0, 220);
  }, [nodes, phaseFilter, typeFilter, minWeight, onlyCrossDomain, highlightDominantDrivers, degreeById]);

  const selectedEvidenceNodes = useMemo(() => {
    if (!selectedNodeId) return [] as HemisphereNode[];
    const selected = nodeById.get(selectedNodeId);
    if (!selected) return [] as HemisphereNode[];
    if (selected.type === 'EVIDENCE') return [] as HemisphereNode[];

    const sessionIds = new Set((selected.sources || []).map((s) => s.sessionId).filter(Boolean));
    if (sessionIds.size === 0) return [] as HemisphereNode[];

    const selectedTokens = tokenSet(`${selected.label} ${selected.summary || ''}`);

    const evid = nodes
      .filter((n) => n.type === 'EVIDENCE')
      .filter((n) => (n.sources || []).some((s) => sessionIds.has(s.sessionId)))
      .map((n) => {
        const sim = jaccard(selectedTokens, tokenSet(`${n.label} ${n.summary || ''}`));
        return { n, sim };
      })
      .filter((r) => r.sim >= 0.08)
      .sort((a, b) => b.sim - a.sim || (b.n.weight || 0) - (a.n.weight || 0))
      .slice(0, 12)
      .map((r) => r.n);

    return evid;
  }, [selectedNodeId, nodeById, nodes]);

  const visibleNodes = useMemo(() => {
    if (!selectedNodeId) return baseVisibleNodes;
    const ids = new Set(baseVisibleNodes.map((n) => n.id));
    const merged = [...baseVisibleNodes];
    for (const n of selectedEvidenceNodes) {
      if (!ids.has(n.id)) {
        merged.push(n);
        ids.add(n.id);
      }
    }
    return merged;
  }, [baseVisibleNodes, selectedEvidenceNodes, selectedNodeId]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const evidenceEdges = useMemo(() => {
    if (!selectedNodeId) return [] as HemisphereEdge[];
    return selectedEvidenceNodes.map((n) => ({
      id: `EVIDENCE_LINK:${selectedNodeId}:${n.id}`,
      source: selectedNodeId,
      target: n.id,
      strength: 0.9,
      kind: 'COOCCUR' as const,
    }));
  }, [selectedEvidenceNodes, selectedNodeId]);

  const visibleEdges = useMemo(() => {
    let base = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
    if (showCausalChains) base = base.filter((e) => e.kind === 'CAUSE_HINT');
    return showCausalChains ? base : [...base, ...evidenceEdges];
  }, [edges, visibleNodeIds, evidenceEdges, showCausalChains]);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) || null : null;

  const positions = useMemo(() => {
    const out = new Map<string, NodePose>();
    const bandForLayer = (layer: HemisphereLayer): { a: number; b: number } => {
      // H1 (intent) lives closer to the apex.
      if (layer === 'H1') return { a: 0.02, b: 0.18 };
      if (layer === 'H2') return { a: 0.34, b: 0.56 };
      if (layer === 'H3') return { a: 0.56, b: 0.78 };
      return { a: 0.78, b: 0.98 };
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
      const phi = (Math.PI / 2) * clamp01(phiT);
      const theta = baseTheta + (u - 0.5) * 0.95;

      const radial = Math.sin(phi);
      const y = Math.cos(phi);
      const x = Math.cos(theta) * radial;
      const z = Math.sin(theta) * radial;

      const coreId = graph?.coreTruthNodeId;
      if (coreId && n.id === coreId) {
        // Core Truth is the gravity well at the dome's center.
        out.set(n.id, { id: n.id, clusterId: 'CORE', layer: n.layer, type: n.type, p: { x: 0, y: 0.55, z: 0 } });
      } else {
        out.set(n.id, { id: n.id, clusterId: cid, layer: n.layer, type: n.type, p: { x, y, z } });
      }
    }

    return out;
  }, [visibleNodes, clusterByNodeId, graph?.coreTruthNodeId]);

  useEffect(() => {
    prevPositionsRef.current = positions;
  }, [positions]);

  const clusterCenters = useMemo(() => {
    const acc = new Map<string, { x: number; y: number; z: number; n: number }>();
    for (const pose of positions.values()) {
      const prev = acc.get(pose.clusterId) || { x: 0, y: 0, z: 0, n: 0 };
      prev.x += pose.p.x;
      prev.y += pose.p.y;
      prev.z += pose.p.z;
      prev.n += 1;
      acc.set(pose.clusterId, prev);
    }
    const out = new Map<string, Vec3>();
    for (const [cid, a] of acc.entries()) {
      out.set(cid, { x: a.x / Math.max(1, a.n), y: a.y / Math.max(1, a.n), z: a.z / Math.max(1, a.n) });
    }
    return out;
  }, [positions]);

  const adjacency = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of visibleEdges) {
      const a = m.get(e.source) || [];
      a.push(e.target);
      m.set(e.source, a);
      const b = m.get(e.target) || [];
      b.push(e.source);
      m.set(e.target, b);
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

  const updateHoverFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;

    let best: { id: string; d2: number } | null = null;
    for (const [id, p] of hitMapRef.current.entries()) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= p.r * p.r) {
        if (!best || d2 < best.d2) best = { id, d2 };
      }
    }
    setHoveredNodeId(best ? best.id : null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    const project = (p: Vec3, w: number, h: number, tMs: number) => {
      const cx = w / 2;
      const cy = h * 0.60;
      const R = Math.min(w, h) * 0.42;
      const spin = reduceMotion ? 0 : tMs * 0.00004;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);
      const x = p.x * cs - p.z * sn;
      const z = p.x * sn + p.z * cs;
      const y = p.y + (reduceMotion ? 0 : Math.sin(tMs * 0.001 + (x + z) * 3) * 0.012);
      const depth = (z + 1) / 2;
      const persp = 0.70 + depth * 0.55;
      return { x: cx + x * R * persp, y: cy - y * R * persp, z, persp };
    };

    const draw = (tMs: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const cx = w / 2;
      const cy = h * 0.60;
      const R = Math.min(w, h) * 0.42;

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.35);
      bg.addColorStop(0, 'rgba(2,6,23,1)');
      bg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,0.22)';
      ctx.lineWidth = Math.max(1, 1.1 * dpr);
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI, 0, false);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 0.8 * dpr);
      for (const rr of [0.25, 0.5, 0.75]) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * rr, Math.PI, 0, false);
        ctx.stroke();
      }
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
      const poseFor = (id: string): { p: Vec3; enter: number } | null => {
        const toPose = positions.get(id);
        if (!toPose) return null;
        const fromPose = trans?.from.get(id);
        if (!trans || !fromPose) return { p: toPose.p, enter: trans ? transEase : 1 };
        return { p: lerpVec(fromPose.p, toPose.p, transEase), enter: 1 };
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

      for (const e of visibleEdges) {
        const a = proj.get(e.source);
        const b = proj.get(e.target);
        if (!a || !b) continue;
        const active = activeEdgeSet.has(e.id);
        const baseAlpha = e.kind === 'CAUSE_HINT' ? 0.62 : e.kind === 'COOCCUR' ? 0.16 : 0.26;
        const alpha = active ? 0.95 : baseAlpha;
        const width = (0.6 + 2.4 * clamp01(e.strength)) * (e.kind === 'CAUSE_HINT' ? 1.35 : 1);
        const unrelatedFade = hoverActive && hoveredNodeId && !(activeNodeSet.has(e.source) && activeNodeSet.has(e.target)) ? 0.30 : 1;

        if (showCausalChains && e.kind === 'CAUSE_HINT') {
          ctx.setLineDash([8 * dpr, 10 * dpr]);
          ctx.lineDashOffset = -tMs * 0.02;
        } else {
          ctx.setLineDash([]);
        }

        ctx.strokeStyle = `rgba(96,165,250,${clamp01(alpha) * unrelatedFade})`;
        ctx.lineWidth = Math.max(1, width * dpr * (active ? 1.25 : 1));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      const ordered = [...visibleNodes]
        .map((n) => ({ n, q: proj.get(n.id) }))
        .filter((x): x is { n: HemisphereNode; q: { x: number; y: number; z: number; s: number } } => !!x.q)
        .sort((a, b) => a.q.z - b.q.z);

      const influenceRadius = (n: HemisphereNode, q: { z: number; s: number }) => {
        const sev = typeof n.severity === 'number' ? clamp01((n.severity - 1) / 4) : 0.5;
        const conf = typeof n.confidence === 'number' ? clamp01(n.confidence) : 0.7;
        const cross = uniq((n.phaseTags || []).map((t) => String(t).toLowerCase())).length;
        const crossMult = 1 + 0.35 * Math.min(3, Math.max(0, cross - 1));
        const freq = Math.sqrt(Math.max(1, n.weight || 1));
        const depth = clamp01((q.z + 1) / 2);
        const depthMult = 0.85 + depth * 0.75;
        const sharpMult = 0.90 + conf * 0.20;
        return (2.2 + freq * 2.05) * (1 + sev * 1.35) * crossMult * depthMult * sharpMult;
      };

      let maxNormal = 1;
      const normalRadii: number[] = [];
      for (const { n, q } of ordered) {
        const coreId = graph?.coreTruthNodeId;
        if (coreId && n.id === coreId) continue;
        const rr = influenceRadius(n, q);
        maxNormal = Math.max(maxNormal, rr);
        normalRadii.push(rr);
      }

      normalRadii.sort((a, b) => a - b);
      const p90 = normalRadii.length
        ? normalRadii[Math.max(0, Math.min(normalRadii.length - 1, Math.floor(normalRadii.length * 0.9)))]
        : maxNormal;
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
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * (core ? 1.22 : 1.1), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        const depth = clamp01((q.z + 1) / 2);
        const depthAlpha = 0.40 + depth * 0.60;
        ctx.globalAlpha = (dimmed ? 0.20 : active ? 1 : 0.92) * depthAlpha * unrelatedAlpha;

        // Brightness communicates severity.
        const fill = core ? '#f8fafc' : palette.fill;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        ctx.fill();
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
          const label = hn.label;
          ctx.save();
          ctx.font = `${Math.max(12, 13 * dpr)}px ui-sans-serif, system-ui, -apple-system, Segoe UI`;
          const metrics = ctx.measureText(label);
          const pad = 10 * dpr;
          const tw = metrics.width;
          const th = 16 * dpr;
          const boxW = tw + pad * 2;
          const boxH = th + pad;
          const x = Math.min(w - boxW - 6 * dpr, hp.x + 10 * dpr);
          const y = Math.max(6 * dpr, hp.y - boxH - 10 * dpr);

          ctx.fillStyle = 'rgba(15,23,42,0.92)';
          ctx.strokeStyle = 'rgba(148,163,184,0.35)';
          ctx.lineWidth = Math.max(1, 1 * dpr);

          // rounded rect (manual)
          const r0 = 8 * dpr;
          ctx.beginPath();
          ctx.moveTo(x + r0, y);
          ctx.lineTo(x + boxW - r0, y);
          ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + r0);
          ctx.lineTo(x + boxW, y + boxH - r0);
          ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - r0, y + boxH);
          ctx.lineTo(x + r0, y + boxH);
          ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r0);
          ctx.lineTo(x, y + r0);
          ctx.quadraticCurveTo(x, y, x + r0, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = 'rgba(226,232,240,0.95)';
          ctx.fillText(label, x + pad, y + pad + th);
          ctx.restore();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [
    visibleNodes,
    visibleEdges,
    positions,
    activeNodeSet,
    activeEdgeSet,
    clusterCenters,
    zoomClusterId,
    graph?.coreTruthNodeId,
    hoveredNodeId,
    nodeById,
    clusterByNodeId,
  ]);

  return (
    <div className="fixed inset-0 bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onMouseMove={(e) => updateHoverFromPointer(e.clientX, e.clientY)}
        onMouseLeave={() => setHoveredNodeId(null)}
        onClick={() => {
          if (hoveredNodeId) {
            setSelectedNodeId(hoveredNodeId);
            return;
          }
          setSelectedNodeId(null);
          setZoomClusterId(null);
        }}
        onDoubleClick={() => {
          if (!hoveredNodeId) return;
          const cid = clusterByNodeId.get(hoveredNodeId) || null;
          if (!cid) return;
          setZoomClusterId((prev) => (prev === cid ? null : cid));
        }}
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-4 top-4 flex items-center gap-2">
          <Link href={`/admin/workshops/${encodeURIComponent(workshopId)}`}>
            <Button variant="ghost" className="text-slate-200 hover:text-white hover:bg-white/10">
              Back
            </Button>
          </Link>
          <Badge variant="outline" className="border-white/20 text-slate-200">
            {runType}
          </Badge>
          {zoomClusterId ? (
            <Button
              size="sm"
              variant="outline"
              className="bg-black/30 text-slate-200 border-white/20 hover:bg-white/10"
              onClick={() => setZoomClusterId(null)}
            >
              Reset Zoom
            </Button>
          ) : null}
        </div>

        <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-2">
          <Button
            variant={runType === 'BASELINE' ? 'default' : 'outline'}
            className={runType === 'BASELINE' ? '' : 'bg-black/30 text-slate-200 border-white/20 hover:bg-white/10'}
            onClick={() => setRunType('BASELINE')}
          >
            Baseline
          </Button>
          <Button
            variant={runType === 'FOLLOWUP' ? 'default' : 'outline'}
            className={runType === 'FOLLOWUP' ? '' : 'bg-black/30 text-slate-200 border-white/20 hover:bg-white/10'}
            onClick={() => setRunType('FOLLOWUP')}
          >
            Follow-up
          </Button>
        </div>

        <div className="pointer-events-auto absolute left-4 bottom-4 w-[340px] max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-black/40 backdrop-blur px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200">Filters</div>
            <Badge variant="outline" className="border-white/20 text-slate-200">
              {visibleNodes.length} nodes
            </Badge>
          </div>

          <div className="space-y-2">
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-300">Phases</div>
              <div className="flex flex-wrap gap-1">
                {ALL_PHASES.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={phaseFilter[p] ? 'default' : 'outline'}
                    className={
                      phaseFilter[p]
                        ? 'h-7 px-2 text-xs'
                        : 'h-7 px-2 text-xs bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'
                    }
                    onClick={() => setPhaseFilter((prev) => ({ ...prev, [p]: !prev[p] }))}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-300">Node types</div>
              <div className="flex flex-wrap gap-1">
                {ALL_TYPES.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={typeFilter[t] ? 'default' : 'outline'}
                    className={
                      typeFilter[t]
                        ? 'h-7 px-2 text-xs'
                        : 'h-7 px-2 text-xs bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'
                    }
                    onClick={() => setTypeFilter((prev) => ({ ...prev, [t]: !prev[t] }))}
                  >
                    {labelForType(t)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-300">
                <div>Signal strength</div>
                <div className="text-slate-200">≥ {minWeight}</div>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.round(maxWeight))}
                value={minWeight}
                onChange={(e) => setMinWeight(Number(e.target.value) || 0)}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-slate-300">Only cross-domain nodes</div>
              <Button
                size="sm"
                variant={onlyCrossDomain ? 'default' : 'outline'}
                className={
                  onlyCrossDomain
                    ? 'h-7 px-2 text-xs'
                    : 'h-7 px-2 text-xs bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'
                }
                onClick={() => setOnlyCrossDomain((v) => !v)}
              >
                {onlyCrossDomain ? 'On' : 'Off'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-slate-300">Highlight dominant drivers</div>
              <Button
                size="sm"
                variant={highlightDominantDrivers ? 'default' : 'outline'}
                className={
                  highlightDominantDrivers
                    ? 'h-7 px-2 text-xs'
                    : 'h-7 px-2 text-xs bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'
                }
                onClick={() => setHighlightDominantDrivers((v) => !v)}
              >
                {highlightDominantDrivers ? 'On' : 'Off'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-slate-300">Show causal chains</div>
              <Button
                size="sm"
                variant={showCausalChains ? 'default' : 'outline'}
                className={
                  showCausalChains
                    ? 'h-7 px-2 text-xs'
                    : 'h-7 px-2 text-xs bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'
                }
                onClick={() => setShowCausalChains((v) => !v)}
              >
                {showCausalChains ? 'On' : 'Off'}
              </Button>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-400">
            {loading ? 'Loading…' : error ? error : data ? `Generated ${new Date(data.generatedAt).toLocaleString()}` : ''}
          </div>
        </div>

        <div className="pointer-events-auto absolute right-4 bottom-4 w-[260px] max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-black/40 backdrop-blur px-3 py-3">
          <div className="mb-2 text-xs font-semibold text-slate-200">Legend</div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_TYPES.map((t) => {
              const c = colorForType(t);
              return (
                <div key={t} className="flex items-center gap-2 text-xs text-slate-200">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.fill }} />
                  <span>{labelForType(t)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {selectedNode ? (
          <div className="pointer-events-auto absolute right-0 top-0 h-full w-[420px] max-w-[calc(100vw-0rem)] border-l border-white/10 bg-black/60 backdrop-blur p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-400">{labelForType(selectedNode.type)}</div>
                <div className="mt-1 text-lg font-semibold text-slate-50 truncate">{selectedNode.label}</div>
              </div>
              <Button
                variant="ghost"
                className="text-slate-200 hover:text-white hover:bg-white/10"
                onClick={() => setSelectedNodeId(null)}
              >
                Close
              </Button>
            </div>

            {selectedNode.summary ? (
              <div className="mt-3 text-sm text-slate-200 whitespace-pre-wrap">{selectedNode.summary}</div>
            ) : selectedNodeId === (graph?.coreTruthNodeId || 'CORE_TRUTH') ? (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Agentic synthesis unavailable. Ensure <code className="text-amber-100">OPENAI_API_KEY</code> is configured for this environment.
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {uniq((selectedNode.phaseTags || []).map((p) => String(p).toLowerCase()))
                .slice(0, 10)
                .map((p) => (
                  <Badge key={p} variant="outline" className="border-white/15 text-slate-200">
                    {p}
                  </Badge>
                ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border border-white/10 bg-white/5 px-2 py-2">
                <div className="text-slate-400">Weight</div>
                <div className="text-slate-50 font-medium">{selectedNode.weight}</div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 px-2 py-2">
                <div className="text-slate-400">Severity</div>
                <div className="text-slate-50 font-medium">
                  {typeof selectedNode.severity === 'number' ? selectedNode.severity.toFixed(1) : '—'}
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 px-2 py-2">
                <div className="text-slate-400">Confidence</div>
                <div className="text-slate-50 font-medium">
                  {typeof selectedNode.confidence === 'number' ? `${Math.round(selectedNode.confidence * 100)}%` : '—'}
                </div>
              </div>
            </div>

            {Array.isArray(selectedNode.evidence) && selectedNode.evidence.length ? (
              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-200">Supporting quotes</div>
                <div className="mt-2 space-y-2">
                  {selectedNode.evidence
                    .filter((e) => e && typeof e === 'object' && (e.quote || e.qaTag))
                    .slice(0, 6)
                    .map((e, idx) => (
                      <div key={idx} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                        {e.qaTag ? <div className="mb-1 text-[11px] text-slate-400">{e.qaTag}</div> : null}
                        {e.quote ? <div className="text-sm text-slate-200 whitespace-pre-wrap">{e.quote}</div> : null}
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

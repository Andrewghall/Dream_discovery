'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { TransformationLogicMap, TLMNode } from '@/lib/output-intelligence/types';

// ── Status / colour system ────────────────────────────────────────────────────

type Status = 'critical' | 'partial' | 'addressed' | 'disconnected';

function calcStatus(n: TLMNode): Status {
  if (n.isOrphan && n.layer === 'CONSTRAINT')  return 'critical';
  if (n.isCoalescent && !n.inValidChain)       return 'critical';
  if (n.inValidChain)                          return 'addressed';
  if (n.isOrphan)                              return 'disconnected';
  return 'partial';
}

const STATUS_STYLE: Record<Status, { fill: string; stroke: string; text: string; label: string }> = {
  critical:     { fill: '#fecaca', stroke: '#ef4444', text: '#991b1b', label: 'No pathway'   },
  partial:      { fill: '#fde68a', stroke: '#f59e0b', text: '#92400e', label: 'Partial'      },
  addressed:    { fill: '#bbf7d0', stroke: '#10b981', text: '#065f46', label: 'Has pathway'  },
  disconnected: { fill: '#e2e8f0', stroke: '#94a3b8', text: '#475569', label: 'Disconnected' },
};

const LAYER_STYLE: Record<TLMNode['layer'], { dot: string; label: string }> = {
  REIMAGINATION: { dot: '#10b981', label: 'Vision'     },
  ENABLER:       { dot: '#3b82f6', label: 'Enabler'    },
  CONSTRAINT:    { dot: '#ef4444', label: 'Challenge'  },
};

// ── Sensitivity modes ─────────────────────────────────────────────────────────
// Controls how much of the real structure is revealed. No new links are invented.

type SensitivityMode = 'executive' | 'balanced' | 'analyst';

interface SensCfg {
  nodeScoreMin:     number;   // 0–100: nodes below this score are faded
  edgeScoreMin:     number;   // raw edge score: edges below this are hidden
  showPartial:      boolean;  // fully render partial-status nodes
  showDisconnected: boolean;  // fully render disconnected/orphan nodes
  dimOpacity:       number;   // opacity for below-threshold nodes (they stay in position)
}

const SENSITIVITY: Record<SensitivityMode, SensCfg> = {
  // edgeScoreMin is intentionally near-zero — link density is controlled by
  // top-N-per-node selection in buildVisEdges, not by score thresholds here.
  executive: { nodeScoreMin: 55, edgeScoreMin: 1, showPartial: false, showDisconnected: false, dimOpacity: 0.06 },
  balanced:  { nodeScoreMin: 15, edgeScoreMin: 1, showPartial: true,  showDisconnected: false, dimOpacity: 0.15 },
  analyst:   { nodeScoreMin:  0, edgeScoreMin: 1, showPartial: true,  showDisconnected: true,  dimOpacity: 0.25 },
};

const SENS_META: Record<SensitivityMode, { label: string; desc: string; color: string }> = {
  executive: { label: 'Executive', desc: 'Strongest signals — high-confidence pathways only', color: '#7c3aed' },
  balanced:  { label: 'Balanced',  desc: 'Critical issues + validated connections',           color: '#2563eb' },
  analyst:   { label: 'Analyst',   desc: 'Full structure — all nodes and weak links visible', color: '#059669' },
};

function nodePassesSens(en: EN, cfg: SensCfg): boolean {
  if (en.status === 'disconnected' && !cfg.showDisconnected) return false;
  if (en.status === 'partial'      && !cfg.showPartial)      return false;
  if (en.score < cfg.nodeScoreMin)                           return false;
  return true;
}

// ── Sensitivity control UI ────────────────────────────────────────────────────

function SensitivityControl({
  value, onChange,
}: { value: SensitivityMode; onChange: (m: SensitivityMode) => void }) {
  const modes: SensitivityMode[] = ['executive', 'balanced', 'analyst'];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Detail</span>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        {modes.map(m => {
          const meta   = SENS_META[m];
          const active = m === value;
          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-colors border-r border-slate-200 last:border-r-0 ${
                active ? 'text-white' : 'text-slate-500 bg-white hover:bg-slate-50'
              }`}
              style={active ? { background: meta.color } : {}}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
      <span className="text-[10px] text-slate-400 hidden sm:block">{SENS_META[value].desc}</span>
    </div>
  );
}

// ── Weighted scoring model ────────────────────────────────────────────────────
// score = (mention_count × 0.6) + (seniority_weight_sum × 0.4)
// Normalised 0–100. Generic labels penalised.

function seniorityWeight(role: string | null | undefined): number {
  if (!role) return 1.0;
  const r = role.toLowerCase();
  if (r.includes('chief') || r.includes('exec') || r.includes('director') ||
      r.includes('ceo') || r.includes('coo') || r.includes('cto')) return 2.0;
  if (r.includes('head of') || r.includes('senior manager') ||
      r.includes('vp') || r.includes('vice president'))           return 1.5;
  if (r.includes('manager') || r.includes('lead') ||
      r.includes('supervisor'))                                    return 1.2;
  return 1.0;
}

const GENERIC_LABELS = new Set([
  'customer', 'system', 'process', 'team', 'people', 'issue', 'problem',
  'thing', 'area', 'work', 'staff', 'data', 'service', 'time', 'way',
  'information', 'support', 'change', 'business', 'day',
]);

function isGeneric(label: string): boolean {
  const l = label.toLowerCase().trim();
  return GENERIC_LABELS.has(l) || l.length <= 3;
}

// ── Enriched node ─────────────────────────────────────────────────────────────

interface EN {
  n:        TLMNode;
  status:   Status;
  score:    number;   // 0–100 normalised
  rawScore: number;   // pre-normalisation (for tooltip/debug)
  lenses:   number;
  connects: Array<{ label: string; layer: TLMNode['layer'] }>;
}

function enrich(tlm: TransformationLogicMap): EN[] {
  if (!tlm.nodes.length) return [];
  const byId = new Map(tlm.nodes.map(n => [n.nodeId, n]));

  // Pass 1 — compute raw weighted scores
  const rawMap = new Map<string, number>();
  for (const n of tlm.nodes) {
    const mentions   = n.rawFrequency;
    const senWeight  = n.quotes.reduce((s, q) => s + seniorityWeight(q.participantRole), 0);
    let raw = (mentions * 0.6) + (senWeight * 0.4);
    if (isGeneric(n.displayLabel)) raw *= 0.35;
    rawMap.set(n.nodeId, raw);
  }
  const maxRaw = Math.max(...rawMap.values(), 1);

  // Pass 2 — build enriched nodes, normalise scores
  return tlm.nodes
    .map(n => {
      const status   = calcStatus(n);
      const rawScore = rawMap.get(n.nodeId) ?? 0;
      const score    = Math.round((rawScore / maxRaw) * 100);
      const lenses   = new Set(n.quotes.map(q => q.lens).filter(Boolean)).size;
      const connects = tlm.edges
        .filter(e => (e.fromNodeId === n.nodeId || e.toNodeId === n.nodeId) && e.score >= 25)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(e => {
          const oid = e.fromNodeId === n.nodeId ? e.toNodeId : e.fromNodeId;
          const o   = byId.get(oid);
          return o ? { label: o.displayLabel, layer: o.layer } : null;
        })
        .filter(Boolean) as Array<{ label: string; layer: TLMNode['layer'] }>;
      return { n, status, score, rawScore, lenses, connects };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Canvas constants ──────────────────────────────────────────────────────────

const CH = 430;
const LANE_Y: Record<TLMNode['layer'], number> = {
  REIMAGINATION: 78,
  ENABLER:       215,
  CONSTRAINT:    358,
};
const PAD_X = 60;
const NODE_SLOT = 54; // px per node slot (diameter + gap)

// Radius: scale down when there are many nodes in the densest lane
function radius(en: EN, maxPerLane: number): number {
  const base = maxPerLane > 16 ? 17
             : maxPerLane > 10 ? 21
             : maxPerLane > 6  ? 26
             : 31;
  return en.n.isCoalescent ? base + 6 : en.n.isOrphan ? base - 3 : base;
}

// Dynamic canvas width grows to fit the widest lane
function dynCW(maxPerLane: number): number {
  return Math.max(820, maxPerLane * NODE_SLOT + PAD_X * 2);
}

// ── Position featured nodes in 3-lane grid ────────────────────────────────────

function positionNodes(featured: EN[], cw: number): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const layers: TLMNode['layer'][] = ['REIMAGINATION', 'ENABLER', 'CONSTRAINT'];
  for (const layer of layers) {
    const group = featured.filter(e => e.n.layer === layer);
    const n     = group.length;
    group.forEach((en, i) => {
      const x = n <= 1 ? cw / 2
              : PAD_X + (i / (n - 1)) * (cw - PAD_X * 2);
      pos.set(en.n.nodeId, { x, y: LANE_Y[layer] });
    });
  }
  return pos;
}

// ── Edge lines between featured nodes ────────────────────────────────────────

interface VisEdge {
  x1: number; y1: number;
  x2: number; y2: number;
  score: number;
  isChain: boolean;
}

function buildVisEdges(
  tlm: TransformationLogicMap,
  featuredIds: Set<string>,
  pos: Map<string, { x: number; y: number }>,
): VisEdge[] {
  // Collect all edges between featured nodes (both endpoints must be visible).
  // No minimum score filter — density is preserved by design.
  const candidateEdges: Array<{ key: string; e: (typeof tlm.edges)[0] }> = [];
  const edgeByKey = new Map<string, (typeof tlm.edges)[0]>();

  for (const e of tlm.edges) {
    if (!featuredIds.has(e.fromNodeId) || !featuredIds.has(e.toNodeId)) continue;
    const key = [e.fromNodeId, e.toNodeId].sort().join('|');
    // Keep highest-score version if duplicates
    const existing = edgeByKey.get(key);
    if (!existing || e.score > existing.score) {
      edgeByKey.set(key, e);
    }
    candidateEdges.push({ key, e });
  }

  // For every featured node, select its top 5 connections (by score, any direction,
  // chain or non-chain). This guarantees density without inventing new links.
  const selectedKeys = new Set<string>();
  for (const id of featuredIds) {
    const connected = [...edgeByKey.entries()]
      .filter(([k]) => {
        const [a, b] = k.split('|');
        return a === id || b === id;
      })
      .sort((x, y) => y[1].score - x[1].score)
      .slice(0, 5); // top 5 per node
    connected.forEach(([k]) => selectedKeys.add(k));
  }

  // Build output VisEdges from the selected keys
  const seen = new Set<string>();
  const out: VisEdge[] = [];
  for (const [key, e] of edgeByKey) {
    if (!selectedKeys.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const f = pos.get(e.fromNodeId);
    const t = pos.get(e.toNodeId);
    if (!f || !t) continue;
    out.push({ x1: f.x, y1: f.y, x2: t.x, y2: t.y, score: e.score, isChain: e.isChainEdge });
  }
  return out;
}

// ── SVG edge component ────────────────────────────────────────────────────────

function Edge({ x1, y1, x2, y2, score, isChain, dim }: VisEdge & { dim: boolean }) {
  const midY = (y1 + y2) / 2;
  const d    = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;

  // Opacity: base 0.30 for weak links, up to 0.85 for strong ones
  const op    = dim ? 0.06 : 0.30 + (score / 100) * 0.55;
  // Stroke width: 1.5 (weak) → 4 (strong), chain edges slightly thicker
  const sw    = dim ? 1 : isChain
    ? 1.5 + (score / 100) * 3.5
    : 1.5 + (score / 100) * 2.5;
  const color = isChain ? '#f97316' : '#6366f1';

  return (
    <>
      {/* Soft glow halo for strong/chain edges */}
      {!dim && score >= 50 && (
        <path d={d} fill="none" stroke={color} strokeWidth={sw + 6} opacity={0.08} strokeLinecap="round" />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={sw} opacity={op} strokeLinecap="round" />
    </>
  );
}

// ── SVG node component ────────────────────────────────────────────────────────

function MapNode({
  en, x, y, selected, dim, onClick, maxPerLane, dimOpacity = 0.22,
}: { en: EN; x: number; y: number; selected: boolean; dim: boolean; onClick: () => void; maxPerLane: number; dimOpacity?: number }) {
  const r   = radius(en, maxPerLane);
  const ss  = STATUS_STYLE[en.status];
  const ls  = LAYER_STYLE[en.n.layer];
  const op  = dim ? dimOpacity : 1;
  const rawLabel = formatLabel(en.n.displayLabel);
  const label = rawLabel.length > 26 ? rawLabel.slice(0, 24) + '…' : rawLabel;

  // Wrap long labels into 2 lines
  const words = label.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length > 16 && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  const twoLines = lines.slice(0, 2);

  return (
    <g onClick={onClick} style={{ cursor: 'pointer', opacity: op }}>
      {/* Selection halo */}
      {selected && (
        <circle cx={x} cy={y} r={r + 8} fill="none" stroke={ss.stroke} strokeWidth="2" opacity="0.4" />
      )}
      {/* Main circle */}
      <circle
        cx={x} cy={y} r={r}
        fill={ss.fill}
        stroke={ss.stroke}
        strokeWidth={selected ? 3 : en.n.isCoalescent ? 2.5 : 1.75}
        strokeDasharray={en.n.isOrphan ? '5,3' : undefined}
      />
      {/* Layer dot (top-left of circle) */}
      <circle cx={x - r * 0.62} cy={y - r * 0.62} r={5}
        fill={ls.dot} stroke="white" strokeWidth="1.5" />
      {/* Label text below circle */}
      {twoLines.map((line, li) => (
        <text
          key={li}
          x={x}
          y={y + r + 13 + li * 12}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight="600"
          fill="#374151"
          style={{ pointerEvents: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

// ── Layer row labels (left axis) ──────────────────────────────────────────────

const BAND_H = 96;

function LaneBands({ cw }: { cw: number }) {
  return (
    <>
      {(['REIMAGINATION', 'ENABLER', 'CONSTRAINT'] as const).map(layer => {
        const ls   = LAYER_STYLE[layer];
        const y    = LANE_Y[layer] - BAND_H / 2;
        const fill = layer === 'REIMAGINATION' ? '#f0fdf4'
                   : layer === 'ENABLER'        ? '#eff6ff'
                   :                              '#fef2f2';
        return (
          <g key={layer}>
            <rect x={0} y={y} width={cw} height={BAND_H} fill={fill} fillOpacity={0.5} />
            <text
              x={10} y={LANE_Y[layer]}
              dominantBaseline="middle"
              fontSize={8}
              fontWeight="800"
              fill={ls.dot}
              opacity={0.6}
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              {ls.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ── Selected node detail ──────────────────────────────────────────────────────

function NodeDetail({ en, onClose }: { en: EN; onClose: () => void }) {
  const ss   = STATUS_STYLE[en.status];
  const ls   = LAYER_STYLE[en.n.layer];
  const q    = en.n.quotes[0] ?? null;
  return (
    <div
      className="rounded-xl border p-4 space-y-3 mt-3"
      style={{ background: ss.fill + 'aa', borderColor: ss.stroke + '66' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: ls.dot }}>{ls.label}</span>
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded text-white"
              style={{ background: ss.stroke }}
            >{ss.label}</span>
            {en.n.isCoalescent && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ background: '#fef3c7', color: '#92400e' }}>Pressure point</span>
            )}
          </div>
          <h4 className="text-sm font-bold text-slate-900 leading-snug">{formatLabel(en.n.displayLabel)}</h4>
          <p className="text-[10px] text-slate-500 mt-1">
            Weighted score: <strong>{en.score}</strong>
            {en.n.rawFrequency > 0 && <> · <strong>{en.n.rawFrequency}</strong> mentions × 0.6</>}
            {en.n.quotes.length > 0 && (
              <> · seniority Σ{en.n.quotes.reduce((s, q) => +(s + seniorityWeight(q.participantRole)).toFixed(1), 0)} × 0.4</>
            )}
            {isGeneric(en.n.displayLabel) && <span className="text-amber-500"> · generic penalty applied</span>}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/60 shrink-0">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Orphan explanation */}
      {en.n.isOrphan && (
        <div className="text-xs leading-relaxed p-2.5 rounded-lg bg-white/60 border border-white/80 text-slate-700">
          {en.n.orphanType === 'CONSTRAINT_NO_RESPONSE'    && '⚠ Known problem with no transformation pathway — being ignored.'}
          {en.n.orphanType === 'REIMAGINATION_UNSUPPORTED' && '⚠ Aspiration with no enabler — strategy without an execution path.'}
          {en.n.orphanType === 'ENABLER_LEADS_NOWHERE'     && '⚠ Activity with no strategic purpose — effort disconnected from vision.'}
          {!en.n.orphanType                                && '⚠ No strong connections to other nodes in the transformation map.'}
        </div>
      )}

      {/* Connections */}
      {en.connects.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Connects to</p>
          <div className="flex flex-wrap gap-1.5">
            {en.connects.map((c, i) => {
              const cl = LAYER_STYLE[c.layer];
              return (
                <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/70 border"
                      style={{ color: cl.dot, borderColor: cl.dot + '44' }}>
                  {c.label.length > 34 ? c.label.slice(0, 32) + '…' : c.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Evidence */}
      {q && (
        <div className="text-xs text-slate-600 italic border-l-2 border-slate-300 pl-2.5 leading-relaxed">
          "{q.text.length > 160 ? q.text.slice(0, 158) + '…' : q.text}"
          {(q.participantRole || q.lens) && (
            <span className="not-italic text-slate-400 ml-1.5">
              — {[q.participantRole, q.lens].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Label formatter ───────────────────────────────────────────────────────────

function formatLabel(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Remaining nodes dropdown ──────────────────────────────────────────────────

function RemainingList({ nodes }: { nodes: EN[] }) {
  const [open, setOpen] = useState(false);
  if (nodes.length === 0) return null;

  // Split by status — each group has its own meaning
  const groups = [
    {
      status: 'critical' as Status,
      label: 'No pathway — being ignored',
      sub: 'High-frequency issues with no transformation response',
      dot: '#ef4444',
      items: nodes.filter(e => e.status === 'critical'),
    },
    {
      status: 'partial' as Status,
      label: 'Partially addressed',
      sub: 'Some coverage exists but gaps remain',
      dot: '#f59e0b',
      items: nodes.filter(e => e.status === 'partial'),
    },
    {
      status: 'addressed' as Status,
      label: 'Has a transformation pathway',
      sub: 'Connected to the vision through valid chains',
      dot: '#10b981',
      items: nodes.filter(e => e.status === 'addressed'),
    },
    {
      status: 'disconnected' as Status,
      label: 'Disconnected — no strong links',
      sub: 'Appears in the hemisphere but is isolated from the main transformation logic',
      dot: '#94a3b8',
      items: nodes.filter(e => e.status === 'disconnected'),
    },
  ].filter(g => g.items.length > 0);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <span className="text-xs font-bold text-slate-700">
            {nodes.length} further issue{nodes.length !== 1 ? 's' : ''}
          </span>
          <span className="ml-2 text-[10px] text-slate-400">not in visual map — expand to review</span>
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 text-slate-400 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {groups.map((g) => (
            <div key={g.status} className="p-4">
              {/* Group header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.dot }} />
                <span className="text-xs font-bold text-slate-700">{g.label}</span>
                <span className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {g.items.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-3 pl-4">{g.sub}</p>

              {/* Rows — sorted by rawFrequency desc within group */}
              <div className="space-y-1.5">
                {[...g.items].sort((a, b) => b.n.rawFrequency - a.n.rawFrequency).map(en => {
                  const ls      = LAYER_STYLE[en.n.layer];
                  const topRole = en.n.quotes.find(q => q.participantRole)?.participantRole;
                  const senW    = seniorityWeight(topRole);
                  return (
                    <div key={en.n.nodeId}
                         className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white border border-slate-100">
                      {/* Layer dot */}
                      <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: ls.dot }} />

                      {/* Label + context */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 leading-snug">
                          {formatLabel(en.n.displayLabel)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {ls.label}
                          {topRole && (
                            <span className="ml-1.5">
                              · raised by <span className="font-medium text-slate-500">{topRole}</span>
                              {senW >= 1.5 && <span className="ml-1 text-amber-500 font-bold">↑ senior</span>}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Mentions count — the actual signal, not a meaningless normalized score */}
                      {en.n.rawFrequency > 0 && (
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black tabular-nums leading-none text-slate-700">
                            {en.n.rawFrequency}
                          </p>
                          <p className="text-[8px] text-slate-400 uppercase tracking-wide">mentions</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 3-metric strip (clickable filters) ───────────────────────────────────────

function AnswerStrip({
  all, activeFilter, onFilter,
}: {
  all: EN[];
  activeFilter: Status | null;
  onFilter: (f: Status | null) => void;
}) {
  const critCount = all.filter(e => e.status === 'critical').length;
  const addressed = all.filter(e => e.status === 'addressed').length;
  const ignored   = all.filter(e => e.status === 'critical' && e.n.isOrphan && e.n.layer === 'CONSTRAINT').length;
  const total     = all.length;
  const pct       = Math.round((addressed / Math.max(total, 1)) * 100);

  const items = [
    { filter: 'critical' as Status,    q: 'Fix first',       v: `${critCount} critical`,              s: 'Scored clusters with no transformation pathway', c: '#ef4444', bg: '#fef2f2', b: '#fca5a5' },
    { filter: 'addressed' as Status,   q: 'Being addressed', v: `${addressed} of ${total} (${pct}%)`, s: 'Weighted clusters with a valid pathway',          c: '#3b82f6', bg: '#eff6ff', b: '#bfdbfe' },
    { filter: 'critical' as Status,    q: 'Being ignored',   v: ignored > 0 ? `${ignored} orphan constraints` : 'None', s: ignored > 0 ? 'High-frequency issues with no plan — sorted by score' : 'All constraints have some pathway', c: ignored > 0 ? '#dc2626' : '#10b981', bg: ignored > 0 ? '#fef2f2' : '#f0fdf4', b: ignored > 0 ? '#fca5a5' : '#bbf7d0' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it, i) => {
        const active = activeFilter === it.filter && i === (activeFilter === 'critical' ? (activeFilter === it.filter && i === 0 ? 0 : 2) : 1);
        const isActive = activeFilter !== null && (
          (i === 0 && activeFilter === 'critical') ||
          (i === 1 && activeFilter === 'addressed') ||
          (i === 2 && activeFilter === 'critical')
        );
        return (
          <button
            key={i}
            onClick={() => onFilter(isActive ? null : it.filter)}
            className="rounded-xl px-4 py-3 text-left transition-all hover:opacity-80"
            style={{
              background: it.bg,
              border: `1px solid ${isActive ? it.c : it.b}`,
              boxShadow: isActive ? `0 0 0 2px ${it.c}44` : undefined,
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{it.q}</p>
            <p className="text-base font-black leading-none mb-1" style={{ color: it.c }}>{it.v}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{it.s}</p>
            {isActive && (
              <p className="text-[9px] font-bold mt-1" style={{ color: it.c }}>Click to clear filter ×</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] text-slate-400 px-1">
      <span className="font-semibold text-slate-500">Status:</span>
      {Object.entries(STATUS_STYLE).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full border" style={{ background: v.fill, borderColor: v.stroke }} />
          {v.label}
        </span>
      ))}
      <span className="ml-2 font-semibold text-slate-500">Layer dot:</span>
      {Object.entries(LAYER_STYLE).map(([, v]) => (
        <span key={v.label} className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.dot }} />
          {v.label}
        </span>
      ))}
      <span className="ml-1 text-slate-300 italic">Click any node to explore</span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props { data: TransformationLogicMap }

export function TransformationLogicMapPanel({ data }: Props) {
  const [selected,     setSelected]     = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Status | null>(null);
  const [sensitivity,  setSensitivity]  = useState<SensitivityMode>('balanced');

  const all = useMemo(() => enrich(data), [data]);

  // ── Featured selection — ALL hooks before early return ──────────────────
  // Show ALL critical nodes (these ARE the 20-30% requiring action),
  // plus top enablers/vision that provide context for the chains.
  const featured = useMemo(() => {
    if (all.length === 0) return [];
    const critical = all.filter(e => e.status === 'critical');
    const partial  = all.filter(e => e.status === 'partial').slice(0, 5);
    const enablers = all.filter(e => e.n.layer === 'ENABLER'       && e.status !== 'critical').slice(0, 5);
    const vision   = all.filter(e => e.n.layer === 'REIMAGINATION' && e.status !== 'critical').slice(0, 4);
    const chosen   = new Set<string>();
    [...critical, ...enablers, ...vision, ...partial].forEach(e => chosen.add(e.n.nodeId));
    return all.filter(e => chosen.has(e.n.nodeId));
  }, [all]);

  const maxPerLane = useMemo(() => {
    const counts = (['REIMAGINATION', 'ENABLER', 'CONSTRAINT'] as const).map(
      l => featured.filter(e => e.n.layer === l).length
    );
    return Math.max(...counts, 1);
  }, [featured]);

  const canvasW  = dynCW(maxPerLane);
  const pos      = useMemo(() => positionNodes(featured, canvasW), [featured, canvasW]);
  const visEdges = useMemo(() => {
    const ids = new Set(featured.map(e => e.n.nodeId));
    return buildVisEdges(data, ids, pos);
  }, [data, featured, pos]);

  if (all.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-400">No graph data — run Brain Scan to generate this map.</p>
      </div>
    );
  }

  const remaining = all.filter(e => !featured.some(f => f.n.nodeId === e.n.nodeId));

  const selectedEN    = selected ? featured.find(e => e.n.nodeId === selected) ?? null : null;

  // Which nodes are connected to the selected node?
  const connectedIds  = selected
    ? new Set(visEdges.filter(e => {
        const fp = pos.get(selected);
        return fp && ((e.x1 === fp.x && e.y1 === fp.y) || (e.x2 === fp.x && e.y2 === fp.y));
      }).flatMap(e => {
        const fp = pos.get(selected)!;
        // Find the other nodeId by matching coordinates
        return featured
          .filter(en => {
            const p = pos.get(en.n.nodeId);
            return p && ((p.x === e.x1 && p.y === e.y1) || (p.x === e.x2 && p.y === e.y2));
          })
          .map(en => en.n.nodeId);
      }))
    : null;

  return (
    <div className="space-y-4">

      {/* ── Three answers ──────────────────────────────────── */}
      <AnswerStrip all={all} activeFilter={activeFilter} onFilter={f => { setActiveFilter(f); setSelected(null); }} />

      {/* ── Visual map ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Header row: node count + sensitivity control */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50 gap-3 flex-wrap">
          <div className="shrink-0">
            <span className="text-xs font-bold text-slate-700">
              {featured.length} nodes mapped
            </span>
            <span className="ml-2 text-[10px] text-slate-400">
              {data.strongestChains.length} valid chain{data.strongestChains.length !== 1 ? 's' : ''} · {data.coverageScore}% constraint coverage
            </span>
          </div>
          <SensitivityControl value={sensitivity} onChange={m => { setSensitivity(m); setSelected(null); }} />
        </div>

        <div className="overflow-x-auto">
          {(() => {
            const sensCfg = SENSITIVITY[sensitivity];
            // Edges: only show those meeting the threshold
            const sensEdges = visEdges.filter(e => e.score >= sensCfg.edgeScoreMin);
            return (
              <svg
                width={canvasW}
                height={CH}
                viewBox={`0 0 ${canvasW} ${CH}`}
                style={{ display: 'block', minWidth: canvasW }}
              >
                <LaneBands cw={canvasW} />

                {/* Edges (sensitivity-filtered) */}
                {sensEdges.map((e, i) => {
                  const dim = selected !== null && connectedIds !== null && (() => {
                    const sp = pos.get(selected)!;
                    const isTouching = (e.x1 === sp.x && e.y1 === sp.y) || (e.x2 === sp.x && e.y2 === sp.y);
                    return !isTouching;
                  })();
                  return <Edge key={i} {...e} dim={dim} />;
                })}

                {/* Nodes — positions stable; below-threshold nodes faded not removed */}
                {featured.map(en => {
                  const p = pos.get(en.n.nodeId);
                  if (!p) return null;
                  // Sensitivity dim: node doesn't pass threshold → use dimOpacity
                  const sensDim    = !nodePassesSens(en, sensCfg);
                  const filterDim  = activeFilter !== null && en.status !== activeFilter;
                  const selectDim  = selected !== null && selected !== en.n.nodeId &&
                                     !(connectedIds?.has(en.n.nodeId) ?? false);
                  const dim = sensDim || filterDim || selectDim;
                  return (
                    <MapNode
                      key={en.n.nodeId}
                      en={en} x={p.x} y={p.y}
                      selected={selected === en.n.nodeId}
                      dim={dim}
                      dimOpacity={sensDim ? sensCfg.dimOpacity : 0.22}
                      maxPerLane={maxPerLane}
                      onClick={() => {
                        if (sensDim) return; // can't select faded nodes
                        setSelected(prev => prev === en.n.nodeId ? null : en.n.nodeId);
                      }}
                    />
                  );
                })}
              </svg>
            );
          })()}
        </div>

        <div className="border-t border-slate-100 px-4 py-2.5">
          <Legend />
        </div>
      </div>

      {/* ── Selected node detail ────────────────────────────── */}
      {selectedEN && (
        <NodeDetail en={selectedEN} onClose={() => setSelected(null)} />
      )}

      {/* ── Remaining dropdown (filtered when active) ──────── */}
      <RemainingList nodes={activeFilter ? remaining.filter(e => e.status === activeFilter) : remaining} />

      {/* ── Interpretation ─────────────────────────────────── */}
      {data.interpretationSummary && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">What this map reveals</p>
          <p className="text-xs text-slate-600 leading-relaxed">{data.interpretationSummary}</p>
        </div>
      )}
    </div>
  );
}

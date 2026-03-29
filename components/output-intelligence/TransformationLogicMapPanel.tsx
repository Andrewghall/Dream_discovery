'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { TransformationLogicMap, TLMNode, TLMEdge } from '@/lib/output-intelligence/types';

// ── Colour system ─────────────────────────────────────────────────────────────

const LAYER = {
  CONSTRAINT:    { fill: '#fee2e2', stroke: '#ef4444', text: '#991b1b', label: 'Constraints',  bg: '#fef2f2' },
  ENABLER:       { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e40af', label: 'Enablers',     bg: '#eff6ff' },
  REIMAGINATION: { fill: '#d1fae5', stroke: '#10b981', text: '#065f46', label: 'Aspirations',  bg: '#f0fdf4' },
} as const;

const HOTSPOT_COLOR = '#f59e0b';
const ORPHAN_STROKE = '#94a3b8';
const CHAIN_COLOR   = '#f97316';
const WEAK_COLOR    = '#cbd5e1';

// ── Canvas geometry ───────────────────────────────────────────────────────────

const CW = 800;
const CH = 460;
const PAD_X  = 72;

const LANE_Y: Record<TLMNode['layer'], number> = {
  REIMAGINATION: 86,
  ENABLER:       232,
  CONSTRAINT:    378,
};

const BAND_H = 100; // visual band height per layer

// ── Node sizing ───────────────────────────────────────────────────────────────

type NSize = 'lg' | 'md' | 'sm';
const RADIUS: Record<NSize, number> = { lg: 34, md: 25, sm: 17 };

// ── Cluster data ──────────────────────────────────────────────────────────────

interface Cluster {
  id:          string;
  label:       string;   // full label, truncated to 32 chars
  circleLines: string[]; // 1-2 short words for inside the circle
  layer:       TLMNode['layer'];
  size:        NSize;
  isHotspot:   boolean;
  isOrphan:    boolean;
  isAddressed: boolean;  // part of a valid chain
  score:       number;
  nodeId:      string;
  quotes:      TLMNode['quotes'];
  orphanType?: TLMNode['orphanType'];
}

interface Road {
  fromId:   string;
  toId:     string;
  strength: number; // 0-100
  isChain:  boolean;
  key:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function circleLines(label: string, size: NSize): string[] {
  if (size === 'sm') return [];
  const maxChars = size === 'lg' ? 12 : 10;
  const words = label.replace(/[^\w\s'-]/g, '').split(/\s+/).slice(0, 4);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = next;
    if (lines.length >= 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  return lines.slice(0, 2);
}

// ── Build clusters from TLM ───────────────────────────────────────────────────

function buildClusters(tlm: TransformationLogicMap): { clusters: Cluster[]; roads: Road[] } {
  const pick = (layer: TLMNode['layer'], max: number): Cluster[] =>
    tlm.nodes
      .filter(n => n.layer === layer)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, max)
      .map((n, i): Cluster => {
        const size: NSize = n.isCoalescent ? 'lg' : n.isOrphan ? 'sm' : 'md';
        return {
          id:          `${layer[0].toLowerCase()}${i}`,
          label:       truncate(n.displayLabel, 34),
          circleLines: circleLines(n.displayLabel, size),
          layer,
          size,
          isHotspot:   n.isCoalescent,
          isOrphan:    n.isOrphan,
          isAddressed: n.inValidChain,
          score:       n.compositeScore,
          nodeId:      n.nodeId,
          quotes:      n.quotes ?? [],
          orphanType:  n.orphanType,
        };
      });

  const clusters: Cluster[] = [
    ...pick('CONSTRAINT',    7),
    ...pick('ENABLER',       5),
    ...pick('REIMAGINATION', 5),
  ];

  const nodeToCluster = new Map<string, string>();
  clusters.forEach(c => nodeToCluster.set(c.nodeId, c.id));

  // Aggregate edges between visible clusters
  const roadMap = new Map<string, Road>();
  for (const e of tlm.edges) {
    const f = nodeToCluster.get(e.fromNodeId);
    const t = nodeToCluster.get(e.toNodeId);
    if (!f || !t || f === t) continue;
    const key = `${f}→${t}`;
    const existing = roadMap.get(key);
    if (!existing || e.score > existing.strength) {
      roadMap.set(key, { fromId: f, toId: t, strength: e.score, isChain: e.isChainEdge, key });
    }
  }

  // Only strong links; prune to max 3 roads per cluster
  const allRoads = [...roadMap.values()].filter(r => r.strength >= 40);
  const degreeMap = new Map<string, Road[]>();
  for (const r of allRoads) {
    for (const id of [r.fromId, r.toId]) {
      if (!degreeMap.has(id)) degreeMap.set(id, []);
      degreeMap.get(id)!.push(r);
    }
  }
  const keep = new Set<string>();
  for (const [, rs] of degreeMap) {
    rs.sort((a, b) => (b.isChain ? 1 : 0) - (a.isChain ? 1 : 0) || b.strength - a.strength)
      .slice(0, 4)
      .forEach(r => keep.add(r.key));
  }
  const roads = allRoads.filter(r => keep.has(r.key));

  return { clusters, roads };
}

// ── Compute x positions within each lane ─────────────────────────────────────

function computePositions(clusters: Cluster[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const layers: TLMNode['layer'][] = ['CONSTRAINT', 'ENABLER', 'REIMAGINATION'];
  for (const layer of layers) {
    const group = clusters.filter(c => c.layer === layer);
    const n = group.length;
    const y = LANE_Y[layer];
    group.forEach((c, i) => {
      const x = n === 1 ? CW / 2 : PAD_X + (i / (n - 1)) * (CW - PAD_X * 2);
      pos.set(c.id, { x, y });
    });
  }
  return pos;
}

// ── SVG Road component ────────────────────────────────────────────────────────

function RoadPath({
  x1, y1, x2, y2,
  strength, isChain, dimmed,
}: {
  x1: number; y1: number; x2: number; y2: number;
  strength: number; isChain: boolean; dimmed: boolean;
}) {
  const midY = (y1 + y2) / 2;
  const d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
  const opacity = dimmed ? 0.12 : 0.25 + (strength / 100) * 0.55;

  if (isChain && !dimmed) {
    return (
      <>
        <path d={d} fill="none" stroke={CHAIN_COLOR} strokeWidth={7} opacity={0.12} strokeLinecap="round" />
        <path d={d} fill="none" stroke={CHAIN_COLOR} strokeWidth={2.5} opacity={opacity} strokeLinecap="round" />
      </>
    );
  }
  return (
    <path
      d={d} fill="none"
      stroke={isChain ? CHAIN_COLOR : WEAK_COLOR}
      strokeWidth={isChain ? 2 : 1.5}
      opacity={opacity}
      strokeLinecap="round"
    />
  );
}

// ── SVG Cluster Node component ────────────────────────────────────────────────

function ClusterCircle({
  c, x, y, selected, dim, onClick,
}: {
  c: Cluster; x: number; y: number;
  selected: boolean; dim: boolean;
  onClick: () => void;
}) {
  const r  = RADIUS[c.size];
  const lc = LAYER[c.layer];
  const strokeColor = c.isHotspot ? HOTSPOT_COLOR : c.isOrphan ? ORPHAN_STROKE : lc.stroke;
  const fillColor   = c.isOrphan  ? '#f8fafc'     : lc.fill;
  const textColor   = c.isOrphan  ? ORPHAN_STROKE : lc.text;

  const baseOpacity = dim ? 0.3 : 1;

  // Lines centred inside circle
  const lines = c.circleLines;
  const lineH  = c.size === 'lg' ? 11 : 10;
  const startY = lines.length > 1 ? y - (lineH * (lines.length - 1)) / 2 : y;

  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer', opacity: baseOpacity }}
    >
      {/* Selection halo */}
      {selected && (
        <circle cx={x} cy={y} r={r + 9} fill="none"
          stroke={strokeColor} strokeWidth="1.5" opacity="0.4" />
      )}

      {/* Main circle */}
      <circle
        cx={x} cy={y} r={r}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={selected ? 3 : c.isHotspot ? 2.5 : 1.75}
        strokeDasharray={c.isOrphan ? '5,3' : undefined}
      />

      {/* Status badge top-right */}
      {c.isHotspot && (
        <circle cx={x + r * 0.7} cy={y - r * 0.7} r={6}
          fill={HOTSPOT_COLOR} stroke="white" strokeWidth="1.5" />
      )}
      {c.isAddressed && !c.isHotspot && (
        <circle cx={x + r * 0.7} cy={y - r * 0.7} r={5}
          fill="#10b981" stroke="white" strokeWidth="1.5" />
      )}

      {/* Text inside circle */}
      {lines.map((line, li) => (
        <text
          key={li}
          x={x}
          y={startY + li * lineH}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={c.size === 'lg' ? 9 : 8}
          fontWeight="700"
          fill={textColor}
          style={{ pointerEvents: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {line}
        </text>
      ))}

      {/* Full label below circle */}
      <text
        x={x}
        y={y + r + 13}
        textAnchor="middle"
        fontSize={7.5}
        fill={c.isOrphan ? '#94a3b8' : '#475569'}
        style={{ pointerEvents: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {truncate(c.label, 30)}
      </text>
    </g>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ tlm }: { tlm: TransformationLogicMap }) {
  const constraints  = tlm.nodes.filter(n => n.layer === 'CONSTRAINT').length;
  const addressed    = tlm.nodes.filter(n => n.layer === 'CONSTRAINT' && n.inValidChain).length;
  const hotspots     = tlm.nodes.filter(n => n.isCoalescent).length;
  const orphans      = tlm.nodes.filter(n => n.isOrphan).length;
  const pct          = constraints > 0 ? Math.round((addressed / constraints) * 100) : 0;

  const cards = [
    {
      value:    `${pct}%`,
      label:    'constraints addressed',
      sub:      `${addressed} of ${constraints} have a transformation path`,
      color:    pct >= 60 ? '#10b981' : pct >= 30 ? '#f59e0b' : '#ef4444',
      bg:       pct >= 60 ? '#f0fdf4' : pct >= 30 ? '#fffbeb' : '#fef2f2',
      border:   pct >= 60 ? '#bbf7d0' : pct >= 30 ? '#fde68a' : '#fecaca',
    },
    {
      value:    String(tlm.strongestChains.length),
      label:    'strong chains',
      sub:      'constraint → enabler → vision pathways',
      color:    '#f97316',
      bg:       '#fff7ed',
      border:   '#fed7aa',
    },
    {
      value:    String(hotspots),
      label:    hotspots === 1 ? 'pressure point' : 'pressure points',
      sub:      'nodes where multiple paths converge',
      color:    '#f59e0b',
      bg:       '#fffbeb',
      border:   '#fde68a',
    },
    {
      value:    String(orphans),
      label:    orphans === 1 ? 'disconnected node' : 'disconnected nodes',
      sub:      'problems or aspirations with no pathway',
      color:    '#64748b',
      bg:       '#f8fafc',
      border:   '#e2e8f0',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <div
          key={i}
          className="rounded-xl p-3 flex flex-col gap-0.5"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          <span className="text-2xl font-black leading-none" style={{ color: c.color }}>{c.value}</span>
          <span className="text-[11px] font-semibold" style={{ color: c.color }}>{c.label}</span>
          <span className="text-[10px] text-slate-400 leading-tight">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ── Selected node detail panel ────────────────────────────────────────────────

function ClusterDetail({ c, roads, clusters, onClose }: {
  c: Cluster; roads: Road[]; clusters: Cluster[]; onClose: () => void;
}) {
  const lc = LAYER[c.layer];
  const connected = roads
    .filter(r => r.fromId === c.id || r.toId === c.id)
    .map(r => {
      const otherId = r.fromId === c.id ? r.toId : r.fromId;
      const other   = clusters.find(cl => cl.id === otherId);
      return other ? { cluster: other, road: r } : null;
    })
    .filter(Boolean) as Array<{ cluster: Cluster; road: Road }>;

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: lc.bg, borderColor: lc.stroke + '40' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: lc.text }}
          >{lc.label}</span>
          <h4 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">{c.label}</h4>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {c.isHotspot   && <Tag color={HOTSPOT_COLOR} label="Pressure point" />}
            {c.isOrphan    && <Tag color="#ef4444"       label="Disconnected" />}
            {c.isAddressed && <Tag color="#10b981"       label="Has a pathway" />}
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/60 shrink-0">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {c.isOrphan && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-700 leading-relaxed">
          {c.orphanType === 'CONSTRAINT_NO_RESPONSE'     && 'Known problem — no transformation pathway planned.'}
          {c.orphanType === 'REIMAGINATION_UNSUPPORTED'  && 'Aspiration with no enabler supporting it.'}
          {c.orphanType === 'ENABLER_LEADS_NOWHERE'      && 'Activity happening with no clear strategic purpose.'}
          {!c.orphanType                                 && 'No strong connections to other nodes.'}
        </div>
      )}

      {connected.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Connected to</p>
          <div className="space-y-1">
            {connected.map(({ cluster: other, road }, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: LAYER[other.layer].stroke }}
                />
                <span className="flex-1 leading-snug">{other.label}</span>
                {road.isChain && (
                  <span className="text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: CHAIN_COLOR }}>chain</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {c.quotes.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Evidence</p>
          <div className="space-y-1.5">
            {c.quotes.slice(0, 2).map((q, i) => (
              <div key={i} className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-2 leading-relaxed">
                "{q.text}"
                {q.participantRole && (
                  <span className="not-italic text-slate-400 ml-1">— {q.participantRole}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
      style={{ background: color + '18', color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] text-slate-500">
      {[
        { color: '#ef4444', label: 'Constraint',         solid: true  },
        { color: '#3b82f6', label: 'Enabler',            solid: true  },
        { color: '#10b981', label: 'Aspiration',         solid: true  },
        { color: CHAIN_COLOR, label: 'Strong chain',     solid: false },
        { color: WEAK_COLOR,  label: 'Weak link',        solid: false },
      ].map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {it.solid
            ? <span className="w-3 h-3 rounded-full shrink-0" style={{ background: it.color + '33', border: `1.5px solid ${it.color}` }} />
            : <svg width="18" height="6" className="shrink-0"><line x1="0" y1="3" x2="18" y2="3" stroke={it.color} strokeWidth="2" /></svg>
          }
          {it.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="relative flex items-center justify-center w-3 h-3">
          <span className="w-3 h-3 rounded-full shrink-0 bg-slate-100 border border-dashed border-slate-400" />
        </span>
        Disconnected
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: HOTSPOT_COLOR }} />
        Pressure point
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
        Has pathway
      </span>
      <span className="ml-2 text-slate-400 italic">Click any node to explore connections</span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  data: TransformationLogicMap;
}

export function TransformationLogicMapPanel({ data }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const { clusters, roads } = useMemo(() => buildClusters(data), [data]);
  const positions            = useMemo(() => computePositions(clusters), [clusters]);

  if (clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <p className="text-sm text-slate-500">No graph data available yet.</p>
        <p className="text-xs text-slate-400">Run the Brain Scan to generate the Transformation Logic Map.</p>
      </div>
    );
  }

  const selectedCluster = selected ? clusters.find(c => c.id === selected) ?? null : null;

  const toggleSelect = (id: string) => setSelected(prev => prev === id ? null : id);

  return (
    <div className="space-y-5">

      {/* ── Summary strip ──────────────────────────────────────── */}
      <SummaryStrip tlm={data} />

      {/* ── Visual map ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

        {/* Layer header labels */}
        <div className="grid grid-cols-3 text-center text-[9px] font-bold uppercase tracking-widest border-b border-slate-100">
          {(['CONSTRAINT', 'ENABLER', 'REIMAGINATION'] as const).map(layer => (
            <div
              key={layer}
              className="py-2 px-3"
              style={{ background: LAYER[layer].bg, color: LAYER[layer].text }}
            >
              {LAYER[layer].label}
            </div>
          ))}
        </div>

        {/* SVG canvas */}
        <div className="w-full overflow-x-auto">
          <svg
            width={CW}
            height={CH}
            viewBox={`0 0 ${CW} ${CH}`}
            style={{ display: 'block', minWidth: CW }}
          >
            {/* Lane band backgrounds */}
            {(['CONSTRAINT', 'ENABLER', 'REIMAGINATION'] as const).map(layer => (
              <rect
                key={layer}
                x={0}
                y={LANE_Y[layer] - BAND_H / 2}
                width={CW}
                height={BAND_H}
                fill={LAYER[layer].stroke}
                fillOpacity={0.04}
              />
            ))}

            {/* Roads — dimmed first, then active */}
            {roads.map(r => {
              const f = positions.get(r.fromId);
              const t = positions.get(r.toId);
              if (!f || !t) return null;
              const dimmed = selected !== null && r.fromId !== selected && r.toId !== selected;
              return (
                <RoadPath
                  key={r.key}
                  x1={f.x} y1={f.y}
                  x2={t.x} y2={t.y}
                  strength={r.strength}
                  isChain={r.isChain}
                  dimmed={dimmed}
                />
              );
            })}

            {/* Cluster nodes */}
            {clusters.map(c => {
              const p = positions.get(c.id);
              if (!p) return null;
              const dim = selected !== null && selected !== c.id &&
                          !roads.some(r =>
                            (r.fromId === selected && r.toId === c.id) ||
                            (r.toId   === selected && r.fromId === c.id)
                          );
              return (
                <ClusterCircle
                  key={c.id}
                  c={c}
                  x={p.x} y={p.y}
                  selected={selected === c.id}
                  dim={dim}
                  onClick={() => toggleSelect(c.id)}
                />
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="border-t border-slate-100 px-5 py-3">
          <Legend />
        </div>
      </div>

      {/* ── Selected node detail ────────────────────────────────── */}
      {selectedCluster && (
        <ClusterDetail
          c={selectedCluster}
          roads={roads}
          clusters={clusters}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ── Interpretation ─────────────────────────────────────── */}
      {data.interpretationSummary && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">What this map reveals</p>
          <p className="text-sm text-slate-700 leading-relaxed">{data.interpretationSummary}</p>
        </div>
      )}

      {/* ── Gap summary ─────────────────────────────────────────── */}
      {(data.orphanSummary.constraintOrphans > 0 ||
        data.orphanSummary.visionOrphans > 0 ||
        data.orphanSummary.enablerOrphans > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {data.orphanSummary.constraintOrphans > 0 && (
            <GapCard
              count={data.orphanSummary.constraintOrphans}
              label="Unaddressed constraints"
              description="Known problems with no transformation plan"
              color="#ef4444"
              bg="#fef2f2"
              border="#fecaca"
            />
          )}
          {data.orphanSummary.visionOrphans > 0 && (
            <GapCard
              count={data.orphanSummary.visionOrphans}
              label="Unsupported aspirations"
              description="Strategy with no execution pathway"
              color="#8b5cf6"
              bg="#faf5ff"
              border="#ddd6fe"
            />
          )}
          {data.orphanSummary.enablerOrphans > 0 && (
            <GapCard
              count={data.orphanSummary.enablerOrphans}
              label="Purposeless enablers"
              description="Activity disconnected from constraints or vision"
              color="#f59e0b"
              bg="#fffbeb"
              border="#fde68a"
            />
          )}
        </div>
      )}
    </div>
  );
}

function GapCard({ count, label, description, color, bg, border }: {
  count: number; label: string; description: string;
  color: string; bg: string; border: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="text-2xl font-black leading-none mb-1" style={{ color }}>{count}</div>
      <div className="text-xs font-semibold mb-0.5" style={{ color }}>{label}</div>
      <div className="text-[10px] text-slate-400 leading-tight">{description}</div>
    </div>
  );
}

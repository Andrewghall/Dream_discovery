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

// ── Scoring ───────────────────────────────────────────────────────────────────

function calcScore(n: TLMNode, maxDeg: number, maxFreq: number): number {
  let s = 0;
  if (n.isCoalescent)                                              s += 28;
  if (n.isOrphan && n.layer === 'CONSTRAINT')                      s += 35;
  if (n.isOrphan && n.layer === 'REIMAGINATION')                   s += 18;
  if (n.isOrphan && n.layer === 'ENABLER')                         s += 10;
  if (!n.inValidChain && !n.isOrphan && n.layer === 'CONSTRAINT')  s += 18;
  if (maxDeg  > 0) s += (n.connectionDegree / maxDeg)  * 16;
  if (maxFreq > 0) s += (n.rawFrequency     / maxFreq) * 10;
  const lenses = new Set(n.quotes.map(q => q.lens).filter(Boolean)).size;
  s += Math.min(12, lenses * 3);
  return Math.min(100, Math.round(s));
}

// ── Enriched node ─────────────────────────────────────────────────────────────

interface EN {
  n:       TLMNode;
  status:  Status;
  score:   number;
  lenses:  number;
  connects: Array<{ label: string; layer: TLMNode['layer'] }>;
}

function enrich(tlm: TransformationLogicMap): EN[] {
  if (!tlm.nodes.length) return [];
  const maxDeg  = Math.max(...tlm.nodes.map(n => n.connectionDegree), 1);
  const maxFreq = Math.max(...tlm.nodes.map(n => n.rawFrequency), 1);
  const byId    = new Map(tlm.nodes.map(n => [n.nodeId, n]));

  return tlm.nodes
    .map(n => {
      const status = calcStatus(n);
      const score  = calcScore(n, maxDeg, maxFreq);
      const lenses = new Set(n.quotes.map(q => q.lens).filter(Boolean)).size;
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
      return { n, status, score, lenses, connects };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Canvas constants ──────────────────────────────────────────────────────────

const CW = 820;
const CH = 430;
const LANE_Y: Record<TLMNode['layer'], number> = {
  REIMAGINATION: 78,
  ENABLER:       215,
  CONSTRAINT:    358,
};
const PAD_X = 80;

// Radius: coalescent = large, orphan = small, default = medium
function radius(en: EN): number {
  return en.n.isCoalescent ? 38 : en.n.isOrphan ? 24 : 31;
}

// ── Position featured nodes in 3-lane grid ────────────────────────────────────

function positionNodes(featured: EN[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const layers: TLMNode['layer'][] = ['REIMAGINATION', 'ENABLER', 'CONSTRAINT'];
  for (const layer of layers) {
    const group = featured.filter(e => e.n.layer === layer);
    const n     = group.length;
    group.forEach((en, i) => {
      const x = n === 0 ? CW / 2 :
                n === 1 ? CW / 2 :
                PAD_X + (i / (n - 1)) * (CW - PAD_X * 2);
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
  const seen = new Set<string>();
  const out: VisEdge[] = [];
  for (const e of tlm.edges) {
    if (!featuredIds.has(e.fromNodeId) || !featuredIds.has(e.toNodeId)) continue;
    if (e.score < 20) continue;
    const key = [e.fromNodeId, e.toNodeId].sort().join('|');
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
  const midY  = (y1 + y2) / 2;
  const d     = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
  const op    = dim ? 0.08 : 0.18 + (score / 100) * 0.55;
  const color = isChain ? '#f97316' : '#94a3b8';
  const sw    = isChain ? 2.5 : 1.5;
  return (
    <>
      {isChain && !dim && (
        <path d={d} fill="none" stroke={color} strokeWidth={8} opacity={0.10} strokeLinecap="round" />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={sw} opacity={op} strokeLinecap="round" />
    </>
  );
}

// ── SVG node component ────────────────────────────────────────────────────────

function MapNode({
  en, x, y, selected, dim, onClick,
}: { en: EN; x: number; y: number; selected: boolean; dim: boolean; onClick: () => void }) {
  const r   = radius(en);
  const ss  = STATUS_STYLE[en.status];
  const ls  = LAYER_STYLE[en.n.layer];
  const op  = dim ? 0.22 : 1;
  const label = en.n.displayLabel.length > 26
    ? en.n.displayLabel.slice(0, 24) + '…'
    : en.n.displayLabel;

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

function LaneBands() {
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
            <rect x={0} y={y} width={CW} height={BAND_H} fill={fill} fillOpacity={0.5} />
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
          <h4 className="text-sm font-bold text-slate-900 leading-snug">{en.n.displayLabel}</h4>
          <p className="text-[10px] text-slate-500 mt-1">
            Priority score: <strong>{en.score}</strong>
            {en.n.rawFrequency > 0 && <> · {en.n.rawFrequency} signals</>}
            {en.lenses > 0 && <> · {en.lenses} {en.lenses === 1 ? 'lens' : 'lenses'}</>}
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

// ── Remaining nodes dropdown ──────────────────────────────────────────────────

function RemainingList({ nodes }: { nodes: EN[] }) {
  const [open, setOpen] = useState(false);
  if (nodes.length === 0) return null;

  const critical = nodes.filter(e => e.status === 'critical');
  const partial  = nodes.filter(e => e.status === 'partial');
  const rest     = nodes.filter(e => e.status !== 'critical' && e.status !== 'partial');

  const groups = [
    { label: 'Critical — no pathway', items: critical, dot: '#ef4444' },
    { label: 'Partial',               items: partial,  dot: '#f59e0b' },
    { label: 'Addressed / Low',       items: rest,     dot: '#94a3b8' },
  ].filter(g => g.items.length > 0);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <span className="text-xs font-bold text-slate-700">Remaining {nodes.length} nodes</span>
          <span className="ml-2 text-[10px] text-slate-400">The other 80% — sorted by priority score</span>
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 text-slate-400 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {groups.map((g, gi) => (
            <div key={gi}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5"
                 style={{ color: g.dot }}>
                <span className="w-2 h-2 rounded-full" style={{ background: g.dot }} />
                {g.label} ({g.items.length})
              </p>
              <div className="space-y-1">
                {g.items.map(en => {
                  const ss = STATUS_STYLE[en.status];
                  const ls = LAYER_STYLE[en.n.layer];
                  return (
                    <div key={en.n.nodeId}
                         className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ls.dot }} />
                      <span className="text-xs text-slate-700 flex-1 leading-snug">{en.n.displayLabel}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                            style={{ background: ss.stroke }}>
                        {ss.label}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums shrink-0 text-slate-400">{en.score}</span>
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

// ── 3-question strip ──────────────────────────────────────────────────────────

function AnswerStrip({ all }: { all: EN[] }) {
  const critCount  = all.filter(e => e.status === 'critical').length;
  const addressed  = all.filter(e => e.status === 'addressed').length;
  const ignored    = all.filter(e => e.status === 'critical' && e.n.isOrphan && e.n.layer === 'CONSTRAINT').length;
  const total      = all.length;
  const pct        = Math.round((addressed / Math.max(total, 1)) * 100);

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { q: 'Fix first',         v: `${critCount} critical`,         s: 'Shown top-left in the map below', c: '#ef4444', bg: '#fef2f2', b: '#fca5a5' },
        { q: 'Being addressed',   v: `${addressed} of ${total} (${pct}%)`, s: 'Nodes with a valid transformation path', c: '#3b82f6', bg: '#eff6ff', b: '#bfdbfe' },
        { q: 'Being ignored',     v: ignored > 0 ? `${ignored} constraints` : 'None', s: ignored > 0 ? 'Known problems with no plan' : 'All constraints have some pathway', c: ignored > 0 ? '#dc2626' : '#10b981', bg: ignored > 0 ? '#fef2f2' : '#f0fdf4', b: ignored > 0 ? '#fca5a5' : '#bbf7d0' },
      ].map((it, i) => (
        <div key={i} className="rounded-xl px-4 py-3" style={{ background: it.bg, border: `1px solid ${it.b}` }}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{it.q}</p>
          <p className="text-base font-black leading-none mb-1" style={{ color: it.c }}>{it.v}</p>
          <p className="text-[10px] text-slate-400 leading-tight">{it.s}</p>
        </div>
      ))}
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
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(() => enrich(data), [data]);

  if (all.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-400">No graph data — run Brain Scan to generate this map.</p>
      </div>
    );
  }

  // ── 80/20 split ──────────────────────────────────────────────────────────
  const featuredCount = Math.max(8, Math.min(14, Math.ceil(all.length * 0.20)));
  const featured      = all.slice(0, featuredCount);
  const remaining     = all.slice(featuredCount);

  const featuredIds   = new Set(featured.map(e => e.n.nodeId));
  const pos           = useMemo(() => positionNodes(featured), [featured]);
  const visEdges      = useMemo(() => buildVisEdges(data, featuredIds, pos), [data, featuredIds, pos]);

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
      <AnswerStrip all={all} />

      {/* ── Visual map ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <div>
            <span className="text-xs font-bold text-slate-700">
              Top {featuredCount} priority nodes
            </span>
            <span className="ml-2 text-[10px] text-slate-400">
              The 20% driving 80% of transformation risk
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {data.strongestChains.length} valid chain{data.strongestChains.length !== 1 ? 's' : ''} · {data.coverageScore}% constraint coverage
          </span>
        </div>

        <div className="overflow-x-auto">
          <svg
            width={CW}
            height={CH}
            viewBox={`0 0 ${CW} ${CH}`}
            style={{ display: 'block', minWidth: CW }}
          >
            {/* Lane backgrounds + labels */}
            <LaneBands />

            {/* Edges */}
            {visEdges.map((e, i) => {
              const dim = selected !== null && connectedIds !== null && (() => {
                const sp = pos.get(selected)!;
                const isTouching = (e.x1 === sp.x && e.y1 === sp.y) || (e.x2 === sp.x && e.y2 === sp.y);
                return !isTouching;
              })();
              return <Edge key={i} {...e} dim={dim} />;
            })}

            {/* Nodes */}
            {featured.map(en => {
              const p = pos.get(en.n.nodeId);
              if (!p) return null;
              const dim = selected !== null && selected !== en.n.nodeId &&
                          !(connectedIds?.has(en.n.nodeId) ?? false);
              return (
                <MapNode
                  key={en.n.nodeId}
                  en={en} x={p.x} y={p.y}
                  selected={selected === en.n.nodeId}
                  dim={dim}
                  onClick={() => setSelected(prev => prev === en.n.nodeId ? null : en.n.nodeId)}
                />
              );
            })}
          </svg>
        </div>

        <div className="border-t border-slate-100 px-4 py-2.5">
          <Legend />
        </div>
      </div>

      {/* ── Selected node detail ────────────────────────────── */}
      {selectedEN && (
        <NodeDetail en={selectedEN} onClose={() => setSelected(null)} />
      )}

      {/* ── Remaining 80% dropdown ─────────────────────────── */}
      <RemainingList nodes={remaining} />

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

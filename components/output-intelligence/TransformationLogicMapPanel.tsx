'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X, Plus, CheckCircle2, Target, AlertTriangle, Zap, Eye } from 'lucide-react';
import type { TransformationLogicMap, TLMNode } from '@/lib/output-intelligence/types';
import {
  computePriorityNodes,
  buildWayForward,
  buildExecSummary,
  formatLabel,
  seniorityWeight,
  type PriorityNode,
  type WayForwardPhase,
} from '@/lib/output-intelligence/engines/priority-engine';
import { ReportSectionToggle } from '@/components/report-builder/ReportSectionToggle';

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
  REIMAGINATION: { dot: '#10b981', label: 'Vision'    },
  ENABLER:       { dot: '#3b82f6', label: 'Enabler'   },
  CONSTRAINT:    { dot: '#ef4444', label: 'Challenge' },
};

// ── Sensitivity modes ─────────────────────────────────────────────────────────

type SensitivityMode = 'executive' | 'balanced' | 'analyst';

interface SensCfg {
  nodeScoreMin:     number;
  edgeScoreMin:     number;
  showPartial:      boolean;
  showDisconnected: boolean;
  dimOpacity:       number;
}

const SENSITIVITY: Record<SensitivityMode, SensCfg> = {
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

function SensitivityControl({ value, onChange }: { value: SensitivityMode; onChange: (m: SensitivityMode) => void }) {
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
  score:    number;
  rawScore: number;
  lenses:   number;
  connects: Array<{ label: string; layer: TLMNode['layer'] }>;
}

function enrich(tlm: TransformationLogicMap): EN[] {
  if (!tlm.nodes.length) return [];
  const byId = new Map(tlm.nodes.map(n => [n.nodeId, n]));

  const rawMap = new Map<string, number>();
  for (const n of tlm.nodes) {
    const mentions  = n.rawFrequency;
    const senWeight = n.quotes.reduce((s, q) => s + seniorityWeight(q.participantRole), 0);
    let raw = (mentions * 0.6) + (senWeight * 0.4);
    if (isGeneric(n.displayLabel)) raw *= 0.35;
    rawMap.set(n.nodeId, raw);
  }
  const maxRaw = Math.max(...rawMap.values(), 1);

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
const PAD_X    = 60;
const NODE_SLOT = 54;

function radius(en: EN, maxPerLane: number): number {
  const base = maxPerLane > 16 ? 17
             : maxPerLane > 10 ? 21
             : maxPerLane > 6  ? 26
             : 31;
  return en.n.isCoalescent ? base + 6 : en.n.isOrphan ? base - 3 : base;
}

function dynCW(maxPerLane: number): number {
  return Math.max(820, maxPerLane * NODE_SLOT + PAD_X * 2);
}

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

// ── Edge lines ────────────────────────────────────────────────────────────────

interface EdgeEvidence {
  mentionCount:     number;
  actorCount:       number;
  quotes:           Array<{ text: string; participantRole: string | null; lens: string | null }>;
  rationale:        string;
  relationshipType: string;
}

interface VisEdge {
  x1: number; y1: number;
  x2: number; y2: number;
  score:      number;
  isChain:    boolean;
  evidence:   EdgeEvidence;
  fromLabel:  string;
  toLabel:    string;
  strandCount: number;
}

function buildVisEdges(
  tlm: TransformationLogicMap,
  featuredIds: Set<string>,
  pos: Map<string, { x: number; y: number }>,
): VisEdge[] {
  const byId = new Map(tlm.nodes.map(n => [n.nodeId, n]));

  const edgeByKey = new Map<string, (typeof tlm.edges)[0]>();
  for (const e of tlm.edges) {
    if (!featuredIds.has(e.fromNodeId) || !featuredIds.has(e.toNodeId)) continue;
    const mc = e.evidence?.mentionCount ?? 0;
    if (mc > 0 && mc < 2) continue;
    if (mc === 0 && e.score < 3) continue;
    const key = [e.fromNodeId, e.toNodeId].sort().join('|');
    const ex  = edgeByKey.get(key);
    if (!ex || e.score > ex.score) edgeByKey.set(key, e);
  }

  const out: VisEdge[] = [];
  for (const e of edgeByKey.values()) {
    const f = pos.get(e.fromNodeId);
    const t = pos.get(e.toNodeId);
    if (!f || !t) continue;
    const mc = e.evidence?.mentionCount ?? 0;
    const ac = e.evidence?.actorCount   ?? 0;
    const strandCount = mc < 2 ? 1 : Math.min(Math.max(ac, 1), 4);
    out.push({
      x1: f.x, y1: f.y, x2: t.x, y2: t.y,
      score: e.score,
      isChain: e.isChainEdge,
      fromLabel: byId.get(e.fromNodeId)?.displayLabel ?? e.fromNodeId,
      toLabel:   byId.get(e.toNodeId)?.displayLabel   ?? e.toNodeId,
      strandCount,
      evidence: {
        mentionCount:     mc,
        actorCount:       ac,
        quotes:           e.evidence?.quotes ?? [],
        rationale:        e.rationale,
        relationshipType: e.relationshipType,
      },
    });
  }
  return out.sort((a, b) => a.score - b.score);
}

// ── Edge bundle renderer ──────────────────────────────────────────────────────

function EdgeBundle({
  x1, y1, x2, y2, score, isChain, dim, evidence, fromLabel, toLabel, strandCount, onClick, selected,
}: VisEdge & { dim: boolean; onClick: () => void; selected: boolean }) {
  const mc    = evidence?.mentionCount ?? 0;
  const ac    = evidence?.actorCount   ?? 0;
  const color = selected ? '#0ea5e9' : isChain ? '#f97316' : '#6366f1';

  const CTRL_SPREAD   = 14;
  const midY          = (y1 + y2) / 2;
  const midX          = (x1 + x2) / 2;
  const isHorizontal  = Math.abs(y2 - y1) < Math.abs(x2 - x1) * 0.4;
  const sw            = dim ? 0.6 : Math.max(0.7, 0.7 + (score / 100) * 2.0);

  const strands = Array.from({ length: strandCount }, (_, i) => {
    const offset = (i - (strandCount - 1) / 2) * CTRL_SPREAD;
    const path   = isHorizontal
      ? `M${x1},${y1} C${midX},${y1 - (35 + offset)} ${midX},${y2 - (35 + offset)} ${x2},${y2}`
      : `M${x1},${y1} C${x1},${midY + offset} ${x2},${midY + offset} ${x2},${y2}`;
    const distFromCentre = Math.abs(i - (strandCount - 1) / 2) / Math.max((strandCount - 1) / 2, 1);
    const op = dim ? 0.04 : (0.30 + (score / 100) * 0.48) * (1 - distFromCentre * 0.35);
    return { path, op };
  });

  const centrePath = isHorizontal
    ? `M${x1},${y1} C${midX},${y1 - 35} ${midX},${y2 - 35} ${x2},${y2}`
    : `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
  const bx = midX;
  const by = isHorizontal ? midY - 35 : midY;

  const label = `${formatLabel(fromLabel)} → ${formatLabel(toLabel)}${mc ? `: ${mc} mentions, ${ac} actors` : ''}`;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <title>{label}</title>
      <path d={centrePath} fill="none" stroke="transparent" strokeWidth={20} />
      {selected && (
        <path d={centrePath} fill="none" stroke={color}
          strokeWidth={(strandCount * CTRL_SPREAD * 0.4) + sw + 4} opacity={0.15} strokeLinecap="round" />
      )}
      {strands.map((s, i) => (
        <path key={i} d={s.path} fill="none" stroke={color}
          strokeWidth={selected ? sw + 0.4 : sw} opacity={s.op} strokeLinecap="round" />
      ))}
      {!dim && mc >= 2 && (
        <g transform={`translate(${bx},${by})`}>
          <rect x={-16} y={-7} width={32} height={13} rx={3}
            fill="white" stroke={color} strokeWidth={0.5} opacity={0.90} />
          <text fontSize={7} fill={color} textAnchor="middle" dominantBaseline="middle" fontWeight="700">
            {mc}{ac > 1 ? `×${ac}↑` : `×`}
          </text>
        </g>
      )}
    </g>
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
      {selected && (
        <circle cx={x} cy={y} r={r + 8} fill="none" stroke={ss.stroke} strokeWidth="2" opacity="0.4" />
      )}
      <circle
        cx={x} cy={y} r={r}
        fill={ss.fill}
        stroke={ss.stroke}
        strokeWidth={selected ? 3 : en.n.isCoalescent ? 2.5 : 1.75}
        strokeDasharray={en.n.isOrphan ? '5,3' : undefined}
      />
      <circle cx={x - r * 0.62} cy={y - r * 0.62} r={5}
        fill={ls.dot} stroke="white" strokeWidth="1.5" />
      {twoLines.map((line, li) => (
        <text
          key={li}
          x={x} y={y + r + 13 + li * 12}
          textAnchor="middle" fontSize={8.5} fontWeight="600" fill="#374151"
          style={{ pointerEvents: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

// ── Lane bands ────────────────────────────────────────────────────────────────

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
              dominantBaseline="middle" fontSize={8} fontWeight="800"
              fill={ls.dot} opacity={0.6}
              style={{ fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.08em' }}
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

function NodeDetail({
  en, onClose, isInWayForward, onAddToWayForward,
}: {
  en: EN;
  onClose: () => void;
  isInWayForward: boolean;
  onAddToWayForward: (nodeId: string) => void;
}) {
  const ss  = STATUS_STYLE[en.status];
  const ls  = LAYER_STYLE[en.n.layer];
  const q   = en.n.quotes[0] ?? null;
  return (
    <div
      className="rounded-xl border p-4 space-y-3 mt-3"
      style={{ background: ss.fill + 'aa', borderColor: ss.stroke + '66' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: ls.dot }}>{ls.label}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded text-white" style={{ background: ss.stroke }}>
              {ss.label}
            </span>
            {en.n.isCoalescent && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ background: '#fef3c7', color: '#92400e' }}>Pressure point</span>
            )}
          </div>
          <h4 className="text-sm font-bold text-slate-900 leading-snug">{formatLabel(en.n.displayLabel)}</h4>
          <p className="text-[10px] text-slate-500 mt-1">
            Weighted score: <strong>{en.score}</strong>
            {en.n.rawFrequency > 0 && <> · <strong>{en.n.rawFrequency}</strong> mentions</>}
            {isGeneric(en.n.displayLabel) && <span className="text-amber-500"> · generic penalty applied</span>}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/60 shrink-0">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {en.n.isOrphan && (
        <div className="text-xs leading-relaxed p-2.5 rounded-lg bg-white/60 border border-white/80 text-slate-700">
          {en.n.orphanType === 'CONSTRAINT_NO_RESPONSE'    && '⚠ Known problem with no transformation pathway — being ignored.'}
          {en.n.orphanType === 'REIMAGINATION_UNSUPPORTED' && '⚠ Aspiration with no enabler — strategy without an execution path.'}
          {en.n.orphanType === 'ENABLER_LEADS_NOWHERE'     && '⚠ Activity with no strategic purpose — effort disconnected from vision.'}
          {!en.n.orphanType                                && '⚠ No strong connections to other nodes in the transformation map.'}
        </div>
      )}

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

      {q && (
        <div className="text-xs text-slate-600 italic border-l-2 border-slate-300 pl-2.5 leading-relaxed">
          &ldquo;{q.text.length > 160 ? q.text.slice(0, 158) + '…' : q.text}&rdquo;
          {(q.participantRole || q.lens) && (
            <span className="not-italic text-slate-400 ml-1.5">
              — {[q.participantRole, q.lens].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}

      {/* Add to Way Forward */}
      <div className="pt-1">
        <button
          onClick={() => onAddToWayForward(en.n.nodeId)}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            isInWayForward
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {isInWayForward ? (
            <><CheckCircle2 className="h-3.5 w-3.5" /> In Way Forward</>
          ) : (
            <><Plus className="h-3.5 w-3.5" /> Add to Way Forward</>
          )}
        </button>
      </div>
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
      <span className="ml-1 text-slate-300 italic">Click any node or link to explore</span>
    </div>
  );
}

// ── Edge evidence panel ───────────────────────────────────────────────────────

function EdgeEvidencePanel({ edge, onClose }: { edge: VisEdge; onClose: () => void }) {
  const relLabel: Record<string, string> = {
    drives: 'Drives →', enables: 'Enables →', constrains: 'Constrains',
    compensates_for: 'Workaround for', responds_to: 'Responds to',
    contradicts: '⟷ Contradicts', blocks: 'Blocks', depends_on: 'Depends on',
  };
  const ev    = edge.evidence ?? { mentionCount: 0, actorCount: 0, quotes: [], rationale: '', relationshipType: '' };
  const label = relLabel[ev.relationshipType] ?? ev.relationshipType;
  const { mentionCount, actorCount, quotes, rationale } = ev;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500 mb-1">Link Evidence</p>
          <p className="text-sm font-semibold text-slate-800 leading-snug">
            {formatLabel(edge.fromLabel)}
            <span className="mx-2 text-sky-400 font-normal text-xs">{label}</span>
            {formatLabel(edge.toLabel)}
          </p>
        </div>
        <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-4 mb-3">
        {[['mentions', mentionCount], ['actors', actorCount], ['strength', edge.score]].map(([k, v]) => (
          <div key={k} className="text-center">
            <p className="text-xl font-black text-sky-700 leading-none">{v}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">{k}</p>
          </div>
        ))}
      </div>
      {rationale && (
        <p className="text-xs text-slate-600 italic mb-3 border-l-2 border-sky-200 pl-2">{rationale}</p>
      )}
      {quotes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Evidence quotes</p>
          {quotes.map((q, i) => (
            <div key={i} className="bg-white border border-sky-100 rounded-lg p-2.5">
              <p className="text-xs italic text-slate-600 mb-1">&ldquo;{q.text}&rdquo;</p>
              <div className="flex items-center gap-2">
                {q.participantRole && <span className="text-[9px] text-slate-400">— {q.participantRole}</span>}
                {q.lens && <span className="text-[9px] text-slate-300">· {q.lens}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No direct quotes available for this relationship.</p>
      )}
    </div>
  );
}

// ── Remaining issues dropdown ─────────────────────────────────────────────────

function RemainingList({ nodes }: { nodes: EN[] }) {
  const [open, setOpen] = useState(false);
  if (nodes.length === 0) return null;

  const groups = [
    { status: 'critical' as Status,     label: 'No pathway — being ignored',    sub: 'High-frequency issues with no transformation response', dot: '#ef4444', items: nodes.filter(e => e.status === 'critical') },
    { status: 'partial' as Status,      label: 'Partially addressed',            sub: 'Some coverage exists but gaps remain',                  dot: '#f59e0b', items: nodes.filter(e => e.status === 'partial') },
    { status: 'addressed' as Status,    label: 'Has a transformation pathway',   sub: 'Connected to the vision through valid chains',           dot: '#10b981', items: nodes.filter(e => e.status === 'addressed') },
    { status: 'disconnected' as Status, label: 'Disconnected — no strong links', sub: 'Appears in the hemisphere but isolated from main logic', dot: '#94a3b8', items: nodes.filter(e => e.status === 'disconnected') },
  ].filter(g => g.items.length > 0);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <span className="text-xs font-bold text-slate-700">{nodes.length} further issue{nodes.length !== 1 ? 's' : ''}</span>
          <span className="ml-2 text-[10px] text-slate-400">not in visual map — expand to review</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {groups.map(g => (
            <div key={g.status} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.dot }} />
                <span className="text-xs font-bold text-slate-700">{g.label}</span>
                <span className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{g.items.length}</span>
              </div>
              <p className="text-[10px] text-slate-400 mb-3 pl-4">{g.sub}</p>
              <div className="space-y-1.5">
                {[...g.items].sort((a, b) => b.n.rawFrequency - a.n.rawFrequency).map(en => {
                  const ls     = LAYER_STYLE[en.n.layer];
                  const topRole = en.n.quotes.find(q => q.participantRole)?.participantRole;
                  const senW   = seniorityWeight(topRole);
                  return (
                    <div key={en.n.nodeId} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white border border-slate-100">
                      <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: ls.dot }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 leading-snug">{formatLabel(en.n.displayLabel)}</p>
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
                      {en.n.rawFrequency > 0 && (
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black tabular-nums leading-none text-slate-700">{en.n.rawFrequency}</p>
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

// ── Filter strip (for visual map) ─────────────────────────────────────────────

function FilterStrip({ all, activeFilter, onFilter }: { all: EN[]; activeFilter: Status | null; onFilter: (f: Status | null) => void }) {
  const critCount = all.filter(e => e.status === 'critical').length;
  const addressed = all.filter(e => e.status === 'addressed').length;
  const ignored   = all.filter(e => e.status === 'critical' && e.n.isOrphan && e.n.layer === 'CONSTRAINT').length;
  const total     = all.length;
  const pct       = Math.round((addressed / Math.max(total, 1)) * 100);

  const items = [
    { key: 'critical' as Status, q: 'Fix first',       v: `${critCount} critical`,              s: 'Scored clusters with no transformation pathway', c: '#ef4444', bg: '#fef2f2', b: '#fca5a5' },
    { key: 'addressed' as Status, q: 'Being addressed', v: `${addressed} of ${total} (${pct}%)`, s: 'Weighted clusters with a valid pathway',          c: '#3b82f6', bg: '#eff6ff', b: '#bfdbfe' },
    { key: 'critical' as Status, q: 'Being ignored',   v: ignored > 0 ? `${ignored} orphan constraints` : 'None', s: ignored > 0 ? 'High-frequency issues with no plan' : 'All constraints have some pathway', c: ignored > 0 ? '#dc2626' : '#10b981', bg: ignored > 0 ? '#fef2f2' : '#f0fdf4', b: ignored > 0 ? '#fca5a5' : '#bbf7d0' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 px-4 pt-3">
      {items.map((it, i) => {
        const isActive = activeFilter !== null && (
          (i === 0 && activeFilter === 'critical') ||
          (i === 1 && activeFilter === 'addressed') ||
          (i === 2 && activeFilter === 'critical')
        );
        return (
          <button
            key={i}
            onClick={() => onFilter(isActive ? null : it.key)}
            className="rounded-xl px-4 py-3 text-left transition-all hover:opacity-80"
            style={{ background: it.bg, border: `1px solid ${isActive ? it.c : it.b}`, boxShadow: isActive ? `0 0 0 2px ${it.c}44` : undefined }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{it.q}</p>
            <p className="text-base font-black leading-none mb-1" style={{ color: it.c }}>{it.v}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{it.s}</p>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DECISION ENGINE SECTIONS
// ══════════════════════════════════════════════════════════════════════════════

// ── Executive Summary ─────────────────────────────────────────────────────────

function ExecutiveSummarySection({ data }: { data: TransformationLogicMap }) {
  const summary = useMemo(() => buildExecSummary(data), [data]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">What the data reveals</p>
        <p className="text-sm font-semibold text-white leading-relaxed">{summary.headline}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div className="px-5 py-3.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Target className="h-3 w-3" /> Where pressure concentrates
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{summary.pressure}</p>
        </div>
        <div className="px-5 py-3.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> What is currently missing
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{summary.gap}</p>
        </div>
        <div className="px-5 py-3.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-500" /> What must happen first
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{summary.action}</p>
        </div>
      </div>
    </div>
  );
}

// ── Risk level pill ───────────────────────────────────────────────────────────

function RiskPill({ level }: { level: PriorityNode['riskLevel'] }) {
  const cfg = {
    critical: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: 'Critical' },
    high:     { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', label: 'High'     },
    medium:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'Medium'   },
  }[level];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border"
          style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

// ── Decision Card ─────────────────────────────────────────────────────────────

function DecisionCard({
  p, isExpanded, onToggle, isInWayForward, onAddToWayForward,
}: {
  p: PriorityNode;
  isExpanded: boolean;
  onToggle: () => void;
  isInWayForward: boolean;
  onAddToWayForward: (nodeId: string) => void;
}) {
  const ls  = LAYER_STYLE[p.layer];
  const topQuote = p.quotes[0] ?? null;

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${
      isExpanded ? 'border-slate-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'
    }`}>
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-3.5 flex items-start gap-4"
      >
        {/* Rank badge */}
        <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center mt-0.5">
          {String(p.rank).padStart(2, '0')}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-bold text-slate-900">{formatLabel(p.displayLabel)}</span>
            <RiskPill level={p.riskLevel} />
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: ls.dot + '22', color: ls.dot }}>
              {ls.label}
            </span>
            {p.isCoalescent && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Pressure point
              </span>
            )}
            {isInWayForward && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" /> Way Forward
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span><strong className="text-slate-600">{p.mentionCount}</strong> mentions</span>
            {p.distinctRoles.length > 0 && (
              <span><strong className="text-slate-600">{p.distinctRoles.length}</strong> role{p.distinctRoles.length !== 1 ? 's' : ''}</span>
            )}
            {p.drives.length > 0 && (
              <span><strong className="text-slate-600">{p.drives.length}</strong> connection{p.drives.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        <span className="shrink-0 text-slate-400 mt-1">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Body — only when expanded */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/50">
          {/* Why this matters */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Why this matters</p>
            <p className="text-xs text-slate-700 leading-relaxed">{p.whyMatters}</p>
          </div>

          {/* Connections */}
          {(p.drives.length > 0 || p.unlocks.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {p.drives.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">Drives →</p>
                  <div className="flex flex-wrap gap-1">
                    {p.drives.map((d, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 font-medium">{d}</span>
                    ))}
                  </div>
                </div>
              )}
              {p.unlocks.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mb-1.5">Unlocks →</p>
                  <div className="flex flex-wrap gap-1">
                    {p.unlocks.map((u, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-medium">{u}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Roles involved */}
          {p.distinctRoles.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Raised by</p>
              <div className="flex flex-wrap gap-1">
                {p.distinctRoles.map((r, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{r}</span>
                ))}
              </div>
            </div>
          )}

          {/* Evidence quote */}
          {topQuote && (
            <div className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3 leading-relaxed">
              &ldquo;{topQuote.text.length > 200 ? topQuote.text.slice(0, 198) + '…' : topQuote.text}&rdquo;
              {topQuote.participantRole && (
                <span className="not-italic text-slate-400 ml-1.5">— {topQuote.participantRole}</span>
              )}
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 space-y-3">
            {/* Risk if ignored */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-400 mb-1.5">Risk if ignored</p>
              <p className="text-xs text-slate-600 leading-relaxed">{p.riskIfIgnored}</p>
            </div>

            {/* Suggested action */}
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-1.5">Suggested action</p>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">{p.suggestedAction}</p>
            </div>
          </div>

          {/* Add to Way Forward */}
          <div className="flex justify-end">
            <button
              onClick={() => onAddToWayForward(p.nodeId)}
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                isInWayForward
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {isInWayForward ? <><CheckCircle2 className="h-3.5 w-3.5" /> In Way Forward</> : <><Plus className="h-3.5 w-3.5" /> Add to Way Forward</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Priority section ──────────────────────────────────────────────────────────

function PrioritySection({
  data, wayForwardIds, onAddToWayForward, workshopId,
}: {
  data: TransformationLogicMap;
  wayForwardIds: Set<string>;
  onAddToWayForward: (nodeId: string) => void;
  workshopId?: string;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const priorities = useMemo(() => computePriorityNodes(data), [data]);

  if (priorities.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Ranked by frequency · seniority · spread · connections</p>
          <h3 className="text-sm font-bold text-slate-800">Top Priorities Driving Transformation Risk</h3>
        </div>
        {workshopId && (
          <ReportSectionToggle workshopId={workshopId} sectionId="transformation_priorities" title="Transformation Priorities" />
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {priorities.map((p, i) => (
          <div key={p.nodeId} className="p-3">
            <DecisionCard
              p={p}
              isExpanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(prev => prev === i ? null : i)}
              isInWayForward={wayForwardIds.has(p.nodeId)}
              onAddToWayForward={onAddToWayForward}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Way Forward section ───────────────────────────────────────────────────────

function WayForwardSection({
  data, manualNodeIds, onRemoveManual, workshopId,
}: {
  data: TransformationLogicMap;
  manualNodeIds: Set<string>;
  onRemoveManual: (nodeId: string) => void;
  workshopId?: string;
}) {
  const phases = useMemo(() => buildWayForward(data, manualNodeIds), [data, manualNodeIds]);
  const totalItems = phases.reduce((s, p) => s + p.items.length, 0);

  if (totalItems === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Evidence-based · Sequenced by dependency · {totalItems} initiatives</p>
          <h3 className="text-sm font-bold text-slate-800">Way Forward</h3>
        </div>
        {workshopId && (
          <ReportSectionToggle workshopId={workshopId} sectionId="way_forward" title="Way Forward" />
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {phases.map(phase => (
          <div key={phase.phase} className="p-5 space-y-4">
            {/* Phase header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0"
                   style={{ background: phase.color }}>
                {phase.phase}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: phase.textColor }}>{phase.name}</p>
                <p className="text-[10px] text-slate-400">{phase.timeline}</p>
              </div>
            </div>

            {/* Initiatives */}
            <div className="space-y-2.5">
              {phase.items.map(item => (
                <div key={item.nodeId}
                     className="rounded-lg p-3 border relative group"
                     style={{ background: phase.bgColor, borderColor: phase.borderColor }}>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: phase.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-snug" style={{ color: phase.textColor }}>
                        {item.label}
                        {item.isManual && (
                          <span className="ml-1.5 text-[9px] font-normal text-slate-400">(added)</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{item.description}</p>
                    </div>
                    {item.isManual && (
                      <button
                        onClick={() => onRemoveManual(item.nodeId)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/60 shrink-0 transition-opacity"
                        title="Remove from Way Forward"
                      >
                        <X className="h-3 w-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Dependencies */}
            <div className="text-[10px] text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-500">Requires: </span>
              {phase.dependencies}
            </div>

            {/* Expected outcome */}
            <div className="rounded-lg p-3 border bg-white" style={{ borderColor: phase.borderColor }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: phase.color }}>Expected outcome</p>
              <p className="text-[10px] text-slate-600 leading-relaxed">{phase.expectedOutcome}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ══════════════════════════════════════════════════════════════════════════════

interface Props {
  data: TransformationLogicMap;
  workshopId?: string;
}

export function TransformationLogicMapPanel({ data, workshopId }: Props) {
  const [selected,         setSelected]         = useState<string | null>(null);
  const [activeFilter,     setActiveFilter]      = useState<Status | null>(null);
  const [sensitivity,      setSensitivity]       = useState<SensitivityMode>('balanced');
  const [selectedEdge,     setSelectedEdge]      = useState<VisEdge | null>(null);
  const [wayForwardIds,    setWayForwardIds]      = useState<Set<string>>(new Set());
  const [mapCollapsed,     setMapCollapsed]       = useState(true);

  const all = useMemo(() => enrich(data), [data]);

  const featured = useMemo(() => {
    if (all.length === 0) return [];
    const byId   = new Map(all.map(e => [e.n.nodeId, e]));
    const chosen = new Set<string>();

    // 1. Both endpoints of every TLM edge (prevents chain constraints being excluded)
    for (const edge of data.edges) {
      const f = byId.get(edge.fromNodeId);
      const t = byId.get(edge.toNodeId);
      if (f) chosen.add(f.n.nodeId);
      if (t) chosen.add(t.n.nodeId);
    }
    // 2. All critical nodes
    all.filter(e => e.status === 'critical').forEach(e => chosen.add(e.n.nodeId));
    // 3. Top partial + extra by layer
    all.filter(e => e.status === 'partial').slice(0, 6).forEach(e => chosen.add(e.n.nodeId));
    all.filter(e => e.n.layer === 'ENABLER'       && !chosen.has(e.n.nodeId)).slice(0, 5).forEach(e => chosen.add(e.n.nodeId));
    all.filter(e => e.n.layer === 'REIMAGINATION' && !chosen.has(e.n.nodeId)).slice(0, 4).forEach(e => chosen.add(e.n.nodeId));

    return all.filter(e => chosen.has(e.n.nodeId));
  }, [all, data.edges]);

  const maxPerLane = useMemo(() => {
    const counts = (['REIMAGINATION', 'ENABLER', 'CONSTRAINT'] as const).map(
      l => featured.filter(e => e.n.layer === l).length,
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

  const remaining   = all.filter(e => !featured.some(f => f.n.nodeId === e.n.nodeId));
  const selectedEN  = selected ? featured.find(e => e.n.nodeId === selected) ?? null : null;

  const connectedIds = selected
    ? new Set(visEdges.filter(e => {
        const fp = pos.get(selected);
        return fp && ((e.x1 === fp.x && e.y1 === fp.y) || (e.x2 === fp.x && e.y2 === fp.y));
      }).flatMap(e => {
        const fp = pos.get(selected)!;
        return featured
          .filter(en => {
            const p = pos.get(en.n.nodeId);
            return p && ((p.x === e.x1 && p.y === e.y1) || (p.x === e.x2 && p.y === e.y2));
          })
          .map(en => en.n.nodeId);
      }))
    : null;

  function handleAddToWayForward(nodeId: string) {
    setWayForwardIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function handleRemoveFromWayForward(nodeId: string) {
    setWayForwardIds(prev => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }

  return (
    <div className="space-y-4 p-4">

      {/* ── Executive Summary ─────────────────────────── */}
      <ExecutiveSummarySection data={data} />

      {/* ── Top Priorities ───────────────────────────── */}
      <PrioritySection
        data={data}
        wayForwardIds={wayForwardIds}
        onAddToWayForward={handleAddToWayForward}
        workshopId={workshopId}
      />

      {/* ── Way Forward ──────────────────────────────── */}
      <WayForwardSection
        data={data}
        manualNodeIds={wayForwardIds}
        onRemoveManual={handleRemoveFromWayForward}
        workshopId={workshopId}
      />

      {/* ── Supporting Evidence (collapsible map) ────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setMapCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-600">Supporting Evidence</span>
            <span className="text-[10px] text-slate-400">— Transformation Logic Map</span>
            <span className="ml-2 text-[10px] text-slate-400">
              {featured.length} nodes · {data.strongestChains.length} chain{data.strongestChains.length !== 1 ? 's' : ''} · {data.coverageScore}% coverage
            </span>
          </div>
          {mapCollapsed
            ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            : <ChevronUp   className="h-4 w-4 text-slate-400 shrink-0" />
          }
        </button>

        {!mapCollapsed && (
          <>
            <FilterStrip
              all={all}
              activeFilter={activeFilter}
              onFilter={f => { setActiveFilter(f); setSelected(null); }}
            />

            {/* Sensitivity control */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 gap-3 flex-wrap">
              <SensitivityControl value={sensitivity} onChange={m => { setSensitivity(m); setSelected(null); }} />
            </div>

            <div className="overflow-x-auto">
              {(() => {
                const sensCfg   = SENSITIVITY[sensitivity];
                const sensEdges = visEdges.filter(e => e.score >= sensCfg.edgeScoreMin);
                return (
                  <svg
                    width={canvasW} height={CH}
                    viewBox={`0 0 ${canvasW} ${CH}`}
                    style={{ display: 'block', minWidth: canvasW }}
                  >
                    <LaneBands cw={canvasW} />
                    {sensEdges.map((e, i) => {
                      const nodeDim = selected !== null && connectedIds !== null && (() => {
                        const sp = pos.get(selected)!;
                        return !((e.x1 === sp.x && e.y1 === sp.y) || (e.x2 === sp.x && e.y2 === sp.y));
                      })();
                      const isEdgeSel = selectedEdge !== null &&
                        selectedEdge.x1 === e.x1 && selectedEdge.y1 === e.y1 &&
                        selectedEdge.x2 === e.x2 && selectedEdge.y2 === e.y2;
                      return (
                        <EdgeBundle
                          key={i} {...e}
                          dim={nodeDim}
                          selected={isEdgeSel}
                          onClick={() => setSelectedEdge(prev =>
                            prev && prev.x1 === e.x1 && prev.y1 === e.y1 &&
                            prev.x2 === e.x2 && prev.y2 === e.y2 ? null : e,
                          )}
                        />
                      );
                    })}
                    {featured.map(en => {
                      const p = pos.get(en.n.nodeId);
                      if (!p) return null;
                      const sensDim   = !nodePassesSens(en, sensCfg);
                      const filterDim = activeFilter !== null && en.status !== activeFilter;
                      const selectDim = selected !== null && selected !== en.n.nodeId &&
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
                            if (sensDim) return;
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

            {/* Edge evidence panel */}
            {selectedEdge && !selectedEN && (
              <div className="px-4 pb-4">
                <EdgeEvidencePanel edge={selectedEdge} onClose={() => setSelectedEdge(null)} />
              </div>
            )}

            {/* Node detail with Add to Way Forward */}
            {selectedEN && (
              <div className="px-4 pb-4">
                <NodeDetail
                  en={selectedEN}
                  onClose={() => { setSelected(null); setSelectedEdge(null); }}
                  isInWayForward={wayForwardIds.has(selectedEN.n.nodeId)}
                  onAddToWayForward={handleAddToWayForward}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Remaining issues ─────────────────────────── */}
      <RemainingList nodes={activeFilter ? remaining.filter(e => e.status === activeFilter) : remaining} />

      {/* ── Interpretation ───────────────────────────── */}
      {data.interpretationSummary && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Graph interpretation</p>
          <p className="text-xs text-slate-600 leading-relaxed">{data.interpretationSummary}</p>
        </div>
      )}
    </div>
  );
}

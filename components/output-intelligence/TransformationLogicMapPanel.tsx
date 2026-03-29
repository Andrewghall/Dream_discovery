'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, MinusCircle, Zap } from 'lucide-react';
import type { TransformationLogicMap, TLMNode } from '@/lib/output-intelligence/types';

// ── Status typing ─────────────────────────────────────────────────────────────

type Status = 'critical' | 'partial' | 'addressed' | 'disconnected';

const STATUS_CFG: Record<Status, {
  label: string; bg: string; border: string;
  pill: string; pillText: string; Icon: typeof AlertCircle;
}> = {
  critical:     { label: 'No pathway',   bg: '#fef2f2', border: '#fca5a5', pill: '#ef4444', pillText: '#fff', Icon: AlertCircle   },
  partial:      { label: 'Partial',      bg: '#fffbeb', border: '#fde68a', pill: '#f59e0b', pillText: '#fff', Icon: MinusCircle   },
  addressed:    { label: 'Has pathway',  bg: '#f0fdf4', border: '#bbf7d0', pill: '#10b981', pillText: '#fff', Icon: CheckCircle2  },
  disconnected: { label: 'Disconnected', bg: '#f8fafc', border: '#e2e8f0', pill: '#94a3b8', pillText: '#fff', Icon: MinusCircle   },
};

const LAYER_CFG: Record<TLMNode['layer'], { label: string; pill: string; text: string }> = {
  CONSTRAINT:    { label: 'Constraint', pill: '#fee2e2', text: '#991b1b' },
  ENABLER:       { label: 'Enabler',    pill: '#dbeafe', text: '#1e40af' },
  REIMAGINATION: { label: 'Aspiration', pill: '#d1fae5', text: '#065f46' },
};

const TIER_CFG = {
  1: { label: 'FIX NOW',             sub: 'Critical issues — no pathway or pressure point without resolution',  bg: '#fef2f2', border: '#f87171', text: '#991b1b', dot: '#ef4444' },
  2: { label: 'HIGH IMPACT — NEXT',  sub: 'Partially addressed or high-scoring issues requiring attention',     bg: '#fffbeb', border: '#fbbf24', text: '#92400e', dot: '#f59e0b' },
  3: { label: 'ADDRESSED / LOW',     sub: 'Handled issues or low-priority supporting nodes',                    bg: '#f8fafc', border: '#cbd5e1', text: '#475569', dot: '#94a3b8' },
} as const;

// ── Scoring ───────────────────────────────────────────────────────────────────

function calcStatus(n: TLMNode): Status {
  if (n.isOrphan && n.layer === 'CONSTRAINT')  return 'critical';
  if (n.isCoalescent && !n.inValidChain)       return 'critical';
  if (n.inValidChain)                          return 'addressed';
  if (n.isOrphan)                              return 'disconnected';
  return 'partial';
}

function calcScore(n: TLMNode, maxDeg: number, maxFreq: number): number {
  let s = 0;
  if (n.isCoalescent)                                               s += 28;
  if (n.isOrphan && n.layer === 'CONSTRAINT')                       s += 35;
  if (n.isOrphan && n.layer === 'REIMAGINATION')                    s += 18;
  if (n.isOrphan && n.layer === 'ENABLER')                          s += 10;
  if (!n.inValidChain && !n.isOrphan && n.layer === 'CONSTRAINT')   s += 18;
  if (maxDeg  > 0) s += (n.connectionDegree / maxDeg)  * 16;
  if (maxFreq > 0) s += (n.rawFrequency     / maxFreq) * 10;
  const lenses = new Set(n.quotes.map(q => q.lens).filter(Boolean)).size;
  s += Math.min(12, lenses * 3);
  return Math.min(100, Math.round(s));
}

function calcTier(status: Status, score: number): 1 | 2 | 3 {
  if (status === 'critical')                    return 1;
  if (status === 'partial'      && score >= 48) return 1;
  if (status === 'partial')                     return 2;
  if (status === 'disconnected' && score >= 22) return 2;
  if (status === 'addressed'    && score >= 60) return 2;
  return 3;
}

// ── Enriched node ─────────────────────────────────────────────────────────────

interface EnrichedNode {
  node:        TLMNode;
  status:      Status;
  score:       number;
  tier:        1 | 2 | 3;
  crossLenses: number;
  connects:    Array<{ label: string; layer: TLMNode['layer'] }>;
}

function buildEnrichedNodes(tlm: TransformationLogicMap): EnrichedNode[] {
  if (!tlm.nodes.length) return [];
  const maxDeg  = Math.max(...tlm.nodes.map(n => n.connectionDegree), 1);
  const maxFreq = Math.max(...tlm.nodes.map(n => n.rawFrequency), 1);
  const byId    = new Map(tlm.nodes.map(n => [n.nodeId, n]));

  return tlm.nodes.map(n => {
    const status      = calcStatus(n);
    const score       = calcScore(n, maxDeg, maxFreq);
    const tier        = calcTier(status, score);
    const crossLenses = new Set(n.quotes.map(q => q.lens).filter(Boolean)).size;

    const connects = tlm.edges
      .filter(e => (e.fromNodeId === n.nodeId || e.toNodeId === n.nodeId) && e.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(e => {
        const otherId = e.fromNodeId === n.nodeId ? e.toNodeId : e.fromNodeId;
        const other   = byId.get(otherId);
        return other ? { label: other.displayLabel, layer: other.layer } : null;
      })
      .filter(Boolean) as Array<{ label: string; layer: TLMNode['layer'] }>;

    return { node: n, status, score, tier, crossLenses, connects };
  });
}

// ── Three-question summary ────────────────────────────────────────────────────

function AnswerStrip({ nodes }: { nodes: EnrichedNode[] }) {
  const fixFirst    = nodes.filter(n => n.tier === 1).length;
  const addressed   = nodes.filter(n => n.status === 'addressed').length;
  const ignored     = nodes.filter(n => n.status === 'critical' && n.node.layer === 'CONSTRAINT' && n.node.isOrphan).length;
  const total       = nodes.length;

  const items = [
    {
      q: 'What do we fix first?',
      a: fixFirst === 0 ? 'No critical issues' : `${fixFirst} issue${fixFirst > 1 ? 's' : ''} in Tier 1`,
      sub: fixFirst > 0 ? 'Scroll to Tier 1 below' : 'All constraints have pathways',
      color: fixFirst > 0 ? '#ef4444' : '#10b981',
      bg:    fixFirst > 0 ? '#fef2f2' : '#f0fdf4',
      bdr:   fixFirst > 0 ? '#fca5a5' : '#bbf7d0',
    },
    {
      q: 'What is being addressed?',
      a: `${addressed} of ${total} nodes`,
      sub: `${Math.round((addressed / Math.max(total, 1)) * 100)}% of the transformation map has a pathway`,
      color: '#3b82f6',
      bg:    '#eff6ff',
      bdr:   '#bfdbfe',
    },
    {
      q: 'What is being ignored?',
      a: ignored === 0 ? 'Nothing critical ignored' : `${ignored} constraint${ignored > 1 ? 's' : ''} with no plan`,
      sub: ignored > 0 ? 'Known problems without a transformation pathway' : 'All constraints are at least partially addressed',
      color: ignored > 0 ? '#dc2626' : '#10b981',
      bg:    ignored > 0 ? '#fef2f2' : '#f0fdf4',
      bdr:   ignored > 0 ? '#fca5a5' : '#bbf7d0',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl p-4" style={{ background: it.bg, border: `1px solid ${it.bdr}` }}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{it.q}</p>
          <p className="text-lg font-black leading-tight mb-1" style={{ color: it.color }}>{it.a}</p>
          <p className="text-[10px] text-slate-400 leading-snug">{it.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Node card ─────────────────────────────────────────────────────────────────

function NodeCard({ en, expanded, onToggle }: {
  en: EnrichedNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sc   = STATUS_CFG[en.status];
  const lc   = LAYER_CFG[en.node.layer];
  const scoreColor = en.status === 'critical' ? '#ef4444' : en.status === 'partial' ? '#f59e0b' : en.status === 'addressed' ? '#10b981' : '#94a3b8';
  const topQuote   = en.node.quotes[0] ?? null;

  return (
    <div
      className="rounded-xl border transition-shadow hover:shadow-sm cursor-pointer"
      style={{ background: sc.bg, borderColor: sc.border }}
      onClick={onToggle}
    >
      {/* Card header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
            {/* Layer pill */}
            <span
              className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ background: lc.pill, color: lc.text }}
            >
              {lc.label}
            </span>
            {/* Status pill */}
            <span
              className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded text-white"
              style={{ background: sc.pill }}
            >
              {sc.label}
            </span>
            {en.node.isCoalescent && (
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ background: '#fef3c7', color: '#92400e' }}>
                Pressure point
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <ScoreBar score={en.score} color={scoreColor} />
            {expanded
              ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            }
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-slate-900 leading-snug">{en.node.displayLabel}</h4>

        {/* Stats row */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
          {en.node.rawFrequency > 0 && (
            <span className="text-[10px] text-slate-500">{en.node.rawFrequency} signals</span>
          )}
          {en.crossLenses > 0 && (
            <span className="text-[10px] text-slate-500">{en.crossLenses} {en.crossLenses === 1 ? 'lens' : 'lenses'}</span>
          )}
          {en.connects.length > 0 && (
            <span className="text-[10px] text-slate-500">{en.connects.length} connection{en.connects.length > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: sc.border }}>

          {/* Orphan explanation */}
          {en.node.isOrphan && (
            <div className="text-xs text-slate-600 leading-relaxed p-2.5 rounded-lg"
                 style={{ background: 'rgba(0,0,0,0.04)' }}>
              {en.node.orphanType === 'CONSTRAINT_NO_RESPONSE'     && '⚠ Known problem with no transformation pathway — this constraint is being ignored.'}
              {en.node.orphanType === 'REIMAGINATION_UNSUPPORTED'  && '⚠ Aspiration with no enabler supporting it — strategy without execution path.'}
              {en.node.orphanType === 'ENABLER_LEADS_NOWHERE'      && '⚠ Activity connected to no vision — effort without strategic purpose.'}
              {!en.node.orphanType                                 && '⚠ No strong connections to other nodes in the transformation map.'}
            </div>
          )}

          {/* Connections */}
          {en.connects.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Connects to</p>
              <div className="flex flex-wrap gap-1.5">
                {en.connects.map((c, i) => {
                  const clc = LAYER_CFG[c.layer];
                  return (
                    <span key={i}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: clc.pill, color: clc.text }}>
                      {c.label.length > 36 ? c.label.slice(0, 35) + '…' : c.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evidence */}
          {topQuote && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Evidence</p>
              <div className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-2.5 leading-relaxed">
                "{topQuote.text.length > 140 ? topQuote.text.slice(0, 138) + '…' : topQuote.text}"
                {(topQuote.participantRole || topQuote.lens) && (
                  <span className="not-italic text-slate-400 ml-1.5">
                    — {[topQuote.participantRole, topQuote.lens].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tier section ──────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE = 6;

function TierSection({ tier, nodes }: { tier: 1 | 2 | 3; nodes: EnrichedNode[] }) {
  const [showAll,    setShowAll]    = useState(false);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [collapsed,  setCollapsed]  = useState(tier === 3);

  if (nodes.length === 0) return null;

  const cfg      = TIER_CFG[tier];
  const visible  = showAll ? nodes : nodes.slice(0, DEFAULT_VISIBLE);
  const hidden   = nodes.length - DEFAULT_VISIBLE;

  const toggleCard = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: cfg.border }}>
      {/* Tier header */}
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        style={{ background: cfg.bg }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
          <div>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: cfg.text }}>
              Tier {tier}: {cfg.label}
            </span>
            <span className="ml-3 text-[10px] font-semibold" style={{ color: cfg.dot }}>
              {nodes.length} {nodes.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 hidden sm:block">{cfg.sub}</span>
          {collapsed
            ? <ChevronDown className="h-4 w-4 shrink-0" style={{ color: cfg.text }} />
            : <ChevronUp   className="h-4 w-4 shrink-0" style={{ color: cfg.text }} />
          }
        </div>
      </button>

      {/* Cards */}
      {!collapsed && (
        <div className="p-4 space-y-3" style={{ background: '#fafafa' }}>
          {visible.map(en => (
            <NodeCard
              key={en.node.nodeId}
              en={en}
              expanded={expanded.has(en.node.nodeId)}
              onToggle={() => toggleCard(en.node.nodeId)}
            />
          ))}

          {!showAll && hidden > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-2.5 text-xs font-semibold rounded-lg border border-dashed transition-colors hover:bg-white"
              style={{ borderColor: cfg.border, color: cfg.text }}
            >
              Show {hidden} more {hidden === 1 ? 'item' : 'items'} ↓
            </button>
          )}
          {showAll && nodes.length > DEFAULT_VISIBLE && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Show less ↑
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  data: TransformationLogicMap;
}

export function TransformationLogicMapPanel({ data }: Props) {
  const enriched = useMemo(() => {
    const nodes = buildEnrichedNodes(data);
    // Within each tier, sort by score descending
    return nodes.sort((a, b) => a.tier - b.tier || b.score - a.score);
  }, [data]);

  if (enriched.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <p className="text-sm text-slate-500">No graph data available yet.</p>
        <p className="text-xs text-slate-400">Run the Brain Scan to generate the Transformation Logic Map.</p>
      </div>
    );
  }

  const tier1 = enriched.filter(n => n.tier === 1);
  const tier2 = enriched.filter(n => n.tier === 2);
  const tier3 = enriched.filter(n => n.tier === 3);

  return (
    <div className="space-y-4">

      {/* ── Three direct answers ──────────────────────────── */}
      <AnswerStrip nodes={enriched} />

      {/* ── Tier sections ─────────────────────────────────── */}
      <TierSection tier={1} nodes={tier1} />
      <TierSection tier={2} nodes={tier2} />
      <TierSection tier={3} nodes={tier3} />

      {/* ── Interpretation ────────────────────────────────── */}
      {data.interpretationSummary && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">What this map reveals</p>
          <p className="text-sm text-slate-700 leading-relaxed">{data.interpretationSummary}</p>
        </div>
      )}

      {/* ── Coverage footer ───────────────────────────────── */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
        <span>{enriched.length} nodes · {data.strongestChains.length} valid chains · {data.coverageScore}% constraint coverage</span>
        <span>Scoring: connection density + orphan severity + cross-lens impact + evidence volume</span>
      </div>
    </div>
  );
}

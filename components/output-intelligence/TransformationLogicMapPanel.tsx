'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, Zap, Target, GitBranch, ArrowRight, X, Info } from 'lucide-react';
import type { TransformationLogicMap, TLMNode, TLMEdge } from '@/lib/output-intelligence/types';

// ── Colour system ─────────────────────────────────────────────────────────────

const LAYER_COLOR = {
  CONSTRAINT:    { fill: '#ef4444', ring: '#fca5a5', muted: '#fee2e2', text: '#991b1b', label: 'Constraint' },
  ENABLER:       { fill: '#3b82f6', ring: '#93c5fd', muted: '#dbeafe', text: '#1e40af', label: 'Enabler'    },
  REIMAGINATION: { fill: '#10b981', ring: '#6ee7b7', muted: '#d1fae5', text: '#065f46', label: 'Aspiration' },
} as const;

const EDGE_COLOR: Record<TLMEdge['relationshipType'], { stroke: string; dashed: boolean }> = {
  drives:          { stroke: '#f97316', dashed: false },
  enables:         { stroke: '#10b981', dashed: false },
  constrains:      { stroke: '#dc2626', dashed: false },
  responds_to:     { stroke: '#3b82f6', dashed: false },
  compensates_for: { stroke: '#f59e0b', dashed: true  },
  contradicts:     { stroke: '#a855f7', dashed: true  },
  blocks:          { stroke: '#7f1d1d', dashed: false },
  depends_on:      { stroke: '#6366f1', dashed: false },
};

// ── Force-directed layout ─────────────────────────────────────────────────────

interface Pos { x: number; y: number; vx: number; vy: number }

const W = 820;
const H = 560;

function initialPositions(nodes: TLMNode[]): Map<string, Pos> {
  const map = new Map<string, Pos>();
  nodes.forEach((n, i) => {
    // Start with layer bias, add angle spread to avoid overlap
    const baseY = n.layer === 'CONSTRAINT' ? 0.75 : n.layer === 'ENABLER' ? 0.50 : 0.25;
    const angle  = (i / nodes.length) * Math.PI * 2;
    const spread = 0.22;
    map.set(n.nodeId, {
      x: (0.5 + Math.cos(angle) * spread) * W,
      y: (baseY  + Math.sin(angle) * spread * 0.5) * H,
      vx: 0,
      vy: 0,
    });
  });
  return map;
}

function runForceSimulation(nodes: TLMNode[], edges: TLMEdge[], iterations = 220): Map<string, Pos> {
  if (nodes.length === 0) return new Map();
  const pos = initialPositions(nodes);
  const REPEL  = 1800;
  const SPRING = 0.018;
  const DAMP   = 0.75;
  const ALPHA_DECAY = 0.96;
  let alpha = 1.0;

  for (let iter = 0; iter < iterations; iter++) {
    alpha *= ALPHA_DECAY;

    // Repulsion between every pair
    const ids = [...pos.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist2 = dx * dx + dy * dy + 1;
        const force = (REPEL / dist2) * alpha;
        const nx = (dx / Math.sqrt(dist2)) * force;
        const ny = (dy / Math.sqrt(dist2)) * force;
        a.vx -= nx; a.vy -= ny;
        b.vx += nx; b.vy += ny;
      }
    }

    // Spring attraction along edges
    for (const edge of edges) {
      const a = pos.get(edge.fromNodeId);
      const b = pos.get(edge.toNodeId);
      if (!a || !b) continue;
      const dx  = b.x - a.x;
      const dy  = b.y - a.y;
      const strength = SPRING * (0.4 + (edge.score / 100) * 0.6);
      const fx  = dx * strength * alpha;
      const fy  = dy * strength * alpha;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Centering + layer-band soft gravity
    for (const [nodeId, p] of pos) {
      const node = nodes.find(n => n.nodeId === nodeId)!;
      const targetY = node.layer === 'CONSTRAINT' ? H * 0.72 : node.layer === 'ENABLER' ? H * 0.50 : H * 0.28;
      p.vx += (W * 0.5 - p.x) * 0.003 * alpha;
      p.vy += (targetY - p.y)  * 0.012 * alpha;
      p.vx *= DAMP;
      p.vy *= DAMP;
      p.x  += p.vx;
      p.y  += p.vy;
      // Clamp to canvas with padding
      p.x = Math.max(50, Math.min(W - 50, p.x));
      p.y = Math.max(40, Math.min(H - 40, p.y));
    }
  }

  return pos;
}

// ── Node radius ───────────────────────────────────────────────────────────────

function nodeRadius(node: TLMNode): number {
  const base = 14 + (node.compositeScore / 100) * 20;
  return node.isCoalescent ? base + 6 : base;
}

// ── Legend items ──────────────────────────────────────────────────────────────

function LegendDot({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <svg width="18" height="10" className="shrink-0">
      <line x1="0" y1="5" x2="18" y2="5"
        stroke={color} strokeWidth="2.5"
        strokeDasharray={dashed ? '4,3' : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Node detail drawer ────────────────────────────────────────────────────────

function ClassBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{ background: color + '22', color, border: `1px solid ${color}55` }}
    >
      {label}
    </span>
  );
}

interface NodeDetailProps {
  node: TLMNode;
  edges: TLMEdge[];
  nodes: TLMNode[];
  onClose: () => void;
}

function NodeDetail({ node, edges, nodes, onClose }: NodeDetailProps) {
  const colors = LAYER_COLOR[node.layer];
  const nodeById = new Map(nodes.map(n => [n.nodeId, n]));

  const outEdges = edges.filter(e => e.fromNodeId === node.nodeId);
  const inEdges  = edges.filter(e => e.toNodeId   === node.nodeId);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-start gap-3 shrink-0"
        style={{ background: colors.muted, borderBottom: `2px solid ${colors.ring}` }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: colors.text }}>
            {colors.label}
          </p>
          <p className="text-sm font-bold text-slate-900 leading-snug">{node.displayLabel}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {node.isCoalescent && <ClassBadge label="Coalescence point" color="#f59e0b" />}
            {node.isOrphan     && <ClassBadge label="Orphan — no pathway" color="#ef4444" />}
            {node.inValidChain && <ClassBadge label="Part of valid chain" color="#10b981" />}
            {node.isCompensating && <ClassBadge label="Workaround" color="#a855f7" />}
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 p-1 rounded hover:bg-slate-200 transition-colors">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Orphan explanation */}
        {node.isOrphan && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
            <p className="text-xs font-semibold text-rose-700 mb-1">Why this is an issue</p>
            <p className="text-xs text-rose-600 leading-relaxed">
              {node.orphanType === 'CONSTRAINT_NO_RESPONSE' && 'This constraint has no planned response — a known problem without a transformation pathway.'}
              {node.orphanType === 'REIMAGINATION_UNSUPPORTED' && 'This aspiration has no enabler supporting it — strategy without an execution path.'}
              {node.orphanType === 'ENABLER_LEADS_NOWHERE' && 'This enabler connects to no vision — activity being performed without clear strategic purpose.'}
            </p>
          </div>
        )}

        {/* Coalescence explanation */}
        {node.isCoalescent && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-700 mb-1">High-density junction</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Multiple pressures and pathways converge here — this is a key transformation leverage point. Addressing this node unlocks or unblocks several other concerns.
            </p>
          </div>
        )}

        {/* Outbound edges */}
        {outEdges.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Drives / Connects to</p>
            <div className="space-y-1.5">
              {outEdges.map(e => {
                const target = nodeById.get(e.toNodeId);
                if (!target) return null;
                const tc = LAYER_COLOR[target.layer];
                return (
                  <div key={e.edgeId} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="shrink-0 mt-1 text-[9px] font-bold uppercase tracking-widest"
                          style={{ color: EDGE_COLOR[e.relationshipType].stroke }}>
                      {e.relationshipType.replace('_', ' ')}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-700 leading-snug flex-1" style={{ color: tc.text }}>
                      {target.displayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inbound edges */}
        {inEdges.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Driven by / Connected from</p>
            <div className="space-y-1.5">
              {inEdges.map(e => {
                const source = nodeById.get(e.fromNodeId);
                if (!source) return null;
                const sc = LAYER_COLOR[source.layer];
                return (
                  <div key={e.edgeId} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-xs leading-snug flex-1" style={{ color: sc.text }}>
                      {source.displayLabel}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                    <span className="shrink-0 mt-1 text-[9px] font-bold uppercase tracking-widest"
                          style={{ color: EDGE_COLOR[e.relationshipType].stroke }}>
                      {e.relationshipType.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Evidence quotes */}
        {node.quotes.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Participant Evidence</p>
            <div className="space-y-2">
              {node.quotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 pl-3 py-1"
                  style={{ borderColor: colors.ring }}>
                  <p className="text-xs text-slate-700 italic leading-relaxed">"{q.text}"</p>
                  {(q.participantRole || q.lens) && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {[q.participantRole, q.lens].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </blockquote>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SVG graph ─────────────────────────────────────────────────────────────────

interface GraphProps {
  data: TransformationLogicMap;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function ForceGraph({ data, selectedId, onSelect }: GraphProps) {
  const positions = useRef<Map<string, Pos>>(new Map());

  // Compute layout once (memoised across re-renders — node identity is stable)
  if (positions.current.size === 0 && data.nodes.length > 0) {
    positions.current = runForceSimulation(data.nodes, data.edges);
  }

  const pos = positions.current;

  // Unique arrowhead markers
  const markerDefs = Object.entries(EDGE_COLOR).map(([type, { stroke }]) => (
    <marker
      key={type}
      id={`arrow-${type}`}
      markerWidth="8" markerHeight="8"
      refX="6" refY="3"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path d="M0,0 L0,6 L8,3 z" fill={stroke} opacity="0.7" />
    </marker>
  ));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <defs>
        {markerDefs}
        {/* Glow filter for coalescence */}
        <filter id="glow-coal" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Layer band backgrounds */}
      <rect x="0" y="0"   width={W} height={H * 0.38} fill="#d1fae5" opacity="0.18" rx="0" />
      <rect x="0" y={H * 0.38} width={W} height={H * 0.24} fill="#dbeafe" opacity="0.18" />
      <rect x="0" y={H * 0.62} width={W} height={H * 0.38} fill="#fee2e2" opacity="0.18" />

      {/* Layer labels */}
      <text x="10" y="18" fontSize="9" fontWeight="700" fill="#065f46" opacity="0.55" letterSpacing="1.5">
        ASPIRATION
      </text>
      <text x="10" y={H * 0.50} fontSize="9" fontWeight="700" fill="#1e40af" opacity="0.55" letterSpacing="1.5">
        ENABLER
      </text>
      <text x="10" y={H - 8}  fontSize="9" fontWeight="700" fill="#991b1b" opacity="0.55" letterSpacing="1.5">
        CONSTRAINT
      </text>

      {/* ── Edges ── */}
      {data.edges.map(edge => {
        const from = pos.get(edge.fromNodeId);
        const to   = pos.get(edge.toNodeId);
        if (!from || !to) return null;
        const ec   = EDGE_COLOR[edge.relationshipType];
        const isSelected = selectedId === edge.fromNodeId || selectedId === edge.toNodeId;
        const opacity = isSelected ? 0.9 : edge.isChainEdge ? 0.55 : 0.28;
        const sw = edge.isChainEdge
          ? 1.5 + (edge.score / 100) * 2.5
          : 1 + (edge.score / 100) * 1.5;

        // Slightly curve the line to avoid overlap
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2 - 15;

        return (
          <path
            key={edge.edgeId}
            d={`M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`}
            fill="none"
            stroke={ec.stroke}
            strokeWidth={sw}
            strokeOpacity={opacity}
            strokeDasharray={ec.dashed ? '5,4' : undefined}
            markerEnd={`url(#arrow-${edge.relationshipType})`}
          />
        );
      })}

      {/* ── Nodes ── */}
      {data.nodes.map(node => {
        const p = pos.get(node.nodeId);
        if (!p) return null;
        const r      = nodeRadius(node);
        const colors = LAYER_COLOR[node.layer];
        const isSelected  = selectedId === node.nodeId;
        const isConnected = selectedId !== null && data.edges.some(
          e => e.fromNodeId === node.nodeId || e.toNodeId === node.nodeId
              ? (e.fromNodeId === selectedId || e.toNodeId === selectedId)
              : false
        );
        const dimmed = selectedId !== null && !isSelected && !isConnected;

        return (
          <g
            key={node.nodeId}
            transform={`translate(${p.x},${p.y})`}
            onClick={() => onSelect(isSelected ? null : node.nodeId)}
            style={{ cursor: 'pointer' }}
            opacity={dimmed ? 0.25 : 1}
          >
            {/* Coalescence outer ring */}
            {node.isCoalescent && (
              <circle
                r={r + 9}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="4,3"
                opacity="0.8"
                filter="url(#glow-coal)"
              />
            )}

            {/* Selection ring */}
            {isSelected && (
              <circle r={r + 5} fill="none" stroke={colors.fill} strokeWidth="2.5" opacity="0.5" />
            )}

            {/* Main circle */}
            <circle
              r={r}
              fill={node.isOrphan ? colors.muted : colors.fill}
              stroke={node.isOrphan ? colors.ring : (isSelected ? colors.fill : '#fff')}
              strokeWidth={node.isOrphan ? '2' : '2'}
              strokeDasharray={node.isOrphan ? '4,3' : undefined}
              opacity={node.isOrphan ? 0.75 : 1}
            />

            {/* Node icon */}
            {node.isCoalescent && (
              <text textAnchor="middle" dominantBaseline="central"
                    fontSize={r * 0.65} fill={node.isOrphan ? colors.text : '#fff'} pointerEvents="none">
                ⬡
              </text>
            )}

            {/* Label */}
            <text
              y={r + 12}
              textAnchor="middle"
              fontSize="9"
              fontWeight={isSelected ? '700' : '600'}
              fill={colors.text}
              pointerEvents="none"
              style={{ maxWidth: '80px' }}
            >
              {node.displayLabel.length > 22
                ? node.displayLabel.slice(0, 20) + '…'
                : node.displayLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function SummaryStrip({ data }: { data: TransformationLogicMap }) {
  const orphanTotal = data.orphanSummary.constraintOrphans + data.orphanSummary.enablerOrphans + data.orphanSummary.visionOrphans;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {/* Coverage */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
        <p className={`text-2xl font-black ${data.coverageScore >= 70 ? 'text-emerald-600' : data.coverageScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
          {data.coverageScore}%
        </p>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">Constraint coverage</p>
        <p className="text-[10px] text-slate-500 mt-1 leading-tight">constraints with a valid transformation path</p>
      </div>

      {/* Chains */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <p className="text-2xl font-black text-emerald-700">{data.strongestChains.length}</p>
        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mt-0.5">Valid chains</p>
        <p className="text-[10px] text-emerald-600 mt-1 leading-tight">complete constraint → enabler → vision paths</p>
      </div>

      {/* Coalescence */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="text-2xl font-black text-amber-700">{data.coalescencePoints.length}</p>
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mt-0.5">Junction points</p>
        <p className="text-[10px] text-amber-600 mt-1 leading-tight">high-density convergence — highest leverage</p>
      </div>

      {/* Orphans */}
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
        <p className="text-2xl font-black text-rose-700">{orphanTotal}</p>
        <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest mt-0.5">Disconnected nodes</p>
        <p className="text-[10px] text-rose-600 mt-1 leading-tight">
          {data.orphanSummary.constraintOrphans} unaddressed · {data.orphanSummary.visionOrphans} unsupported
        </p>
      </div>
    </div>
  );
}

// ── Chain table ───────────────────────────────────────────────────────────────

function ChainTable({ chains }: { chains: TransformationLogicMap['strongestChains'] }) {
  if (chains.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
        <p className="text-xs font-bold text-slate-700">Strongest Transformation Chains</p>
      </div>
      <div className="divide-y divide-slate-100">
        {chains.map((chain, i) => (
          <div key={chain.chainId} className="px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black flex items-center justify-center">
              {i + 1}
            </span>
            <span className="text-xs text-rose-700 font-medium flex-shrink-0 max-w-[180px]">{chain.constraintLabel}</span>
            <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
            <span className="text-xs text-blue-700 font-medium flex-shrink-0 max-w-[180px]">{chain.enablerLabel}</span>
            <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
            <span className="text-xs text-emerald-700 font-medium flex-shrink-0 max-w-[180px]">{chain.reimaginationLabel}</span>
            <span className="ml-auto shrink-0 text-[10px] font-bold text-slate-400">
              {chain.chainStrength > 1 ? chain.chainStrength.toFixed(0) : Math.round(chain.chainStrength * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Orphan panel ──────────────────────────────────────────────────────────────

function OrphanPanel({ data }: { data: TransformationLogicMap }) {
  const total = data.orphanSummary.constraintOrphans + data.orphanSummary.enablerOrphans + data.orphanSummary.visionOrphans;
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-rose-600" />
        <p className="text-sm font-bold text-rose-700">Disconnected Nodes — Watch Points</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-white border border-rose-200 p-3 text-center">
          <p className="text-xl font-black text-rose-600">{data.orphanSummary.constraintOrphans}</p>
          <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-widest">Unaddressed</p>
          <p className="text-[10px] text-rose-500 mt-0.5">Known problems, no plan</p>
        </div>
        <div className="rounded-lg bg-white border border-amber-200 p-3 text-center">
          <p className="text-xl font-black text-amber-600">{data.orphanSummary.enablerOrphans}</p>
          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest">Purposeless</p>
          <p className="text-[10px] text-amber-500 mt-0.5">Effort disconnected from vision</p>
        </div>
        <div className="rounded-lg bg-white border border-purple-200 p-3 text-center">
          <p className="text-xl font-black text-purple-600">{data.orphanSummary.visionOrphans}</p>
          <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-widest">Unsupported</p>
          <p className="text-[10px] text-purple-500 mt-0.5">Aspirations with no enablers</p>
        </div>
      </div>
      {data.orphanSummary.topOrphanLabels.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest mb-2">Examples</p>
          <div className="flex flex-wrap gap-1.5">
            {data.orphanSummary.topOrphanLabels.map((label, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-rose-200 text-rose-700 font-medium">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-3 rounded-xl border border-slate-100 bg-slate-50 text-[10px]">
      {/* Layers */}
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#ef4444' }} />
        <span className="text-slate-600 font-medium">Constraint</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#3b82f6' }} />
        <span className="text-slate-600 font-medium">Enabler</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#10b981' }} />
        <span className="text-slate-600 font-medium">Aspiration</span>
      </div>
      <div className="w-px h-4 bg-slate-200" />
      {/* Node states */}
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full shrink-0 border-2 border-amber-400 border-dashed bg-transparent" />
        <span className="text-slate-600">Junction (coalescence)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full shrink-0 border-2 border-slate-300 border-dashed bg-slate-100" />
        <span className="text-slate-600">Orphan (no pathway)</span>
      </div>
      <div className="w-px h-4 bg-slate-200" />
      {/* Edge types */}
      <div className="flex items-center gap-1.5">
        <LegendDot color="#f97316" />
        <span className="text-slate-600">Drives</span>
      </div>
      <div className="flex items-center gap-1.5">
        <LegendDot color="#10b981" />
        <span className="text-slate-600">Enables</span>
      </div>
      <div className="flex items-center gap-1.5">
        <LegendDot color="#f59e0b" dashed />
        <span className="text-slate-600">Compensates for</span>
      </div>
      <div className="flex items-center gap-1.5">
        <LegendDot color="#a855f7" dashed />
        <span className="text-slate-600">Contradicts</span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  data: TransformationLogicMap;
}

export function TransformationLogicMapPanel({ data }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNode = selectedId ? data.nodes.find(n => n.nodeId === selectedId) ?? null : null;

  if (data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Target className="h-10 w-10 text-slate-300 mb-4" />
        <p className="text-sm font-semibold text-slate-500">Transformation Logic Map not yet available</p>
        <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
          This section builds from the relationship graph. Run a full Brain Scan after a live workshop session with classified signals to generate the map.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">

      {/* Interpretation summary */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200">
        <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-900 leading-relaxed">{data.interpretationSummary}</p>
      </div>

      {/* Summary strip */}
      <SummaryStrip data={data} />

      {/* Graph + detail panel */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="border-b border-slate-100 px-4 py-2.5 flex items-center gap-2 bg-slate-50">
          <Zap className="h-3.5 w-3.5 text-indigo-500" />
          <p className="text-xs font-bold text-slate-700">Logic Map — click any node to explore</p>
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="flex" style={{ minHeight: '400px' }}>
          {/* SVG graph */}
          <div className={selectedNode ? 'flex-1 min-w-0 border-r border-slate-100' : 'w-full'}>
            <ForceGraph
              data={data}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* Detail panel */}
          {selectedNode && (
            <div className="w-72 shrink-0 overflow-hidden" style={{ maxHeight: '560px' }}>
              <NodeDetail
                node={selectedNode}
                edges={data.edges}
                nodes={data.nodes}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="border-t border-slate-100 p-3">
          <Legend />
        </div>
      </div>

      {/* Chain table */}
      <ChainTable chains={data.strongestChains} />

      {/* Orphan panel */}
      <OrphanPanel data={data} />

    </div>
  );
}

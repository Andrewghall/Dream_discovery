'use client';

import { useState, useMemo } from 'react';
import type { ConstraintMapData, ConstraintNode, ConstraintRelationship } from '@/lib/types/discover-analysis';

interface ConstraintMapProps {
  data: ConstraintMapData;
}

// Domain colours (muted executive-grade palette)
const DOMAIN_COLORS: Record<string, string> = {
  People: '#93c5fd',        // blue-300
  Technology: '#fdba74',    // orange-300
  Customer: '#c4b5fd',      // violet-300
  Organisation: '#6ee7b7',  // emerald-300
  Regulation: '#fca5a5',    // red-300
  General: '#cbd5e1',       // slate-300
};

const SEVERITY_STROKE: Record<string, string> = {
  critical: '#ef4444',
  significant: '#f59e0b',
  moderate: '#94a3b8',
};

/**
 * Constraint Map — SVG directed graph of constraints and dependencies
 *
 * Layout: left-to-right hierarchy. Root constraints (no deps) on the left,
 * dependent constraints flowing right.
 */
export function ConstraintMap({ data }: ConstraintMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Layout computation
  const layout = useMemo(() => computeLayout(data), [data]);

  if (data.constraints.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground/50">
        <p className="text-sm">No constraints identified</p>
      </div>
    );
  }

  const { positions, svgWidth, svgHeight } = layout;

  return (
    <div className="relative overflow-x-auto">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="font-sans"
      >
        {/* Edges first (behind nodes) */}
        {data.relationships.map((rel, i) => {
          const from = positions.get(rel.source);
          const to = positions.get(rel.target);
          if (!from || !to) return null;

          const strokeColor =
            rel.type === 'blocks' ? '#ef4444' :
            rel.type === 'amplifies' ? '#f59e0b' :
            '#94a3b8';

          const isDashed = rel.type === 'amplifies';

          return (
            <g key={`edge-${i}`}>
              <line
                x1={from.x + from.width}
                y1={from.y + from.height / 2}
                x2={to.x}
                y2={to.y + to.height / 2}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeDasharray={isDashed ? '4,3' : undefined}
                markerEnd={`url(#arrow-${rel.type})`}
                opacity={
                  hoveredId === null ? 0.5 :
                  hoveredId === rel.source || hoveredId === rel.target ? 0.9 : 0.15
                }
                className="transition-opacity"
              />
            </g>
          );
        })}

        {/* Arrow markers */}
        <defs>
          {['depends_on', 'blocks', 'amplifies'].map((type) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth={6}
              markerHeight={6}
              orient="auto"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill={
                  type === 'blocks' ? '#ef4444' :
                  type === 'amplifies' ? '#f59e0b' :
                  '#94a3b8'
                }
              />
            </marker>
          ))}
        </defs>

        {/* Nodes */}
        {data.constraints.map((constraint) => {
          const pos = positions.get(constraint.id);
          if (!pos) return null;

          const fill = DOMAIN_COLORS[constraint.domain] || DOMAIN_COLORS.General;
          const stroke = SEVERITY_STROKE[constraint.severity] || SEVERITY_STROKE.moderate;
          const isHovered = hoveredId === constraint.id;
          const isConnected = hoveredId !== null && data.relationships.some(
            (r) => (r.source === hoveredId && r.target === constraint.id) ||
                   (r.target === hoveredId && r.source === constraint.id),
          );
          const isDimmed = hoveredId !== null && !isHovered && !isConnected;

          return (
            <g
              key={constraint.id}
              onMouseEnter={() => setHoveredId(constraint.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="cursor-pointer"
              opacity={isDimmed ? 0.25 : 1}
            >
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.width}
                height={pos.height}
                rx={8}
                fill={fill}
                stroke={stroke}
                strokeWidth={isHovered ? 2 : 1}
                opacity={0.85}
              />
              {/* Description text (truncated) */}
              <text
                x={pos.x + pos.width / 2}
                y={pos.y + pos.height / 2 - 4}
                textAnchor="middle"
                className="fill-slate-700"
                fontSize={10}
                fontWeight={500}
              >
                {truncate(constraint.description, 25)}
              </text>
              {/* Weight + domain */}
              <text
                x={pos.x + pos.width / 2}
                y={pos.y + pos.height / 2 + 10}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize={8}
              >
                {constraint.domain} &middot; w:{constraint.weight}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip for hovered node */}
      {hoveredId && (() => {
        const constraint = data.constraints.find((c) => c.id === hoveredId);
        const pos = positions.get(hoveredId);
        if (!constraint || !pos) return null;

        return (
          <div
            className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-xs pointer-events-none"
            style={{
              left: pos.x + pos.width / 2,
              top: pos.y - 10,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <p className="text-sm font-medium text-slate-800 mb-1">{constraint.description}</p>
            <div className="text-xs text-slate-500 space-y-0.5">
              <div>Domain: {constraint.domain}</div>
              <div>Severity: {constraint.severity}</div>
              <div>Frequency: {constraint.frequency} mentions</div>
              <div>Weight: {constraint.weight}</div>
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-slate-400" />
          <span className="text-xs text-slate-400">depends on</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-red-400" />
          <span className="text-xs text-slate-400">blocks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-amber-400" style={{ borderBottom: '1.5px dashed #f59e0b' }} />
          <span className="text-xs text-slate-400">amplifies</span>
        </div>
      </div>
    </div>
  );
}

// ── Layout computation ───────────────────────────────────────

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeLayout(data: ConstraintMapData): {
  positions: Map<string, NodePosition>;
  svgWidth: number;
  svgHeight: number;
} {
  const NODE_W = 180;
  const NODE_H = 44;
  const GAP_X = 60;
  const GAP_Y = 20;
  const PADDING = 30;

  const positions = new Map<string, NodePosition>();
  const { constraints, relationships } = data;

  if (constraints.length === 0) {
    return { positions, svgWidth: 400, svgHeight: 200 };
  }

  // Build adjacency: which nodes does each depend on?
  const dependsOn = new Map<string, Set<string>>();
  for (const c of constraints) {
    dependsOn.set(c.id, new Set());
  }
  for (const rel of relationships) {
    if (rel.type === 'depends_on' && dependsOn.has(rel.source)) {
      dependsOn.get(rel.source)!.add(rel.target);
    }
  }

  // Topological layering: assign depth based on dependencies
  const depths = new Map<string, number>();
  const visited = new Set<string>();

  function getDepth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visited.has(id)) return 0; // Cycle protection
    visited.add(id);

    const deps = dependsOn.get(id);
    if (!deps || deps.size === 0) {
      depths.set(id, 0);
      return 0;
    }

    let maxDepDep = 0;
    for (const dep of deps) {
      maxDepDep = Math.max(maxDepDep, getDepth(dep) + 1);
    }
    depths.set(id, maxDepDep);
    return maxDepDep;
  }

  for (const c of constraints) {
    getDepth(c.id);
  }

  // Group by depth (column)
  const columns = new Map<number, string[]>();
  for (const c of constraints) {
    const d = depths.get(c.id) || 0;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(c.id);
  }

  // Position nodes
  const maxCol = Math.max(0, ...columns.keys());
  let maxY = 0;

  for (let col = 0; col <= maxCol; col++) {
    const ids = columns.get(col) || [];
    const x = PADDING + col * (NODE_W + GAP_X);

    for (let row = 0; row < ids.length; row++) {
      const y = PADDING + row * (NODE_H + GAP_Y);
      positions.set(ids[row], { x, y, width: NODE_W, height: NODE_H });
      maxY = Math.max(maxY, y + NODE_H);
    }
  }

  const svgWidth = PADDING * 2 + (maxCol + 1) * NODE_W + maxCol * GAP_X;
  const svgHeight = maxY + PADDING;

  return { positions, svgWidth: Math.max(svgWidth, 400), svgHeight: Math.max(svgHeight, 200) };
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
}

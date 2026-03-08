'use client';

import { useState, useMemo } from 'react';
import type { AlignmentHeatmapData, AlignmentCell } from '@/lib/types/discover-analysis';

interface AlignmentHeatmapProps {
  data: AlignmentHeatmapData;
  /** When true, append (n=X) next to actor labels */
  showSampleSize?: boolean;
  /** When provided, render a participation imbalance warning above the heatmap */
  imbalanceWarning?: string | null;
}

/**
 * Alignment Heatmap — SVG grid showing theme×actor alignment
 *
 * Cell colour: red (divergence) → white (neutral) → green (alignment)
 * Cell opacity: proportional to utterance count (confidence)
 */
export function AlignmentHeatmap({ data, showSampleSize, imbalanceWarning }: AlignmentHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    cell: AlignmentCell;
    x: number;
    y: number;
  } | null>(null);

  // Layout constants
  const CELL_W = 90;
  const CELL_H = 40;
  const LABEL_LEFT = 160;
  const LABEL_TOP = 80;
  const GAP = 2;

  const { themes, actors, cells } = data;

  // Build lookup for O(1) cell access
  const cellLookup = useMemo(() => {
    const map = new Map<string, AlignmentCell>();
    for (const c of cells) {
      map.set(`${c.theme}|||${c.actor}`, c);
    }
    return map;
  }, [cells]);

  // Max utterance count for opacity scaling
  const maxUtterance = useMemo(
    () => Math.max(1, ...cells.map((c) => c.utteranceCount)),
    [cells],
  );

  const svgWidth = LABEL_LEFT + actors.length * (CELL_W + GAP) + 20;
  const svgHeight = LABEL_TOP + themes.length * (CELL_H + GAP) + 20;

  function getCellColor(score: number): string {
    if (score > 0.05) {
      // Green: white → green as score → 1
      const g = Math.round(180 + (1 - score) * 75);
      const r = Math.round(255 - score * 130);
      const b = Math.round(255 - score * 130);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (score < -0.05) {
      // Red: white → red as score → -1
      const absScore = Math.abs(score);
      const r = Math.round(180 + (1 - absScore) * 75);
      const g = Math.round(255 - absScore * 130);
      const b = Math.round(255 - absScore * 130);
      return `rgb(${r}, ${g}, ${b})`;
    }
    // Neutral: visible slate-300 so it doesn't disappear against white background
    return 'rgb(203, 213, 225)';
  }

  function getCellOpacity(utteranceCount: number): number {
    // Minimum 0.65 so even single-utterance cells are clearly visible
    return 0.65 + 0.35 * (utteranceCount / maxUtterance);
  }

  if (themes.length === 0 || actors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground/50">
        <p className="text-sm">Insufficient data for alignment analysis</p>
      </div>
    );
  }

  // Compute per-actor sample sizes for n= display
  const actorSampleSizes = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cells) {
      map.set(c.actor, (map.get(c.actor) || 0) + c.utteranceCount);
    }
    return map;
  }, [cells]);

  return (
    <div className="relative overflow-x-auto">
      {imbalanceWarning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          <span className="text-xs text-amber-700">{imbalanceWarning}</span>
        </div>
      )}
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="font-sans"
      >
        {/* Actor labels (top) */}
        {actors.map((actor, col) => (
          <text
            key={`actor-${col}`}
            x={LABEL_LEFT + col * (CELL_W + GAP) + CELL_W / 2}
            y={LABEL_TOP - 12}
            textAnchor="middle"
            className="fill-slate-600"
            fontSize={11}
            fontWeight={500}
          >
            {truncate(actor, 12)}
            {showSampleSize && (
              <tspan className="fill-slate-400" fontSize={9}>
                {' '}(n={actorSampleSizes.get(actor) || 0})
              </tspan>
            )}
          </text>
        ))}

        {/* Theme labels (left) + cells */}
        {themes.map((theme, row) => (
          <g key={`row-${row}`}>
            {/* Theme label */}
            <text
              x={LABEL_LEFT - 10}
              y={LABEL_TOP + row * (CELL_H + GAP) + CELL_H / 2 + 4}
              textAnchor="end"
              className="fill-slate-600"
              fontSize={11}
              fontWeight={500}
            >
              {truncate(theme, 22)}
            </text>

            {/* Cells */}
            {actors.map((actor, col) => {
              const cell = cellLookup.get(`${theme}|||${actor}`);
              const x = LABEL_LEFT + col * (CELL_W + GAP);
              const y = LABEL_TOP + row * (CELL_H + GAP);

              if (!cell) {
                return (
                  <rect
                    key={`cell-${row}-${col}`}
                    x={x} y={y}
                    width={CELL_W} height={CELL_H}
                    rx={4}
                    fill="rgb(248, 250, 252)"
                    stroke="rgb(226, 232, 240)"
                    strokeWidth={0.5}
                    opacity={0.3}
                  />
                );
              }

              return (
                <g key={`cell-${row}-${col}`}>
                  <rect
                    x={x} y={y}
                    width={CELL_W} height={CELL_H}
                    rx={4}
                    fill={getCellColor(cell.alignmentScore)}
                    stroke="rgb(203, 213, 225)"
                    strokeWidth={0.5}
                    opacity={getCellOpacity(cell.utteranceCount)}
                    className="cursor-pointer transition-opacity hover:opacity-100"
                    onMouseEnter={(e) => {
                      const rect = (e.target as SVGRectElement).getBoundingClientRect();
                      setTooltip({ cell, x: rect.x + rect.width / 2, y: rect.y });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                  {/* Utterance count */}
                  <text
                    x={x + CELL_W / 2}
                    y={y + CELL_H / 2 + 4}
                    textAnchor="middle"
                    className="fill-slate-500 pointer-events-none"
                    fontSize={10}
                  >
                    {cell.utteranceCount}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Legend */}
        <g transform={`translate(${LABEL_LEFT}, ${svgHeight - 14})`}>
          <rect x={0} y={0} width={12} height={12} rx={2} fill="rgb(125, 180, 125)" />
          <text x={16} y={10} fontSize={9} className="fill-slate-500">Aligned</text>
          <rect x={70} y={0} width={12} height={12} rx={2} fill="rgb(203, 213, 225)" />
          <text x={86} y={10} fontSize={9} className="fill-slate-500">Neutral</text>
          <rect x={140} y={0} width={12} height={12} rx={2} fill="rgb(180, 125, 125)" />
          <text x={156} y={10} fontSize={9} className="fill-slate-500">Divergent</text>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-medium text-sm text-slate-800 mb-1">
            {tooltip.cell.theme} &times; {tooltip.cell.actor}
          </div>
          <div className="text-xs text-slate-500 space-y-0.5">
            <div>Score: {tooltip.cell.alignmentScore.toFixed(2)}</div>
            <div>
              Sentiment: +{tooltip.cell.sentimentBalance.positive}
              / ={tooltip.cell.sentimentBalance.neutral}
              / -{tooltip.cell.sentimentBalance.negative}
            </div>
            <div>{tooltip.cell.utteranceCount} utterances</div>
          </div>
          {tooltip.cell.sampleQuotes.length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              {tooltip.cell.sampleQuotes.slice(0, 2).map((q, i) => (
                <p key={i} className="text-xs text-slate-400 italic truncate">
                  &ldquo;{q}&rdquo;
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
}

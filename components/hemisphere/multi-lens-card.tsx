'use client';

import type { MultiLensAnalysis } from '@/lib/types/hemisphere-diagnostic';

interface MultiLensCardProps {
  multiLens: MultiLensAnalysis;
}

function scoreColor(score: number): string {
  if (score >= 70) return '#34d399';
  if (score >= 50) return '#60a5fa';
  if (score >= 30) return '#fbbf24';
  return '#f87171';
}

export function MultiLensCard({ multiLens }: MultiLensCardProps) {
  const { lenses } = multiLens;
  const sortedLenses = [...lenses].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-4">
      {/* Header */}
      <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Multi-Lens Analysis</h3>

      {/* Lens scores */}
      <div className="space-y-2.5">
        {sortedLenses.map((lens) => {
          const color = scoreColor(lens.score);
          return (
            <div key={lens.lens} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300 font-medium">{lens.lens}</span>
                <span className="text-[11px] font-bold" style={{ color }}>
                  {lens.score.toFixed(0)}
                </span>
              </div>

              {/* Score bar */}
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, lens.score)}%`, backgroundColor: color }}
                />
              </div>

              {/* Evidence */}
              {lens.evidence.length > 0 && (
                <div className="pl-2 border-l border-white/5">
                  {lens.evidence.map((ev, i) => (
                    <p key={i} className="text-[9px] text-slate-500 truncate">{ev}</p>
                  ))}
                </div>
              )}

              {/* Concern */}
              {lens.concern && (
                <p className="text-[9px] text-amber-400/80 pl-2 border-l border-amber-500/20">
                  {lens.concern}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

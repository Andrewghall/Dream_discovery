'use client';

import type { SentimentIndex } from '@/lib/types/hemisphere-diagnostic';

interface SentimentIndexCardProps {
  sentimentIndex: SentimentIndex;
}

const BALANCE_LABELS: Record<string, { label: string; color: string }> = {
  'expansive': { label: 'Expansive', color: '#34d399' },
  'defensive': { label: 'Defensive', color: '#f87171' },
  'fragmented': { label: 'Fragmented', color: '#fbbf24' },
  'aligned': { label: 'Aligned', color: '#60a5fa' },
  'risk-dominated': { label: 'Risk Dominated', color: '#ef4444' },
  'innovation-dominated': { label: 'Innovation Dominated', color: '#10b981' },
};

export function SentimentIndexCard({ sentimentIndex }: SentimentIndexCardProps) {
  const { domains, overallCreative, overallConstraint, balanceLabel } = sentimentIndex;
  const meta = BALANCE_LABELS[balanceLabel] || { label: balanceLabel, color: '#94a3b8' };

  return (
    <div className="space-y-4">
      {/* Overall Sentiment */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Sentiment Index</h3>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      {/* Overall bars */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 w-16">Creative</span>
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, overallCreative)}%` }}
            />
          </div>
          <span className="text-[10px] text-emerald-400 w-8 text-right">{overallCreative}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 w-16">Constraint</span>
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500 transition-all duration-500"
              style={{ width: `${Math.min(100, overallConstraint)}%` }}
            />
          </div>
          <span className="text-[10px] text-red-400 w-8 text-right">{overallConstraint}%</span>
        </div>
      </div>

      {/* Per-domain breakdown - sorted bottom (constraint) to top (creative) */}
      <div className="space-y-1.5 pt-2 border-t border-white/5">
        <span className="text-[10px] text-slate-500 font-medium">By Domain</span>
        {domains.map((d) => {
          const total = d.creativeDensity + d.constraintDensity;
          const remainder = Math.max(0, 100 - total);
          return (
            <div key={d.domain} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-300 truncate max-w-[120px]">{d.domain}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-500">{d.nodeCount} nodes</span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: d.sentimentLabel === 'innovation-led' ? '#10b98122'
                        : d.sentimentLabel === 'constraint-heavy' ? '#ef444422'
                        : d.sentimentLabel === 'risk-aware' ? '#f59e0b22'
                        : '#3b82f622',
                      color: d.sentimentLabel === 'innovation-led' ? '#34d399'
                        : d.sentimentLabel === 'constraint-heavy' ? '#f87171'
                        : d.sentimentLabel === 'risk-aware' ? '#fbbf24'
                        : '#60a5fa',
                    }}
                  >
                    {d.sentimentLabel.replace(/-/g, ' ')}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500/80"
                  style={{ width: `${d.creativeDensity}%` }}
                />
                <div
                  className="h-full bg-slate-600/40"
                  style={{ width: `${remainder}%` }}
                />
                <div
                  className="h-full bg-red-500/80"
                  style={{ width: `${d.constraintDensity}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

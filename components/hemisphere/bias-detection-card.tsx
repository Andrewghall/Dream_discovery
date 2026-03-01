'use client';

import type { BiasDetection } from '@/lib/types/hemisphere-diagnostic';

interface BiasDetectionCardProps {
  biasDetection: BiasDetection;
}

const BIAS_LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'low': { label: 'Low', color: '#34d399', bg: '#10b98122' },
  'moderate': { label: 'Moderate', color: '#fbbf24', bg: '#f59e0b22' },
  'significant': { label: 'Significant', color: '#f87171', bg: '#ef444422' },
};

export function BiasDetectionCard({ biasDetection }: BiasDetectionCardProps) {
  const {
    contributionBalance,
    giniCoefficient,
    dominantVoice,
    sentimentByLayer,
    languageIntensity,
    overallBiasLevel,
  } = biasDetection;

  const biasConfig = BIAS_LEVEL_CONFIG[overallBiasLevel] || BIAS_LEVEL_CONFIG['low'];
  const maxShare = Math.max(...contributionBalance.map((c) => c.share), 0.01);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Bias Detection</h3>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: biasConfig.bg, color: biasConfig.color }}
          >
            {biasConfig.label}
          </span>
          <span className="text-[10px] text-slate-500">
            Gini: {giniCoefficient.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Dominant voice warning */}
      {dominantVoice && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <p className="text-[10px] text-amber-300">
            <span className="font-semibold">{dominantVoice.name}</span> contributes {(dominantVoice.share * 100).toFixed(0)}% of all data points.
            Other perspectives may be under-represented.
          </p>
        </div>
      )}

      {/* Contribution balance bars */}
      <div className="space-y-1">
        <span className="text-[10px] text-slate-500 font-medium">Contribution Balance</span>
        {contributionBalance.slice(0, 8).map((c) => (
          <div key={c.actor} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-24 truncate" title={c.actor}>
              {c.actor}
            </span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(c.share / maxShare) * 100}%`,
                  backgroundColor: c.share > 0.4 ? '#f87171' : c.share > 0.25 ? '#fbbf24' : '#60a5fa',
                }}
              />
            </div>
            <span className="text-[10px] text-slate-400 w-10 text-right">
              {(c.share * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* Sentiment by Layer */}
      <div className="space-y-1.5 pt-2 border-t border-white/5">
        <span className="text-[10px] text-slate-500 font-medium">Sentiment by Layer</span>
        <div className="grid grid-cols-4 gap-1">
          <div className="text-[9px] text-slate-500">Layer</div>
          <div className="text-[9px] text-emerald-500 text-center">Positive</div>
          <div className="text-[9px] text-amber-500 text-center">Concerned</div>
          <div className="text-[9px] text-red-500 text-center">Critical</div>
          {sentimentByLayer.filter(l => l.layer !== 'H4').map((l) => (
            <div key={l.layer} className="contents">
              <div className="text-[10px] text-slate-300 font-medium">{l.layer}</div>
              <div className="text-[10px] text-emerald-400 text-center">{l.positive.toFixed(0)}%</div>
              <div className="text-[10px] text-amber-400 text-center">{l.concerned.toFixed(0)}%</div>
              <div className="text-[10px] text-red-400 text-center">{l.critical.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Language intensity (top 5) */}
      {languageIntensity.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-white/5">
          <span className="text-[10px] text-slate-500 font-medium">Language Intensity</span>
          {languageIntensity.slice(0, 5).map((li) => (
            <div key={li.actor} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{li.actor}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, li.avgSeverity * 20)}%`,
                      backgroundColor: li.avgSeverity > 3.5 ? '#f87171' : li.avgSeverity > 2.5 ? '#fbbf24' : '#60a5fa',
                    }}
                  />
                </div>
                <span className="text-[9px] text-slate-500 w-6 text-right">{li.avgSeverity.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

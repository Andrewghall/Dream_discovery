'use client';

import type {
  ConfidenceIndexData,
  ConfidenceDistribution,
  NarrativeLayer,
} from '@/lib/types/discover-analysis';

interface ConfidenceIndexProps {
  data: ConfidenceIndexData;
  /** When true, show only the overall bar in a single row (no domain/layer breakdown) */
  compact?: boolean;
}

const LAYER_LABELS: Record<NarrativeLayer, string> = {
  executive: 'Executive',
  operational: 'Operational',
  frontline: 'Frontline',
};

const CONFIDENCE_COLORS = {
  certain: { bg: 'bg-slate-600', fill: '#475569', label: 'Certain' },
  hedging: { bg: 'bg-amber-400', fill: '#fbbf24', label: 'Hedging' },
  uncertain: { bg: 'bg-red-400', fill: '#f87171', label: 'Uncertain' },
};

/**
 * Confidence Index — Stacked bars showing certainty/hedging/uncertainty
 */
export function ConfidenceIndex({ data, compact }: ConfidenceIndexProps) {
  const overallTotal = data.overall.certain + data.overall.hedging + data.overall.uncertain;

  if (overallTotal === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground/50">
        <p className="text-sm">No confidence data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overall */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Overall Confidence
        </h4>
        <StackedBar distribution={data.overall} height={20} showLabels />
      </div>

      {/* By Domain */}
      {!compact && data.byDomain.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            By Domain
          </h4>
          <div className="space-y-2">
            {data.byDomain.map((d) => (
              <div key={d.domain}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-slate-600 font-medium">{d.domain}</span>
                  <span className="text-[10px] text-slate-400">
                    {total(d.distribution)} responses
                  </span>
                </div>
                <StackedBar distribution={d.distribution} height={12} />
                {d.hedgingPhrases.length > 0 && (
                  <div className="mt-1 ml-1">
                    {d.hedgingPhrases.slice(0, 2).map((phrase, i) => (
                      <p key={i} className="text-[10px] text-slate-400 italic truncate">
                        &ldquo;{phrase}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Layer */}
      {!compact && data.byLayer.some((l) => total(l.distribution) > 0) && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            By Narrative Layer
          </h4>
          <div className="space-y-2">
            {data.byLayer.map((l) => {
              const t = total(l.distribution);
              if (t === 0) return null;
              return (
                <div key={l.layer}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-600 font-medium">
                      {LAYER_LABELS[l.layer]}
                    </span>
                    <span className="text-[10px] text-slate-400">{t} responses</span>
                  </div>
                  <StackedBar distribution={l.distribution} height={12} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        {Object.entries(CONFIDENCE_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${val.bg}`} />
            <span className="text-xs text-slate-400">{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stacked Bar ──────────────────────────────────────────────

function StackedBar({
  distribution,
  height = 12,
  showLabels = false,
}: {
  distribution: ConfidenceDistribution;
  height?: number;
  showLabels?: boolean;
}) {
  const t = total(distribution);
  if (t === 0) return <div className="h-3 bg-slate-100 rounded-full" />;

  const certainPct = (distribution.certain / t) * 100;
  const hedgingPct = (distribution.hedging / t) * 100;
  const uncertainPct = (distribution.uncertain / t) * 100;

  return (
    <div>
      <div
        className="flex rounded-full overflow-hidden"
        style={{ height }}
      >
        {certainPct > 0 && (
          <div
            className={CONFIDENCE_COLORS.certain.bg}
            style={{ width: `${certainPct}%` }}
            title={`Certain: ${Math.round(certainPct)}%`}
          />
        )}
        {hedgingPct > 0 && (
          <div
            className={CONFIDENCE_COLORS.hedging.bg}
            style={{ width: `${hedgingPct}%` }}
            title={`Hedging: ${Math.round(hedgingPct)}%`}
          />
        )}
        {uncertainPct > 0 && (
          <div
            className={CONFIDENCE_COLORS.uncertain.bg}
            style={{ width: `${uncertainPct}%` }}
            title={`Uncertain: ${Math.round(uncertainPct)}%`}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-slate-500">
            {Math.round(certainPct)}% certain
          </span>
          <span className="text-[10px] text-slate-500">
            {Math.round(hedgingPct)}% hedging
          </span>
          <span className="text-[10px] text-slate-500">
            {Math.round(uncertainPct)}% uncertain
          </span>
        </div>
      )}
    </div>
  );
}

function total(d: ConfidenceDistribution): number {
  return d.certain + d.hedging + d.uncertain;
}

'use client';

import { useMemo } from 'react';
import type { ConstraintMapData } from '@/lib/types/discover-analysis';

interface ConstraintMapProps {
  data: ConstraintMapData;
  showImpactScore?: boolean;
  lensColors?: Record<string, { bg: string }>;
}

// Domain chip colours
const DOMAIN_COLORS: Record<string, { bg: string; text: string }> = {
  People:       { bg: '#dbeafe', text: '#1d4ed8' },
  Technology:   { bg: '#ffedd5', text: '#c2410c' },
  Customer:     { bg: '#ede9fe', text: '#6d28d9' },
  Organisation: { bg: '#d1fae5', text: '#065f46' },
  Regulation:   { bg: '#fee2e2', text: '#b91c1c' },
  General:      { bg: '#f1f5f9', text: '#475569' },
};

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    bar: '#ef4444',
    badge: { bg: '#fee2e2', text: '#b91c1c' },
    dot: '#ef4444',
  },
  significant: {
    label: 'Significant',
    bar: '#f59e0b',
    badge: { bg: '#fef3c7', text: '#92400e' },
    dot: '#f59e0b',
  },
  moderate: {
    label: 'Moderate',
    bar: '#94a3b8',
    badge: { bg: '#f1f5f9', text: '#475569' },
    dot: '#94a3b8',
  },
} as const;

const SEVERITY_ORDER: Array<'critical' | 'significant' | 'moderate'> = [
  'critical',
  'significant',
  'moderate',
];

/**
 * Constraint Map — Ranked readable list of organisational constraints.
 *
 * Groups constraints by severity, shows full descriptions, weight bars,
 * and blocking/amplifying relationships in plain English.
 */
export function ConstraintMap({ data, showImpactScore, lensColors }: ConstraintMapProps) {
  const { grouped, maxWeight, blockMap, ampMap } = useMemo(() => {
    const constraints = data.constraints ?? [];
    const relationships = data.relationships ?? [];

    const maxWeight = Math.max(1, ...constraints.map((c) => c.weight));

    // Map: constraintId → list of constraint descriptions it blocks
    const blockMap = new Map<string, string[]>();
    // Map: constraintId → list of constraint descriptions it amplifies
    const ampMap = new Map<string, string[]>();

    const descById = new Map(constraints.map((c) => [c.id, c.description]));

    for (const rel of relationships) {
      if (rel.type === 'blocks') {
        const targets = blockMap.get(rel.source) ?? [];
        const targetDesc = descById.get(rel.target);
        if (targetDesc) targets.push(targetDesc);
        blockMap.set(rel.source, targets);
      } else if (rel.type === 'amplifies') {
        const targets = ampMap.get(rel.source) ?? [];
        const targetDesc = descById.get(rel.target);
        if (targetDesc) targets.push(targetDesc);
        ampMap.set(rel.source, targets);
      }
    }

    // Group by severity, sorted by weight desc within each group
    const grouped = SEVERITY_ORDER.map((severity) => ({
      severity,
      constraints: constraints
        .filter((c) => c.severity === severity)
        .sort((a, b) => b.weight - a.weight),
    })).filter((g) => g.constraints.length > 0);

    return { grouped, maxWeight, blockMap, ampMap };
  }, [data]);

  if ((data.constraints ?? []).length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground/50">
        <p className="text-sm">No constraints identified</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ severity, constraints }) => {
        const config = SEVERITY_CONFIG[severity];
        return (
          <div key={severity}>
            {/* Severity section header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.dot }} />
              <span
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: config.dot }}
              >
                {config.label}
              </span>
              <span className="text-[10px] text-slate-400">
                — {constraints.length} constraint{constraints.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {constraints.map((c) => {
                const domainStyle = lensColors?.[c.domain]
                  ? { bg: lensColors[c.domain].bg, text: '#1e293b' }
                  : DOMAIN_COLORS[c.domain] ?? DOMAIN_COLORS.General;

                const weightPct = Math.round((c.weight / maxWeight) * 100);
                const blockedBy = blockMap.get(c.id) ?? [];
                const amplifies = ampMap.get(c.id) ?? [];

                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-100 bg-white p-4 hover:border-slate-200 transition-colors"
                  >
                    {/* Top row: description + domain chip */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-sm font-medium text-slate-800 leading-snug flex-1">
                        {c.description}
                      </p>
                      <span
                        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: domainStyle.bg, color: domainStyle.text }}
                      >
                        {c.domain}
                      </span>
                    </div>

                    {/* Weight bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          {showImpactScore ? 'Impact score' : 'Weight'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {c.weight} &nbsp;·&nbsp; ×{c.frequency} mentions
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${weightPct}%`, backgroundColor: config.bar }}
                        />
                      </div>
                    </div>

                    {/* Relationships in plain English */}
                    {(blockedBy.length > 0 || amplifies.length > 0) && (
                      <div className="border-t border-slate-50 pt-3 space-y-2">
                        {blockedBy.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 text-[10px] font-semibold text-red-500 uppercase tracking-wider mt-0.5">
                              Blocks
                            </span>
                            <div className="flex flex-col gap-1">
                              {blockedBy.map((desc, i) => (
                                <span key={i} className="text-xs text-slate-600">
                                  {desc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {amplifies.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-0.5">
                              Amplifies
                            </span>
                            <div className="flex flex-col gap-1">
                              {amplifies.map((desc, i) => (
                                <span key={i} className="text-xs text-slate-600">
                                  {desc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

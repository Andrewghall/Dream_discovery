'use client';

import type { V2ConstraintCluster } from '@/lib/output/v2-synthesis-agent';

const SEVERITY_STYLES = {
  critical: { badge: 'bg-red-100 text-red-800 border-red-200', stripe: 'bg-red-500', dot: 'bg-red-500', label: 'Critical severity' },
  high:     { badge: 'bg-orange-100 text-orange-800 border-orange-200', stripe: 'bg-orange-500', dot: 'bg-orange-500', label: 'High severity' },
  medium:   { badge: 'bg-amber-100 text-amber-800 border-amber-200', stripe: 'bg-amber-400', dot: 'bg-amber-400', label: 'Medium severity' },
} as const;

const EFFORT_STYLES = {
  high:   'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  low:    'bg-emerald-50 text-emerald-700 border-emerald-200',
} as const;

const EFFORT_LABEL = {
  high:   'High effort to resolve',
  medium: 'Medium effort to resolve',
  low:    'Low effort to resolve',
} as const;

interface ConstraintClusterProps {
  cluster: V2ConstraintCluster;
}

export function ConstraintCluster({ cluster }: ConstraintClusterProps) {
  const sev = SEVERITY_STYLES[cluster.severity] || SEVERITY_STYLES.medium;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Left severity stripe */}
      <div className="flex">
        <div className={`w-1 flex-shrink-0 ${sev.stripe}`} />
        <div className="flex-1 p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-slate-900 leading-snug">{cluster.name}</h4>
            <div className="flex-shrink-0 rounded-full bg-slate-900 text-white text-xs font-bold px-2.5 py-0.5 min-w-[28px] text-center">
              {cluster.count}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${sev.badge}`}>
              {sev.label}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${EFFORT_STYLES[cluster.effort]}`}>
              {EFFORT_LABEL[cluster.effort]}
            </span>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              👤 {cluster.actor}
            </span>
            <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              📍 {cluster.journeyStage}
            </span>
          </div>

          {/* Items — verbatim workshop signals */}
          {cluster.items?.length > 0 && (
            <div className="mb-4 rounded-lg bg-slate-50 border border-slate-100 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Workshop signals
              </div>
              <ul className="space-y-1.5">
                {cluster.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700 italic">
                    <span className="flex-shrink-0 text-slate-300 font-serif text-sm leading-tight">"</span>
                    <span className="leading-relaxed">{item}</span>
                    <span className="flex-shrink-0 text-slate-300 font-serif text-sm leading-tight">"</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Why it blocks — causal explanation */}
          {cluster.whyItBlocks && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-red-500 mb-1.5">
                Why this blocks transformation
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{cluster.whyItBlocks}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import type { V2ConstraintCluster } from '@/lib/output/v2-synthesis-agent';

const SEVERITY_STYLES = {
  critical: { badge: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500', label: 'Critical' },
  high: { badge: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500', label: 'High' },
  medium: { badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-400', label: 'Medium' },
} as const;

const EFFORT_STYLES = {
  high: 'bg-slate-200 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-emerald-100 text-emerald-700',
} as const;

interface ConstraintClusterProps {
  cluster: V2ConstraintCluster;
}

export function ConstraintCluster({ cluster }: ConstraintClusterProps) {
  const sev = SEVERITY_STYLES[cluster.severity] || SEVERITY_STYLES.medium;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sev.dot}`} />
          <h4 className="text-sm font-semibold text-slate-900">{cluster.name}</h4>
        </div>
        {/* Count chip */}
        <div className="flex-shrink-0 rounded-full bg-slate-900 text-white text-xs font-bold px-2.5 py-0.5">
          {cluster.count}
        </div>
      </div>

      {/* Severity + Effort + Anchor badges */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${sev.badge}`}>
          {sev.label} severity
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EFFORT_STYLES[cluster.effort]}`}>
          {cluster.effort} effort
        </span>
        <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          👤 {cluster.actor}
        </span>
        <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          📍 {cluster.journeyStage}
        </span>
      </div>

      {/* Items */}
      {cluster.items?.length > 0 && (
        <ul className="space-y-1.5">
          {cluster.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-slate-300" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

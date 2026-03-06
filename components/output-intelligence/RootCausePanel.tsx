'use client';

import type { RootCauseIntelligence } from '@/lib/output-intelligence/types';

interface Props {
  data: RootCauseIntelligence;
}

function SeverityBadge({ severity }: { severity: 'critical' | 'significant' | 'moderate' }) {
  const styles = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    significant: 'bg-amber-100 text-amber-700 border-amber-200',
    moderate: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wide ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function FrictionBar({ level }: { level: number }) {
  const pct = Math.max(0, Math.min(10, level)) * 10;
  const color =
    pct >= 70 ? 'bg-red-400' : pct >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function RootCausePanel({ data }: Props) {
  return (
    <div className="space-y-8">
      {/* Systemic pattern */}
      {data.systemicPattern && (
        <div className="p-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Systemic Pattern
          </p>
          <p className="text-sm leading-relaxed text-slate-200">{data.systemicPattern}</p>
        </div>
      )}

      {/* Root causes */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Ranked Root Causes ({data.rootCauses?.length ?? 0})
        </h3>
        <div className="space-y-4">
          {(data.rootCauses ?? []).map((cause) => (
            <div
              key={cause.rank}
              className="p-4 rounded-xl border border-slate-200 bg-white flex gap-4"
            >
              {/* Rank number */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                {cause.rank}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-slate-900">{cause.cause}</p>
                  <SeverityBadge severity={cause.severity} />
                </div>

                {cause.category && (
                  <span className="inline-block mb-2 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                    {cause.category}
                  </span>
                )}

                {/* Lenses */}
                {(cause.affectedLenses ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {cause.affectedLenses.map((lens) => (
                      <span
                        key={lens}
                        className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200"
                      >
                        {lens}
                      </span>
                    ))}
                  </div>
                )}

                {/* Journey stages */}
                {(cause.journeyStages ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {cause.journeyStages.map((stage) => (
                      <span
                        key={stage}
                        className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-100"
                      >
                        {stage}
                      </span>
                    ))}
                  </div>
                )}

                {/* Evidence */}
                {(cause.evidence ?? []).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {cause.evidence.slice(0, 3).map((e, i) => (
                      <li key={i} className="text-xs text-slate-500 flex gap-2">
                        <span className="text-slate-300 shrink-0">—</span>
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Friction map */}
      {(data.frictionMap ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Friction Map</h3>
          <div className="space-y-3">
            {data.frictionMap.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-slate-600 truncate" title={f.stage}>
                  {f.stage}
                </span>
                <FrictionBar level={f.frictionLevel} />
                <span className="w-6 shrink-0 text-xs font-semibold text-slate-500">
                  {f.frictionLevel}
                </span>
                {f.primaryCause && (
                  <span className="text-xs text-slate-400 truncate max-w-[200px]" title={f.primaryCause}>
                    {f.primaryCause}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

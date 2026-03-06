'use client';

import { AlertTriangle } from 'lucide-react';
import type { ExecutionRoadmap } from '@/lib/output-intelligence/types';

interface Props {
  data: ExecutionRoadmap;
}

const PHASE_COLORS = [
  {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'bg-blue-600',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    header: 'bg-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500',
  },
  {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    header: 'bg-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
];

export function ExecutionRoadmapPanel({ data }: Props) {
  return (
    <div className="space-y-8">
      {/* Critical path */}
      {data.criticalPath && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
            Critical Path
          </p>
          <p className="text-sm text-amber-800">{data.criticalPath}</p>
        </div>
      )}

      {/* Phase columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(data.phases ?? []).map((phase, i) => {
          const colors = PHASE_COLORS[i] ?? PHASE_COLORS[0];
          return (
            <div
              key={phase.phase}
              className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden flex flex-col`}
            >
              {/* Phase header */}
              <div className={`${colors.header} px-4 py-3 text-white`}>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                  {phase.phase.split(' — ')[0]}
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {phase.phase.split(' — ')[1] ?? phase.phase}
                </p>
                {phase.timeframe && (
                  <p className="text-xs opacity-70 mt-1">{phase.timeframe}</p>
                )}
              </div>

              <div className="p-4 flex-1 space-y-4">
                {/* Initiatives */}
                {(phase.initiatives ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Initiatives
                    </p>
                    <div className="space-y-2">
                      {phase.initiatives.map((init, j) => (
                        <div key={j} className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <div className="flex items-start gap-2">
                            <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${colors.dot}`} />
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{init.title}</p>
                              {init.description && (
                                <p className="text-xs text-slate-500 mt-0.5">{init.description}</p>
                              )}
                              {init.outcome && (
                                <p className="text-xs text-emerald-600 mt-1">
                                  <span className="font-medium">→ </span>{init.outcome}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Capabilities */}
                {(phase.capabilities ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Capabilities Required
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {phase.capabilities.map((cap, j) => (
                        <span
                          key={j}
                          className={`text-xs px-2 py-0.5 rounded-full ${colors.badge} font-medium`}
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {(phase.dependencies ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Dependencies
                    </p>
                    <ul className="space-y-1">
                      {phase.dependencies.map((dep, j) => (
                        <li key={j} className="text-xs text-slate-600 flex gap-2">
                          <span className="text-slate-300 shrink-0">↳</span>
                          {dep}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Constraints */}
                {(phase.constraints ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Constraints
                    </p>
                    <ul className="space-y-1">
                      {phase.constraints.map((c, j) => (
                        <li key={j} className="text-xs text-slate-500 flex gap-2">
                          <span className="text-red-300 shrink-0">!</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Key risks */}
      {(data.keyRisks ?? []).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700">Key Risks</h3>
          </div>
          <div className="space-y-2">
            {data.keyRisks.map((risk, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200"
              >
                <span className="shrink-0 text-amber-500 font-bold text-xs mt-0.5">{i + 1}</span>
                <p className="text-sm text-amber-800">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import type { StrategicImpact } from '@/lib/output-intelligence/types';

interface Props {
  data: StrategicImpact;
}

function BigStat({
  label,
  percentage,
  description,
  color,
}: {
  label: string;
  percentage: number;
  description: string;
  color: string;
}) {
  return (
    <div className={`p-5 rounded-xl border ${color} text-center`}>
      <p className="text-4xl font-bold mb-1">{percentage}%</p>
      <p className="text-sm font-semibold mb-2">{label}</p>
      <p className="text-xs opacity-80">{description}</p>
    </div>
  );
}

export function StrategicImpactPanel({ data }: Props) {
  const confidence = Math.max(0, Math.min(100, data.confidenceScore ?? 0));
  const confColor =
    confidence >= 70
      ? 'text-emerald-600'
      : confidence >= 40
      ? 'text-amber-600'
      : 'text-red-500';

  return (
    <div className="space-y-8">
      {/* 3 big stat numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BigStat
          label="Automation Potential"
          percentage={data.automationPotential?.percentage ?? 0}
          description={data.automationPotential?.description ?? ''}
          color="border-purple-200 bg-purple-50 text-purple-800"
        />
        <BigStat
          label="AI Assisted Work"
          percentage={data.aiAssistedWork?.percentage ?? 0}
          description={data.aiAssistedWork?.description ?? ''}
          color="border-blue-200 bg-blue-50 text-blue-800"
        />
        <BigStat
          label="Human Only Work"
          percentage={data.humanOnlyWork?.percentage ?? 0}
          description={data.humanOnlyWork?.description ?? ''}
          color="border-slate-200 bg-slate-50 text-slate-700"
        />
      </div>

      {/* Confidence score */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">Confidence in estimates:</span>
        <span className={`text-sm font-bold ${confColor}`}>{confidence}/100</span>
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-32">
          <div
            className={`h-full rounded-full ${confidence >= 70 ? 'bg-emerald-500' : confidence >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Business case summary */}
      {data.businessCaseSummary && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Business Case Summary
          </p>
          <p className="text-sm leading-relaxed text-slate-200">{data.businessCaseSummary}</p>
        </div>
      )}

      {/* Efficiency gains */}
      {(data.efficiencyGains ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Efficiency Gains</h3>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Estimated Gain
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Basis
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.efficiencyGains.map((gain, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{gain.metric}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-emerald-600">{gain.estimated}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{gain.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Experience improvements */}
      {(data.experienceImprovements ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Experience Improvements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.experienceImprovements.map((imp, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  {imp.dimension}
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-400">Current</p>
                    <p className="text-sm text-slate-600">{imp.currentState}</p>
                  </div>
                  <div className="text-slate-300 text-center">↓</div>
                  <div>
                    <p className="text-xs text-emerald-500">Future</p>
                    <p className="text-sm text-emerald-700 font-medium">{imp.futureState}</p>
                  </div>
                </div>
                {imp.impact && (
                  <p className="mt-3 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                    {imp.impact}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

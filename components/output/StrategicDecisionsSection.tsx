'use client';

/**
 * Strategic Decisions Section (Section 4)
 *
 * This is the core output the workshop was designed to create.
 * Not observations. Not insight clusters. Decisions.
 *
 * Sub-sections:
 *   A. Declared End-State
 *   B. Strategic Pillars (max 5)
 *   C. 30-60 Day Direction
 */

import { SectionHeader, EmptyState, MiniStat } from './shared';
import { SampleSizeIndicator } from './SampleSizeIndicator';
import type { StrategicDecisionsData } from '@/lib/types/output-dashboard';
import type { HemisphereDiagnostic } from '@/lib/types/hemisphere-diagnostic';

interface StrategicDecisionsSectionProps {
  strategicData: StrategicDecisionsData | null;
  diagAfter: HemisphereDiagnostic | null;
  participantCount: number;
}

const PILLAR_COLORS = [
  'border-blue-500',
  'border-emerald-500',
  'border-purple-500',
  'border-amber-500',
  'border-cyan-500',
];

export function StrategicDecisionsSection({
  strategicData,
  diagAfter,
  participantCount,
}: StrategicDecisionsSectionProps) {
  if (!strategicData) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Strategic Decisions"
          subtitle="The outcomes this workshop was designed to produce"
        />
        <EmptyState message="Strategic decisions data is not yet available. Run synthesis to populate this section." />
      </div>
    );
  }

  const { declaredEndState, pillars, direction } = strategicData;
  const direction30 = direction.filter((d) => d.timeframe === '30-day');
  const direction60 = direction.filter((d) => d.timeframe === '60-day');

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Strategic Decisions"
        subtitle="The outcomes this workshop was designed to produce"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Strategic Pillars" value={pillars.length} color="text-blue-600" />
        <MiniStat label="30-Day Actions" value={direction30.length} color="text-emerald-600" />
        <MiniStat label="60-Day Actions" value={direction60.length} color="text-purple-600" />
        <MiniStat label="Participants" value={participantCount} />
      </div>

      {/* A. Declared End-State */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 text-white">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">
          Declared End-State
        </h3>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">What we are building</div>
            <p className="text-base text-slate-100 leading-relaxed">{declaredEndState.whatWeAreBuilding}</p>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Why it matters</div>
            <p className="text-sm text-slate-200 leading-relaxed">{declaredEndState.whyItMatters}</p>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">What success looks like</div>
            <p className="text-sm text-slate-200 leading-relaxed">{declaredEndState.successLooksLike}</p>
          </div>
        </div>
      </div>

      {/* B. Strategic Pillars (max 5) */}
      {pillars.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Strategic Pillars</h3>
          <div className="space-y-4">
            {pillars.slice(0, 5).map((pillar, i) => (
              <div
                key={i}
                className={`bg-white rounded-xl border-l-4 ${PILLAR_COLORS[i % PILLAR_COLORS.length]} border border-slate-200 p-5`}
              >
                <h4 className="text-sm font-bold text-slate-900 mb-3">{pillar.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Outcome</div>
                    <p className="text-sm text-slate-700">{pillar.outcomeStatement}</p>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Journey Impact</div>
                    <p className="text-sm text-slate-700">{pillar.journeyImpact}</p>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Actor Impact</div>
                    <p className="text-sm text-slate-700">{pillar.actorImpact}</p>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Key Tension to Resolve</div>
                    <p className="text-sm text-slate-700">{pillar.keyTensionToResolve}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C. 30-60 Day Direction */}
      {direction.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">30-60 Day Direction</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Timeframe</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Owner</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Risk Exposure</th>
                </tr>
              </thead>
              <tbody>
                {direction.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.timeframe === '30-day'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {item.timeframe}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{item.action}</td>
                    <td className="py-2.5 px-3 text-slate-600">{item.owner}</td>
                    <td className="py-2.5 px-3 text-slate-600">{item.riskExposure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

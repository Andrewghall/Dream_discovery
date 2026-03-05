'use client';

/**
 * Actor Alignment Matrix (Section 3 sub-component)
 *
 * Table: rows=actors, cols=Sentiment Index, Friction Areas,
 * Desired Future State, Capability Gap.
 * Divergence via color-coded variance indicator, not volume.
 */

import { SampleSizeIndicator } from './SampleSizeIndicator';
import type { ActorAlignmentEntry } from '@/lib/types/output-dashboard';

interface ActorAlignmentMatrixProps {
  actors: ActorAlignmentEntry[];
}

function getSentimentColor(index: number): string {
  if (index > 0.3) return 'text-emerald-600 bg-emerald-50';
  if (index > 0) return 'text-emerald-500 bg-emerald-50/50';
  if (index > -0.3) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function getDivergenceColor(variance: number): string {
  if (variance > 0.5) return 'bg-red-400';
  if (variance > 0.25) return 'bg-amber-400';
  return 'bg-emerald-400';
}

function getDivergenceLabel(variance: number): string {
  if (variance > 0.5) return 'High divergence';
  if (variance > 0.25) return 'Moderate divergence';
  return 'Low divergence';
}

export function ActorAlignmentMatrix({ actors }: ActorAlignmentMatrixProps) {
  if (actors.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-sm">No actor alignment data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actor</th>
            <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sentiment</th>
            <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Divergence</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Friction Areas</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Future State</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Capability Gap</th>
          </tr>
        </thead>
        <tbody>
          {actors.map((actor) => (
            <tr key={actor.actor} className="border-b border-slate-100 hover:bg-slate-50/50">
              {/* Actor name + sample size */}
              <td className="py-3 px-3">
                <div className="font-medium text-slate-800">{actor.actor}</div>
                <SampleSizeIndicator count={actor.sampleSize} />
              </td>

              {/* Sentiment index */}
              <td className="py-3 px-3 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getSentimentColor(actor.sentimentIndex)}`}>
                  {actor.sentimentIndex > 0 ? '+' : ''}{actor.sentimentIndex.toFixed(2)}
                </span>
              </td>

              {/* Divergence variance */}
              <td className="py-3 px-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getDivergenceColor(actor.divergenceVariance)}`}
                      style={{ width: `${Math.min(100, actor.divergenceVariance * 200)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {getDivergenceLabel(actor.divergenceVariance)}
                  </span>
                </div>
              </td>

              {/* Friction areas */}
              <td className="py-3 px-3">
                {actor.frictionAreas.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {actor.frictionAreas.slice(0, 3).map((area) => (
                      <span key={area} className="inline-block px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs">
                        {area}
                      </span>
                    ))}
                    {actor.frictionAreas.length > 3 && (
                      <span className="text-[10px] text-slate-400">+{actor.frictionAreas.length - 3} more</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">None identified</span>
                )}
              </td>

              {/* Desired future state */}
              <td className="py-3 px-3">
                <span className="text-xs text-slate-600">{actor.desiredFutureState}</span>
              </td>

              {/* Capability gap */}
              <td className="py-3 px-3">
                <span className="text-xs text-slate-600">{actor.capabilityGap}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

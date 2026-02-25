'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ActorJourney, JourneyPhase } from '@/lib/cognitive-guidance/pipeline';
import { ALL_JOURNEY_PHASES } from '@/lib/cognitive-guidance/pipeline';

const PHASE_LABELS: Record<JourneyPhase, string> = {
  AWARENESS: 'Aware',
  CONSIDERATION: 'Consider',
  DECISION: 'Decide',
  PURCHASE: 'Purchase',
  ONBOARDING: 'Onboard',
  USAGE: 'Use',
  SUPPORT: 'Support',
  RETENTION_EXIT: 'Retain',
};

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-green-500',
  concerned: 'bg-amber-500',
  critical: 'bg-red-500',
  neutral: 'bg-gray-400',
};

type Props = {
  journeys: Map<string, ActorJourney>;
  expanded: boolean;
  onToggleExpand: () => void;
};

export default function ActorJourneyPanel({
  journeys,
  expanded,
  onToggleExpand,
}: Props) {
  const actors = Array.from(journeys.values());

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Header bar */}
      <button
        onClick={onToggleExpand}
        className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-900">Actor Journeys</h3>
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-gray-200 text-[11px] font-medium text-gray-700">
          {actors.length}
        </span>
        <span className="ml-auto text-gray-500">
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="max-h-[300px] overflow-y-auto px-4 pb-3">
          {actors.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">
              Actors will appear as they are mentioned in conversation
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1.5 pr-3 text-[11px] font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-white">
                      Actor
                    </th>
                    {ALL_JOURNEY_PHASES.map((phase) => (
                      <th
                        key={phase}
                        className="text-center py-1.5 px-1 text-[11px] font-medium text-gray-500 whitespace-nowrap"
                      >
                        {PHASE_LABELS[phase]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actors.map((actor) => (
                    <tr key={actor.actorName} className="border-b border-gray-100 last:border-b-0">
                      {/* Actor name + role */}
                      <td className="py-1.5 pr-3 sticky left-0 bg-white">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-800 whitespace-nowrap">
                            {actor.actorName}
                          </span>
                          <span className="text-[10px] text-gray-400 leading-tight">
                            {actor.role}
                          </span>
                        </div>
                      </td>

                      {/* Phase cells */}
                      {ALL_JOURNEY_PHASES.map((phase) => {
                        const entry = actor.phases[phase];
                        const isGap = !entry;

                        return (
                          <td key={phase} className="py-1.5 px-1">
                            {isGap ? (
                              <div className="flex items-center justify-center h-8 rounded border border-dashed border-gray-300 bg-gray-50">
                                <span className="text-gray-300 text-[10px]">&mdash;</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-0.5 h-8 rounded bg-green-50 border border-green-200">
                                <span className="text-[10px] font-medium text-green-800 tabular-nums">
                                  {(entry.confidence * 100).toFixed(0)}%
                                </span>
                                <span
                                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                                    SENTIMENT_DOT[entry.sentiment] ?? SENTIMENT_DOT.neutral
                                  }`}
                                  title={entry.sentiment}
                                />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

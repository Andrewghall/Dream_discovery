'use client';

/**
 * Constraint Impact Ranking (Section 5 sub-component)
 *
 * Ranked card list showing Constraint Impact Score:
 * DependencyCount x ActorSpread x Severity
 *
 * Structural blockers ranked above operational irritations.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, AlertTriangle } from 'lucide-react';
import { SampleSizeIndicator } from './SampleSizeIndicator';
import type { ConstraintImpactEntry } from '@/lib/types/output-dashboard';

interface ConstraintImpactRankingProps {
  entries: ConstraintImpactEntry[];
}

const SEVERITY_LABELS: Record<number, { label: string; color: string }> = {
  3: { label: 'Critical', color: 'bg-red-50 text-red-700' },
  2: { label: 'Significant', color: 'bg-amber-50 text-amber-700' },
  1: { label: 'Moderate', color: 'bg-slate-50 text-slate-600' },
};

export function ConstraintImpactRanking({ entries }: ConstraintImpactRankingProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-sm">No constraint impact data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const isExpanded = expandedId === entry.id;
        const sevInfo = SEVERITY_LABELS[entry.severity] || SEVERITY_LABELS[1];

        return (
          <div
            key={entry.id}
            className={`border border-slate-200 rounded-lg overflow-hidden transition-all ${
              isExpanded ? 'shadow-sm' : ''
            }`}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
            >
              {/* Rank */}
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center">
                {i + 1}
              </span>

              {/* Structural/Operational badge */}
              {entry.isStructural ? (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                  <Shield className="h-3 w-3" />
                  Structural
                </span>
              ) : (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600">
                  Operational
                </span>
              )}

              {/* Description */}
              <span className="flex-1 text-sm font-medium text-slate-800 truncate">
                {entry.description}
              </span>

              {/* Impact score */}
              <span className="flex-shrink-0 text-xs font-mono text-slate-500">
                Impact: {entry.impactScore}
              </span>

              {/* Expand */}
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
              )}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Dependencies</div>
                    <div className="text-lg font-bold text-slate-900">{entry.dependencyCount}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Actor Spread</div>
                    <div className="text-lg font-bold text-slate-900">{entry.actorSpread}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Severity</div>
                    <div className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${sevInfo.color}`}>
                      {sevInfo.label}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Domain</div>
                    <div className="text-sm font-medium text-slate-700 mt-1">{entry.domain}</div>
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-700 font-medium mb-1">Impact Score Formula</div>
                  <p className="text-xs text-blue-600 font-mono">
                    {Math.max(1, entry.dependencyCount)} (deps) x {entry.actorSpread} (spread) x {entry.severity} (severity) = {entry.impactScore}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

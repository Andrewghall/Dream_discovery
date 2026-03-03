'use client';

/**
 * Constraints & System Friction Section (Section 5)
 *
 * Constraint Impact Score = DependencyCount x ActorSpread x Severity
 * Structural blockers ranked above operational irritations.
 */

import { useState } from 'react';
import { SectionHeader, MiniStat, EmptyState } from './shared';
import { SampleSizeIndicator } from './SampleSizeIndicator';
import { ParticipationImbalanceWarning } from './ParticipationImbalanceWarning';
import { ConstraintImpactRanking } from './ConstraintImpactRanking';
import { ConstraintMap } from '@/components/discover-analysis/constraint-map';
import { BalanceSafeguardCard } from '@/components/hemisphere/balance-safeguard-card';
import type { ConstraintMapData, TensionSurfaceData } from '@/lib/types/discover-analysis';
import type { BalanceSafeguard } from '@/lib/types/hemisphere-diagnostic';
import type { ConstraintImpactEntry, NormalizationResult } from '@/lib/types/output-dashboard';

type SubTab = 'impact' | 'dependencies' | 'safeguards';

interface ConstraintsFrictionSectionProps {
  constraintImpactEntries: ConstraintImpactEntry[];
  constraintData: ConstraintMapData | null;
  tensions: TensionSurfaceData | null;
  balanceSafeguard: BalanceSafeguard | null;
  participationResult: NormalizationResult | null;
}

export function ConstraintsFrictionSection({
  constraintImpactEntries,
  constraintData,
  tensions,
  balanceSafeguard,
  participationResult,
}: ConstraintsFrictionSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('impact');

  const structuralCount = constraintImpactEntries.filter((e) => e.isStructural).length;
  const operationalCount = constraintImpactEntries.filter((e) => !e.isStructural).length;
  const criticalFlags = balanceSafeguard?.flags.filter((f) => f.severity === 'critical').length || 0;

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'impact', label: 'Impact Ranking' },
    { key: 'dependencies', label: 'Dependency Map' },
    { key: 'safeguards', label: 'Balance Safeguards' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Constraints & System Friction"
        subtitle="Structural blockers, dependency chains, and systemic impact"
      />

      {/* Participation imbalance */}
      {participationResult?.imbalanceWarning && (
        <ParticipationImbalanceWarning message={participationResult.imbalanceWarning} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Total Constraints" value={constraintImpactEntries.length} color="text-red-600" />
        <MiniStat label="Structural Blockers" value={structuralCount} color="text-red-600" />
        <MiniStat label="Operational" value={operationalCount} />
        <MiniStat label="Critical Flags" value={criticalFlags} color="text-red-600" />
      </div>

      {/* Sub-tab navigation */}
      <div className="flex border-b border-slate-200 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.key
                ? 'text-red-600 border-red-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {activeTab === 'impact' && (
          constraintImpactEntries.length > 0 ? (
            <ConstraintImpactRanking entries={constraintImpactEntries} />
          ) : (
            <EmptyState message="No constraint impact data available. Run discovery analysis to compute constraint scores." />
          )
        )}

        {activeTab === 'dependencies' && (
          constraintData ? (
            <ConstraintMap data={constraintData} showImpactScore />
          ) : (
            <EmptyState message="No constraint dependency data available." />
          )
        )}

        {activeTab === 'safeguards' && (
          balanceSafeguard ? (
            <div className="space-y-4">
              <BalanceSafeguardCard balanceSafeguard={balanceSafeguard} />
              {/* Balance score */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Overall Balance</div>
                <div className="text-2xl font-bold text-slate-900">{balanceSafeguard.overallBalance}/100</div>
                <p className="text-sm text-slate-600 mt-2">{balanceSafeguard.diagnosis}</p>
              </div>
            </div>
          ) : (
            <EmptyState message="Balance safeguard data requires hemisphere diagnostic computation." />
          )
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * Journey & Actor Intelligence Section (Section 3)
 *
 * Sub-sections:
 *   A. Editable Journey Map (reuses LiveJourneyMap)
 *   B. Actor Alignment Matrix (new)
 *   C. Alignment Heatmap (normalized)
 */

import { useState } from 'react';
import { SectionHeader, MiniStat, EmptyState } from './shared';
import { SampleSizeIndicator } from './SampleSizeIndicator';
import { ParticipationImbalanceWarning } from './ParticipationImbalanceWarning';
import { ActorAlignmentMatrix } from './ActorAlignmentMatrix';
import { AlignmentHeatmap } from '@/components/discover-analysis/alignment-heatmap';
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { AlignmentHeatmapData } from '@/lib/types/discover-analysis';
import type { ActorAlignmentEntry, NormalizationResult } from '@/lib/types/output-dashboard';

type SubTab = 'journey' | 'actors' | 'alignment';

interface JourneyIntelligenceSectionProps {
  journeyData: LiveJourneyData | null;
  normalizedAlignment: AlignmentHeatmapData | null;
  actorAlignmentMatrix: ActorAlignmentEntry[];
  participationResult: NormalizationResult | null;
}

export function JourneyIntelligenceSection({
  journeyData,
  normalizedAlignment,
  actorAlignmentMatrix,
  participationResult,
}: JourneyIntelligenceSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('journey');

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'journey', label: 'Journey Map' },
    { key: 'actors', label: 'Actor Matrix' },
    { key: 'alignment', label: 'Alignment Heatmap' },
  ];

  // Journey stats
  const painPoints = journeyData?.interactions.filter((i) => i.isPainPoint).length || 0;
  const totalInteractions = journeyData?.interactions.length || 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Journey & Actor Intelligence"
        subtitle="Translating collective thought into operational clarity"
      />

      {/* Participation imbalance warning */}
      {participationResult?.imbalanceWarning && (
        <ParticipationImbalanceWarning message={participationResult.imbalanceWarning} />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Actors" value={actorAlignmentMatrix.length || normalizedAlignment?.actors.length || 0} />
        <MiniStat label="Interactions" value={totalInteractions} />
        <MiniStat label="Pain Points" value={painPoints} color="text-red-600" />
        <MiniStat
          label="Avg Divergence"
          value={actorAlignmentMatrix.length > 0
            ? (actorAlignmentMatrix.reduce((s, a) => s + a.divergenceVariance, 0) / actorAlignmentMatrix.length).toFixed(2)
            : '0'
          }
        />
      </div>

      {/* Sub-tab navigation */}
      <div className="flex border-b border-slate-200 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.key
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {activeTab === 'journey' && (
          journeyData ? (
            <div className="overflow-hidden">
              <LiveJourneyMap data={journeyData} expanded={true} mode="output" />
            </div>
          ) : (
            <EmptyState message="No journey data available. The customer journey map is populated during the live workshop session." />
          )
        )}

        {activeTab === 'actors' && (
          actorAlignmentMatrix.length > 0 ? (
            <ActorAlignmentMatrix actors={actorAlignmentMatrix} />
          ) : (
            <EmptyState message="Actor alignment matrix requires alignment data from the discovery analysis." />
          )
        )}

        {activeTab === 'alignment' && (
          normalizedAlignment ? (
            <AlignmentHeatmap
              data={normalizedAlignment}
              showSampleSize
              imbalanceWarning={participationResult?.imbalanceWarning}
            />
          ) : (
            <EmptyState message="Alignment heatmap requires discovery analysis data." />
          )
        )}
      </div>
    </div>
  );
}

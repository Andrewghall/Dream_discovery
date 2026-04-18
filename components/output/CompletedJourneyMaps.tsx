'use client';

/**
 * CompletedJourneyMaps
 *
 * Shows all four DREAM journey map phases as separate lenses on the actor journey.
 *
 * Phase 1 – Discovery (shell)
 *   The as-is / baseline view synthesised from participant discovery interviews.
 *   Captures what the organisation currently does — the raw material before
 *   any reimagining.
 *
 * Phase 2 – Reimagined (pure)
 *   The ideal future state, unconstrained. No technology limits, no budget walls,
 *   no regulatory blockers. This is the aspiration.
 *
 * Phase 3 – Constrained
 *   The Reimagined vision overlaid with real-world constraints identified during
 *   the session. Shows where constraint flags block or modify the ideal path
 *   (left-to-right constraint mapping built into the journey).
 *
 * Phase 4 – Defined Approach
 *   The agreed implementation path — what will actually be built. Hopefully close
 *   to the Reimagined view; differences surface the compromises made.
 */

import { useState, useMemo } from 'react';
import { ActorAlignmentMatrix } from './ActorAlignmentMatrix';
import { AlignmentHeatmap } from '@/components/discover-analysis/alignment-heatmap';
import { ParticipationImbalanceWarning } from './ParticipationImbalanceWarning';
import { EmptyState } from './shared';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { AlignmentHeatmapData } from '@/lib/types/discover-analysis';
import type { ActorAlignmentEntry, NormalizationResult } from '@/lib/types/output-dashboard';
// PHASE_TEMPLATES removed — Output now shows real session data or an empty state with a hint

// ── Types ────────────────────────────────────────────────────────────────────

type PhaseKey = 'discovery' | 'reimagined' | 'constrained' | 'defined';

interface PhaseConfig {
  key: PhaseKey;
  /** Short label shown in the tab */
  label: string;
  /** Dialogue phase tag used in phaseAdded field */
  dreamPhase: string | null;
  /** One-line subtitle shown under the map */
  subtitle: string;
  /** Colour accent class for the active tab indicator */
  accent: string;
  /** Badge text shown top-right of the map area */
  badge: string;
  badgeColor: string;
  /** Description shown when no phase-specific data exists */
  emptyHint: string;
}

const PHASES: PhaseConfig[] = [
  {
    key: 'discovery',
    label: 'Discovery (Shell)',
    dreamPhase: null, // baseline — from synthesis, no phaseAdded filter
    subtitle: 'Current-state baseline synthesised from participant discovery interviews',
    accent: 'border-slate-700 text-slate-900',
    badge: 'As-Is Baseline',
    badgeColor: 'bg-slate-100 text-slate-600',
    emptyHint:
      'Run the hemisphere Synthesise step to auto-generate the discovery journey from session data.',
  },
  {
    key: 'reimagined',
    label: 'Reimagined (Pure)',
    dreamPhase: 'REIMAGINE',
    subtitle: 'Ideal future state — no constraints, no compromises',
    accent: 'border-emerald-600 text-emerald-800',
    badge: 'Future Vision',
    badgeColor: 'bg-emerald-50 text-emerald-700',
    emptyHint:
      'Run the live REIMAGINE phase to capture the unconstrained ideal journey.',
  },
  {
    key: 'constrained',
    label: 'Constrained',
    dreamPhase: 'CONSTRAINTS',
    subtitle: 'Reimagined journey overlaid with real-world constraint flags — the compromised position',
    accent: 'border-amber-600 text-amber-800',
    badge: 'Realistic View',
    badgeColor: 'bg-amber-50 text-amber-700',
    emptyHint:
      'Run the live CONSTRAINTS phase to surface blocking and significant constraints on the journey.',
  },
  {
    key: 'defined',
    label: 'Defined Approach',
    dreamPhase: 'DEFINE_APPROACH',
    subtitle: 'The agreed implementation path — what will actually be delivered',
    accent: 'border-blue-600 text-blue-800',
    badge: 'Delivery Plan',
    badgeColor: 'bg-blue-50 text-blue-700',
    emptyHint:
      'Run the live DEFINE_APPROACH phase to lock in the agreed actor journey.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the journey data to display for a given phase.
 *
 * Priority:
 *   1. Real phase-specific interactions from the session journey data
 *   2. Full journey data (fallback) when phaseAdded is sparse
 *   3. Template data when no real journey data exists at all
 *
 * Also returns:
 *   hasPhaseData  — true if real phase-specific interactions were found
 *   isTemplate    — true if we are showing template data (no real data yet)
 */
function filterForPhase(
  data: LiveJourneyData | null,
  phase: PhaseConfig,
): { filtered: LiveJourneyData; hasPhaseData: boolean; isTemplate: boolean } {
  const EMPTY: LiveJourneyData = {
    stages: data?.stages ?? [],
    actors: data?.actors ?? [],
    interactions: [],
  };

  // No real journey data at all
  if (!data || data.interactions.length === 0) {
    return { filtered: EMPTY, hasPhaseData: false, isTemplate: false };
  }

  if (phase.dreamPhase === null) {
    // Discovery: baseline — interactions with no phaseAdded (captured before phase was tracked)
    // or tagged SYNTHESIS. If none, show all interactions as the baseline view.
    const baseline = data.interactions.filter(
      (i) => !i.phaseAdded || (i.phaseAdded as string) === 'SYNTHESIS',
    );
    if (baseline.length > 0) {
      return { filtered: { ...data, interactions: baseline }, hasPhaseData: true, isTemplate: false };
    }
    // All interactions have phaseAdded (session fully tracked) — show all as discovery baseline
    return { filtered: data, hasPhaseData: true, isTemplate: false };
  }

  let matched = data.interactions.filter((i) => i.phaseAdded === phase.dreamPhase);

  // Constrained: also pull in any interactions with constraint flags from any phase
  if (phase.dreamPhase === 'CONSTRAINTS') {
    const withFlags = data.interactions.filter(
      (i) => i.constraintFlags && i.constraintFlags.length > 0,
    );
    const ids = new Set(matched.map((i) => i.id));
    for (const c of withFlags) {
      if (!ids.has(c.id)) matched = [...matched, c];
    }
  }

  if (matched.length > 0) {
    return { filtered: { ...data, interactions: matched }, hasPhaseData: true, isTemplate: false };
  }

  // No phase-specific interactions yet — show empty state
  return { filtered: EMPTY, hasPhaseData: false, isTemplate: false };
}

// ── Component ────────────────────────────────────────────────────────────────

export interface CompletedJourneyMapsProps {
  journeyData: LiveJourneyData | null | undefined;
  normalizedAlignment: AlignmentHeatmapData | null;
  actorAlignmentMatrix: ActorAlignmentEntry[];
  participationResult: NormalizationResult | null;
}

type InnerTab = 'journey' | 'actors' | 'alignment';

export function CompletedJourneyMaps({
  journeyData,
  normalizedAlignment,
  actorAlignmentMatrix,
  participationResult,
}: CompletedJourneyMapsProps) {
  const [activePhase, setActivePhase] = useState<PhaseKey>('discovery');
  const [innerTab, setInnerTab] = useState<InnerTab>('journey');

  const currentPhase = PHASES.find((p) => p.key === activePhase)!;

  const { filtered, hasPhaseData, isTemplate } = useMemo(() => {
    return filterForPhase(journeyData ?? null, currentPhase);
  }, [journeyData, currentPhase]);

  // Quick stats on filtered data
  const stats = useMemo(() => {
    if (!filtered) return { actors: 0, stages: 0, interactions: 0, painPoints: 0, momentsOfTruth: 0, withConstraints: 0 };
    return {
      actors: filtered.actors.length,
      stages: filtered.stages.length,
      interactions: filtered.interactions.length,
      painPoints: filtered.interactions.filter((i) => i.isPainPoint).length,
      momentsOfTruth: filtered.interactions.filter((i) => i.isMomentOfTruth).length,
      withConstraints: filtered.interactions.filter(
        (i) => i.constraintFlags && i.constraintFlags.length > 0,
      ).length,
    };
  }, [filtered]);

  return (
    <div className="space-y-0">
      {/* === Phase selector tabs === */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden">
        {PHASES.map((phase, idx) => {
          const isActive = activePhase === phase.key;
          return (
            <button
              key={phase.key}
              onClick={() => setActivePhase(phase.key)}
              className={`relative flex-1 px-4 py-3.5 text-center text-sm font-medium transition-all ${
                idx > 0 ? 'border-l border-slate-200' : ''
              } ${
                isActive
                  ? 'bg-white text-slate-900 font-semibold'
                  : 'bg-slate-50 text-slate-500 hover:bg-white hover:text-slate-700'
              }`}
            >
              {/* Phase number */}
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-1.5 font-bold ${
                isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {idx + 1}
              </span>
              {phase.label}
              {/* Active underline */}
              {isActive && (
                <span
                  className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                    phase.key === 'discovery' ? 'bg-slate-700' :
                    phase.key === 'reimagined' ? 'bg-emerald-500' :
                    phase.key === 'constrained' ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* === Phase context bar === */}
      <div className={`flex items-center justify-between px-5 py-2.5 border-b border-slate-100 ${
        activePhase === 'discovery' ? 'bg-slate-50' :
        activePhase === 'reimagined' ? 'bg-emerald-50' :
        activePhase === 'constrained' ? 'bg-amber-50' :
        'bg-blue-50'
      }`}>
        <p className="text-xs text-slate-600 italic">{currentPhase.subtitle}</p>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${currentPhase.badgeColor}`}>
          {currentPhase.badge}
        </span>
      </div>

      {/* === Stats bar === */}
      <div className="flex gap-6 px-5 py-2 bg-white border-b border-slate-100 text-xs text-slate-500 items-center">
        <span><span className="font-semibold text-slate-800">{stats.actors}</span> actors</span>
        <span><span className="font-semibold text-slate-800">{stats.stages}</span> stages</span>
        <span><span className="font-semibold text-slate-800">{stats.interactions}</span> interactions</span>
        {stats.painPoints > 0 && (
          <span className="text-red-600"><span className="font-semibold">{stats.painPoints}</span> pain points</span>
        )}
        {stats.momentsOfTruth > 0 && (
          <span className="text-amber-600"><span className="font-semibold">{stats.momentsOfTruth}</span> moments of truth</span>
        )}
        {stats.withConstraints > 0 && (
          <span className="text-orange-600"><span className="font-semibold">{stats.withConstraints}</span> constraint flags</span>
        )}
        {!hasPhaseData && (
          <span className="ml-auto text-amber-600 italic">
            {currentPhase.emptyHint}
          </span>
        )}
      </div>

      {/* === Inner tabs: Journey / Actors / Alignment === */}
      <div className="flex border-b border-slate-100 bg-white gap-0 px-5">
        {([
          { key: 'journey' as InnerTab, label: 'Journey Map' },
          { key: 'actors' as InnerTab, label: 'Actor Matrix' },
          { key: 'alignment' as InnerTab, label: 'Alignment Heatmap' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setInnerTab(tab.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              innerTab === tab.key
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === Content === */}
      <div className="bg-white rounded-b-xl border-x border-b border-slate-200 overflow-hidden">
        {/* Participation imbalance warning */}
        {participationResult?.imbalanceWarning && innerTab === 'journey' && (
          <div className="px-5 pt-4">
            <ParticipationImbalanceWarning message={participationResult.imbalanceWarning} />
          </div>
        )}

        {innerTab === 'journey' && (
          <div className="p-4">
            {!hasPhaseData && filtered.interactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <span className="text-4xl">🗺️</span>
                <p className="text-sm font-medium text-slate-600">{currentPhase.label} journey not yet captured</p>
                <p className="text-xs text-slate-400 max-w-sm">{currentPhase.emptyHint}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">Journey map display has been removed.</p>
            )}
          </div>
        )}

        {innerTab === 'actors' && (
          <div className="p-6">
            {actorAlignmentMatrix.length > 0 ? (
              <ActorAlignmentMatrix actors={actorAlignmentMatrix} />
            ) : (
              <EmptyState message="Actor alignment matrix requires discovery analysis data from at least one completed session." />
            )}
          </div>
        )}

        {innerTab === 'alignment' && (
          <div className="p-6">
            {normalizedAlignment ? (
              <AlignmentHeatmap
                data={normalizedAlignment}
                showSampleSize
                imbalanceWarning={participationResult?.imbalanceWarning}
              />
            ) : (
              <EmptyState message="Alignment heatmap requires discovery analysis data." />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Journey Completion State — pure helper functions
 *
 * Deterministic % calculation between agent LLM cycles.
 * No LLM calls, no side effects, no network.
 */

import type { JourneyCompletionState, JourneyGap } from './guidance-state';
import type { LiveJourneyData, LiveJourneyInteraction } from '@/lib/cognitive-guidance/pipeline';
import type { JourneyMutationIntentType } from './agents/journey-mutation-types';

// ══════════════════════════════════════════════════════════
// FACTORY
// ══════════════════════════════════════════════════════════

export function createInitialJourneyCompletionState(): JourneyCompletionState {
  return {
    overallCompletionPercent: 0,
    stageCompletionPercents: {},
    actorCompletionPercents: {},
    gaps: [],
    domainActorName: null,
    lastAssessedAtMs: 0,
    assessmentCount: 0,
  };
}

// ══════════════════════════════════════════════════════════
// DETERMINISTIC COMPLETION CALCULATION
// ══════════════════════════════════════════════════════════

/**
 * Per-interaction completeness scoring (0-100):
 *
 * - action + channel (context serves as channel proxy) → 20%
 * - sentiment / EQ → 10%
 * - AI agency (human/assisted/AI-only) → 10%
 * - automation level (aiAgencyNow vs aiAgencyFuture) → 10%
 * - Day 1 vs end state (aiAgencyNow ≠ aiAgencyFuture) → 10%
 * - urgency (businessIntensity > 0) → 10%
 * - proactive vs reactive (customerIntensity vs businessIntensity) → 10%
 * - pain points → 10%
 * - moments of truth → 10%
 */
function scoreInteraction(interaction: LiveJourneyInteraction): number {
  let score = 0;

  // action + channel (context serves as channel/channel proxy)
  if (interaction.action && interaction.action.length > 0) score += 10;
  if (interaction.context && interaction.context.length > 0) score += 10;

  // sentiment / EQ
  if (interaction.sentiment && interaction.sentiment !== 'neutral') score += 10;
  else if (interaction.sentiment === 'neutral') score += 5; // default neutral gets partial credit

  // AI agency specified
  if (interaction.aiAgencyNow && interaction.aiAgencyNow !== 'human') score += 10;
  else if (interaction.aiAgencyNow === 'human') score += 5; // explicit human is still data

  // Automation level — aiAgencyFuture specified
  if (interaction.aiAgencyFuture && interaction.aiAgencyFuture !== 'human') score += 10;
  else if (interaction.aiAgencyFuture === 'human') score += 5;

  // Day 1 vs end state — different now vs future means both are captured
  if (interaction.aiAgencyNow !== interaction.aiAgencyFuture) score += 10;

  // Urgency — businessIntensity > 0 indicates urgency data exists
  if (interaction.businessIntensity > 0) score += 10;

  // Proactive vs reactive — customerIntensity data exists
  if (interaction.customerIntensity > 0) score += 10;

  // Pain points
  if (interaction.isPainPoint) score += 10;

  // Moments of truth
  if (interaction.isMomentOfTruth) score += 10;

  return Math.min(100, score);
}

/**
 * Fast deterministic calculation of journey completion percentages.
 * Called on every pipeline tick (no LLM needed).
 */
export function calculateDeterministicCompletion(
  journey: LiveJourneyData,
): Pick<JourneyCompletionState, 'overallCompletionPercent' | 'stageCompletionPercents' | 'actorCompletionPercents'> {
  if (journey.interactions.length === 0) {
    return {
      overallCompletionPercent: 0,
      stageCompletionPercents: {},
      actorCompletionPercents: {},
    };
  }

  // Per-stage completion: average of interaction scores in that stage
  const stageCompletionPercents: Record<string, number> = {};
  for (const stage of journey.stages) {
    const stageInteractions = journey.interactions.filter(i => i.stage === stage);
    if (stageInteractions.length === 0) {
      stageCompletionPercents[stage] = 0;
    } else {
      const total = stageInteractions.reduce((sum, i) => sum + scoreInteraction(i), 0);
      stageCompletionPercents[stage] = Math.round(total / stageInteractions.length);
    }
  }

  // Per-actor completion: average of stages where actor has interactions
  const actorCompletionPercents: Record<string, number> = {};
  for (const actor of journey.actors) {
    const actorInteractions = journey.interactions.filter(
      i => i.actor.toLowerCase() === actor.name.toLowerCase(),
    );
    if (actorInteractions.length === 0) {
      actorCompletionPercents[actor.name] = 0;
    } else {
      // Group by stage, calculate per-stage average, then overall actor average
      const stageScores: Record<string, number[]> = {};
      for (const i of actorInteractions) {
        if (!stageScores[i.stage]) stageScores[i.stage] = [];
        stageScores[i.stage].push(scoreInteraction(i));
      }
      const stageAvgs = Object.values(stageScores).map(
        scores => scores.reduce((s, v) => s + v, 0) / scores.length,
      );
      actorCompletionPercents[actor.name] = Math.round(
        stageAvgs.reduce((s, v) => s + v, 0) / stageAvgs.length,
      );
    }
  }

  // Overall: weighted average of all stage completions + actor bonus
  const stageValues = Object.values(stageCompletionPercents);
  const stageAvg = stageValues.length > 0
    ? stageValues.reduce((s, v) => s + v, 0) / stageValues.length
    : 0;

  // Bonus for actor coverage: ≥3 actors = full bonus (10%), fewer = proportional
  const actorBonus = Math.min(10, (journey.actors.length / 3) * 10);

  // Bonus for stage coverage: stages with any data get credit
  const coveredStages = stageValues.filter(v => v > 0).length;
  const stageCoverageBonus = journey.stages.length > 0
    ? (coveredStages / journey.stages.length) * 10
    : 0;

  const overallCompletionPercent = Math.min(100, Math.round(
    stageAvg * 0.8 + actorBonus + stageCoverageBonus,
  ));

  return {
    overallCompletionPercent,
    stageCompletionPercents,
    actorCompletionPercents,
  };
}

// ══════════════════════════════════════════════════════════
// MERGE AGENT ASSESSMENT
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// SUGGESTED MUTATION — agent-proposed structural change
// ══════════════════════════════════════════════════════════

/**
 * A structural mutation proposed by the Journey Completion Agent.
 * Confidence determines how the orchestrator handles it:
 *   > 0.75  — high confidence: emitted immediately as journey.mutation
 *   0.5-0.75 — medium confidence: proposed to orchestrator for review
 *   < 0.5   — low confidence: converted to pad prompt (ask a question first)
 */
export type SuggestedMutation = {
  type: JourneyMutationIntentType;
  payload: Record<string, unknown>;
  confidence: number;        // 0-1
  rationale: string;         // why the agent proposes this
  sourceNodeIds: string[];   // belief/utterance IDs that justify it
  gapId?: string;            // which JourneyGap this mutation resolves
};

export type JourneyAssessment = {
  overallCompletionPercent: number;
  stageCompletionPercents: Record<string, number>;
  actorCompletionPercents: Record<string, number>;
  gaps: JourneyGap[];
  domainActorName: string | null;
  suggestedPadPrompts: Array<{
    prompt: string;
    gapId: string;
    stage: string | null;
    label: string;    // "Journey Mapping" or "Journey: {stage}"
  }>;
  suggestedMutations?: SuggestedMutation[];  // structural changes proposed by the agent
};

/**
 * Merge an LLM agent assessment into the current state.
 * Agent gaps replace existing gaps; completion percents take the agent's
 * values (which may be more nuanced than deterministic).
 */
export function mergeAgentAssessment(
  current: JourneyCompletionState,
  assessment: JourneyAssessment,
): JourneyCompletionState {
  return {
    overallCompletionPercent: assessment.overallCompletionPercent,
    stageCompletionPercents: {
      ...current.stageCompletionPercents,
      ...assessment.stageCompletionPercents,
    },
    actorCompletionPercents: {
      ...current.actorCompletionPercents,
      ...assessment.actorCompletionPercents,
    },
    gaps: assessment.gaps,
    domainActorName: assessment.domainActorName ?? current.domainActorName,
    lastAssessedAtMs: Date.now(),
    assessmentCount: current.assessmentCount + 1,
  };
}

// ══════════════════════════════════════════════════════════
// BUILD JOURNEY CONTEXT STRING — for agent prompts
// ══════════════════════════════════════════════════════════

/**
 * Build a concise text summary of journey completion state
 * for injection into agent system/review prompts.
 */
export function buildJourneyContextString(
  state: JourneyCompletionState | null,
): string | null {
  if (!state || state.overallCompletionPercent === 0) return null;

  const lines: string[] = [];
  lines.push(`Overall journey completion: ${state.overallCompletionPercent}%`);

  if (state.domainActorName) {
    lines.push(`Domain actor: ${state.domainActorName}`);
  }

  // Top 3 unfilled gaps
  const unresolvedGaps = state.gaps.filter(g => !g.resolved).sort((a, b) => b.priority - a.priority);
  if (unresolvedGaps.length > 0) {
    lines.push(`Top gaps (${unresolvedGaps.length} total):`);
    for (const gap of unresolvedGaps.slice(0, 3)) {
      const location = [gap.stage, gap.actor].filter(Boolean).join(' / ');
      lines.push(`  - [${gap.gapType}] ${location ? location + ': ' : ''}${gap.description}`);
    }
  }

  // Stage coverage summary
  const stages = Object.entries(state.stageCompletionPercents);
  if (stages.length > 0) {
    const summary = stages.map(([s, p]) => `${s}: ${p}%`).join(', ');
    lines.push(`Stage coverage: ${summary}`);
  }

  return lines.join('\n');
}

// ══════════════════════════════════════════════════════════
// INTERACTION EVIDENCE HELPERS
// ══════════════════════════════════════════════════════════

/**
 * Returns the names of completeness fields that are missing or default
 * for a given interaction. Used by the Journey agent to explain what
 * evidence it still needs before proposing mutations.
 */
export function getInteractionMissingFields(ix: LiveJourneyInteraction): string[] {
  const missing: string[] = [];
  if (!ix.context || ix.context.length === 0) missing.push('channel/context');
  if (ix.sentiment === 'neutral') missing.push('sentiment/EQ');
  if (ix.aiAgencyNow === 'human' && ix.aiAgencyFuture === 'human') missing.push('AI agency (now/future)');
  if (ix.aiAgencyNow === ix.aiAgencyFuture) missing.push('Day1 vs end state');
  if (ix.businessIntensity === 0) missing.push('urgency');
  if (ix.customerIntensity === 0) missing.push('proactive/reactive');
  if (!ix.isPainPoint) missing.push('pain point (unconfirmed)');
  if (!ix.isMomentOfTruth) missing.push('moment of truth (unconfirmed)');
  return missing;
}

// ══════════════════════════════════════════════════════════
// CONFIDENCE GATE — partition mutations by confidence tier
// ══════════════════════════════════════════════════════════

/**
 * Partitions agent-proposed mutations into confidence tiers.
 * Exported so it can be tested independently.
 *
 * Tiers:
 *   highConfidence  (> 0.75) — emit immediately as journey.mutation
 *   mediumConfidence (0.5-0.75) — surface as proposed mutation for orchestrator review
 *   lowConfidence   (< 0.5)  — convert to pad prompt (ask more questions first)
 */
export function partitionMutationsByConfidence(mutations: SuggestedMutation[]): {
  highConfidence: SuggestedMutation[];
  mediumConfidence: SuggestedMutation[];
  lowConfidence: SuggestedMutation[];
} {
  return {
    highConfidence: mutations.filter(m => m.confidence > 0.75),
    mediumConfidence: mutations.filter(m => m.confidence >= 0.5 && m.confidence <= 0.75),
    lowConfidence: mutations.filter(m => m.confidence < 0.5),
  };
}

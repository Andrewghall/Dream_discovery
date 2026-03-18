/**
 * Server-side Journey State Mutator
 *
 * Pure functions for applying journey mutations on the server (orchestrator side).
 *
 * Key design property: interactions use stable, content-based IDs instead of
 * timestamp-based IDs. Same actor/stage/action always produces the same ID,
 * so repeated assessment of the same evidence never creates duplicate rows —
 * even if the client's dedup set is lost between SSE reconnects.
 */

import type { LiveJourneyData, LiveJourneyInteraction, AiAgencyLevel } from '@/lib/cognitive-guidance/pipeline';
import type { JourneyMutationIntent } from './agents/journey-mutation-types';

// ── Stable ID ────────────────────────────────────────────────────────────────

/**
 * Generate a stable, content-based interaction ID.
 * Same actor + stage + action always returns the same string.
 * Used to prevent server-side duplicate interactions across reassessment cycles.
 */
export function makeStableInteractionId(actor: string, stage: string, action: string): string {
  return `srv:${actor}:${stage}:${action}`
    .substring(0, 120)
    .toLowerCase()
    .replace(/[^a-z0-9:]/g, '_');
}

// ── Pure mutation application ─────────────────────────────────────────────────

/**
 * Apply a single JourneyMutationIntent to a LiveJourneyData.
 * Pure function — no side effects, no network, no LLM.
 *
 * For add_interaction: uses makeStableInteractionId so replay is idempotent.
 * For add_stage / add_actor: case-insensitive dedup.
 */
export function applyMutationToServerJourney(
  journey: LiveJourneyData,
  intent: JourneyMutationIntent,
): LiveJourneyData {
  switch (intent.type) {
    case 'add_stage': {
      const { stageName, afterStage } = intent.payload as { stageName: string; afterStage?: string };
      if (journey.stages.some(s => s.toLowerCase() === stageName.toLowerCase())) return journey;
      const stages = [...journey.stages];
      if (afterStage) {
        const idx = stages.findIndex(s => s.toLowerCase() === afterStage.toLowerCase());
        if (idx >= 0) stages.splice(idx + 1, 0, stageName);
        else stages.push(stageName);
      } else {
        stages.push(stageName);
      }
      return { ...journey, stages };
    }

    case 'add_actor': {
      const { name, role } = intent.payload as { name: string; role: string };
      if (journey.actors.some(a => a.name.toLowerCase() === name.toLowerCase())) return journey;
      return {
        ...journey,
        actors: [...journey.actors, { name, role: role || 'auto-created', mentionCount: 0 }],
      };
    }

    case 'rename_actor': {
      const { oldName, newName } = intent.payload as { oldName: string; newName: string };
      return {
        ...journey,
        actors: journey.actors.map(a =>
          a.name.toLowerCase() === oldName.toLowerCase() ? { ...a, name: newName } : a,
        ),
        interactions: journey.interactions.map(ix =>
          ix.actor.toLowerCase() === oldName.toLowerCase() ? { ...ix, actor: newName } : ix,
        ),
      };
    }

    case 'rename_stage': {
      const { oldName, newName } = intent.payload as { oldName: string; newName: string };
      return {
        ...journey,
        stages: journey.stages.map(s => s.toLowerCase() === oldName.toLowerCase() ? newName : s),
        interactions: journey.interactions.map(ix =>
          ix.stage.toLowerCase() === oldName.toLowerCase() ? { ...ix, stage: newName } : ix,
        ),
      };
    }

    case 'add_interaction': {
      const p = intent.payload as {
        actor: string;
        stage: string;
        action: string;
        context?: string;
        sentiment?: string;
        aiAgencyNow?: string;
        aiAgencyFuture?: string;
        isPainPoint?: boolean;
        isMomentOfTruth?: boolean;
        businessIntensity?: number;
        customerIntensity?: number;
      };

      // Stable ID — same content always produces the same ID across reassessment runs
      const stableId = makeStableInteractionId(p.actor, p.stage, p.action);
      if (journey.interactions.some(ix => ix.id === stableId)) return journey; // idempotent

      let result = { ...journey };

      // Auto-create missing actor
      if (!result.actors.some(a => a.name.toLowerCase() === p.actor.toLowerCase())) {
        result = {
          ...result,
          actors: [...result.actors, { name: p.actor, role: 'auto-created', mentionCount: 0 }],
        };
      }

      // Auto-create missing stage
      if (!result.stages.some(s => s.toLowerCase() === p.stage.toLowerCase())) {
        result = { ...result, stages: [...result.stages, p.stage] };
      }

      const ix: LiveJourneyInteraction = {
        id: stableId,
        actor: p.actor,
        stage: p.stage,
        action: p.action,
        context: p.context || '',
        sentiment: (p.sentiment as LiveJourneyInteraction['sentiment']) || 'neutral',
        businessIntensity: p.businessIntensity ?? 0.5,
        customerIntensity: p.customerIntensity ?? 0.5,
        aiAgencyNow: (p.aiAgencyNow as AiAgencyLevel) || 'human',
        aiAgencyFuture: (p.aiAgencyFuture as AiAgencyLevel) || 'human',
        isPainPoint: p.isPainPoint ?? false,
        isMomentOfTruth: p.isMomentOfTruth ?? false,
        sourceNodeIds: intent.sourceNodeIds || [],
        addedBy: 'ai',
        createdAtMs: Date.now(),
      };

      return { ...result, interactions: [...result.interactions, ix] };
    }

    default:
      return journey;
  }
}

// ── Journey merge ─────────────────────────────────────────────────────────────

/**
 * Merge a base journey (from cogState actor graph) with an accumulated server-side
 * journey (from previously applied mutations).
 *
 * Accumulated data takes precedence: its stages come first (preserving agent-defined
 * order), its actors/interactions are preferred. Base fills in anything not yet in
 * the accumulated state.
 */
export function mergeWithAccumulatedJourney(
  base: LiveJourneyData,
  accumulated: LiveJourneyData,
): LiveJourneyData {
  // Stages: accumulated order first, then any base stages not already present
  const accStagesLower = new Set(accumulated.stages.map(s => s.toLowerCase()));
  const mergedStages = [
    ...accumulated.stages,
    ...base.stages.filter(s => !accStagesLower.has(s.toLowerCase())),
  ];

  // Actors: accumulated first, then base actors not already there
  const accActorKeys = new Set(accumulated.actors.map(a => a.name.toLowerCase()));
  const mergedActors = [
    ...accumulated.actors,
    ...base.actors.filter(a => !accActorKeys.has(a.name.toLowerCase())),
  ];

  // Interactions: accumulated first, then base interactions not already there (by ID)
  const accIxIds = new Set(accumulated.interactions.map(ix => ix.id));
  const mergedInteractions = [
    ...accumulated.interactions,
    ...base.interactions.filter(ix => !accIxIds.has(ix.id)),
  ];

  return { stages: mergedStages, actors: mergedActors, interactions: mergedInteractions };
}

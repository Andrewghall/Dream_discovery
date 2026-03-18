/**
 * Server-side Journey State Mutator
 *
 * Pure functions for applying journey mutations on the server (orchestrator side).
 *
 * Key design properties:
 *
 * 1. Interactions use stable, content-based IDs (srv:actor:stage:action).
 *    Same content always produces the same ID, so replay is idempotent across
 *    reassessment cycles — even if the client's dedup set is lost on reconnect.
 *
 * 2. Accumulated stages are CANONICAL once the accumulator is initialised.
 *    `mergeWithAccumulatedJourney` does NOT re-add base stages. This preserves
 *    rename_stage, remove_stage, and merge_stage mutations across reassessments.
 *    Actors and interactions remain additive (cogState discovers new ones over time).
 *
 * 3. All emitted mutation types are supported server-side so the accumulator
 *    stays in sync with every change the agent produces.
 *
 * 4. Interactions are deduplicated by semantic identity (actor+stage+action+context)
 *    as well as by ID, so srv: and cog: copies of the same interaction collapse to one.
 */

import type { LiveJourneyData, LiveJourneyInteraction, AiAgencyLevel } from '@/lib/cognitive-guidance/pipeline';
import {
  REMOVE_STAGE_INTERACTION_LIMIT,
  type JourneyMutationIntent,
  type MergeStagePayload,
  type RemoveStagePayload,
  type UpdateInteractionPayload,
} from './agents/journey-mutation-types';

// ── Stable IDs ───────────────────────────────────────────────────────────────

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

/**
 * Semantic identity key for an interaction: actor + stage + action + context,
 * normalised for case and whitespace. Used to collapse srv: and cog: copies
 * of the same interaction when cogState catches up after bootstrap.
 *
 * Exported for use in tests.
 */
export function makeSemanticKey(ix: {
  actor: string;
  stage: string;
  action: string;
  context?: string;
}): string {
  return [ix.actor, ix.stage, ix.action, ix.context ?? '']
    .map(s => s.toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|');
}

// ── Pure mutation application ─────────────────────────────────────────────────

/**
 * Apply a single JourneyMutationIntent to a LiveJourneyData.
 * Pure function — no side effects, no network, no LLM.
 *
 * Supports all emitted mutation types:
 *   add_stage, rename_stage, merge_stage, remove_stage,
 *   add_actor, rename_actor, add_interaction, update_interaction
 *
 * For add_interaction: stable content-based ID ensures replay is idempotent.
 * For update_interaction: facilitator-owned interactions are never modified.
 */
export function applyMutationToServerJourney(
  journey: LiveJourneyData,
  intent: JourneyMutationIntent,
): LiveJourneyData {
  switch (intent.type) {
    // ── Stage mutations ───────────────────────────────────────────────────────

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

    case 'merge_stage': {
      const { sourceStages, targetName } = intent.payload as MergeStagePayload;
      const srcLower = sourceStages.map(s => s.toLowerCase());
      // All source stages must exist; otherwise the intent is stale — ignore it
      const allExist = srcLower.every(s => journey.stages.some(js => js.toLowerCase() === s));
      if (!allExist) return journey;

      const stages = journey.stages.filter(s => !srcLower.includes(s.toLowerCase()));
      if (!stages.some(s => s.toLowerCase() === targetName.toLowerCase())) stages.push(targetName);

      const rewritten = journey.interactions.map(ix =>
        srcLower.includes(ix.stage.toLowerCase()) ? { ...ix, stage: targetName } : ix,
      );
      // Dedup by semantic key: interactions from different source stages that share
      // actor/action/context become identical after stage rewrite — keep first occurrence.
      const seen = new Set<string>();
      const interactions = rewritten.filter(ix => {
        const key = makeSemanticKey(ix);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { ...journey, stages, interactions };
    }

    case 'remove_stage': {
      const { stageName, force } = intent.payload as RemoveStagePayload;
      if (!journey.stages.some(s => s.toLowerCase() === stageName.toLowerCase())) return journey;

      const affected = journey.interactions.filter(
        ix => ix.stage.toLowerCase() === stageName.toLowerCase(),
      ).length;
      // Mirror client guard: refuse removal of stages with many interactions unless forced
      if (affected > REMOVE_STAGE_INTERACTION_LIMIT && !force) return journey;

      return {
        ...journey,
        stages: journey.stages.filter(s => s.toLowerCase() !== stageName.toLowerCase()),
        interactions: journey.interactions.filter(
          ix => ix.stage.toLowerCase() !== stageName.toLowerCase(),
        ),
      };
    }

    // ── Actor mutations ───────────────────────────────────────────────────────

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

    // ── Interaction mutations ─────────────────────────────────────────────────

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

    case 'update_interaction': {
      const { interactionId, updates } = intent.payload as UpdateInteractionPayload;
      const target = journey.interactions.find(ix => ix.id === interactionId);

      // Guard 1: interaction must exist
      if (!target) return journey;

      // Guard 2: never overwrite facilitator-owned interactions (mirrors client-side rule)
      if (target.addedBy === 'facilitator') return journey;

      return {
        ...journey,
        interactions: journey.interactions.map(ix => {
          if (ix.id !== interactionId) return ix;
          return {
            ...ix,
            ...(updates.aiAgencyNow       !== undefined && { aiAgencyNow: updates.aiAgencyNow }),
            ...(updates.aiAgencyFuture    !== undefined && { aiAgencyFuture: updates.aiAgencyFuture }),
            ...(updates.businessIntensity !== undefined && { businessIntensity: updates.businessIntensity }),
            ...(updates.customerIntensity !== undefined && { customerIntensity: updates.customerIntensity }),
            ...(updates.isPainPoint       !== undefined && { isPainPoint: updates.isPainPoint }),
            ...(updates.isMomentOfTruth   !== undefined && { isMomentOfTruth: updates.isMomentOfTruth }),
            ...(updates.sentiment         !== undefined && { sentiment: updates.sentiment }),
          };
        }),
      };
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
 * Stage handling — CANONICAL (not additive):
 *   Accumulated stages are the authoritative list once the accumulator is seeded.
 *   Base stages are NOT re-added. This preserves rename_stage, remove_stage, and
 *   merge_stage mutations — re-adding base.stages would undo them on the next cycle.
 *
 * Actor handling — additive:
 *   CogState discovers new actors over time; adding them to the view is safe and
 *   does not conflict with the accumulated actor list.
 *
 * Interaction handling — additive + semantic dedup:
 *   CogState produces cog: IDs; the accumulator produces srv: IDs.
 *   Dedup by ID AND by semantic key (actor+stage+action+context) collapses both
 *   copies of the same interaction to one. Accumulated copy is kept (richer fields).
 */
export function mergeWithAccumulatedJourney(
  base: LiveJourneyData,
  accumulated: LiveJourneyData,
): LiveJourneyData {
  // Stages: accumulated IS the canonical list — do NOT append base stages.
  // Re-adding base stages would undo rename/remove/merge mutations on the next assessment.
  const mergedStages = accumulated.stages;

  // Actors: accumulated first, then cogState actors not already there (additive, safe)
  const accActorKeys = new Set(accumulated.actors.map(a => a.name.toLowerCase()));
  const mergedActors = [
    ...accumulated.actors,
    ...base.actors.filter(a => !accActorKeys.has(a.name.toLowerCase())),
  ];

  // Interactions: accumulated first, then base interactions not already there.
  // Three-layer guard on each base interaction:
  //   1. Stage-validity: base.interactions whose stage is no longer in accumulated.stages
  //      (because it was renamed, merged, or removed) must not be added back. Semantic-key
  //      dedup cannot catch these — the stage name differs so keys never collide.
  //   2. ID dedup: skip if the same ID already exists in accumulated.
  //   3. Semantic dedup: skip if same actor+stage+action+context already in accumulated.
  // The accumulated (srv:) copy is preferred — it has aiAgency, intensity, isPainPoint
  // etc. set by the journey agent; the cogState (cog:) copy typically has fewer fields.
  const accValidStagesLower = new Set(accumulated.stages.map(s => s.toLowerCase()));
  const accIxIds = new Set(accumulated.interactions.map(ix => ix.id));
  const accSemanticKeys = new Set(accumulated.interactions.map(ix => makeSemanticKey(ix)));
  const mergedInteractions = [
    ...accumulated.interactions,
    ...base.interactions.filter(
      ix =>
        accValidStagesLower.has(ix.stage.toLowerCase()) && // stage must still exist in canonical list
        !accIxIds.has(ix.id) &&
        !accSemanticKeys.has(makeSemanticKey(ix)),
    ),
  ];

  return { stages: mergedStages, actors: mergedActors, interactions: mergedInteractions };
}

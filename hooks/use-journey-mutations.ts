'use client';

/**
 * useJourneyMutations
 *
 * Reducer-style hook for journey state with explicit mutation intent
 * handling. Single source of truth for the live journey map.
 *
 * Receives:
 * - journey.completion events (full LiveJourneyData merges)
 * - journey.mutation intents (structural changes: add/rename/merge/remove)
 *
 * Provides guardrails (max stages, max actors, cascade renames, etc.)
 * and replay-safe dedup via appliedIntentIds.
 */

import { useCallback, useRef, useState } from 'react';
import type {
  LiveJourneyData,
  LiveJourneyActor,
  LiveJourneyInteraction,
  DialoguePhase,
} from '@/lib/cognitive-guidance/pipeline';
import { mergeBackendJourney } from '@/lib/cognitive-guidance/pipeline';
import type {
  JourneyMutationIntent,
  AddStagePayload,
  RenameStagePayload,
  MergeStagePayload,
  RemoveStagePayload,
  AddActorPayload,
  RenameActorPayload,
  AddInteractionPayload,
  UpdateInteractionPayload,
} from '@/lib/cognition/agents/journey-mutation-types';
import {
  MAX_STAGES,
  MAX_ACTORS,
  REMOVE_STAGE_INTERACTION_LIMIT,
} from '@/lib/cognition/agents/journey-mutation-types';

// -----------------------------------------------------------------------
// Hook options
// -----------------------------------------------------------------------

export interface JourneyMutationsOptions {
  initialJourney: LiveJourneyData;
  dialoguePhase: DialoguePhase;
}

export interface JourneyMutationsReturn {
  journey: LiveJourneyData;
  setJourney: React.Dispatch<React.SetStateAction<LiveJourneyData>>;
  applyMutationIntent: (intent: JourneyMutationIntent) => void;
  mergeBackend: (backendJourney: LiveJourneyData) => void;
  appliedIntentIds: Set<string>;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function stageExists(stages: string[], name: string): boolean {
  return stages.some((s) => s.toLowerCase() === name.toLowerCase());
}

function actorExists(actors: LiveJourneyActor[], name: string): boolean {
  return actors.some((a) => a.name.toLowerCase() === name.toLowerCase());
}

// -----------------------------------------------------------------------
// Mutation appliers (pure functions, return new journey state)
// -----------------------------------------------------------------------

function applyAddStage(
  journey: LiveJourneyData,
  payload: AddStagePayload,
): LiveJourneyData {
  if (journey.stages.length >= MAX_STAGES) {
    console.warn(`[JourneyMutations] Rejected add_stage: max ${MAX_STAGES} stages reached`);
    return journey;
  }
  if (stageExists(journey.stages, payload.stageName)) {
    console.warn(`[JourneyMutations] Rejected add_stage: "${payload.stageName}" already exists`);
    return journey;
  }

  const stages = [...journey.stages];
  if (payload.afterStage) {
    const idx = stages.findIndex(
      (s) => s.toLowerCase() === payload.afterStage!.toLowerCase(),
    );
    if (idx >= 0) {
      stages.splice(idx + 1, 0, payload.stageName);
    } else {
      stages.push(payload.stageName);
    }
  } else {
    stages.push(payload.stageName);
  }

  return { ...journey, stages };
}

function applyRenameStage(
  journey: LiveJourneyData,
  payload: RenameStagePayload,
): LiveJourneyData {
  if (!stageExists(journey.stages, payload.oldName)) {
    console.warn(`[JourneyMutations] Rejected rename_stage: "${payload.oldName}" not found`);
    return journey;
  }

  const stages = journey.stages.map((s) =>
    s.toLowerCase() === payload.oldName.toLowerCase() ? payload.newName : s,
  );

  // Cascade to all interactions referencing this stage
  const interactions = journey.interactions.map((ix) =>
    ix.stage.toLowerCase() === payload.oldName.toLowerCase()
      ? { ...ix, stage: payload.newName }
      : ix,
  );

  return { ...journey, stages, interactions };
}

function applyMergeStage(
  journey: LiveJourneyData,
  payload: MergeStagePayload,
): LiveJourneyData {
  const missing = payload.sourceStages.filter(
    (s) => !stageExists(journey.stages, s),
  );
  if (missing.length > 0) {
    console.warn(`[JourneyMutations] Rejected merge_stage: stages not found: ${missing.join(', ')}`);
    return journey;
  }

  const sourceNamesLower = payload.sourceStages.map((s) => s.toLowerCase());

  // Remove source stages, add target if not present
  const stages = journey.stages.filter(
    (s) => !sourceNamesLower.includes(s.toLowerCase()),
  );
  if (!stageExists(stages, payload.targetName)) {
    stages.push(payload.targetName);
  }

  // Move interactions from source stages to target
  const interactions = journey.interactions.map((ix) =>
    sourceNamesLower.includes(ix.stage.toLowerCase())
      ? { ...ix, stage: payload.targetName }
      : ix,
  );

  return { ...journey, stages, interactions };
}

function applyRemoveStage(
  journey: LiveJourneyData,
  payload: RemoveStagePayload,
): LiveJourneyData {
  if (!stageExists(journey.stages, payload.stageName)) {
    console.warn(`[JourneyMutations] Rejected remove_stage: "${payload.stageName}" not found`);
    return journey;
  }

  const affectedCount = journey.interactions.filter(
    (ix) => ix.stage.toLowerCase() === payload.stageName.toLowerCase(),
  ).length;

  if (affectedCount > REMOVE_STAGE_INTERACTION_LIMIT && !payload.force) {
    console.warn(
      `[JourneyMutations] Rejected remove_stage: "${payload.stageName}" has ${affectedCount} interactions (limit ${REMOVE_STAGE_INTERACTION_LIMIT}). Use force=true to override.`,
    );
    return journey;
  }

  const stages = journey.stages.filter(
    (s) => s.toLowerCase() !== payload.stageName.toLowerCase(),
  );
  const interactions = journey.interactions.filter(
    (ix) => ix.stage.toLowerCase() !== payload.stageName.toLowerCase(),
  );

  return { ...journey, stages, interactions };
}

function applyAddActor(
  journey: LiveJourneyData,
  payload: AddActorPayload,
): LiveJourneyData {
  if (journey.actors.length >= MAX_ACTORS) {
    console.warn(`[JourneyMutations] Rejected add_actor: max ${MAX_ACTORS} actors reached`);
    return journey;
  }
  if (actorExists(journey.actors, payload.name)) {
    console.warn(`[JourneyMutations] Rejected add_actor: "${payload.name}" already exists`);
    return journey;
  }

  const actors: LiveJourneyActor[] = [
    ...journey.actors,
    { name: payload.name, role: payload.role, mentionCount: 0 },
  ];

  return { ...journey, actors };
}

function applyRenameActor(
  journey: LiveJourneyData,
  payload: RenameActorPayload,
): LiveJourneyData {
  if (!actorExists(journey.actors, payload.oldName)) {
    console.warn(`[JourneyMutations] Rejected rename_actor: "${payload.oldName}" not found`);
    return journey;
  }

  const actors = journey.actors.map((a) =>
    a.name.toLowerCase() === payload.oldName.toLowerCase()
      ? { ...a, name: payload.newName }
      : a,
  );

  // Cascade to all interactions referencing this actor
  const interactions = journey.interactions.map((ix) =>
    ix.actor.toLowerCase() === payload.oldName.toLowerCase()
      ? { ...ix, actor: payload.newName }
      : ix,
  );

  return { ...journey, actors, interactions };
}

function applyAddInteraction(
  journey: LiveJourneyData,
  payload: AddInteractionPayload,
): LiveJourneyData {
  let result = { ...journey };

  // Auto-create missing actor
  if (!actorExists(result.actors, payload.actor)) {
    if (result.actors.length < MAX_ACTORS) {
      result = {
        ...result,
        actors: [
          ...result.actors,
          { name: payload.actor, role: 'auto-created', mentionCount: 0 },
        ],
      };
    }
  }

  // Auto-create missing stage
  if (!stageExists(result.stages, payload.stage)) {
    if (result.stages.length < MAX_STAGES) {
      result = {
        ...result,
        stages: [...result.stages, payload.stage],
      };
    }
  }

  const newInteraction: LiveJourneyInteraction = {
    id: `mutation:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    actor: payload.actor,
    stage: payload.stage,
    action: payload.action,
    context: payload.context,
    sentiment: payload.sentiment,
    businessIntensity: 0.5,
    customerIntensity: 0.5,
    aiAgencyNow: 'human',
    aiAgencyFuture: 'human',
    isPainPoint: payload.sentiment === 'critical',
    isMomentOfTruth: false,
    sourceNodeIds: [],
    addedBy: 'ai',
    createdAtMs: Date.now(),
  };

  return {
    ...result,
    interactions: [...result.interactions, newInteraction],
  };
}

function applyUpdateInteraction(
  journey: LiveJourneyData,
  payload: UpdateInteractionPayload,
): LiveJourneyData {
  const target = journey.interactions.find((ix) => ix.id === payload.interactionId);

  // Manual edit protection: never allow AI mutations to overwrite facilitator-added interactions
  if (target?.addedBy === 'facilitator') {
    console.warn(`[JourneyMutations] Rejected update_interaction: "${payload.interactionId}" is facilitator-owned`);
    return journey;
  }

  const exists = !!target;
  if (!exists) {
    console.warn(`[JourneyMutations] Rejected update_interaction: "${payload.interactionId}" not found`);
    return journey;
  }

  const interactions = journey.interactions.map((ix) => {
    if (ix.id !== payload.interactionId) return ix;
    return {
      ...ix,
      ...(payload.updates.aiAgencyNow !== undefined && { aiAgencyNow: payload.updates.aiAgencyNow }),
      ...(payload.updates.aiAgencyFuture !== undefined && { aiAgencyFuture: payload.updates.aiAgencyFuture }),
      ...(payload.updates.businessIntensity !== undefined && { businessIntensity: payload.updates.businessIntensity }),
      ...(payload.updates.customerIntensity !== undefined && { customerIntensity: payload.updates.customerIntensity }),
      ...(payload.updates.isPainPoint !== undefined && { isPainPoint: payload.updates.isPainPoint }),
      ...(payload.updates.isMomentOfTruth !== undefined && { isMomentOfTruth: payload.updates.isMomentOfTruth }),
      ...(payload.updates.sentiment !== undefined && { sentiment: payload.updates.sentiment }),
    };
  });

  return { ...journey, interactions };
}

// -----------------------------------------------------------------------
// Hook implementation
// -----------------------------------------------------------------------

export function useJourneyMutations(
  options: JourneyMutationsOptions,
): JourneyMutationsReturn {
  const { initialJourney } = options;

  const [journey, setJourney] = useState<LiveJourneyData>(initialJourney);
  const appliedIntentIdsRef = useRef<Set<string>>(new Set());

  // ---- Apply a single mutation intent with guardrails + dedup ----

  const applyMutationIntent = useCallback((intent: JourneyMutationIntent) => {
    // Replay dedup
    if (appliedIntentIdsRef.current.has(intent.id)) return;
    appliedIntentIdsRef.current.add(intent.id);

    setJourney((prev) => {
      switch (intent.type) {
        case 'add_stage':
          return applyAddStage(prev, intent.payload as unknown as AddStagePayload);
        case 'rename_stage':
          return applyRenameStage(prev, intent.payload as unknown as RenameStagePayload);
        case 'merge_stage':
          return applyMergeStage(prev, intent.payload as unknown as MergeStagePayload);
        case 'remove_stage':
          return applyRemoveStage(prev, intent.payload as unknown as RemoveStagePayload);
        case 'add_actor':
          return applyAddActor(prev, intent.payload as unknown as AddActorPayload);
        case 'rename_actor':
          return applyRenameActor(prev, intent.payload as unknown as RenameActorPayload);
        case 'add_interaction':
          return applyAddInteraction(prev, intent.payload as unknown as AddInteractionPayload);
        case 'update_interaction':
          return applyUpdateInteraction(prev, intent.payload as unknown as UpdateInteractionPayload);
        default:
          console.warn(`[JourneyMutations] Unknown intent type: ${intent.type}`);
          return prev;
      }
    });
  }, []);

  // ---- Merge full backend journey (from journey.completion events) ----

  const mergeBackend = useCallback((backendJourney: LiveJourneyData) => {
    setJourney((prev) => mergeBackendJourney(prev, backendJourney));
  }, []);

  return {
    journey,
    setJourney,
    applyMutationIntent,
    mergeBackend,
    // eslint-disable-next-line react-hooks/refs
    appliedIntentIds: appliedIntentIdsRef.current,
  };
}

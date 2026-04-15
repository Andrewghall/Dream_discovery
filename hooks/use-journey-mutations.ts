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
 *
 * All incoming intent payloads are treated as UNTRUSTED and validated
 * before use. Malformed payloads are rejected with a warning — they
 * never crash the client.
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
// Guard helpers — never crash on unknown/malformed data
// -----------------------------------------------------------------------

/** Returns the lowercase form of a string, or null if the value is not a non-empty string. */
function safeLower(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.toLowerCase();
}

/** True iff `name` is a non-empty string that matches (case-insensitive) an entry in `stages`. */
function stageExists(stages: string[], name: unknown): boolean {
  const needle = safeLower(name);
  if (needle === null) return false;
  return stages.some((s) => safeLower(s) === needle);
}

/** True iff `name` is a non-empty string matching (case-insensitive) an actor in `actors`. */
function actorExists(actors: LiveJourneyActor[], name: unknown): boolean {
  const needle = safeLower(name);
  if (needle === null) return false;
  return actors.some((a) => safeLower(a?.name) === needle);
}

// -----------------------------------------------------------------------
// Per-intent payload validators
// Returns a typed, cleaned payload or null if the payload is invalid.
// -----------------------------------------------------------------------

function validateAddStage(raw: unknown): AddStagePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.stageName !== 'string' || !p.stageName.trim()) return null;
  return {
    stageName: p.stageName.trim(),
    afterStage: typeof p.afterStage === 'string' && p.afterStage.trim() ? p.afterStage.trim() : undefined,
  };
}

function validateRenameStage(raw: unknown): RenameStagePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.oldName !== 'string' || !p.oldName.trim()) return null;
  if (typeof p.newName !== 'string' || !p.newName.trim()) return null;
  return { oldName: p.oldName.trim(), newName: p.newName.trim() };
}

function validateMergeStage(raw: unknown): MergeStagePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.targetName !== 'string' || !p.targetName.trim()) return null;
  if (!Array.isArray(p.sourceStages) || p.sourceStages.length === 0) return null;
  const sources = (p.sourceStages as unknown[])
    .filter((s) => typeof s === 'string' && (s as string).trim())
    .map((s) => (s as string).trim());
  if (sources.length === 0) return null;
  return { sourceStages: sources, targetName: p.targetName.trim() };
}

function validateRemoveStage(raw: unknown): RemoveStagePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.stageName !== 'string' || !p.stageName.trim()) return null;
  return {
    stageName: p.stageName.trim(),
    force: p.force === true,
  };
}

function validateAddActor(raw: unknown): AddActorPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.name !== 'string' || !p.name.trim()) return null;
  return {
    name: p.name.trim(),
    role: typeof p.role === 'string' && p.role.trim() ? p.role.trim() : 'Participant',
  };
}

function validateRenameActor(raw: unknown): RenameActorPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.oldName !== 'string' || !p.oldName.trim()) return null;
  if (typeof p.newName !== 'string' || !p.newName.trim()) return null;
  return { oldName: p.oldName.trim(), newName: p.newName.trim() };
}

function validateAddInteraction(raw: unknown): AddInteractionPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.actor !== 'string' || !p.actor.trim()) return null;
  if (typeof p.stage !== 'string' || !p.stage.trim()) return null;
  if (typeof p.action !== 'string' || !p.action.trim()) return null;
  const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'concerned', 'critical']);
  const sentiment =
    typeof p.sentiment === 'string' && VALID_SENTIMENTS.has(p.sentiment) ? p.sentiment : 'neutral';
  return {
    actor: p.actor.trim(),
    stage: p.stage.trim(),
    action: p.action.trim(),
    context: typeof p.context === 'string' ? p.context : '',
    sentiment: sentiment as 'positive' | 'neutral' | 'concerned' | 'critical',
  };
}

function validateUpdateInteraction(raw: unknown): UpdateInteractionPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.interactionId !== 'string' || !p.interactionId.trim()) return null;
  if (!p.updates || typeof p.updates !== 'object') return null;
  return { interactionId: p.interactionId.trim(), updates: p.updates as UpdateInteractionPayload['updates'] };
}

// -----------------------------------------------------------------------
// Mutation appliers (pure functions, return new journey state)
// All receive VALIDATED payloads — no further defensive checks needed.
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
    const afterLower = safeLower(payload.afterStage);
    const idx = stages.findIndex((s) => safeLower(s) === afterLower);
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

  const oldLower = safeLower(payload.oldName)!;
  const stages = journey.stages.map((s) =>
    safeLower(s) === oldLower ? payload.newName : s,
  );
  const interactions = journey.interactions.map((ix) =>
    safeLower(ix.stage) === oldLower ? { ...ix, stage: payload.newName } : ix,
  );

  return { ...journey, stages, interactions };
}

function applyMergeStage(
  journey: LiveJourneyData,
  payload: MergeStagePayload,
): LiveJourneyData {
  const missing = payload.sourceStages.filter((s) => !stageExists(journey.stages, s));
  if (missing.length > 0) {
    console.warn(`[JourneyMutations] Rejected merge_stage: stages not found: ${missing.join(', ')}`);
    return journey;
  }

  const sourceNamesLower = new Set(payload.sourceStages.map((s) => safeLower(s)!));

  const stages = journey.stages.filter((s) => !sourceNamesLower.has(safeLower(s)!));
  if (!stageExists(stages, payload.targetName)) {
    stages.push(payload.targetName);
  }

  const interactions = journey.interactions.map((ix) =>
    sourceNamesLower.has(safeLower(ix.stage) ?? '')
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

  const stageNameLower = safeLower(payload.stageName)!;
  const affectedCount = journey.interactions.filter(
    (ix) => safeLower(ix.stage) === stageNameLower,
  ).length;

  if (affectedCount > REMOVE_STAGE_INTERACTION_LIMIT && !payload.force) {
    console.warn(
      `[JourneyMutations] Rejected remove_stage: "${payload.stageName}" has ${affectedCount} interactions (limit ${REMOVE_STAGE_INTERACTION_LIMIT}). Use force=true to override.`,
    );
    return journey;
  }

  const stages = journey.stages.filter((s) => safeLower(s) !== stageNameLower);
  const interactions = journey.interactions.filter(
    (ix) => safeLower(ix.stage) !== stageNameLower,
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

  const oldLower = safeLower(payload.oldName)!;
  const actors = journey.actors.map((a) =>
    safeLower(a?.name) === oldLower ? { ...a, name: payload.newName } : a,
  );
  const interactions = journey.interactions.map((ix) =>
    safeLower(ix.actor) === oldLower ? { ...ix, actor: payload.newName } : ix,
  );

  return { ...journey, actors, interactions };
}

function applyAddInteraction(
  journey: LiveJourneyData,
  payload: AddInteractionPayload,
): LiveJourneyData {
  let result = { ...journey };

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

  if (target?.addedBy === 'facilitator') {
    console.warn(`[JourneyMutations] Rejected update_interaction: "${payload.interactionId}" is facilitator-owned`);
    return journey;
  }

  if (!target) {
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
      // Validate payload before any mutation — reject with warning rather than crash
      switch (intent.type) {
        case 'add_stage': {
          const p = validateAddStage(intent.payload);
          if (!p) {
            console.warn('[JourneyMutations] Rejected add_stage: invalid payload', intent.payload);
            return prev;
          }
          return applyAddStage(prev, p);
        }
        case 'rename_stage': {
          const p = validateRenameStage(intent.payload);
          if (!p) {
            console.warn('[JourneyMutations] Rejected rename_stage: invalid payload', intent.payload);
            return prev;
          }
          return applyRenameStage(prev, p);
        }
        case 'merge_stage': {
          const p = validateMergeStage(intent.payload);
          if (!p) {
            console.warn('[JourneyMutations] Rejected merge_stage: invalid payload', intent.payload);
            return prev;
          }
          return applyMergeStage(prev, p);
        }
        case 'remove_stage': {
          const p = validateRemoveStage(intent.payload);
          if (!p) {
            console.warn('[JourneyMutations] Rejected remove_stage: invalid payload', intent.payload);
            return prev;
          }
          return applyRemoveStage(prev, p);
        }
        case 'add_actor': {
          const p = validateAddActor(intent.payload);
          if (!p) {
            console.warn('[JourneyMutations] Rejected add_actor: invalid payload', intent.payload);
            return prev;
          }
          return applyAddActor(prev, p);
        }
        case 'rename_actor': {
          const p = validateRenameActor(intent.payload);
          if (!p) {
            console.warn('[JourneyMutations] Rejected rename_actor: invalid payload', intent.payload);
            return prev;
          }
          return applyRenameActor(prev, p);
        }
        case 'add_interaction': {
          const p = validateAddInteraction(intent.payload);
          if (!p) {
            console.warn('[JourneyMutations] Rejected add_interaction: invalid payload', intent.payload);
            return prev;
          }
          return applyAddInteraction(prev, p);
        }
        case 'update_interaction': {
          const p = validateUpdateInteraction(intent.payload);
          if (!p) {
            console.warn('[JourneyMutations] Rejected update_interaction: invalid payload', intent.payload);
            return prev;
          }
          return applyUpdateInteraction(prev, p);
        }
        default:
          console.warn(`[JourneyMutations] Unknown intent type: ${intent.type}`, intent.payload);
          return prev;
      }
    });
  }, []);

  // ---- Merge full backend journey (from journey.completion events) ----

  const mergeBackend = useCallback((backendJourney: LiveJourneyData) => {
    // Warn about obviously malformed backend data before merging
    if (backendJourney?.actors?.some((a) => !a?.name)) {
      console.warn('[JourneyMutations] journey.completion: backend actors contain missing names — malformed entries will be skipped');
    }
    if (backendJourney?.stages?.some((s) => !s)) {
      console.warn('[JourneyMutations] journey.completion: backend stages contain empty/null values — malformed entries will be skipped');
    }
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

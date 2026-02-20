/**
 * Cognitive State Serialization
 *
 * Converts between CognitiveState (with Maps/Sets) and plain JSON
 * for snapshot save/restore and potential DB persistence.
 */

import type {
  CognitiveState,
  Belief,
  ActiveContradiction,
  EntityMention,
  TrackedActor,
  ConversationMomentum,
  ReasoningEntry,
  PendingMeaning,
} from './cognitive-state';
import { createCognitiveState } from './cognitive-state';

// ── Serialized Types (plain JSON, no Maps/Sets) ─────────────

type SerializedEntityMention = Omit<EntityMention, 'coOccurringEntities'> & {
  coOccurringEntities: Record<string, number>;
};

type SerializedPendingMeaning = Omit<PendingMeaning, 'contentWords'> & {
  contentWords: string[];
};

export type SerializedCognitiveState = {
  workshopId: string;
  workshopGoal: string;
  currentPhase: CognitiveState['currentPhase'];

  beliefs: Array<[string, Belief]>;
  contradictions: Array<[string, ActiveContradiction]>;
  entities: Array<[string, SerializedEntityMention]>;
  actors: Array<[string, TrackedActor]>;

  momentum: ConversationMomentum;
  pendingMeaning: SerializedPendingMeaning | null;
  reasoningLog: ReasoningEntry[];

  processedUtteranceCount: number;
  lastProcessedAtMs: number | null;
  createdAtMs: number;
  lastActivityMs: number;
};

// ══════════════════════════════════════════════════════════════
// SERIALIZE — CognitiveState → JSON
// ══════════════════════════════════════════════════════════════

export function serializeCognitiveState(state: CognitiveState): SerializedCognitiveState {
  return {
    workshopId: state.workshopId,
    workshopGoal: state.workshopGoal,
    currentPhase: state.currentPhase,

    beliefs: Array.from(state.beliefs.entries()),
    contradictions: Array.from(state.contradictions.entries()),
    entities: Array.from(state.entities.entries()).map(([key, entity]) => [
      key,
      {
        ...entity,
        coOccurringEntities: Object.fromEntries(entity.coOccurringEntities),
      },
    ]),
    actors: Array.from(state.actors.entries()),

    momentum: { ...state.momentum },
    pendingMeaning: state.pendingMeaning
      ? {
          ...state.pendingMeaning,
          contentWords: Array.from(state.pendingMeaning.contentWords),
        }
      : null,
    reasoningLog: [...state.reasoningLog],

    processedUtteranceCount: state.processedUtteranceCount,
    lastProcessedAtMs: state.lastProcessedAtMs,
    createdAtMs: state.createdAtMs,
    lastActivityMs: state.lastActivityMs,
  };
}

// ══════════════════════════════════════════════════════════════
// DESERIALIZE — JSON → CognitiveState
// ══════════════════════════════════════════════════════════════

export function deserializeCognitiveState(data: SerializedCognitiveState): CognitiveState {
  const state = createCognitiveState(data.workshopId, data.workshopGoal, data.currentPhase);

  // Restore beliefs
  for (const [key, belief] of data.beliefs) {
    state.beliefs.set(key, belief);
  }

  // Restore contradictions
  for (const [key, contradiction] of data.contradictions) {
    state.contradictions.set(key, contradiction);
  }

  // Restore entities (convert coOccurringEntities back to Map)
  for (const [key, entity] of data.entities) {
    state.entities.set(key, {
      ...entity,
      coOccurringEntities: new Map(Object.entries(entity.coOccurringEntities)),
    });
  }

  // Restore actors
  for (const [key, actor] of data.actors) {
    state.actors.set(key, actor);
  }

  // Restore momentum
  state.momentum = data.momentum;

  // Restore pending meaning (convert contentWords back to Set)
  state.pendingMeaning = data.pendingMeaning
    ? {
        ...data.pendingMeaning,
        contentWords: new Set(data.pendingMeaning.contentWords),
      }
    : null;

  // Restore reasoning log
  state.reasoningLog = data.reasoningLog;

  // Restore counters
  state.processedUtteranceCount = data.processedUtteranceCount;
  state.lastProcessedAtMs = data.lastProcessedAtMs;
  state.createdAtMs = data.createdAtMs;
  state.lastActivityMs = data.lastActivityMs;

  return state;
}

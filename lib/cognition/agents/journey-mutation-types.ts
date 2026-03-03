/**
 * Journey Mutation Intent Types
 *
 * Shared types used by both the Facilitation Orchestrator (server) and
 * the useJourneyMutations hook (client). These define the explicit
 * mutation intents the orchestrator can emit to structurally modify the
 * live journey map (add/rename/merge/remove stages and actors, add
 * interactions).
 */

// -----------------------------------------------------------------------
// Intent type enum
// -----------------------------------------------------------------------

export type JourneyMutationIntentType =
  | 'add_stage'
  | 'rename_stage'
  | 'merge_stage'
  | 'remove_stage'
  | 'add_actor'
  | 'rename_actor'
  | 'add_interaction'
  | 'update_interaction';

// -----------------------------------------------------------------------
// Base intent shape (emitted via outbox as `journey.mutation` events)
// -----------------------------------------------------------------------

export type JourneyMutationIntent = {
  id: string;
  type: JourneyMutationIntentType;
  payload: Record<string, unknown>;
  sourceNodeIds: string[];
  emittedAtMs: number;
};

// -----------------------------------------------------------------------
// Typed payload interfaces per intent type
// -----------------------------------------------------------------------

export type AddStagePayload = {
  stageName: string;
  afterStage?: string; // Insert after this stage; append if omitted
};

export type RenameStagePayload = {
  oldName: string;
  newName: string;
};

export type MergeStagePayload = {
  sourceStages: string[];
  targetName: string;
};

export type RemoveStagePayload = {
  stageName: string;
  force?: boolean; // Required if >5 interactions reference this stage
};

export type AddActorPayload = {
  name: string;
  role: string;
};

export type RenameActorPayload = {
  oldName: string;
  newName: string;
};

export type AddInteractionPayload = {
  actor: string;
  stage: string;
  action: string;
  context: string;
  sentiment: 'positive' | 'neutral' | 'concerned' | 'critical';
};

export type UpdateInteractionPayload = {
  interactionId: string;
  updates: {
    aiAgencyNow?: 'human' | 'assisted' | 'autonomous';
    aiAgencyFuture?: 'human' | 'assisted' | 'autonomous';
    businessIntensity?: number;
    customerIntensity?: number;
    isPainPoint?: boolean;
    isMomentOfTruth?: boolean;
    sentiment?: 'positive' | 'neutral' | 'concerned' | 'critical';
  };
};

// -----------------------------------------------------------------------
// Guardrail constants
// -----------------------------------------------------------------------

export const MAX_STAGES = 12;
export const MAX_ACTORS = 20;
export const REMOVE_STAGE_INTERACTION_LIMIT = 5;

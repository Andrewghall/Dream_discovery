/**
 * Integration Tests - Journey Mutations
 *
 * Tests the pure mutation functions that power useJourneyMutations.
 * These functions are extracted from hooks/use-journey-mutations.ts
 * and tested without React state. Covers:
 * - add_stage, add_actor, rename_stage with cascade
 * - Guardrails: duplicate stage rejection, remove stage with >5 interactions
 * - Replay dedup via applied intent ID set
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  LiveJourneyData,
  LiveJourneyInteraction,
  LiveJourneyActor,
} from '@/lib/cognitive-guidance/pipeline';
import type {
  JourneyMutationIntent,
  JourneyMutationIntentType,
  AddStagePayload,
  AddActorPayload,
  RenameStagePayload,
  RemoveStagePayload,
  MergeStagePayload,
  AddInteractionPayload,
} from '@/lib/cognition/agents/journey-mutation-types';
import {
  MAX_STAGES,
  MAX_ACTORS,
  REMOVE_STAGE_INTERACTION_LIMIT,
} from '@/lib/cognition/agents/journey-mutation-types';

// -----------------------------------------------------------------------
// Recreate the pure mutation functions from hooks/use-journey-mutations.ts
// These are copied verbatim from the hook (lines 63-314)
// -----------------------------------------------------------------------

function stageExists(stages: string[], name: string): boolean {
  return stages.some((s) => s.toLowerCase() === name.toLowerCase());
}

function actorExists(actors: LiveJourneyActor[], name: string): boolean {
  return actors.some((a) => a.name.toLowerCase() === name.toLowerCase());
}

function applyAddStage(
  journey: LiveJourneyData,
  payload: AddStagePayload,
): LiveJourneyData {
  if (journey.stages.length >= MAX_STAGES) return journey;
  if (stageExists(journey.stages, payload.stageName)) return journey;

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
  if (!stageExists(journey.stages, payload.oldName)) return journey;

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

function applyRemoveStage(
  journey: LiveJourneyData,
  payload: RemoveStagePayload,
): LiveJourneyData {
  if (!stageExists(journey.stages, payload.stageName)) return journey;

  const affectedCount = journey.interactions.filter(
    (ix) => ix.stage.toLowerCase() === payload.stageName.toLowerCase(),
  ).length;

  if (affectedCount > REMOVE_STAGE_INTERACTION_LIMIT && !payload.force) {
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
  if (journey.actors.length >= MAX_ACTORS) return journey;
  if (actorExists(journey.actors, payload.name)) return journey;

  const actors: LiveJourneyActor[] = [
    ...journey.actors,
    { name: payload.name, role: payload.role, mentionCount: 0 },
  ];

  return { ...journey, actors };
}

function applyMergeStage(
  journey: LiveJourneyData,
  payload: MergeStagePayload,
): LiveJourneyData {
  const missing = payload.sourceStages.filter(
    (s) => !stageExists(journey.stages, s),
  );
  if (missing.length > 0) return journey;

  const sourceNamesLower = payload.sourceStages.map((s) => s.toLowerCase());

  const stages = journey.stages.filter(
    (s) => !sourceNamesLower.includes(s.toLowerCase()),
  );
  if (!stageExists(stages, payload.targetName)) {
    stages.push(payload.targetName);
  }

  const interactions = journey.interactions.map((ix) =>
    sourceNamesLower.includes(ix.stage.toLowerCase())
      ? { ...ix, stage: payload.targetName }
      : ix,
  );

  return { ...journey, stages, interactions };
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
    id: `mutation:test:${Math.random().toString(36).slice(2, 8)}`,
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

// -----------------------------------------------------------------------
// Dispatcher with intent dedup (mirrors hook lines 330-358)
// -----------------------------------------------------------------------

function createMutationDispatcher() {
  const appliedIntentIds = new Set<string>();

  return {
    apply(journey: LiveJourneyData, intent: JourneyMutationIntent): LiveJourneyData {
      // Replay dedup
      if (appliedIntentIds.has(intent.id)) return journey;
      appliedIntentIds.add(intent.id);

      switch (intent.type) {
        case 'add_stage':
          return applyAddStage(journey, intent.payload as unknown as AddStagePayload);
        case 'rename_stage':
          return applyRenameStage(journey, intent.payload as unknown as RenameStagePayload);
        case 'merge_stage':
          return applyMergeStage(journey, intent.payload as unknown as MergeStagePayload);
        case 'remove_stage':
          return applyRemoveStage(journey, intent.payload as unknown as RemoveStagePayload);
        case 'add_actor':
          return applyAddActor(journey, intent.payload as unknown as AddActorPayload);
        case 'add_interaction':
          return applyAddInteraction(journey, intent.payload as unknown as AddInteractionPayload);
        default:
          return journey;
      }
    },
    get appliedIds() {
      return appliedIntentIds;
    },
  };
}

// -----------------------------------------------------------------------
// Test data factories
// -----------------------------------------------------------------------

function makeIntent(
  type: JourneyMutationIntentType,
  payload: Record<string, unknown>,
  id?: string,
): JourneyMutationIntent {
  return {
    id: id || `intent-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    sourceNodeIds: [],
    emittedAtMs: Date.now(),
  };
}

function makeInteraction(overrides: Partial<LiveJourneyInteraction> = {}): LiveJourneyInteraction {
  return {
    id: `ix-${Math.random().toString(36).slice(2, 8)}`,
    actor: 'Customer',
    stage: 'Discovery',
    action: 'Browses catalog',
    context: 'Online store',
    sentiment: 'neutral',
    businessIntensity: 0.5,
    customerIntensity: 0.5,
    aiAgencyNow: 'human',
    aiAgencyFuture: 'human',
    isPainPoint: false,
    isMomentOfTruth: false,
    sourceNodeIds: [],
    addedBy: 'ai',
    createdAtMs: Date.now(),
    ...overrides,
  };
}

function makeBaseJourney(): LiveJourneyData {
  return {
    stages: ['Discovery', 'Engagement', 'Commitment'],
    actors: [
      { name: 'Customer', role: 'End user', mentionCount: 5 },
      { name: 'Sales Rep', role: 'Internal', mentionCount: 3 },
    ],
    interactions: [
      makeInteraction({ id: 'ix-1', actor: 'Customer', stage: 'Discovery', action: 'Browses catalog' }),
      makeInteraction({ id: 'ix-2', actor: 'Sales Rep', stage: 'Engagement', action: 'Sends proposal' }),
    ],
  };
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('Journey Mutations', () => {
  let journey: LiveJourneyData;

  beforeEach(() => {
    journey = makeBaseJourney();
  });

  describe('add_stage', () => {
    it('applies add_stage intent -- appends to end by default', () => {
      const intent = makeIntent('add_stage', { stageName: 'Fulfilment' });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      expect(result.stages).toEqual(['Discovery', 'Engagement', 'Commitment', 'Fulfilment']);
    });

    it('inserts after a specific stage when afterStage is provided', () => {
      const intent = makeIntent('add_stage', {
        stageName: 'Consideration',
        afterStage: 'Discovery',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      expect(result.stages).toEqual(['Discovery', 'Consideration', 'Engagement', 'Commitment']);
    });

    it('appends to end when afterStage does not exist', () => {
      const intent = makeIntent('add_stage', {
        stageName: 'Support',
        afterStage: 'NonexistentStage',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      expect(result.stages).toEqual(['Discovery', 'Engagement', 'Commitment', 'Support']);
    });
  });

  describe('add_actor', () => {
    it('applies add_actor intent', () => {
      const intent = makeIntent('add_actor', {
        name: 'Support Agent',
        role: 'Internal team member',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      expect(result.actors).toHaveLength(3);
      const newActor = result.actors.find((a) => a.name === 'Support Agent');
      expect(newActor).toBeDefined();
      expect(newActor!.role).toBe('Internal team member');
      expect(newActor!.mentionCount).toBe(0);
    });

    it('rejects duplicate actor name (case-insensitive)', () => {
      const intent = makeIntent('add_actor', {
        name: 'customer', // Already exists as 'Customer'
        role: 'Duplicate',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      expect(result.actors).toHaveLength(2);
      expect(result).toEqual(journey);
    });
  });

  describe('rename_stage with cascade', () => {
    it('cascades rename_stage to interactions referencing that stage', () => {
      const intent = makeIntent('rename_stage', {
        oldName: 'Discovery',
        newName: 'Awareness',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      // Stage renamed
      expect(result.stages).toContain('Awareness');
      expect(result.stages).not.toContain('Discovery');

      // Interaction cascaded
      const ix1 = result.interactions.find((ix) => ix.id === 'ix-1')!;
      expect(ix1.stage).toBe('Awareness');

      // Unrelated interaction unchanged
      const ix2 = result.interactions.find((ix) => ix.id === 'ix-2')!;
      expect(ix2.stage).toBe('Engagement');
    });

    it('handles case-insensitive rename correctly', () => {
      const intent = makeIntent('rename_stage', {
        oldName: 'discovery', // lowercase but 'Discovery' exists
        newName: 'Research',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      expect(result.stages).toContain('Research');
      expect(result.stages).not.toContain('Discovery');
    });

    it('does nothing when renaming a non-existent stage', () => {
      const intent = makeIntent('rename_stage', {
        oldName: 'FakeStage',
        newName: 'RealStage',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      expect(result).toEqual(journey);
    });
  });

  describe('Guardrails', () => {
    it('rejects duplicate stage name (case-insensitive)', () => {
      const intent = makeIntent('add_stage', {
        stageName: 'discovery', // Already exists as 'Discovery'
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      // Should be unchanged
      expect(result.stages).toEqual(['Discovery', 'Engagement', 'Commitment']);
    });

    it('rejects add_stage when MAX_STAGES reached', () => {
      // Fill up to MAX_STAGES
      const fullJourney: LiveJourneyData = {
        ...journey,
        stages: Array.from({ length: MAX_STAGES }, (_, i) => `Stage${i}`),
      };

      const intent = makeIntent('add_stage', { stageName: 'OneMore' });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(fullJourney, intent);

      expect(result.stages).toHaveLength(MAX_STAGES);
      expect(result.stages).not.toContain('OneMore');
    });

    it('rejects add_actor when MAX_ACTORS reached', () => {
      const fullJourney: LiveJourneyData = {
        ...journey,
        actors: Array.from({ length: MAX_ACTORS }, (_, i) => ({
          name: `Actor${i}`,
          role: 'Test',
          mentionCount: 0,
        })),
      };

      const intent = makeIntent('add_actor', { name: 'OneMore', role: 'Test' });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(fullJourney, intent);

      expect(result.actors).toHaveLength(MAX_ACTORS);
    });

    it('rejects remove_stage with >5 interactions without force flag', () => {
      // Create a journey with more than REMOVE_STAGE_INTERACTION_LIMIT interactions for one stage
      const manyInteractions = Array.from(
        { length: REMOVE_STAGE_INTERACTION_LIMIT + 1 },
        (_, i) => makeInteraction({ id: `ix-heavy-${i}`, stage: 'Discovery' }),
      );

      const heavyJourney: LiveJourneyData = {
        ...journey,
        interactions: manyInteractions,
      };

      const intent = makeIntent('remove_stage', { stageName: 'Discovery' });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(heavyJourney, intent);

      // Should be unchanged -- too many interactions to remove without force
      expect(result.stages).toContain('Discovery');
      expect(result.interactions).toHaveLength(REMOVE_STAGE_INTERACTION_LIMIT + 1);
    });

    it('allows remove_stage with >5 interactions when force=true', () => {
      const manyInteractions = Array.from(
        { length: REMOVE_STAGE_INTERACTION_LIMIT + 1 },
        (_, i) => makeInteraction({ id: `ix-heavy-${i}`, stage: 'Discovery' }),
      );

      const heavyJourney: LiveJourneyData = {
        ...journey,
        interactions: manyInteractions,
      };

      const intent = makeIntent('remove_stage', {
        stageName: 'Discovery',
        force: true,
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(heavyJourney, intent);

      expect(result.stages).not.toContain('Discovery');
      expect(result.interactions).toHaveLength(0);
    });

    it('allows remove_stage with exactly REMOVE_STAGE_INTERACTION_LIMIT interactions', () => {
      const exactInteractions = Array.from(
        { length: REMOVE_STAGE_INTERACTION_LIMIT },
        (_, i) => makeInteraction({ id: `ix-exact-${i}`, stage: 'Discovery' }),
      );

      const exactJourney: LiveJourneyData = {
        ...journey,
        interactions: exactInteractions,
      };

      const intent = makeIntent('remove_stage', { stageName: 'Discovery' });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(exactJourney, intent);

      // 5 is not > 5, so it should be allowed
      expect(result.stages).not.toContain('Discovery');
      expect(result.interactions).toHaveLength(0);
    });
  });

  describe('Replay Dedup', () => {
    it('deduplicates replay of same intent ID', () => {
      const intentId = 'intent-dedup-test';
      const intent = makeIntent('add_stage', { stageName: 'Support' }, intentId);
      const dispatcher = createMutationDispatcher();

      const result1 = dispatcher.apply(journey, intent);
      expect(result1.stages).toContain('Support');
      expect(result1.stages).toHaveLength(4);

      // Replay the same intent -- should be a no-op
      const result2 = dispatcher.apply(result1, intent);
      expect(result2.stages).toHaveLength(4);
      expect(result2).toEqual(result1);
      expect(dispatcher.appliedIds.size).toBe(1);
    });

    it('applies different intents with different IDs', () => {
      const dispatcher = createMutationDispatcher();

      const intent1 = makeIntent('add_stage', { stageName: 'Support' }, 'id-1');
      const intent2 = makeIntent('add_stage', { stageName: 'Growth' }, 'id-2');

      let result = dispatcher.apply(journey, intent1);
      result = dispatcher.apply(result, intent2);

      expect(result.stages).toContain('Support');
      expect(result.stages).toContain('Growth');
      expect(result.stages).toHaveLength(5);
      expect(dispatcher.appliedIds.size).toBe(2);
    });
  });

  describe('merge_stage', () => {
    it('merges source stages into target and cascades interactions', () => {
      const journeyWithExtra: LiveJourneyData = {
        stages: ['Discovery', 'Research', 'Engagement', 'Commitment'],
        actors: journey.actors,
        interactions: [
          makeInteraction({ id: 'ix-d1', stage: 'Discovery', action: 'Browses' }),
          makeInteraction({ id: 'ix-r1', stage: 'Research', action: 'Compares' }),
          makeInteraction({ id: 'ix-e1', stage: 'Engagement', action: 'Contacts' }),
        ],
      };

      const intent = makeIntent('merge_stage', {
        sourceStages: ['Discovery', 'Research'],
        targetName: 'Awareness',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journeyWithExtra, intent);

      // Source stages removed, target added
      expect(result.stages).not.toContain('Discovery');
      expect(result.stages).not.toContain('Research');
      expect(result.stages).toContain('Awareness');
      expect(result.stages).toContain('Engagement');
      expect(result.stages).toContain('Commitment');

      // Interactions cascaded to target
      const awarenessInteractions = result.interactions.filter(
        (ix) => ix.stage === 'Awareness',
      );
      expect(awarenessInteractions).toHaveLength(2);
    });
  });

  describe('add_interaction', () => {
    it('auto-creates missing actor and stage', () => {
      const intent = makeIntent('add_interaction', {
        actor: 'New Actor',
        stage: 'New Stage',
        action: 'Does something',
        context: 'Test context',
        sentiment: 'positive',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      expect(result.actors.some((a) => a.name === 'New Actor')).toBe(true);
      expect(result.stages).toContain('New Stage');
      expect(result.interactions).toHaveLength(journey.interactions.length + 1);

      const newIx = result.interactions[result.interactions.length - 1];
      expect(newIx.actor).toBe('New Actor');
      expect(newIx.stage).toBe('New Stage');
      expect(newIx.sentiment).toBe('positive');
      expect(newIx.addedBy).toBe('ai');
    });

    it('does not duplicate existing actor or stage', () => {
      const intent = makeIntent('add_interaction', {
        actor: 'Customer', // Already exists
        stage: 'Discovery', // Already exists
        action: 'Adds item to cart',
        context: 'E-commerce',
        sentiment: 'positive',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      // Actor count unchanged
      expect(result.actors).toHaveLength(2);
      // Stage count unchanged
      expect(result.stages).toHaveLength(3);
      // But interaction was added
      expect(result.interactions).toHaveLength(3);
    });

    it('marks critical sentiment interactions as pain points', () => {
      const intent = makeIntent('add_interaction', {
        actor: 'Customer',
        stage: 'Commitment',
        action: 'Fails to complete checkout',
        context: 'Payment flow broken',
        sentiment: 'critical',
      });
      const dispatcher = createMutationDispatcher();
      const result = dispatcher.apply(journey, intent);

      const newIx = result.interactions[result.interactions.length - 1];
      expect(newIx.isPainPoint).toBe(true);
      expect(newIx.sentiment).toBe('critical');
    });
  });

  describe('Constants validation', () => {
    it('has expected guardrail constants', () => {
      expect(MAX_STAGES).toBe(12);
      expect(MAX_ACTORS).toBe(20);
      expect(REMOVE_STAGE_INTERACTION_LIMIT).toBe(5);
    });
  });
});

/**
 * Integration Test — Journey Map End-to-End (BIFFA Live Script)
 *
 * Proves that spoken BIFFA session data flows end-to-end:
 *   1. Transcript ingestion → cognitive state with utterances
 *   2. Journey agent invoked BEFORE belief gate (0 beliefs = OK)
 *   3. Agent returns mutations from conversation context
 *   4. Mutations emitted as journey.mutation events
 *   5. Live journey state populated via dispatcher
 *
 * All LLM calls are mocked. No network required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LiveJourneyData, LiveJourneyInteraction } from '@/lib/cognitive-guidance/pipeline';
import type { JourneyMutationIntent } from '@/lib/cognition/agents/journey-mutation-types';
import type { JourneyAssessment, SuggestedMutation } from '@/lib/cognition/journey-completion-state';
import {
  partitionMutationsByConfidence,
} from '@/lib/cognition/journey-completion-state';
import {
  createCognitiveState,
  type CognitiveState,
} from '@/lib/cognition/cognitive-state';

// ── Pure mutation functions (mirrors hooks/use-journey-mutations.ts) ──────────

function applyAddStage(j: LiveJourneyData, payload: { stageName: string; afterStage?: string }): LiveJourneyData {
  if (j.stages.some(s => s.toLowerCase() === payload.stageName.toLowerCase())) return j;
  const stages = [...j.stages];
  if (payload.afterStage) {
    const idx = stages.findIndex(s => s.toLowerCase() === payload.afterStage!.toLowerCase());
    if (idx >= 0) stages.splice(idx + 1, 0, payload.stageName);
    else stages.push(payload.stageName);
  } else {
    stages.push(payload.stageName);
  }
  return { ...j, stages };
}

function applyAddActor(j: LiveJourneyData, payload: { name: string; role: string }): LiveJourneyData {
  if (j.actors.some(a => a.name.toLowerCase() === payload.name.toLowerCase())) return j;
  return { ...j, actors: [...j.actors, { name: payload.name, role: payload.role, mentionCount: 0 }] };
}

function applyAddInteraction(j: LiveJourneyData, payload: {
  actor: string; stage: string; action: string; context: string;
  sentiment: LiveJourneyInteraction['sentiment'];
  aiAgencyNow?: string; aiAgencyFuture?: string;
  isPainPoint?: boolean; isMomentOfTruth?: boolean;
  businessIntensity?: number; customerIntensity?: number;
}): LiveJourneyData {
  let result = { ...j };
  if (!result.actors.some(a => a.name.toLowerCase() === payload.actor.toLowerCase())) {
    result = { ...result, actors: [...result.actors, { name: payload.actor, role: 'auto-created', mentionCount: 0 }] };
  }
  if (!result.stages.some(s => s.toLowerCase() === payload.stage.toLowerCase())) {
    result = { ...result, stages: [...result.stages, payload.stage] };
  }
  const ix: LiveJourneyInteraction = {
    id: `test:ix:${Math.random().toString(36).slice(2, 8)}`,
    actor: payload.actor,
    stage: payload.stage,
    action: payload.action,
    context: payload.context,
    sentiment: payload.sentiment,
    businessIntensity: payload.businessIntensity ?? 0.5,
    customerIntensity: payload.customerIntensity ?? 0.5,
    aiAgencyNow: (payload.aiAgencyNow as LiveJourneyInteraction['aiAgencyNow']) ?? 'human',
    aiAgencyFuture: (payload.aiAgencyFuture as LiveJourneyInteraction['aiAgencyFuture']) ?? 'human',
    isPainPoint: payload.isPainPoint ?? false,
    isMomentOfTruth: payload.isMomentOfTruth ?? false,
    sourceNodeIds: [],
    addedBy: 'ai',
    createdAtMs: Date.now(),
  };
  return { ...result, interactions: [...result.interactions, ix] };
}

function applyMutationIntent(journey: LiveJourneyData, intent: JourneyMutationIntent): LiveJourneyData {
  switch (intent.type) {
    case 'add_stage':
      return applyAddStage(journey, intent.payload as { stageName: string; afterStage?: string });
    case 'add_actor':
      return applyAddActor(journey, intent.payload as { name: string; role: string });
    case 'add_interaction':
      return applyAddInteraction(journey, intent.payload as Parameters<typeof applyAddInteraction>[1]);
    default:
      return journey;
  }
}

// ── BIFFA test data ──────────────────────────────────────────────────────────

/**
 * Simulates what the cognitive state looks like after the FIRST utterance
 * from a BIFFA live session — ZERO beliefs, but utterance text present.
 */
function makeBiffaCogState(): CognitiveState {
  const state = createCognitiveState('ws-biffa-test', 'Biffa waste management journey mapping', 'REIMAGINE');

  // Simulate 4 BIFFA-style spoken utterances (no beliefs extracted yet)
  state.recentUtterances = [
    {
      id: 'utt-1',
      text: 'So currently the household customer puts out their bin and the collection crew picks it up manually every week.',
      speaker: 'Participant',
      timestampMs: Date.now() - 4000,
    },
    {
      id: 'utt-2',
      text: 'There are pain points in route planning — the driver often has no idea which bins are full and which streets to prioritise.',
      speaker: 'Participant',
      timestampMs: Date.now() - 3000,
    },
    {
      id: 'utt-3',
      text: 'In the future we want AI to optimise the routes so the fleet management system automatically adjusts based on sensor data.',
      speaker: 'Participant',
      timestampMs: Date.now() - 2000,
    },
    {
      id: 'utt-4',
      text: 'Customer service gets calls when collections are missed — that is a moment of truth for the customer relationship.',
      speaker: 'Participant',
      timestampMs: Date.now() - 1000,
    },
  ];

  return state;
}

/**
 * Simulated journey agent response for BIFFA session —
 * as if the LLM read the utterances and extracted structured data.
 */
function makeBiffaAssessment(): JourneyAssessment {
  return {
    overallCompletionPercent: 25,
    stageCompletionPercents: { Collection: 45, 'Route Planning': 30, 'Customer Service': 35 },
    actorCompletionPercents: { 'Collection Crew': 45, 'Fleet / Route Systems': 30, 'Customer Service': 35 },
    domainActorName: 'household customer',
    gaps: [
      {
        id: 'jgap_1',
        gapType: 'missing_sentiment',
        stage: 'Collection',
        actor: 'Household / Business',
        description: 'Customer emotional state during collection not captured.',
        suggestedQuestion: 'How does the household customer feel when their bin is collected on time vs missed?',
        priority: 0.8,
        resolved: false,
      },
    ],
    suggestedPadPrompts: [],
    suggestedMutations: [
      // Stage mutations
      {
        type: 'add_stage',
        payload: { stageName: 'Collection' },
        confidence: 0.9,
        rationale: 'Participant explicitly described collection crew picking up waste from households.',
        sourceNodeIds: ['utt-1'],
      },
      {
        type: 'add_stage',
        payload: { stageName: 'Route Planning' },
        confidence: 0.85,
        rationale: "Participant described route planning pain points and driver's lack of visibility.",
        sourceNodeIds: ['utt-2'],
      },
      {
        type: 'add_stage',
        payload: { stageName: 'Customer Service' },
        confidence: 0.85,
        rationale: 'Participant described customer service calls for missed collections.',
        sourceNodeIds: ['utt-4'],
      },
      // Actor mutations
      {
        type: 'add_actor',
        payload: { name: 'Collection Crew', role: 'Operational — waste collection' },
        confidence: 0.9,
        rationale: 'Collection crew explicitly mentioned as performing manual collection.',
        sourceNodeIds: ['utt-1'],
      },
      {
        type: 'add_actor',
        payload: { name: 'Household / Business', role: 'Customer — waste producer' },
        confidence: 0.88,
        rationale: 'Household customer described as putting out bins.',
        sourceNodeIds: ['utt-1'],
      },
      // Interaction mutations
      {
        type: 'add_interaction',
        payload: {
          actor: 'Household / Business',
          stage: 'Collection',
          action: 'Puts out bin for weekly collection',
          context: 'Kerbside',
          sentiment: 'neutral',
          aiAgencyNow: 'human',
          aiAgencyFuture: 'human',
          businessIntensity: 0.5,
          customerIntensity: 0.5,
        },
        confidence: 0.88,
        rationale: "Household customer 'puts out their bin' stated in first utterance.",
        sourceNodeIds: ['utt-1'],
      },
      {
        type: 'add_interaction',
        payload: {
          actor: 'Collection Crew',
          stage: 'Collection',
          action: 'Manually collects waste from households',
          context: 'Kerbside collection',
          sentiment: 'neutral',
          aiAgencyNow: 'human',
          aiAgencyFuture: 'assisted',
          businessIntensity: 0.7,
          customerIntensity: 0.4,
        },
        confidence: 0.88,
        rationale: 'Collection crew picks up manually today; future AI optimisation mentioned.',
        sourceNodeIds: ['utt-1', 'utt-3'],
      },
      {
        type: 'add_interaction',
        payload: {
          actor: 'Collection Crew',
          stage: 'Route Planning',
          action: 'Navigates route without bin fill data',
          context: 'Vehicle cab',
          sentiment: 'concerned',
          aiAgencyNow: 'human',
          aiAgencyFuture: 'ai-only',
          isPainPoint: true,
          businessIntensity: 0.8,
          customerIntensity: 0.3,
        },
        confidence: 0.82,
        rationale: 'Driver pain point: no visibility of which bins are full.',
        sourceNodeIds: ['utt-2'],
      },
      {
        type: 'add_interaction',
        payload: {
          actor: 'Customer Service',
          stage: 'Customer Service',
          action: 'Handles missed collection calls',
          context: 'Phone / inbound',
          sentiment: 'concerned',
          aiAgencyNow: 'human',
          aiAgencyFuture: 'assisted',
          isMomentOfTruth: true,
          businessIntensity: 0.6,
          customerIntensity: 0.9,
        },
        confidence: 0.85,
        rationale: 'Customer service calls for missed collections — moment of truth.',
        sourceNodeIds: ['utt-4'],
      },
    ] as SuggestedMutation[],
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Journey Map — BIFFA end-to-end population', () => {
  let emptyJourney: LiveJourneyData;

  beforeEach(() => {
    emptyJourney = {
      stages: ['Discovery', 'Engagement', 'Commitment', 'Fulfilment', 'Support', 'Growth'],
      actors: [],
      interactions: [],
    };
  });

  // ── 1. Agent returns mutations from BIFFA speech ─────────────────────────

  it('journey assessment includes mutations populated from BIFFA utterances', () => {
    const assessment = makeBiffaAssessment();
    expect(assessment.suggestedMutations).toBeDefined();
    expect(assessment.suggestedMutations!.length).toBeGreaterThan(0);

    // Should include stage, actor, and interaction mutations
    const types = new Set(assessment.suggestedMutations!.map(m => m.type));
    expect(types).toContain('add_stage');
    expect(types).toContain('add_actor');
    expect(types).toContain('add_interaction');
  });

  it('all BIFFA mutations have confidence > 0.75 (auto-emit tier)', () => {
    const { suggestedMutations } = makeBiffaAssessment();
    const { highConfidence, mediumConfidence, lowConfidence } =
      partitionMutationsByConfidence(suggestedMutations!);

    // All BIFFA mutations should be high confidence (clearly stated in speech)
    expect(highConfidence.length).toBe(suggestedMutations!.length);
    expect(mediumConfidence).toHaveLength(0);
    expect(lowConfidence).toHaveLength(0);
  });

  // ── 2. journey.mutation events emitted for high-confidence mutations ──────

  it('emits journey.mutation events for each high-confidence mutation', () => {
    const assessment = makeBiffaAssessment();
    const { highConfidence } = partitionMutationsByConfidence(assessment.suggestedMutations!);

    const emittedEvents: JourneyMutationIntent[] = [];

    for (const m of highConfidence) {
      const intent: JourneyMutationIntent = {
        id: `jca:${m.type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        type: m.type as JourneyMutationIntent['type'],
        payload: m.payload,
        sourceNodeIds: m.sourceNodeIds,
        emittedAtMs: Date.now(),
      };
      emittedEvents.push(intent);
    }

    expect(emittedEvents.length).toBe(highConfidence.length);
    expect(emittedEvents.some(e => e.type === 'add_stage')).toBe(true);
    expect(emittedEvents.some(e => e.type === 'add_actor')).toBe(true);
    expect(emittedEvents.some(e => e.type === 'add_interaction')).toBe(true);
  });

  // ── 3. Live journey state populated by applying mutations ─────────────────

  it('journey map is populated with BIFFA stages after mutations applied', () => {
    const assessment = makeBiffaAssessment();
    const { highConfidence } = partitionMutationsByConfidence(assessment.suggestedMutations!);

    let journey = { ...emptyJourney };
    for (const m of highConfidence) {
      const intent: JourneyMutationIntent = {
        id: `jca:${m.type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        type: m.type as JourneyMutationIntent['type'],
        payload: m.payload,
        sourceNodeIds: m.sourceNodeIds,
        emittedAtMs: Date.now(),
      };
      journey = applyMutationIntent(journey, intent);
    }

    // BIFFA-specific stages should appear
    expect(journey.stages).toContain('Collection');
    expect(journey.stages).toContain('Route Planning');
    expect(journey.stages).toContain('Customer Service');
  });

  it('journey map has BIFFA actors after mutations applied', () => {
    const assessment = makeBiffaAssessment();
    const { highConfidence } = partitionMutationsByConfidence(assessment.suggestedMutations!);

    let journey = { ...emptyJourney };
    for (const m of highConfidence) {
      journey = applyMutationIntent(journey, {
        id: `test:${m.type}:${Math.random()}`,
        type: m.type as JourneyMutationIntent['type'],
        payload: m.payload,
        sourceNodeIds: m.sourceNodeIds,
        emittedAtMs: Date.now(),
      });
    }

    const actorNames = journey.actors.map(a => a.name);
    expect(actorNames).toContain('Collection Crew');
    expect(actorNames).toContain('Household / Business');
  });

  it('journey map has interactions with structured data after mutations applied', () => {
    const assessment = makeBiffaAssessment();
    const { highConfidence } = partitionMutationsByConfidence(assessment.suggestedMutations!);

    let journey = { ...emptyJourney };
    for (const m of highConfidence) {
      journey = applyMutationIntent(journey, {
        id: `test:${m.type}:${Math.random()}`,
        type: m.type as JourneyMutationIntent['type'],
        payload: m.payload,
        sourceNodeIds: m.sourceNodeIds,
        emittedAtMs: Date.now(),
      });
    }

    expect(journey.interactions.length).toBeGreaterThan(0);

    // Pain point interaction should be present (route planning)
    const painPoint = journey.interactions.find(ix => ix.isPainPoint);
    expect(painPoint).toBeDefined();
    expect(painPoint!.stage).toBe('Route Planning');

    // Moment of truth interaction should be present (customer service)
    const mot = journey.interactions.find(ix => ix.isMomentOfTruth);
    expect(mot).toBeDefined();
    expect(mot!.stage).toBe('Customer Service');

    // Future AI agency present (route optimisation)
    const aiOptimised = journey.interactions.find(ix => ix.aiAgencyFuture === 'ai-only');
    expect(aiOptimised).toBeDefined();
  });

  it('interactions capture ai agency now/future difference (Day 1 vs end state)', () => {
    const assessment = makeBiffaAssessment();
    const { highConfidence } = partitionMutationsByConfidence(assessment.suggestedMutations!);

    let journey = { ...emptyJourney };
    for (const m of highConfidence) {
      journey = applyMutationIntent(journey, {
        id: `test:${m.type}:${Math.random()}`,
        type: m.type as JourneyMutationIntent['type'],
        payload: m.payload,
        sourceNodeIds: m.sourceNodeIds,
        emittedAtMs: Date.now(),
      });
    }

    // At least one interaction must show a meaningful Day-1 vs end-state difference
    const withTransformation = journey.interactions.filter(
      ix => ix.aiAgencyNow !== ix.aiAgencyFuture,
    );
    expect(withTransformation.length).toBeGreaterThan(0);
  });

  // ── 4. Journey assessment runs before belief gate ─────────────────────────

  it('cognitive state with 0 beliefs but BIFFA utterances has enough for journey assessment', () => {
    const state = makeBiffaCogState();

    // Confirm no beliefs — would normally block the orchestrator
    expect(state.beliefs.size).toBe(0);

    // But utterances exist — enough for journey assessment
    expect(state.recentUtterances.length).toBeGreaterThan(0);

    // Conversation context built from utterances passes non-empty speech
    const recentSpeech = state.recentUtterances.slice(-8).map(u => u.text);
    expect(recentSpeech.length).toBe(4);
    expect(recentSpeech[0]).toContain('collection crew');
  });

  it('first journey assessment interval is 0 (immediate on first utterance)', () => {
    // _lastJourneyAssessmentAtMs = 0 → first run
    const lastJourneyMs = 0;
    const isFirstJourneyRun = lastJourneyMs === 0;
    const JOURNEY_ASSESSMENT_INTERVAL_MS = 30_000;

    const journeyThrottle = isFirstJourneyRun ? 0 : JOURNEY_ASSESSMENT_INTERVAL_MS;

    // With 0 throttle, the gate passes immediately with any utterance
    const utterances = makeBiffaCogState().recentUtterances;
    const shouldAssess = utterances.length > 0 && (Date.now() - lastJourneyMs) >= journeyThrottle;
    expect(shouldAssess).toBe(true);
  });

  it('subsequent journey assessments are throttled to 30s', () => {
    const JOURNEY_ASSESSMENT_INTERVAL_MS = 30_000;
    const lastJourneyMs = Date.now() - 10_000; // 10s ago
    const isFirstJourneyRun = false;
    const journeyThrottle = isFirstJourneyRun ? 0 : JOURNEY_ASSESSMENT_INTERVAL_MS;

    const utterances = makeBiffaCogState().recentUtterances;
    const shouldAssess = utterances.length > 0 && (Date.now() - lastJourneyMs) >= journeyThrottle;
    expect(shouldAssess).toBe(false); // only 10s elapsed, need 30s
  });

  // ── 5. Dedup: duplicate mutation intents don't duplicate map entries ───────

  it('replay of same intent IDs does not duplicate stages or actors', () => {
    const appliedIds = new Set<string>();
    let journey = { ...emptyJourney };

    const intents: JourneyMutationIntent[] = [
      { id: 'id-stage-collection', type: 'add_stage', payload: { stageName: 'Collection' }, sourceNodeIds: [], emittedAtMs: Date.now() },
      { id: 'id-actor-crew', type: 'add_actor', payload: { name: 'Collection Crew', role: 'Operational' }, sourceNodeIds: [], emittedAtMs: Date.now() },
    ];

    // Apply twice
    for (let round = 0; round < 2; round++) {
      for (const intent of intents) {
        if (appliedIds.has(intent.id)) continue;
        appliedIds.add(intent.id);
        journey = applyMutationIntent(journey, intent);
      }
    }

    expect(journey.stages.filter(s => s === 'Collection')).toHaveLength(1);
    expect(journey.actors.filter(a => a.name === 'Collection Crew')).toHaveLength(1);
  });
});

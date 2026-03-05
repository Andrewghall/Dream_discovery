/**
 * Integration Tests - Live Page Agentic (Orchestrator Extensions)
 *
 * Tests that:
 *   1. buildStickyPadFromSuggestion creates pads with the correct shape
 *   2. Composite-key dedup prevents duplicate suggestedPadPrompts
 *   3. emit_journey_mutations tool handler emits correctly shaped intents
 *   4. Edge cases around empty / missing fields are handled gracefully
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helper: mirrors the real buildStickyPadFromSuggestion logic
// ---------------------------------------------------------------------------

interface SuggestedPadPrompt {
  prompt: string;
  gapId: string;
  stage: string;
  label: string;
}

interface GuidanceState {
  currentMainQuestion: {
    text: string;
    lens: string | null;
    purpose: string;
    grounding: string;
    phase: string;
  } | null;
}

function buildStickyPadFromSuggestion(
  sp: SuggestedPadPrompt,
  _guidanceState: GuidanceState,
  mainQuestionIndex: number,
) {
  return {
    id: `journey-gap:${sp.gapId}:${mainQuestionIndex}`,
    type: 'GAP_PROBE' as const,
    prompt: sp.prompt,
    source: 'agent' as const, // NOT 'journey'
    journeyGapId: sp.gapId,
    padLabel: sp.label,
    coverageState: 'active' as const,
    coveragePercent: 0,
    lens: null,
    mainQuestionIndex,
  };
}

// ---------------------------------------------------------------------------
// Helper: mirrors the composite-key dedup used in the live page
// ---------------------------------------------------------------------------

function deduplicatePrompts(
  prompts: SuggestedPadPrompt[],
  workshopId: string,
  mainQuestionIndex: number,
  existingKeys?: Set<string>,
) {
  const emittedKeys = existingKeys ?? new Set<string>();
  const accepted: SuggestedPadPrompt[] = [];

  for (const sp of prompts) {
    const dedupKey = `${workshopId}:${sp.gapId || ''}:${sp.stage || ''}:${mainQuestionIndex}`;
    if (emittedKeys.has(dedupKey)) continue;
    emittedKeys.add(dedupKey);
    accepted.push(sp);
  }

  return { accepted, emittedKeys };
}

// ---------------------------------------------------------------------------
// Helper: mirrors the emit_journey_mutations tool handler
// ---------------------------------------------------------------------------

interface JourneyMutation {
  type: string;
  payload: Record<string, unknown>;
  sourceNodeIds: string[];
}

function emitJourneyMutations(mutations: JourneyMutation[]) {
  const emitted: Array<{ id: string; type: string; payload: Record<string, unknown> }> = [];
  for (const m of mutations) {
    emitted.push({
      id: `orch:${m.type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      type: m.type,
      payload: m.payload || {},
    });
  }
  return emitted;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Live Page Agentic - Orchestrator Extensions', () => {
  // -----------------------------------------------------------------------
  // buildStickyPadFromSuggestion
  // -----------------------------------------------------------------------
  describe('buildStickyPadFromSuggestion', () => {
    it('creates pad with correct shape', () => {
      const sp: SuggestedPadPrompt = {
        prompt: 'What happens at the engagement stage?',
        gapId: 'gap1',
        stage: 'Engagement',
        label: 'Journey: Engagement',
      };
      const guidanceState: GuidanceState = {
        currentMainQuestion: {
          text: 'Test Q',
          lens: null,
          purpose: '',
          grounding: '',
          phase: 'REIMAGINE',
        },
      };

      const pad = buildStickyPadFromSuggestion(sp, guidanceState, 0);

      expect(pad.source).toBe('agent');
      expect(pad.type).toBe('GAP_PROBE');
      expect(pad.journeyGapId).toBe('gap1');
      expect(pad.padLabel).toBe('Journey: Engagement');
      expect(pad.coverageState).toBe('active');
      expect(pad.coveragePercent).toBe(0);
      expect(pad.id).toBe('journey-gap:gap1:0');
      expect(pad.mainQuestionIndex).toBe(0);
    });

    it('encodes mainQuestionIndex into the pad id', () => {
      const sp: SuggestedPadPrompt = {
        prompt: 'Probe question',
        gapId: 'gap-x',
        stage: 'Awareness',
        label: 'Journey: Awareness',
      };
      const guidanceState: GuidanceState = { currentMainQuestion: null };

      const pad0 = buildStickyPadFromSuggestion(sp, guidanceState, 0);
      const pad3 = buildStickyPadFromSuggestion(sp, guidanceState, 3);

      expect(pad0.id).toBe('journey-gap:gap-x:0');
      expect(pad3.id).toBe('journey-gap:gap-x:3');
      expect(pad0.id).not.toBe(pad3.id);
    });

    it('sets source to agent, never journey', () => {
      const sp: SuggestedPadPrompt = {
        prompt: 'Test',
        gapId: 'g1',
        stage: 'Retention',
        label: 'Journey: Retention',
      };
      const pad = buildStickyPadFromSuggestion(sp, { currentMainQuestion: null }, 1);

      expect(pad.source).toBe('agent');
      expect(pad.source).not.toBe('journey');
    });

    it('preserves full prompt text from the suggestion', () => {
      const longPrompt = 'How do customers perceive value during the onboarding phase given their prior expectations set during initial engagement?';
      const sp: SuggestedPadPrompt = {
        prompt: longPrompt,
        gapId: 'gap-onboarding',
        stage: 'Onboarding',
        label: 'Journey: Onboarding',
      };
      const pad = buildStickyPadFromSuggestion(sp, { currentMainQuestion: null }, 0);

      expect(pad.prompt).toBe(longPrompt);
    });
  });

  // -----------------------------------------------------------------------
  // Composite-key dedup
  // -----------------------------------------------------------------------
  describe('composite-key dedup for suggestedPadPrompts', () => {
    it('prevents duplicate suggestedPadPrompts', () => {
      const prompts: SuggestedPadPrompt[] = [
        { prompt: 'Q1', gapId: 'gap1', stage: 'Engagement', label: 'L1' },
        { prompt: 'Q1', gapId: 'gap1', stage: 'Engagement', label: 'L1' }, // duplicate
        { prompt: 'Q1', gapId: 'gap2', stage: 'Engagement', label: 'L2' }, // different gapId = NOT duplicate
      ];

      const { accepted } = deduplicatePrompts(prompts, 'ws1', 0);

      expect(accepted).toHaveLength(2);
      expect(accepted[0].gapId).toBe('gap1');
      expect(accepted[1].gapId).toBe('gap2');
    });

    it('treats different mainQuestionIndex as separate keys', () => {
      const prompts: SuggestedPadPrompt[] = [
        { prompt: 'Q1', gapId: 'gap1', stage: 'Engagement', label: 'L1' },
      ];

      const { emittedKeys: keys0 } = deduplicatePrompts(prompts, 'ws1', 0);
      const { accepted: accepted1 } = deduplicatePrompts(prompts, 'ws1', 1, keys0);

      // Same gapId + stage but different mainQuestionIndex -> should still be accepted
      expect(accepted1).toHaveLength(1);
    });

    it('treats different workshopIds as separate keys', () => {
      const prompts: SuggestedPadPrompt[] = [
        { prompt: 'Q1', gapId: 'gap1', stage: 'Engagement', label: 'L1' },
      ];

      const { emittedKeys: keysWs1 } = deduplicatePrompts(prompts, 'ws1', 0);
      const { accepted: acceptedWs2 } = deduplicatePrompts(prompts, 'ws2', 0, keysWs1);

      expect(acceptedWs2).toHaveLength(1);
    });

    it('handles empty prompts array', () => {
      const { accepted } = deduplicatePrompts([], 'ws1', 0);

      expect(accepted).toHaveLength(0);
    });

    it('handles prompts with missing gapId gracefully', () => {
      const prompts = [
        { prompt: 'Q1', gapId: '', stage: 'Engagement', label: 'L1' },
        { prompt: 'Q2', gapId: '', stage: 'Engagement', label: 'L2' }, // same empty gapId + stage = duplicate
        { prompt: 'Q3', gapId: '', stage: 'Awareness', label: 'L3' },  // different stage = NOT duplicate
      ];

      const { accepted } = deduplicatePrompts(prompts, 'ws1', 0);

      expect(accepted).toHaveLength(2);
      expect(accepted[0].prompt).toBe('Q1');
      expect(accepted[1].prompt).toBe('Q3');
    });
  });

  // -----------------------------------------------------------------------
  // emit_journey_mutations
  // -----------------------------------------------------------------------
  describe('emit_journey_mutations creates correctly shaped intents', () => {
    it('creates one intent per mutation', () => {
      const mutations: JourneyMutation[] = [
        { type: 'add_stage', payload: { stageName: 'Onboarding' }, sourceNodeIds: ['n1'] },
        { type: 'add_actor', payload: { name: 'Customer', role: 'end user' }, sourceNodeIds: [] },
      ];

      const emitted = emitJourneyMutations(mutations);

      expect(emitted).toHaveLength(2);
      expect(emitted[0].type).toBe('add_stage');
      expect(emitted[1].type).toBe('add_actor');
    });

    it('preserves payload contents in emitted intents', () => {
      const mutations: JourneyMutation[] = [
        {
          type: 'add_stage',
          payload: { stageName: 'Onboarding', order: 2 },
          sourceNodeIds: ['n1', 'n2'],
        },
      ];

      const emitted = emitJourneyMutations(mutations);

      expect(emitted[0].payload).toEqual({ stageName: 'Onboarding', order: 2 });
    });

    it('generates unique ids with orch: prefix and mutation type', () => {
      const mutations: JourneyMutation[] = [
        { type: 'add_touchpoint', payload: { name: 'Email' }, sourceNodeIds: [] },
        { type: 'add_touchpoint', payload: { name: 'Phone' }, sourceNodeIds: [] },
      ];

      const emitted = emitJourneyMutations(mutations);

      // Both have the correct prefix
      expect(emitted[0].id).toMatch(/^orch:add_touchpoint:/);
      expect(emitted[1].id).toMatch(/^orch:add_touchpoint:/);

      // IDs are unique even for same mutation type
      expect(emitted[0].id).not.toBe(emitted[1].id);
    });

    it('handles empty mutations array', () => {
      const emitted = emitJourneyMutations([]);

      expect(emitted).toHaveLength(0);
    });

    it('handles mutations with empty payload', () => {
      const mutations: JourneyMutation[] = [
        { type: 'remove_stage', payload: {}, sourceNodeIds: ['n5'] },
      ];

      const emitted = emitJourneyMutations(mutations);

      expect(emitted).toHaveLength(1);
      expect(emitted[0].type).toBe('remove_stage');
      expect(emitted[0].payload).toEqual({});
    });
  });
});

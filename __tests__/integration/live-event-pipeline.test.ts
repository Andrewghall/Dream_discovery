/**
 * Integration Tests - Live Event Pipeline (Dedup + Dispatch Logic)
 *
 * Tests the core dedup + dispatch logic that powers useLiveEventPipeline.
 * Simulates the dispatcher pattern without React hooks to verify:
 * - Correct callback routing based on event type
 * - Idempotent dedup via seen event IDs
 * - Reconnect/replay safety with unique event batches
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StickyPad } from '@/lib/cognitive-guidance/pipeline';
import type { JourneyMutationIntent } from '@/lib/cognition/agents/journey-mutation-types';

// -----------------------------------------------------------------------
// Recreate the dispatcher logic from use-live-event-pipeline.ts
// This mirrors the dispatchEvent useCallback at line 182-243
// -----------------------------------------------------------------------

type EventCallbacks = {
  'datapoint.created'?: (payload: unknown) => void;
  'classification.updated'?: (payload: unknown) => void;
  'agentic.analyzed'?: (payload: unknown) => void;
  'annotation.updated'?: (payload: unknown) => void;
  'pad.generated'?: (payload: unknown) => void;
  'journey.completion'?: (payload: unknown) => void;
  'journey.mutation'?: (payload: unknown) => void;
  'agent.conversation'?: (payload: unknown) => void;
  'contradiction.detected'?: (payload: unknown) => void;
  'belief.stabilised'?: (payload: unknown) => void;
  [key: string]: ((payload: unknown) => void) | undefined;
};

function createDispatcher(callbacks: EventCallbacks) {
  const seenIds = new Set<string>();
  let count = 0;

  return {
    dispatch(eventId: string, type: string, payload: unknown) {
      // Idempotent dedup -- exact same logic as the hook
      if (seenIds.has(eventId)) return;
      seenIds.add(eventId);
      count++;

      try {
        switch (type) {
          case 'datapoint.created':
            callbacks['datapoint.created']?.(payload);
            break;
          case 'classification.updated':
            callbacks['classification.updated']?.(payload);
            break;
          case 'agentic.analyzed':
            callbacks['agentic.analyzed']?.(payload);
            break;
          case 'annotation.updated':
            callbacks['annotation.updated']?.(payload);
            break;
          case 'pad.generated': {
            // The hook unwraps { pad: StickyPad } from the payload
            const p = payload as { pad?: StickyPad };
            if (p?.pad) callbacks['pad.generated']?.(p.pad);
            break;
          }
          case 'journey.completion':
            callbacks['journey.completion']?.(payload);
            break;
          case 'journey.mutation':
            callbacks['journey.mutation']?.(payload);
            break;
          case 'agent.conversation':
            callbacks['agent.conversation']?.(payload);
            break;
          case 'contradiction.detected':
            callbacks['contradiction.detected']?.(payload);
            break;
          case 'belief.stabilised':
            callbacks['belief.stabilised']?.(payload);
            break;
          default:
            break;
        }
      } catch {
        // Mirror hook error swallowing
      }
    },
    get seenCount() {
      return count;
    },
    get seenIds() {
      return seenIds;
    },
  };
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('Live Event Pipeline - Dedup + Dispatch', () => {
  let onPadGenerated: ReturnType<typeof vi.fn>;
  let onDataPointCreated: ReturnType<typeof vi.fn>;
  let onJourneyCompletion: ReturnType<typeof vi.fn>;
  let onJourneyMutation: ReturnType<typeof vi.fn>;
  let onAgentConversation: ReturnType<typeof vi.fn>;
  let onContradictionDetected: ReturnType<typeof vi.fn>;
  let onBeliefStabilised: ReturnType<typeof vi.fn>;

  let dispatcher: ReturnType<typeof createDispatcher>;

  beforeEach(() => {
    onPadGenerated = vi.fn();
    onDataPointCreated = vi.fn();
    onJourneyCompletion = vi.fn();
    onJourneyMutation = vi.fn();
    onAgentConversation = vi.fn();
    onContradictionDetected = vi.fn();
    onBeliefStabilised = vi.fn();

    dispatcher = createDispatcher({
      'pad.generated': onPadGenerated,
      'datapoint.created': onDataPointCreated,
      'journey.completion': onJourneyCompletion,
      'journey.mutation': onJourneyMutation,
      'agent.conversation': onAgentConversation,
      'contradiction.detected': onContradictionDetected,
      'belief.stabilised': onBeliefStabilised,
    });
  });

  it('dispatches pad.generated events to onPadGenerated callback', () => {
    const fakePad: Partial<StickyPad> = {
      id: 'pad-1',
      type: 'CLARIFICATION',
      prompt: 'What does this mean for your team?',
      source: 'agent',
      coveragePercent: 0,
      coverageState: 'active',
      lens: 'People',
      mainQuestionIndex: 0,
    };

    // pad.generated events wrap the pad in a { pad: ... } envelope
    dispatcher.dispatch('evt-001', 'pad.generated', { pad: fakePad });

    expect(onPadGenerated).toHaveBeenCalledTimes(1);
    expect(onPadGenerated).toHaveBeenCalledWith(fakePad);
    expect(dispatcher.seenCount).toBe(1);
  });

  it('dispatches datapoint.created events to onDataPointCreated callback', () => {
    const payload = {
      dataPoint: {
        id: 'dp-1',
        rawText: 'We need better tooling',
        source: 'capture',
        createdAt: new Date().toISOString(),
      },
    };

    dispatcher.dispatch('evt-dp-1', 'datapoint.created', payload);

    expect(onDataPointCreated).toHaveBeenCalledTimes(1);
    expect(onDataPointCreated).toHaveBeenCalledWith(payload);
  });

  it('dispatches journey.mutation events to onJourneyMutation callback', () => {
    const intent: JourneyMutationIntent = {
      id: 'mut-001',
      type: 'add_stage',
      payload: { stageName: 'Onboarding' },
      sourceNodeIds: ['n1'],
      emittedAtMs: Date.now(),
    };

    dispatcher.dispatch('evt-mut-1', 'journey.mutation', intent);

    expect(onJourneyMutation).toHaveBeenCalledTimes(1);
    expect(onJourneyMutation).toHaveBeenCalledWith(intent);
  });

  it('deduplicates events with the same ID', () => {
    const fakePad: Partial<StickyPad> = {
      id: 'pad-2',
      type: 'GAP_PROBE',
      prompt: 'What are we missing?',
      source: 'prep',
    };

    // Dispatch the same event ID twice (SSE + poll overlap)
    dispatcher.dispatch('evt-002', 'pad.generated', { pad: fakePad });
    dispatcher.dispatch('evt-002', 'pad.generated', { pad: fakePad });

    expect(onPadGenerated).toHaveBeenCalledTimes(1);
    expect(dispatcher.seenCount).toBe(1);
    expect(dispatcher.seenIds.size).toBe(1);
  });

  it('deduplicates across different event types with the same ID', () => {
    // Edge case: same event ID for different types (should still dedup)
    dispatcher.dispatch('evt-shared-id', 'pad.generated', { pad: { id: 'p1' } });
    dispatcher.dispatch('evt-shared-id', 'journey.completion', { data: 'test' });

    // Second dispatch with same ID is skipped entirely
    expect(onPadGenerated).toHaveBeenCalledTimes(1);
    expect(onJourneyCompletion).toHaveBeenCalledTimes(0);
    expect(dispatcher.seenCount).toBe(1);
  });

  it('handles reconnect/replay without duplicates — 5 unique events all processed', () => {
    const events = [
      { id: 'evt-100', type: 'datapoint.created', payload: { dataPoint: { id: 'dp-100', rawText: 'A', source: 's', createdAt: '2025-01-01' } } },
      { id: 'evt-101', type: 'pad.generated', payload: { pad: { id: 'pad-101', prompt: 'B' } } },
      { id: 'evt-102', type: 'journey.completion', payload: { journeyCompletionState: {} } },
      { id: 'evt-103', type: 'journey.mutation', payload: { id: 'mut-1', type: 'add_stage', payload: {}, sourceNodeIds: [], emittedAtMs: 0 } },
      { id: 'evt-104', type: 'agent.conversation', payload: { role: 'assistant', content: 'hi' } },
    ];

    // First pass (SSE delivery)
    for (const evt of events) {
      dispatcher.dispatch(evt.id, evt.type, evt.payload);
    }

    expect(dispatcher.seenCount).toBe(5);

    // Second pass (poll replay after reconnect)
    for (const evt of events) {
      dispatcher.dispatch(evt.id, evt.type, evt.payload);
    }

    // Should still be 5 -- no duplicates
    expect(dispatcher.seenCount).toBe(5);
    expect(onDataPointCreated).toHaveBeenCalledTimes(1);
    expect(onPadGenerated).toHaveBeenCalledTimes(1);
    expect(onJourneyCompletion).toHaveBeenCalledTimes(1);
    expect(onJourneyMutation).toHaveBeenCalledTimes(1);
    expect(onAgentConversation).toHaveBeenCalledTimes(1);
  });

  it('silently ignores unknown event types', () => {
    dispatcher.dispatch('evt-unknown', 'some.future.event', { data: 'test' });

    expect(dispatcher.seenCount).toBe(1);
    // No callbacks should have been invoked
    expect(onPadGenerated).not.toHaveBeenCalled();
    expect(onDataPointCreated).not.toHaveBeenCalled();
    expect(onJourneyCompletion).not.toHaveBeenCalled();
    expect(onJourneyMutation).not.toHaveBeenCalled();
  });

  it('does not dispatch pad.generated if payload lacks pad property', () => {
    // Malformed payload -- missing the .pad wrapper
    dispatcher.dispatch('evt-bad', 'pad.generated', { something: 'else' });

    expect(dispatcher.seenCount).toBe(1);
    expect(onPadGenerated).not.toHaveBeenCalled();
  });

  it('handles null pad in pad.generated payload gracefully', () => {
    dispatcher.dispatch('evt-null-pad', 'pad.generated', { pad: null });

    expect(dispatcher.seenCount).toBe(1);
    expect(onPadGenerated).not.toHaveBeenCalled();
  });

  it('dispatches contradiction.detected and belief.stabilised events', () => {
    dispatcher.dispatch('evt-c1', 'contradiction.detected', { beliefId: 'b1', type: 'direct' });
    dispatcher.dispatch('evt-b1', 'belief.stabilised', { beliefId: 'b2', strength: 0.9 });

    expect(onContradictionDetected).toHaveBeenCalledTimes(1);
    expect(onContradictionDetected).toHaveBeenCalledWith({ beliefId: 'b1', type: 'direct' });
    expect(onBeliefStabilised).toHaveBeenCalledTimes(1);
    expect(onBeliefStabilised).toHaveBeenCalledWith({ beliefId: 'b2', strength: 0.9 });
    expect(dispatcher.seenCount).toBe(2);
  });
});

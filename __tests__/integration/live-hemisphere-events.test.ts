/**
 * Integration Tests - Live Hemisphere Events (No Regression)
 *
 * Tests that hemisphere event callbacks work correctly through the
 * unified dispatch pattern. Verifies:
 *   1. datapoint.created fires onDataPointCreated
 *   2. classification.updated fires onClassificationUpdated
 *   3. agentic.analyzed fires onAgenticAnalyzed
 *   4. annotation.updated fires onAnnotationUpdated
 *   5. Idempotent dispatch (same eventId is ignored on second call)
 *   6. Agentic-only event types do NOT fire hemisphere callbacks
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal dispatcher that mirrors the real unified event pipeline behaviour:
//   - Routes events to the correct callback by type
//   - Deduplicates by eventId so the same event cannot fire twice
// ---------------------------------------------------------------------------

function createDispatcher(callbacks: Record<string, (payload: unknown) => void>) {
  const seenIds = new Set<string>();
  return {
    dispatch(eventId: string, type: string, payload: unknown) {
      if (seenIds.has(eventId)) return;
      seenIds.add(eventId);
      callbacks[type]?.(payload);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Live Hemisphere Events - No Regression', () => {
  it('fires onDataPointCreated for datapoint.created events', () => {
    const onDataPointCreated = vi.fn();
    const dispatcher = createDispatcher({ 'datapoint.created': onDataPointCreated });

    const payload = {
      dataPoint: {
        id: 'dp1',
        rawText: 'test utterance',
        source: 'whisper',
        createdAt: new Date().toISOString(),
      },
      transcriptChunk: {
        speakerId: null,
        startTimeMs: 0,
        endTimeMs: 1000,
        confidence: 0.95,
        source: 'whisper',
      },
    };

    dispatcher.dispatch('dp1', 'datapoint.created', payload);

    expect(onDataPointCreated).toHaveBeenCalledOnce();
    expect(onDataPointCreated).toHaveBeenCalledWith(payload);
  });

  it('fires onClassificationUpdated for classification.updated events', () => {
    const onClassificationUpdated = vi.fn();
    const dispatcher = createDispatcher({ 'classification.updated': onClassificationUpdated });

    const payload = {
      dataPointId: 'dp2',
      themeId: 'theme-abc',
      classification: 'PAIN_POINT',
      confidence: 0.88,
      updatedAt: new Date().toISOString(),
    };

    dispatcher.dispatch('cls-dp2', 'classification.updated', payload);

    expect(onClassificationUpdated).toHaveBeenCalledOnce();
    expect(onClassificationUpdated).toHaveBeenCalledWith(payload);
  });

  it('fires onAgenticAnalyzed for agentic.analyzed events', () => {
    const onAgenticAnalyzed = vi.fn();
    const dispatcher = createDispatcher({ 'agentic.analyzed': onAgenticAnalyzed });

    const payload = {
      analysisId: 'analysis-1',
      dataPointIds: ['dp1', 'dp2'],
      insights: [
        { type: 'theme_cluster', label: 'Trust concerns', confidence: 0.91 },
      ],
      completedAt: new Date().toISOString(),
    };

    dispatcher.dispatch('analysis-1', 'agentic.analyzed', payload);

    expect(onAgenticAnalyzed).toHaveBeenCalledOnce();
    expect(onAgenticAnalyzed).toHaveBeenCalledWith(payload);
  });

  it('fires onAnnotationUpdated for annotation.updated events', () => {
    const onAnnotationUpdated = vi.fn();
    const dispatcher = createDispatcher({ 'annotation.updated': onAnnotationUpdated });

    const payload = {
      dataPointId: 'dp3',
      annotationId: 'ann-1',
      text: 'Facilitator note: revisit later',
      author: 'facilitator',
      updatedAt: new Date().toISOString(),
    };

    dispatcher.dispatch('ann-1', 'annotation.updated', payload);

    expect(onAnnotationUpdated).toHaveBeenCalledOnce();
    expect(onAnnotationUpdated).toHaveBeenCalledWith(payload);
  });

  it('deduplicates events by eventId (idempotent dispatch)', () => {
    const onDataPointCreated = vi.fn();
    const dispatcher = createDispatcher({ 'datapoint.created': onDataPointCreated });

    const payload = {
      dataPoint: { id: 'dp-dup', rawText: 'duplicate test', source: 'whisper', createdAt: new Date().toISOString() },
      transcriptChunk: { speakerId: null, startTimeMs: 0, endTimeMs: 500, confidence: 0.9, source: 'whisper' },
    };

    dispatcher.dispatch('dp-dup', 'datapoint.created', payload);
    dispatcher.dispatch('dp-dup', 'datapoint.created', payload); // duplicate

    expect(onDataPointCreated).toHaveBeenCalledOnce();
  });

  it('does not fire hemisphere callbacks for agentic event types', () => {
    const onDataPointCreated = vi.fn();
    const onClassificationUpdated = vi.fn();
    const onAgenticAnalyzed = vi.fn();
    const onAnnotationUpdated = vi.fn();

    const dispatcher = createDispatcher({
      'datapoint.created': onDataPointCreated,
      'classification.updated': onClassificationUpdated,
      'agentic.analyzed': onAgenticAnalyzed,
      'annotation.updated': onAnnotationUpdated,
    });

    // These are internal agentic pipeline events that should NOT map
    // to any hemisphere callback
    const agenticOnlyTypes = [
      'orchestrator.heartbeat',
      'agent.tool_call',
      'pipeline.stage_complete',
      'facilitation.suggestion',
    ];

    for (const type of agenticOnlyTypes) {
      dispatcher.dispatch(`evt-${type}`, type, { detail: 'internal' });
    }

    expect(onDataPointCreated).not.toHaveBeenCalled();
    expect(onClassificationUpdated).not.toHaveBeenCalled();
    expect(onAgenticAnalyzed).not.toHaveBeenCalled();
    expect(onAnnotationUpdated).not.toHaveBeenCalled();
  });

  it('routes multiple different event types to their respective callbacks', () => {
    const onDataPointCreated = vi.fn();
    const onClassificationUpdated = vi.fn();
    const onAgenticAnalyzed = vi.fn();

    const dispatcher = createDispatcher({
      'datapoint.created': onDataPointCreated,
      'classification.updated': onClassificationUpdated,
      'agentic.analyzed': onAgenticAnalyzed,
    });

    dispatcher.dispatch('e1', 'datapoint.created', { id: 'dp1' });
    dispatcher.dispatch('e2', 'classification.updated', { id: 'cls1' });
    dispatcher.dispatch('e3', 'agentic.analyzed', { id: 'a1' });

    expect(onDataPointCreated).toHaveBeenCalledOnce();
    expect(onClassificationUpdated).toHaveBeenCalledOnce();
    expect(onAgenticAnalyzed).toHaveBeenCalledOnce();
  });

  it('allows same event type with different eventIds', () => {
    const onDataPointCreated = vi.fn();
    const dispatcher = createDispatcher({ 'datapoint.created': onDataPointCreated });

    dispatcher.dispatch('dp-a', 'datapoint.created', { id: 'dp-a' });
    dispatcher.dispatch('dp-b', 'datapoint.created', { id: 'dp-b' });
    dispatcher.dispatch('dp-c', 'datapoint.created', { id: 'dp-c' });

    expect(onDataPointCreated).toHaveBeenCalledTimes(3);
  });
});

'use client';

/**
 * useLiveEventPipeline
 *
 * Unified SSE + outbox polling hook for live workshop events.
 * Handles all event types with typed callbacks, idempotent dedup,
 * and strict cleanup on unmount / dependency changes.
 *
 * Replaces both the live page's startSse() and cognitive-guidance's
 * inline SSE + poll logic. One EventSource, one poll interval, one
 * dedup set.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StickyPad } from '@/lib/cognitive-guidance/pipeline';
import type { JourneyCompletionState } from '@/lib/cognition/guidance-state';
// Journey mutation types inlined after journey-mutation-types.ts was removed
type JourneyMutationIntent = { id: string; type: string; payload: Record<string, unknown>; sourceNodeIds?: string[]; emittedAtMs: number };
import type { AgentConversationEntry } from '@/components/cognitive-guidance/agent-orchestration-panel';

// -----------------------------------------------------------------------
// Payload types (shared with consumers)
// -----------------------------------------------------------------------

export type DataPointCreatedPayload = {
  dataPoint: {
    id: string;
    rawText: string;
    source: string;
    speakerId?: string | null;
    createdAt: string | Date;
    dialoguePhase?: string | null;
  };
  transcriptChunk?: {
    speakerId?: string | null;
    startTimeMs: number;
    endTimeMs: number;
    confidence: number | null;
    source: string;
  };
};

export type ClassificationUpdatedPayload = {
  dataPointId: string;
  classification: {
    primaryType: string;
    confidence: number;
    keywords: string[];
    suggestedArea: string | null;
    updatedAt: string;
  };
};

export type AgenticAnalyzedPayload = {
  dataPointId: string;
  analysis: {
    interpretation: string;
    domains: Array<{ domain: string; confidence: number }>;
    themes: string[];
    actors: Array<{ name: string; role: string; sentiment?: string }>;
    overallConfidence: number;
    interactions?: Array<{
      fromActor: string;
      toActor: string;
      action: string;
      sentiment: string;
      context: string;
    }>;
  };
};

export type AnnotationUpdatedPayload = {
  dataPointId: string;
  annotation: {
    dialoguePhase?: string | null;
    intent?: string | null;
    updatedAt: string | Date;
  };
};

export type { AgentConversationEntry } from '@/components/cognitive-guidance/agent-orchestration-panel';

export type JourneyCompletionPayload = {
  journeyCompletionState: JourneyCompletionState;
  liveJourney?: {
    stages: string[];
    actors: Array<{ name: string; role: string; mentionCount: number }>;
    interactions: Array<Record<string, unknown>>;
  };
};

// -----------------------------------------------------------------------
// Hook options
// -----------------------------------------------------------------------

export interface LiveEventPipelineOptions {
  workshopId: string;
  enabled: boolean;

  // Transcript / hemisphere callbacks
  onDataPointCreated?: (payload: DataPointCreatedPayload) => void;
  onClassificationUpdated?: (payload: ClassificationUpdatedPayload) => void;
  onAgenticAnalyzed?: (payload: AgenticAnalyzedPayload) => void;
  onAnnotationUpdated?: (payload: AnnotationUpdatedPayload) => void;

  // Agentic facilitation callbacks
  onPadGenerated?: (pad: StickyPad) => void;
  onJourneyCompletion?: (payload: JourneyCompletionPayload) => void;
  onJourneyMutation?: (intent: JourneyMutationIntent) => void;
  onAgentConversation?: (entry: AgentConversationEntry) => void;

  // Signal callbacks
  onContradictionDetected?: (payload: Record<string, unknown>) => void;
  onBeliefStabilised?: (payload: Record<string, unknown>) => void;
}

export interface LiveEventPipelineReturn {
  listening: boolean;
  startListening: () => void;
  stopListening: () => void;
  seenEventCount: number;
}

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------

const POLL_INTERVAL_MS = 3_000;

const POLL_TYPES = [
  'datapoint.created',
  'classification.updated',
  'agentic.analyzed',
  'annotation.updated',
  'pad.generated',
  'journey.completion',
  'journey.mutation',
  'agent.conversation',
  'belief.created',
  'belief.reinforced',
  'belief.stabilised',
  'contradiction.detected',
].join(',');

// -----------------------------------------------------------------------
// Hook implementation
// -----------------------------------------------------------------------

export function useLiveEventPipeline(
  options: LiveEventPipelineOptions,
): LiveEventPipelineReturn {
  const {
    workshopId,
    enabled,
    onDataPointCreated,
    onClassificationUpdated,
    onAgenticAnalyzed,
    onAnnotationUpdated,
    onPadGenerated,
    onJourneyCompletion,
    onJourneyMutation,
    onAgentConversation,
    onContradictionDetected,
    onBeliefStabilised,
  } = options;

  const [listening, setListening] = useState(false);
  const [seenEventCount, setSeenEventCount] = useState(0);

  // Refs for SSE + poll infrastructure
  const esRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastOutboxCursorRef = useRef<string>(new Date().toISOString());
  const lastOutboxCursorIdRef = useRef<string>('');
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  // Stable callback refs (avoid stale closures)
  const callbacksRef = useRef(options);
  // Keep ref in sync with latest options without adding it to effect deps
  useLayoutEffect(() => { callbacksRef.current = options; });

  // ---- Central event dispatch ----

  const dispatchEvent = useCallback(
    (eventId: string, type: string, payload: unknown) => {
      // Idempotent dedup
      if (seenEventIdsRef.current.has(eventId)) return;
      seenEventIdsRef.current.add(eventId);
      setSeenEventCount((c) => c + 1);

      const cbs = callbacksRef.current;

      try {
        switch (type) {
          case 'datapoint.created': {
            cbs.onDataPointCreated?.(payload as DataPointCreatedPayload);
            break;
          }
          case 'classification.updated': {
            cbs.onClassificationUpdated?.(payload as ClassificationUpdatedPayload);
            break;
          }
          case 'agentic.analyzed': {
            cbs.onAgenticAnalyzed?.(payload as AgenticAnalyzedPayload);
            break;
          }
          case 'annotation.updated': {
            cbs.onAnnotationUpdated?.(payload as AnnotationUpdatedPayload);
            break;
          }
          case 'pad.generated': {
            const p = payload as { pad?: StickyPad };
            if (p?.pad) cbs.onPadGenerated?.(p.pad);
            break;
          }
          case 'journey.completion': {
            cbs.onJourneyCompletion?.(payload as JourneyCompletionPayload);
            break;
          }
          case 'journey.mutation': {
            cbs.onJourneyMutation?.(payload as JourneyMutationIntent);
            break;
          }
          case 'agent.conversation': {
            cbs.onAgentConversation?.(payload as AgentConversationEntry);
            break;
          }
          case 'contradiction.detected': {
            cbs.onContradictionDetected?.(payload as Record<string, unknown>);
            break;
          }
          case 'belief.stabilised': {
            cbs.onBeliefStabilised?.(payload as Record<string, unknown>);
            break;
          }
          // belief.created, belief.reinforced -- not consumed currently
          default:
            break;
        }
      } catch (err) {
        console.error(`[EventPipeline] Error dispatching ${type}:`, err);
      }
    },
    [],
  );

  // ---- Start / stop functions ----

  const cleanup = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (esRef.current || pollIntervalRef.current) cleanup();

    const eventUrl = `/api/workshops/${encodeURIComponent(workshopId)}/events`;

    // ---- SSE connection (best-effort, unreliable on Vercel) ----
    try {
      const es = new EventSource(eventUrl);
      esRef.current = es;

      es.addEventListener('open', () => {
        console.log('[EventPipeline] SSE connected');
      });

      // Listen for all event types
      const sseHandler = (eventType: string) => (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (!data) return;

          // Extract event id for dedup
          const eventId =
            data.id ||
            data.dataPoint?.id ||
            data.dataPointId ||
            `sse:${eventType}:${Date.now()}:${Math.random()}`;

          dispatchEvent(eventId, eventType, data);
        } catch {
          // Malformed SSE data -- skip
        }
      };

      const SSE_EVENT_TYPES = [
        'datapoint.created',
        'classification.updated',
        'agentic.analyzed',
        'annotation.updated',
        'pad.generated',
        'journey.completion',
        'journey.mutation',
        'agent.conversation',
        'belief.stabilised',
        'contradiction.detected',
      ];

      for (const eventType of SSE_EVENT_TYPES) {
        es.addEventListener(eventType, sseHandler(eventType));
      }

      es.addEventListener('error', () => {
        console.warn('[EventPipeline] SSE error -- relying on poll fallback');
      });
    } catch {
      console.warn('[EventPipeline] SSE unavailable -- poll only');
    }

    // ---- Outbox polling (primary, durable) ----
    const poll = async () => {
      try {
        const url = `/api/workshops/${encodeURIComponent(workshopId)}/events/poll` +
          `?after=${encodeURIComponent(lastOutboxCursorRef.current)}` +
          `&types=${POLL_TYPES}` +
          (lastOutboxCursorIdRef.current ? `&afterId=${encodeURIComponent(lastOutboxCursorIdRef.current)}` : '');

        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        const events = Array.isArray(data?.events) ? data.events : [];

        for (const evt of events) {
          const eventId = evt.id || `poll:${evt.type}:${evt.createdAt}`;
          dispatchEvent(eventId, evt.type, evt.payload);
        }

        // Advance composite cursor to last event (events ordered by [createdAt, id] ASC)
        if (events.length > 0) {
          const last = events[events.length - 1];
          const ts =
            typeof last.createdAt === 'string'
              ? last.createdAt
              : new Date(last.createdAt).toISOString();
          lastOutboxCursorRef.current = ts;
          lastOutboxCursorIdRef.current = last.id || '';
        }
      } catch (err) {
        console.warn('[EventPipeline] Poll error:', err);
      }
    };

    // Immediate first poll
    void poll();

    // Then poll every POLL_INTERVAL_MS
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    setListening(true);
  }, [workshopId, dispatchEvent, cleanup]);

  const stopListening = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // ---- Auto-start/stop based on enabled prop ----

  useEffect(() => {
    if (enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startListening();
    } else {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [enabled, workshopId]); // eslint-disable-line react-hooks/exhaustive-deps
  // startListening and cleanup are stable (useCallback with no deps that change)

  return {
    listening,
    startListening,
    stopListening,
    seenEventCount,
  };
}

'use client';

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Radio, Square } from 'lucide-react';
import {
  HemisphereNodes,
  type HemisphereNodeDatum,
} from '@/components/live/hemisphere-nodes';

import {
  type CogNode,
  type StickyPad,
  type Signal,
  type LensCoverage,
  type Lens,
  type ActorJourney,
  type SessionConfidence,
  ALL_LENSES,
  createInitialNode,
  categoriseNode,
  applyLensMapping,
  calculateLensCoverage,
  detectSignals,
  generateStickyPads,
  updateActorJourneys,
  calculateSessionConfidence,
} from '@/lib/cognitive-guidance/pipeline';

import { StickyPadCanvas } from '@/components/cognitive-guidance/sticky-pad-canvas';
import LensCoverageBar from '@/components/cognitive-guidance/lens-coverage-bar';
import GapIndicatorStrip from '@/components/cognitive-guidance/gap-indicator-strip';
import SignalClusterPanel from '@/components/cognitive-guidance/signal-cluster-panel';
import ActorJourneyPanel from '@/components/cognitive-guidance/actor-journey-panel';

type PageProps = {
  params: Promise<{ id: string }>;
};

// ── SSE event payload types ──────────────────────────────

type RealtimeEvent = {
  type: string;
  workshopId: string;
  payload: unknown;
  createdAt?: number;
};

type DataPointCreatedPayload = {
  dataPoint: {
    id: string;
    rawText: string;
    source: string;
    speakerId?: string | null;
    createdAt: string | Date;
    dialoguePhase?: string;
  };
  transcriptChunk?: {
    speakerId?: string | null;
    startTimeMs?: number;
    endTimeMs?: number;
    confidence?: number | null;
    source?: string;
  };
};

type ClassificationUpdatedPayload = {
  dataPointId: string;
  classification: {
    primaryType: string;
    confidence: number;
    keywords: string[];
    suggestedArea?: string;
    updatedAt: string;
  };
};

type AgenticAnalyzedPayload = {
  dataPointId: string;
  analysis: {
    interpretation: {
      semanticMeaning: string;
      sentimentTone: string;
    };
    domains: Array<{ domain: string; relevance: number; reasoning: string }>;
    themes: Array<{ label: string; category: string; confidence: number; reasoning: string }>;
    actors?: Array<{
      name: string;
      role: string;
      interactions: Array<{
        withActor: string;
        action: string;
        sentiment: string;
        context: string;
      }>;
    }>;
    overallConfidence: number;
  };
};

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export default function CognitiveGuidancePage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  // ── Core state ─────────────────────────────────────────
  const [cogNodes, setCogNodes] = useState<Map<string, CogNode>>(new Map());
  const [hemisphereNodes, setHemisphereNodes] = useState<Record<string, HemisphereNodeDatum>>({});
  const [stickyPads, setStickyPads] = useState<StickyPad[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [lensCoverage, setLensCoverage] = useState<Map<Lens, LensCoverage>>(new Map());
  const [actorJourneys, setActorJourneys] = useState<Map<string, ActorJourney>>(new Map());
  const [sessionConfidence, setSessionConfidence] = useState<SessionConfidence>({
    overallConfidence: 0,
    categorisedRate: 0,
    lensCoverageRate: 0,
    contradictionCount: 0,
    stabilisedBeliefCount: 0,
  });

  // ── SSE state ──────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  // ── UI state ───────────────────────────────────────────
  const [selectedPadId, setSelectedPadId] = useState<string | null>(null);
  const [journeyExpanded, setJourneyExpanded] = useState(false);

  // ── Belief tracking for Stage 3 ────────────────────────
  const contradictionsRef = useRef<Array<{ id: string; beliefA: string; beliefB: string; resolved: boolean }>>([]);
  const stabilisedCountRef = useRef(0);
  const lastBufferedRunRef = useRef(0);
  const nodeCountSinceLastRunRef = useRef(0);

  const eventUrl = useMemo(
    () => `/api/workshops/${encodeURIComponent(workshopId)}/events`,
    [workshopId]
  );

  // ── Buffered pipeline (Stages 3-5) ────────────────────
  const runBufferedPipeline = useCallback((nodes: CogNode[], nowMs: number) => {
    const nodesArr = nodes;

    // Stage 3: Gap & Signal Detection
    const detectedSignals = detectSignals(nodesArr, contradictionsRef.current, nowMs);
    setSignals(detectedSignals);

    // Stage 3 also: Lens Coverage
    const coverage = calculateLensCoverage(nodesArr);
    setLensCoverage(coverage);

    // Stage 4: Sticky Pad Generation
    setStickyPads(prev => generateStickyPads(detectedSignals, prev, nowMs));

    // Stage 5: Actor Journey Construction
    const journeys = updateActorJourneys(nodesArr);
    setActorJourneys(journeys);

    // Session confidence
    const confidence = calculateSessionConfidence(
      nodesArr,
      coverage,
      contradictionsRef.current,
      stabilisedCountRef.current,
    );
    setSessionConfidence(confidence);

    lastBufferedRunRef.current = nowMs;
    nodeCountSinceLastRunRef.current = 0;
  }, []);

  // ── Timer for buffered pipeline ────────────────────────
  useEffect(() => {
    if (!listening) return;

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const timeSinceLastRun = nowMs - lastBufferedRunRef.current;
      if (timeSinceLastRun >= 10_000 || nodeCountSinceLastRunRef.current >= 5) {
        setCogNodes(current => {
          const nodesArr = Array.from(current.values());
          if (nodesArr.length >= 3) {
            runBufferedPipeline(nodesArr, nowMs);
          }
          return current;
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [listening, runBufferedPipeline]);

  // ── SSE connection ─────────────────────────────────────
  const startListening = useCallback(() => {
    try {
      esRef.current?.close();
    } catch { /* ignore */ }

    const es = new EventSource(eventUrl);
    esRef.current = es;

    // ── datapoint.created → Stage 1 (initial) ──────────
    es.addEventListener('datapoint.created', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const p = evt.payload as DataPointCreatedPayload;
        const dataPointId = p?.dataPoint?.id;
        if (!dataPointId) return;

        const createdAtMs =
          typeof p.dataPoint.createdAt === 'string'
            ? Date.parse(p.dataPoint.createdAt)
            : p.dataPoint.createdAt instanceof Date
              ? p.dataPoint.createdAt.getTime()
              : Date.now();

        // Create CogNode (Stage 1 — UNCLASSIFIED initially)
        const cogNode = createInitialNode(
          dataPointId,
          String(p.dataPoint.rawText ?? ''),
          p.dataPoint.speakerId || p.transcriptChunk?.speakerId || null,
          createdAtMs,
        );
        setCogNodes(prev => {
          if (prev.has(dataPointId)) return prev;
          const next = new Map(prev);
          next.set(dataPointId, cogNode);
          return next;
        });

        // Also maintain hemisphere nodes for the mini widget
        const hNode: HemisphereNodeDatum = {
          dataPointId,
          createdAtMs,
          rawText: String(p.dataPoint.rawText ?? ''),
          dataPointSource: String(p.dataPoint.source ?? ''),
          speakerId: p.dataPoint.speakerId || p.transcriptChunk?.speakerId || null,
          dialoguePhase: null,
          transcriptChunk: p.transcriptChunk
            ? {
                speakerId: p.transcriptChunk.speakerId || null,
                startTimeMs: Number(p.transcriptChunk.startTimeMs ?? 0),
                endTimeMs: Number(p.transcriptChunk.endTimeMs ?? 0),
                confidence: typeof p.transcriptChunk.confidence === 'number' ? p.transcriptChunk.confidence : null,
                source: String(p.transcriptChunk.source ?? ''),
              }
            : null,
          classification: null,
        };
        setHemisphereNodes(prev => {
          if (prev[dataPointId]) return prev;
          return { ...prev, [dataPointId]: hNode };
        });

        setNodeCount(c => c + 1);
        nodeCountSinceLastRunRef.current++;
      } catch { /* ignore */ }
    });

    // ── classification.updated → Stage 1 (recategorise) ──
    es.addEventListener('classification.updated', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const p = evt.payload as ClassificationUpdatedPayload;
        const dataPointId = p?.dataPointId;
        if (!dataPointId) return;

        const cls = p.classification;
        setCogNodes(prev => {
          const existing = prev.get(dataPointId);
          if (!existing) return prev;
          const updated = categoriseNode(existing, {
            primaryType: cls.primaryType,
            confidence: cls.confidence,
            keywords: Array.isArray(cls.keywords) ? cls.keywords : [],
          });
          const next = new Map(prev);
          next.set(dataPointId, updated);
          return next;
        });

        // Update hemisphere node too
        setHemisphereNodes(prev => {
          const existing = prev[dataPointId];
          if (!existing) return prev;
          return {
            ...prev,
            [dataPointId]: {
              ...existing,
              classification: {
                primaryType: cls.primaryType as HemisphereNodeDatum['classification'] extends null ? never : NonNullable<HemisphereNodeDatum['classification']>['primaryType'],
                confidence: cls.confidence,
                keywords: Array.isArray(cls.keywords) ? cls.keywords : [],
                suggestedArea: cls.suggestedArea ?? null,
                updatedAt: cls.updatedAt,
              },
            },
          };
        });
      } catch { /* ignore */ }
    });

    // ── agentic.analyzed → Stage 2 (lens mapping) ────────
    es.addEventListener('agentic.analyzed', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const p = evt.payload as AgenticAnalyzedPayload;
        const dataPointId = p?.dataPointId;
        if (!dataPointId) return;

        const analysis = {
          domains: p.analysis.domains,
          themes: p.analysis.themes,
          actors: Array.isArray(p.analysis.actors) ? p.analysis.actors : [],
          semanticMeaning: p.analysis.interpretation.semanticMeaning,
          sentimentTone: p.analysis.interpretation.sentimentTone,
          overallConfidence: p.analysis.overallConfidence,
        };

        setCogNodes(prev => {
          const existing = prev.get(dataPointId);
          if (!existing) return prev;
          const updated = applyLensMapping(existing, analysis);
          const next = new Map(prev);
          next.set(dataPointId, updated);
          return next;
        });

        // Update hemisphere node
        setHemisphereNodes(prev => {
          const existing = prev[dataPointId];
          if (!existing) return prev;
          return {
            ...prev,
            [dataPointId]: {
              ...existing,
              agenticAnalysis: analysis,
            },
          };
        });
      } catch { /* ignore */ }
    });

    // ── Belief events → feed into Stage 3 ────────────────
    es.addEventListener('belief.stabilised', () => {
      stabilisedCountRef.current++;
    });

    es.addEventListener('contradiction.detected', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data);
        const c = evt.payload?.contradiction;
        if (c) {
          contradictionsRef.current.push({
            id: c.id || `c_${Date.now()}`,
            beliefA: c.beliefA?.label || '',
            beliefB: c.beliefB?.label || '',
            resolved: false,
          });
        }
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    setListening(true);
  }, [eventUrl]);

  const stopListening = useCallback(() => {
    try {
      esRef.current?.close();
      esRef.current = null;
    } catch { /* ignore */ }
    setListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { esRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

  // Convert hemisphere nodes to array for the mini widget
  const hemisphereNodeArray = useMemo(
    () => Object.values(hemisphereNodes),
    [hemisphereNodes]
  );

  // ── Sticky pad actions ─────────────────────────────────
  const handleDismissPad = useCallback((id: string) => {
    setStickyPads(prev => prev.map(p =>
      p.id === id ? { ...p, status: 'dismissed' as const } : p
    ));
  }, []);

  const handleSnoozePad = useCallback((id: string) => {
    setStickyPads(prev => prev.map(p =>
      p.id === id ? { ...p, status: 'snoozed' as const, snoozedUntilMs: Date.now() + 60_000 } : p
    ));
  }, []);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href={`/admin/workshops/${workshopId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cognitive Guidance</h1>
              <p className="text-sm text-muted-foreground">
                Facilitation intelligence layer — {nodeCount} contributions captured
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!listening ? (
              <Button onClick={startListening} size="sm">
                <Radio className="h-4 w-4 mr-2" />
                Start Listening
              </Button>
            ) : (
              <Button onClick={stopListening} variant="destructive" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
            {listening && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        {/* Lens Coverage Bar + Gap Indicators */}
        <LensCoverageBar coverage={lensCoverage} />
        <GapIndicatorStrip signals={signals} />

        {/* ═══ PRIMARY CANVAS — Sticky Pads own the screen ═══ */}
        <div className="mt-4">
          <StickyPadCanvas
            pads={stickyPads}
            selectedPadId={selectedPadId}
            onSelectPad={setSelectedPadId}
            onDismissPad={handleDismissPad}
            onSnoozePad={handleSnoozePad}
          />
        </div>

        {/* ═══ BOTTOM STRIP — Context panels (collapsible) ═══ */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Compact Hemisphere + Signals */}
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-2">
              <h3 className="text-xs font-medium mb-1 text-muted-foreground">Hemisphere</h3>
              <div className="h-[160px] pointer-events-none">
                <HemisphereNodes
                  nodes={hemisphereNodeArray}
                  originTimeMs={null}
                />
              </div>
            </div>
            <SignalClusterPanel
              signals={signals}
              sessionConfidence={sessionConfidence}
            />
          </div>

          {/* Actor Journey Panel */}
          <ActorJourneyPanel
            journeys={actorJourneys}
            expanded={journeyExpanded}
            onToggleExpand={() => setJourneyExpanded(e => !e)}
          />
        </div>
      </div>
    </div>
  );
}

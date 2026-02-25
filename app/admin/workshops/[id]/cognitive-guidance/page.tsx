'use client';

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Radio, Square, X, Maximize2 } from 'lucide-react';
import {
  HemisphereNodes,
  type HemisphereNodeDatum,
  type HemispherePrimaryType,
} from '@/components/live/hemisphere-nodes';

import {
  type CogNode,
  type StickyPad,
  type Signal,
  type LensCoverage,
  type Lens,
  type SessionConfidence,
  type DialoguePhase,
  type LiveJourneyData,
  type LiveJourneyInteraction,
  ALL_LENSES,
  ALL_PHASES,
  PHASE_LABELS,
  DEFAULT_JOURNEY_STAGES,
  createInitialNode,
  categoriseNode,
  applyLensMapping,
  calculateLensCoverage,
  detectSignals,
  generateStickyPads,
  buildLiveJourney,
  calculateSessionConfidence,
} from '@/lib/cognitive-guidance/pipeline';

import { StickyPadCanvas } from '@/components/cognitive-guidance/sticky-pad-canvas';
import LensCoverageBar from '@/components/cognitive-guidance/lens-coverage-bar';
import GapIndicatorStrip from '@/components/cognitive-guidance/gap-indicator-strip';
import SignalClusterPanel from '@/components/cognitive-guidance/signal-cluster-panel';
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';

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
// SEED PADS PER PHASE
// ══════════════════════════════════════════════════════════

function getSeedPadsForPhase(phase: DialoguePhase): StickyPad[] {
  const now = Date.now();

  switch (phase) {
    case 'SYNTHESIS':
      return [
        {
          id: 'synth-themes', type: 'CLARIFICATION', status: 'active',
          prompt: 'What were the most common themes across all participant interviews? Where is there strong consensus?',
          signalStrength: 0.9, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'repeated_theme', sourceNodeIds: [], description: 'Identify shared themes from discovery' },
        },
        {
          id: 'synth-diverge', type: 'CONTRADICTION_PROBE', status: 'active',
          prompt: 'Where did participants disagree or have strongly different perspectives? What drove the divergence?',
          signalStrength: 0.85, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'contradiction', sourceNodeIds: [], description: 'Surface divergent views across interviews' },
        },
        {
          id: 'synth-gaps', type: 'GAP_PROBE', status: 'active',
          prompt: 'Which domains or topics were barely discussed in the interviews? Are there blind spots the group should address?',
          signalStrength: 0.8, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'missing_dimension', sourceNodeIds: [], description: 'Identify coverage gaps from interviews' },
        },
        {
          id: 'synth-customer', type: 'CUSTOMER_IMPACT', status: 'active',
          prompt: 'What did participants say about the customer experience? Was there a shared view of customer needs?',
          signalStrength: 0.75, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'repeated_theme', sourceNodeIds: [], description: 'Collective customer perspective' },
        },
        {
          id: 'synth-pain', type: 'CLARIFICATION', status: 'active',
          prompt: 'What were the top pain points and challenges raised across all interviews? Which are most urgent?',
          signalStrength: 0.7, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'repeated_theme', sourceNodeIds: [], description: 'Aggregate pain points from discovery' },
        },
        {
          id: 'synth-surprise', type: 'CLARIFICATION', status: 'active',
          prompt: 'Were there any surprising or unexpected insights from the interviews that the group should discuss?',
          signalStrength: 0.65, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'repeated_theme', sourceNodeIds: [], description: 'Surface unexpected findings' },
        },
      ];

    case 'REIMAGINE':
      return [
        {
          id: 'reimag-vision', type: 'CLARIFICATION', status: 'active',
          prompt: 'What is the ideal future state for this business? Paint the picture of success without constraints.',
          signalStrength: 0.9, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'repeated_theme', sourceNodeIds: [], description: 'Opening prompt — establish aspirational vision' },
        },
        {
          id: 'reimag-actors', type: 'CLARIFICATION', status: 'active',
          prompt: 'Who are the key actors and stakeholders in this vision? What roles do they play?',
          signalStrength: 0.85, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'repeated_theme', sourceNodeIds: [], description: 'Identify actors and their relationships' },
        },
        {
          id: 'reimag-customer', type: 'CUSTOMER_IMPACT', status: 'active',
          prompt: 'How does the customer experience look in this reimagined future? What changes for them?',
          signalStrength: 0.8, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'missing_dimension', sourceNodeIds: [], description: 'Customer perspective in the vision' },
        },
        {
          id: 'reimag-people', type: 'GAP_PROBE', status: 'active',
          prompt: 'How do the people in the organisation fit into this future? What does their experience look like?',
          signalStrength: 0.75, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'missing_dimension', sourceNodeIds: [], description: 'People dimension in the vision' },
        },
        {
          id: 'reimag-org', type: 'GAP_PROBE', status: 'active',
          prompt: 'What does the organisation look like in this future state? How is it structured differently?',
          signalStrength: 0.7, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'missing_dimension', sourceNodeIds: [], description: 'Organisation dimension in the vision' },
        },
        {
          id: 'reimag-goals', type: 'CLARIFICATION', status: 'active',
          prompt: 'What are the top 3 business outcomes you want from this transformation?',
          signalStrength: 0.65, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'unanswered_question', sourceNodeIds: [], description: 'Define measurable business goals' },
        },
      ];

    case 'CONSTRAINTS':
      // Right-to-left: Regulation → Customer → Technology → Organisation → People
      return [
        {
          id: 'con-regulation', type: 'RISK_PROBE', status: 'active',
          prompt: 'What regulatory, compliance, or legal constraints apply to this vision? What must we comply with?',
          signalStrength: 0.9, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'missing_dimension', sourceNodeIds: [], description: 'Regulation lens — start from hard external constraints' },
        },
        {
          id: 'con-customer', type: 'CUSTOMER_IMPACT', status: 'active',
          prompt: 'What customer-side constraints exist? Budget limits, adoption barriers, switching costs, expectations?',
          signalStrength: 0.85, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'missing_dimension', sourceNodeIds: [], description: 'Customer constraints and realities' },
        },
        {
          id: 'con-technology', type: 'RISK_PROBE', status: 'active',
          prompt: 'What technology constraints are we dealing with? Legacy systems, integration challenges, technical debt?',
          signalStrength: 0.8, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'high_freq_constraint', sourceNodeIds: [], description: 'Technology barriers and limitations' },
        },
        {
          id: 'con-org', type: 'RISK_PROBE', status: 'active',
          prompt: 'What organisational constraints exist? Budget, structure, politics, competing priorities, change fatigue?',
          signalStrength: 0.75, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'high_freq_constraint', sourceNodeIds: [], description: 'Organisational barriers' },
        },
        {
          id: 'con-people', type: 'RISK_PROBE', status: 'active',
          prompt: 'What people constraints apply? Skills gaps, capacity, resistance to change, key-person dependencies?',
          signalStrength: 0.7, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'high_freq_constraint', sourceNodeIds: [], description: 'People barriers and limitations' },
        },
        {
          id: 'con-blockers', type: 'CONTRADICTION_PROBE', status: 'active',
          prompt: 'Which constraints are absolute blockers vs conditions to manage? Can we rank them by severity?',
          signalStrength: 0.65, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'risk_cluster', sourceNodeIds: [], description: 'Prioritise constraints by impact' },
        },
      ];

    case 'DEFINE_APPROACH':
      // Left-to-right: People → Organisation → Technology → Customer → Regulation
      return [
        {
          id: 'def-people', type: 'ENABLER_PROBE', status: 'active',
          prompt: 'What do the people need to make this work? Training, new roles, culture change, leadership support?',
          signalStrength: 0.9, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'weak_enabler', sourceNodeIds: [], description: 'People enablers — start from human needs' },
        },
        {
          id: 'def-org', type: 'ENABLER_PROBE', status: 'active',
          prompt: 'How does the organisation need to change? New processes, governance, reporting lines, partnerships?',
          signalStrength: 0.85, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'weak_enabler', sourceNodeIds: [], description: 'Organisation design for the solution' },
        },
        {
          id: 'def-tech', type: 'ENABLER_PROBE', status: 'active',
          prompt: 'What technology is needed to enable this? Build, buy, or integrate? What\'s the platform strategy?',
          signalStrength: 0.8, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'weak_enabler', sourceNodeIds: [], description: 'Technology enablers and choices' },
        },
        {
          id: 'def-customer', type: 'CUSTOMER_IMPACT', status: 'active',
          prompt: 'How do we prove the customer outcome? What does the customer journey look like in the new approach?',
          signalStrength: 0.75, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'missing_dimension', sourceNodeIds: [], description: 'Customer validation of approach' },
        },
        {
          id: 'def-regulation', type: 'OWNERSHIP_ACTION', status: 'active',
          prompt: 'How do we satisfy the regulatory requirements identified? What compliance steps are needed?',
          signalStrength: 0.7, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'missing_dimension', sourceNodeIds: [], description: 'Regulation compliance in the approach' },
        },
        {
          id: 'def-ownership', type: 'OWNERSHIP_ACTION', status: 'active',
          prompt: 'Who owns each workstream? What are the immediate next steps and who is accountable?',
          signalStrength: 0.65, createdAtMs: now, snoozedUntilMs: null,
          provenance: { triggerType: 'unanswered_question', sourceNodeIds: [], description: 'Assign ownership and next steps' },
        },
      ];
  }
}

// ══════════════════════════════════════════════════════════
// DEMO DATA — Only used for the retail reference workshop
// ══════════════════════════════════════════════════════════

const RETAIL_WORKSHOP_ID = 'retail-cx-workshop';

const DEMO_HEMISPHERE_NODES: HemisphereNodeDatum[] = (() => {
  const now = Date.now();
  const types: HemispherePrimaryType[] = ['VISIONARY', 'INSIGHT', 'CONSTRAINT', 'RISK', 'ENABLER', 'ACTION', 'QUESTION', 'OPPORTUNITY'];
  const phrases = [
    'We need a unified customer platform that brings everything together',
    'The current onboarding process takes 6 weeks — far too long',
    'Regulatory compliance is non-negotiable for any solution',
    'Our people are our biggest asset but they lack digital skills',
    'The legacy CRM cannot scale to handle our growth targets',
    'AI-driven personalisation could transform customer retention',
    'Who owns the data governance framework going forward?',
    'We should partner with fintech providers rather than build',
    'The customer expects a seamless omnichannel experience',
    'Budget constraints mean we need a phased approach',
    'Employee engagement scores have dropped 15% this year',
    'Cloud migration would unlock agility but needs board approval',
    'Our competitors are already 2 years ahead on digital',
    'The customer journey has 7 handoffs — each is a dropout risk',
    'We need clearer KPIs tied to business outcomes not activity',
  ];
  const domains = ['People', 'Operations', 'Customer', 'Technology', 'Regulation'];
  const keywords = [
    ['platform', 'unified', 'customer'], ['onboarding', 'process', 'time'], ['regulation', 'compliance'],
    ['people', 'skills', 'digital'], ['CRM', 'legacy', 'scale'], ['AI', 'personalisation', 'retention'],
    ['data', 'governance'], ['partner', 'fintech', 'build'], ['customer', 'omnichannel', 'seamless'],
    ['budget', 'phased', 'approach'], ['engagement', 'employee', 'scores'], ['cloud', 'migration', 'agility'],
    ['competitors', 'digital', 'ahead'], ['journey', 'handoffs', 'dropout'], ['KPIs', 'outcomes', 'business'],
  ];

  return phrases.map((text, i) => ({
    dataPointId: `demo-node-${i}`,
    createdAtMs: now - (phrases.length - i) * 30_000,
    rawText: text,
    dataPointSource: 'live_transcript',
    speakerId: `speaker-${(i % 4) + 1}`,
    dialoguePhase: null,
    intent: null,
    themeId: null,
    themeLabel: null,
    transcriptChunk: {
      speakerId: `speaker-${(i % 4) + 1}`,
      startTimeMs: i * 30_000,
      endTimeMs: (i + 1) * 30_000,
      confidence: 0.85 + Math.random() * 0.15,
      source: 'deepgram',
    },
    classification: {
      primaryType: types[i % types.length],
      confidence: 0.6 + Math.random() * 0.35,
      keywords: keywords[i],
      suggestedArea: domains[i % domains.length],
      updatedAt: new Date().toISOString(),
    },
    agenticAnalysis: {
      domains: [{ domain: domains[i % domains.length], relevance: 0.7 + Math.random() * 0.3, reasoning: 'Primary domain' }],
      themes: [{ label: keywords[i][0], category: 'theme', confidence: 0.8, reasoning: 'Key topic' }],
      actors: [],
      semanticMeaning: text,
      sentimentTone: ['positive', 'neutral', 'concerned'][i % 3],
      overallConfidence: 0.7 + Math.random() * 0.25,
    },
  }));
})();

// ══════════════════════════════════════════════════════════
// DEMO LIVE JOURNEY DATA
// ══════════════════════════════════════════════════════════

function getDemoLiveJourney(): LiveJourneyData {
  const now = Date.now();
  const mkI = (
    id: string, actor: string, stage: string, action: string, context: string,
    sentiment: LiveJourneyInteraction['sentiment'],
    bizInt: number, custInt: number,
    aiNow: LiveJourneyInteraction['aiAgencyNow'], aiFuture: LiveJourneyInteraction['aiAgencyFuture'],
    painPoint = false, mot = false,
  ): LiveJourneyInteraction => ({
    id, actor, stage, action, context, sentiment,
    businessIntensity: bizInt, customerIntensity: custInt,
    aiAgencyNow: aiNow, aiAgencyFuture: aiFuture,
    isPainPoint: painPoint, isMomentOfTruth: mot,
    sourceNodeIds: [], addedBy: 'ai', createdAtMs: now,
  });

  return {
    stages: DEFAULT_JOURNEY_STAGES.REIMAGINE,
    actors: [
      { name: 'End Customer', role: 'Primary user of the platform', mentionCount: 12 },
      { name: 'Frontline Staff', role: 'Customer-facing team members', mentionCount: 8 },
      { name: 'Store Manager', role: 'Operations leadership', mentionCount: 5 },
      { name: 'IT Team', role: 'Technology delivery', mentionCount: 6 },
    ],
    interactions: [
      // End Customer journey
      mkI('d1', 'End Customer', 'Discovery', 'Browses online', 'Exploring product options across channels', 'neutral', 0.25, 0.25, 'human', 'autonomous'),
      mkI('d2', 'End Customer', 'Discovery', 'Sees advertisement', 'Notices brand through targeted marketing', 'positive', 0.5, 0.25, 'assisted', 'autonomous'),
      mkI('d3', 'End Customer', 'Engagement', 'Visits store', 'Seeks personalised product advice', 'positive', 0.5, 0.5, 'human', 'assisted', false, true),
      mkI('d4', 'End Customer', 'Commitment', 'Completes purchase', 'Finalises transaction', 'neutral', 0.5, 0.5, 'human', 'autonomous'),
      mkI('d5', 'End Customer', 'Commitment', 'Experiences delay', 'Waits at checkout — friction point', 'critical', 0.75, 0.75, 'human', 'autonomous', true),
      mkI('d6', 'End Customer', 'Fulfilment', 'Receives order', 'Waits for delivery', 'neutral', 0.5, 0.5, 'human', 'assisted'),
      mkI('d7', 'End Customer', 'Support', 'Contacts support', 'Inquires about order status', 'concerned', 0.75, 0.75, 'human', 'autonomous', true),
      mkI('d8', 'End Customer', 'Growth', 'Joins loyalty program', 'Engages with brand long-term', 'positive', 0.25, 0.25, 'assisted', 'autonomous'),
      // Frontline Staff
      mkI('d9', 'Frontline Staff', 'Engagement', 'Provides recommendations', 'Offers personalised advice to customer', 'positive', 0.75, 0.25, 'human', 'assisted', false, true),
      mkI('d10', 'Frontline Staff', 'Engagement', 'Demonstrates product', 'Showcases features in-store', 'positive', 0.75, 0.5, 'human', 'assisted'),
      // Store Manager
      mkI('d11', 'Store Manager', 'Commitment', 'Handles checkout', 'Processes payment and manages queue', 'neutral', 0.75, 0.25, 'human', 'autonomous'),
      mkI('d12', 'Store Manager', 'Support', 'Addresses complaint', 'Resolves customer issue escalation', 'concerned', 0.75, 0.5, 'human', 'assisted'),
      // IT Team
      mkI('d13', 'IT Team', 'Fulfilment', 'Delivers package', 'Last-mile logistics coordination', 'neutral', 0.75, 0.5, 'assisted', 'autonomous'),
      mkI('d14', 'IT Team', 'Growth', 'Sends promotions', 'Automated engagement campaigns', 'positive', 0.5, 0.25, 'assisted', 'autonomous'),
    ],
  };
}


// (Synthesis data types moved to Discovery tab)

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export default function CognitiveGuidancePage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const isRetailDemo = workshopId === RETAIL_WORKSHOP_ID;

  // ── Core state ─────────────────────────────────────────
  const [cogNodes, setCogNodes] = useState<Map<string, CogNode>>(new Map());
  const [hemisphereNodes, setHemisphereNodes] = useState<Record<string, HemisphereNodeDatum>>({});
  const [stickyPads, setStickyPads] = useState<StickyPad[]>(() => getSeedPadsForPhase('REIMAGINE'));
  const [signals, setSignals] = useState<Signal[]>([]);
  const [lensCoverage, setLensCoverage] = useState<Map<Lens, LensCoverage>>(new Map());
  const [liveJourney, setLiveJourney] = useState<LiveJourneyData>(() =>
    isRetailDemo ? getDemoLiveJourney() : { stages: DEFAULT_JOURNEY_STAGES.REIMAGINE, actors: [], interactions: [] }
  );
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
  const [journeyExpanded, setJourneyExpanded] = useState(true);
  const [dialoguePhase, setDialoguePhase] = useState<DialoguePhase>('REIMAGINE');
  const [expandedNode, setExpandedNode] = useState<HemisphereNodeDatum | null>(null);
  const [hemisphereExpanded, setHemisphereExpanded] = useState(false);

  // (Synthesis data moved to Discovery tab)

  // ── Belief tracking for Stage 3 ────────────────────────
  const contradictionsRef = useRef<Array<{ id: string; beliefA: string; beliefB: string; resolved: boolean }>>([]);
  const stabilisedCountRef = useRef(0);
  const lastBufferedRunRef = useRef(0);
  const nodeCountSinceLastRunRef = useRef(0);

  const eventUrl = useMemo(
    () => `/api/workshops/${encodeURIComponent(workshopId)}/events`,
    [workshopId]
  );

  // ── Phase change → swap seed pads + journey stages ─────
  const handlePhaseChange = useCallback((phase: DialoguePhase) => {
    setDialoguePhase(phase);
    // Only replace with seed pads if not listening (no real data yet)
    if (!listening) {
      setStickyPads(getSeedPadsForPhase(phase));
      setSelectedPadId(null);
      // Update journey stages for the new phase
      setLiveJourney(prev => ({
        ...prev,
        stages: DEFAULT_JOURNEY_STAGES[phase],
      }));
    }
  }, [listening]);

  // (Synthesis data fetching moved to Discovery tab)

  // ── Buffered pipeline (Stages 3-5) ────────────────────
  const runBufferedPipeline = useCallback((nodes: CogNode[], nowMs: number) => {
    const nodesArr = nodes;

    // Stage 3: Gap & Signal Detection
    const detectedSignals = detectSignals(nodesArr, contradictionsRef.current, nowMs);
    setSignals(detectedSignals);

    // Stage 3 also: Lens Coverage
    const coverage = calculateLensCoverage(nodesArr);
    setLensCoverage(coverage);

    // Stage 4: Sticky Pad Generation (phase-aware)
    setStickyPads(prev => generateStickyPads(detectedSignals, prev, nowMs, dialoguePhase));

    // Stage 5: Live Journey Construction (progressive, preserves facilitator edits)
    setLiveJourney(prev => buildLiveJourney(nodesArr, prev, DEFAULT_JOURNEY_STAGES[dialoguePhase]));

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
  }, [dialoguePhase]);

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

  // Use demo nodes only for retail workshop; otherwise real nodes or empty
  const hemisphereNodeArray = useMemo(() => {
    const realNodes = Object.values(hemisphereNodes);
    if (realNodes.length > 0) return realNodes;
    return isRetailDemo ? DEMO_HEMISPHERE_NODES : [];
  }, [hemisphereNodes, isRetailDemo]);

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

  // (Radar chart / word cloud data transforms moved to Discovery tab)

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
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
                {PHASE_LABELS[dialoguePhase]} — {listening ? `${nodeCount} contributions captured` : 'Ready'}
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

        {/* Phase Selector — 3 workshop phases (Discovery is its own tab) */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-4">
          {(['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as DialoguePhase[]).map((phase) => (
            <button
              key={phase}
              onClick={() => handlePhaseChange(phase)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                dialoguePhase === phase
                  ? 'bg-white shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {PHASE_LABELS[phase]}
            </button>
          ))}
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

        {/* ═══ CONTEXT STRIP — Hemisphere + Signals side by side ═══ */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
          <div className="rounded-lg border bg-card p-2 relative group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-muted-foreground">Hemisphere</h3>
              <button
                onClick={() => setHemisphereExpanded(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                title="Expand hemisphere"
              >
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="h-[140px]">
              <HemisphereNodes
                nodes={hemisphereNodeArray}
                originTimeMs={null}
                onNodeClick={(node) => setExpandedNode(node)}
              />
            </div>
          </div>
          <SignalClusterPanel
            signals={signals}
            sessionConfidence={sessionConfidence}
          />
        </div>

        {/* ═══ LIVE JOURNEY MAP — Full width ═══ */}
        <div className="mt-4">
          <LiveJourneyMap
            data={liveJourney}
            onChange={setLiveJourney}
            expanded={journeyExpanded}
            onToggleExpand={() => setJourneyExpanded(e => !e)}
          />
        </div>

        {/* ═══ EXPANDED HEMISPHERE MODAL ═══ */}
        {hemisphereExpanded && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setHemisphereExpanded(false); }}
          >
            <div className="relative w-[90vw] max-w-4xl bg-card rounded-xl shadow-2xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
                <h2 className="text-sm font-semibold">Hemisphere — All Contributions</h2>
                <button
                  onClick={() => setHemisphereExpanded(false)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4" style={{ height: '70vh' }}>
                <HemisphereNodes
                  nodes={hemisphereNodeArray}
                  originTimeMs={null}
                  onNodeClick={(node) => { setExpandedNode(node); }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══ NODE DETAIL MODAL ═══ */}
        {expandedNode && (
          <NodeDetailModal
            node={expandedNode}
            onClose={() => setExpandedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// NODE DETAIL MODAL
// ══════════════════════════════════════════════════════════

const NODE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  VISIONARY:    { bg: '#f5f3ff', text: '#6d28d9', border: '#8b5cf6' },
  OPPORTUNITY:  { bg: '#eff6ff', text: '#1d4ed8', border: '#3b82f6' },
  CONSTRAINT:   { bg: '#fff7ed', text: '#c2410c', border: '#f97316' },
  RISK:         { bg: '#fef2f2', text: '#b91c1c', border: '#ef4444' },
  ENABLER:      { bg: '#f0fdfa', text: '#0d9488', border: '#14b8a6' },
  INSIGHT:      { bg: '#ecfdf5', text: '#059669', border: '#10b981' },
  ACTION:       { bg: '#fffbeb', text: '#b45309', border: '#f59e0b' },
  QUESTION:     { bg: '#f0f9ff', text: '#0369a1', border: '#0ea5e9' },
};

function NodeDetailModal({ node, onClose }: { node: HemisphereNodeDatum; onClose: () => void }) {
  const cls = node.classification;
  const analysis = node.agenticAnalysis;
  const type = cls?.primaryType ?? 'INSIGHT';
  const colors = NODE_TYPE_COLORS[type] ?? NODE_TYPE_COLORS.INSIGHT;
  const confidence = cls?.confidence;
  const keywords = cls?.keywords ?? [];
  const domains = analysis?.domains ?? [];
  const themes = analysis?.themes ?? [];
  const actors = analysis?.actors ?? [];
  const sentiment = analysis?.sentimentTone;
  const meaning = analysis?.semanticMeaning;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-[90vw] max-w-lg rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: colors.bg, border: `2px solid ${colors.border}` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: `1px solid ${colors.border}33` }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: colors.border, color: '#fff' }}
            >
              {type}
            </span>
            {confidence != null && (
              <span className="text-xs font-medium" style={{ color: colors.text }}>
                {(confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors hover:bg-black/5"
          >
            <X className="h-4 w-4" style={{ color: colors.text }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Raw text — the main quote */}
          <p className="text-base font-medium leading-relaxed" style={{ color: colors.text }}>
            &ldquo;{node.rawText}&rdquo;
          </p>

          {/* Semantic meaning */}
          {meaning && meaning !== node.rawText && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-60" style={{ color: colors.text }}>
                Interpretation
              </h4>
              <p className="text-sm" style={{ color: colors.text }}>
                {meaning}
              </p>
            </div>
          )}

          {/* Keywords */}
          {keywords.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-60" style={{ color: colors.text }}>
                Keywords
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${colors.border}20`, color: colors.text, border: `1px solid ${colors.border}40` }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Domains */}
          {domains.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-60" style={{ color: colors.text }}>
                Domains
              </h4>
              <div className="space-y-1.5">
                {domains.map((d) => (
                  <div key={d.domain} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-medium" style={{ color: colors.text }}>{d.domain}</span>
                        <span className="opacity-60" style={{ color: colors.text }}>{(d.relevance * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.border}20` }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${d.relevance * 100}%`, backgroundColor: colors.border }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Themes */}
          {themes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-60" style={{ color: colors.text }}>
                Themes
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {themes.map((t) => (
                  <span
                    key={t.label}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${colors.border}20`, color: colors.text, border: `1px solid ${colors.border}40` }}
                  >
                    {t.label} ({(t.confidence * 100).toFixed(0)}%)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actors */}
          {actors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-60" style={{ color: colors.text }}>
                Actors
              </h4>
              <div className="space-y-1">
                {actors.map((a) => (
                  <div key={a.name} className="text-xs" style={{ color: colors.text }}>
                    <span className="font-semibold">{a.name}</span>
                    {a.role ? <span className="opacity-60"> — {a.role}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: sentiment + speaker + time */}
          <div
            className="flex items-center justify-between pt-3 text-xs opacity-60"
            style={{ borderTop: `1px solid ${colors.border}22`, color: colors.text }}
          >
            <div className="flex items-center gap-3">
              {sentiment && (
                <span className="capitalize">{sentiment}</span>
              )}
              {node.speakerId && (
                <span>Speaker: {node.speakerId.replace('speaker-', '#')}</span>
              )}
            </div>
            {node.transcriptChunk?.startTimeMs != null && (
              <span>{formatTimeMs(node.transcriptChunk.startTimeMs)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// (Synthesis components moved to Discovery tab)

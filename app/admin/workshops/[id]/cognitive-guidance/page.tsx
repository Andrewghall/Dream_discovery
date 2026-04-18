'use client';

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ChevronRight, Radio, Square, X, Maximize2, Zap, Loader2, Check, History } from 'lucide-react';
import {
  HemisphereNodes,
  type HemisphereNodeDatum,
  type HemispherePrimaryType,
} from '@/components/live/hemisphere-nodes';

import {
  type CogNode,
  type StickyPad,
  type StickyPadType,
  type Signal,
  type LensCoverage,
  type Lens,
  type SessionConfidence,
  type DialoguePhase,
  type LiveJourneyData,
  ALL_PHASES,
  PHASE_LABELS,
  DEFAULT_JOURNEY_STAGES,
  getBlueprintJourneyStages,
  createInitialNode,
  categoriseNode,
  applyLensMapping,
  inferKeywordLenses,
  LENS_TO_DOMAIN,
  buildKeywordLensMap,
  buildLensToDomain,
  calculateLensCoverage,
  detectSignals,
  generateStickyPads,
  buildLiveJourney,
  calculateSessionConfidence,
  calculateQuestionCoverage,
} from '@/lib/cognitive-guidance/pipeline';

import { StickyPadCanvas } from '@/components/cognitive-guidance/sticky-pad-canvas';
import { MainQuestionCard } from '@/components/cognitive-guidance/featured-question-card';
import LensCoverageBar from '@/components/cognitive-guidance/lens-coverage-bar';
import GapIndicatorStrip from '@/components/cognitive-guidance/gap-indicator-strip';
import DataSufficiencyBar from '@/components/cognitive-guidance/data-sufficiency-bar';
import MetricContradictionAlert from '@/components/cognitive-guidance/metric-contradiction-alert';
import SignalClusterPanel from '@/components/cognitive-guidance/signal-cluster-panel';
import {
  AgentOrchestrationPanel,
  type AgentConversationEntry,
} from '@/components/cognitive-guidance/agent-orchestration-panel';
import type { GuidedTheme } from '@/lib/cognition/guidance-state';
import type { WorkshopPhase, FacilitationQuestion, SubQuestion, WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';
import { getDimensionColors, darkenHex, lightenHex } from '@/lib/cognition/workshop-dimensions';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import { useAudioCapture } from '@/hooks/use-audio-capture';
import type { StreamTranscript } from '@/lib/captureapi/client';
import { MicSetupDialog } from '@/components/cognitive-guidance/mic-setup-dialog';
import VersionHistoryPanel from '@/components/cognitive-guidance/version-history-panel';
import type { LiveSessionVersionPayload } from '@/lib/cognitive-guidance/pipeline';
import { toast } from 'sonner';
import {
  COVERAGE_THRESHOLD,
  dialoguePhaseToWorkshopPhase,
  lensToStickyPadType,
  buildSessionPadsFromPrep,
  seedPad,
  getSeedPadsForPhase,
  type PrepQuestion,
  type PrepPhaseData,
  type PrepQuestionSet,
} from './_utils/guidance-helpers';
import { NodeDetailModal } from './_components/NodeDetailModal';

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
  // NOTE: Do NOT use Date.now() or Math.random() in useState initialisers —
  // they cause React hydration mismatch (#418) because server and client get different values.
  // Seed data is populated in a client-only useEffect below.
  const [stickyPads, setStickyPads] = useState<StickyPad[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [lensCoverage, setLensCoverage] = useState<Map<Lens, LensCoverage>>(new Map());
  const [dialoguePhase, setDialoguePhase] = useState<DialoguePhase>('REIMAGINE');
  const [liveJourney, setLiveJourney] = useState<LiveJourneyData>(
    { stages: DEFAULT_JOURNEY_STAGES.REIMAGINE, actors: [], interactions: [] },
  );
  const [sessionConfidence, setSessionConfidence] = useState<SessionConfidence>({
    overallConfidence: 0,
    categorisedRate: 0,
    lensCoverageRate: 0,
    contradictionCount: 0,
    stabilisedBeliefCount: 0,
  });

  // ── Data sufficiency tracking ────────────────────────
  const [dataSufficiency, setDataSufficiency] = useState({
    hasResearch: false,
    hasDiscoveryBriefing: false,
    hasBlueprint: false,
    hasHistoricalMetrics: false,
    metricsCount: 0,
  });
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // ── SSE state ──────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  // ── Auto-save to LiveWorkshopSnapshot ─────────────────
  const [workshopName, setWorkshopName] = useState<string>('');
  const [cgSnapshots, setCgSnapshots] = useState<Array<{ id: string; name: string; dialoguePhase: string }>>([]);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);
  const [lastSavedSnapshotId, setLastSavedSnapshotId] = useState<string | null>(null);

  // ── Versioned session auto-save (full state, every 30s) ──
  const [sessionVersions, setSessionVersions] = useState<Array<{
    id: string; version: number; dialoguePhase: string; label: string | null; createdAt: string;
  }>>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [versionSaveStatus, setVersionSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastVersionHashRef = useRef('');
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  const versionUrl = useMemo(
    () => `/api/admin/workshops/${encodeURIComponent(workshopId)}/live/session-versions`,
    [workshopId]
  );

  const snapshotUrl = useMemo(
    () => `/api/admin/workshops/${encodeURIComponent(workshopId)}/live/snapshots`,
    [workshopId]
  );

  // ── Audio capture + mic setup ─────────────────────────
  const dialoguePhaseRef = useRef<DialoguePhase>('REIMAGINE');
  const blueprintStagesRef = useRef<Array<{ name: string }> | null>(null);
  const blueprintLensNamesRef = useRef<string[]>([]);
  const [blueprintLensNames, setBlueprintLensNames] = useState<string[]>([]);
  const customKeywordMapRef = useRef<[string, RegExp][] | null>(null);
  const customLensToDomainRef = useRef<Record<string, string> | null>(null);

  // Live hemisphere nodes — updated in real-time from CaptureAPI token stream.
  // One "live" node per speaker that updates as words stream in, then removed
  // when speechFinal fires (permanent node arrives from backend SSE/polling).
  const liveNodesBySpeaker = useRef<Map<string, string>>(new Map()); // speakerId → liveId

  const handleTranscriptStream = useCallback((msg: StreamTranscript) => {
    const text = (msg.rawText?.trim() || msg.cleanText?.trim() || '');
    if (!text) return;
    const speakerId = msg.speaker !== null ? `speaker_${msg.speaker}` : 'speaker_0';
    const liveId = `live:${speakerId}`;

    if (msg.speechFinal) {
      // Utterance complete — remove live node.
      // The permanent node will arrive via datapoint.created SSE from the backend POST.
      liveNodesBySpeaker.current.delete(speakerId);
      setHemisphereNodes(prev => {
        if (!prev[liveId]) return prev;
        const next = { ...prev };
        delete next[liveId];
        return next;
      });
      return;
    }

    // Only show on hemisphere if 4+ words (filter noise fragments)
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 4) return;

    // Run keyword inference on the growing text
    const kwLensResults = text.length >= 3 ? inferKeywordLenses(text, customKeywordMapRef.current) : [];
    const kwDomains = kwLensResults.map(kw => ({
      domain: (customLensToDomainRef.current ?? LENS_TO_DOMAIN)[kw.lens] ?? kw.lens,
      relevance: Math.min(0.95, kw.relevance + 0.4),
      reasoning: kw.evidence,
    })).filter(d => !!d.domain);

    const hNode: HemisphereNodeDatum = {
      dataPointId: liveId,
      createdAtMs: Date.now(),
      rawText: text,
      dataPointSource: 'SPEECH',
      speakerId,
      dialoguePhase: (['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as const).includes(
        dialoguePhaseRef.current as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH'
      )
        ? (dialoguePhaseRef.current as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH')
        : null,
      transcriptChunk: null,
      classification: null,
      agenticAnalysis: kwDomains.length > 0 ? {
        domains: kwDomains,
        themes: [],
        actors: [],
        semanticMeaning: '',
        sentimentTone: 'neutral',
        overallConfidence: 0.5,
      } : null,
    };

    liveNodesBySpeaker.current.set(speakerId, liveId);
    setHemisphereNodes(prev => ({ ...prev, [liveId]: hNode }));
  }, []);

  const audio = useAudioCapture({
    workshopId,
    getDialoguePhase: () => dialoguePhaseRef.current,
    onTranscriptStream: handleTranscriptStream,
  });
  const [micDialogOpen, setMicDialogOpen] = useState(false);

  // ── UI state ───────────────────────────────────────────
  const [selectedPadId, setSelectedPadId] = useState<string | null>(null);
  // Keep ref in sync for the audio capture hook (avoids stale closure)
  useEffect(() => { dialoguePhaseRef.current = dialoguePhase; }, [dialoguePhase]);
  const [expandedNode, setExpandedNode] = useState<HemisphereNodeDatum | null>(null);
  const [hemisphereExpanded, setHemisphereExpanded] = useState(false);

  // ── Theme + Agent state ─────────────────────────────────
  const [themes, setThemes] = useState<GuidedTheme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [freeflowMode, setFreeflowMode] = useState(false);
  const [agentConversation, setAgentConversation] = useState<AgentConversationEntry[]>([]);
  const [agentPanelCollapsed, setAgentPanelCollapsed] = useState(false);

  // ── Prep question set (loaded from DB on mount) ────────
  const prepQuestionsRef = useRef<PrepQuestionSet | null>(null);
  const [prepQuestionsVersion, setPrepQuestionsVersion] = useState(0); // bumped when ref is set to trigger useMemo
  const [prepLoaded, setPrepLoaded] = useState(false);

  // ── "Peeling the Onion" — main question navigation ─────
  const [mainQuestionIndex, setMainQuestionIndex] = useState(0);
  const [completedByQuestion, setCompletedByQuestion] = useState<Map<number, StickyPad[]>>(new Map());
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  // ── Dynamic lens colors from research dimensions ──
  const [customLensColors, setCustomLensColors] = useState<Record<string, { bg: string; text: string; accent: string; label: string }> | undefined>(undefined);

  // ── Blueprint source indicator (transparency) ──
  const [blueprintSource, setBlueprintSource] = useState<'blueprint' | 'research_override' | 'legacy_fallback'>('legacy_fallback');

  // ── Client-only: populate seed data after hydration (avoids React #418) ──
  useEffect(() => {
    setStickyPads(prev => prev.length === 0 ? getSeedPadsForPhase('REIMAGINE').slice(0, 4) : prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Main questions for current phase (derived from prep data) ──
  const mainQuestions = useMemo(() => {
    const prep = prepQuestionsRef.current;
    if (!prep) return [];
    const wp = dialoguePhaseToWorkshopPhase(dialoguePhase);
    if (!wp) return [];
    const phaseData = prep.phases?.[wp];
    if (!phaseData?.questions?.length) return [];
    return [...phaseData.questions].sort((a, b) => a.order - b.order);
  }, [dialoguePhase, prepQuestionsVersion]);

  const currentMainQ = mainQuestions[mainQuestionIndex] ?? null;

  // ── Convert a main question's sub-questions into StickyPads ──
  // If the question has prep-generated sub-questions, use those.
  // Otherwise, generate starter sub-pads from the question's lens + phase lenses
  // so there's always something on screen to kick off discussion.
  const loadPrepSubPads = useCallback((question: PrepQuestion, qIndex: number): StickyPad[] => {
    const now = Date.now();

    // Use prep sub-questions if they exist
    if (question.subQuestions?.length) {
      return question.subQuestions.map((sq, i) => ({
        id: `sub:${sq.id}`,
        type: lensToStickyPadType(sq.lens),
        prompt: sq.text,
        signalStrength: 0.9 - (i * 0.05),
        provenance: {
          triggerType: 'repeated_theme' as const,
          sourceNodeIds: [] as string[],
          description: sq.purpose,
        },
        createdAtMs: now,
        status: 'active' as const,
        snoozedUntilMs: null,
        source: 'prep' as const,
        questionId: question.id,
        grounding: sq.purpose,
        coveragePercent: 0,
        coverageState: (i < 4 ? 'active' : 'queued') as StickyPad['coverageState'],
        lens: sq.lens || null,
        mainQuestionIndex: qIndex,
        journeyGapId: null,
        padLabel: null,
      }));
    }

    // Fallback: generate starter sub-pads from the question itself
    // Use the question's lens + the phase's lens order to create 2-3 probes
    const prep = prepQuestionsRef.current;
    const wp = dialoguePhaseToWorkshopPhase(dialoguePhase);
    const phaseLenses = wp && prep?.phases?.[wp]?.lensOrder
      ? prep.phases[wp].lensOrder
      : blueprintLensNamesRef.current.slice(0, 3);

    // Pick the question's own lens + 1-2 from phase lens order
    const qLens = question.lens || 'General';
    const otherLenses = phaseLenses.filter((l) => l !== qLens).slice(0, 2);
    const starterLenses = [qLens, ...otherLenses];

    // Phase-specific starter prompts — REIMAGINE = pure vision, no constraints
    const phasePrompts: Record<string, Record<string, string>> = {
      REIMAGINE: {
        People: 'In the ideal world, how would people experience this? Describe the perfect day.',
        Organisation: 'What would the ideal points of engagement look like — with no friction at all?',
        Customer: 'Describe the perfect experience from the customer\'s perspective — what does amazing look like?',
        Technology: 'If technology were limitless, what would this look like?',
        Regulation: 'Imagine a world with no regulatory barriers — what becomes possible?',
        General: 'Paint the picture — what does the ideal future state look like here?',
      },
      CONSTRAINTS: {
        People: 'What people-related limitations stand between today and that vision?',
        Organisation: 'What organisational constraints — structure, budget, politics — block progress here?',
        Customer: 'What customer-side barriers exist? Adoption, behaviour, access?',
        Technology: 'What technology constraints are we dealing with — legacy systems, integration, data?',
        Regulation: 'What regulatory or compliance requirements must we work within here?',
        General: 'What\'s the biggest blocker standing in the way?',
      },
      DEFINE_APPROACH: {
        People: 'What do the people need to make this work? Skills, roles, ways of working?',
        Organisation: 'How does the organisation need to change to deliver this?',
        Customer: 'How do we prove the customer outcome? What does the journey look like in practice?',
        Technology: 'What technology enables this approach? Build, buy, or integrate?',
        Regulation: 'How do we satisfy the regulatory requirements while still delivering the vision?',
        General: 'Who owns this and what\'s the first step?',
      },
    };

    const prompts = phasePrompts[dialoguePhase] || phasePrompts.REIMAGINE;

    return starterLenses.map((lens, i) => ({
      id: `auto:${question.id}:${lens.toLowerCase()}`,
      type: lensToStickyPadType(lens),
      prompt: prompts[lens] || `Explore this from the ${lens} lens`,
      signalStrength: 0.85 - (i * 0.05),
      provenance: {
        triggerType: 'repeated_theme' as const,
        sourceNodeIds: [] as string[],
        description: `Auto-generated starter for "${question.text}" — ${lens} lens`,
      },
      createdAtMs: now,
      status: 'active' as const,
      snoozedUntilMs: null,
      source: 'prep' as const,
      questionId: question.id,
      grounding: question.purpose,
      coveragePercent: 0,
      coverageState: 'active' as StickyPad['coverageState'],
      lens,
      mainQuestionIndex: qIndex,
      journeyGapId: null,
      padLabel: null,
    }));
  }, [dialoguePhase]);

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

  // ── Guidance state sync → POST to server ─────────────
  const syncGuidanceState = useCallback(async (
    overrides: {
      activeThemeId?: string | null;
      themes?: GuidedTheme[];
      freeflowMode?: boolean;
      dialoguePhase?: DialoguePhase;
      currentMainQuestion?: { text: string; lens: string | null; purpose: string; grounding: string; phase: string } | null;
    } = {},
  ) => {
    try {
      await fetch(`/api/workshops/${workshopId}/guidance-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeThemeId: overrides.activeThemeId ?? activeThemeId,
          themes: overrides.themes ?? themes,
          freeflowMode: overrides.freeflowMode ?? freeflowMode,
          dialoguePhase: overrides.dialoguePhase ?? dialoguePhase,
          ...(overrides.currentMainQuestion !== undefined && { currentMainQuestion: overrides.currentMainQuestion }),
        }),
      });
    } catch { /* fail silently — non-critical */ }
  }, [workshopId, activeThemeId, themes, freeflowMode, dialoguePhase]);

  // ── Phase change → swap seed pads + journey stages ─────
  const handlePhaseChange = useCallback((phase: DialoguePhase) => {
    setDialoguePhase((prevPhase) => {
      setLiveJourney((prevJourney) => {
        // Stamp phaseAdded on any interactions that don't yet have it
        const stamped = prevJourney.interactions.map((i) => ({
          ...i,
          phaseAdded: i.phaseAdded ?? prevPhase,
          // When leaving REIMAGINE, snapshot ideal intensity values for comparison in later phases
          ...(prevPhase === 'REIMAGINE' && !i.idealBusinessIntensity ? {
            idealBusinessIntensity: i.businessIntensity,
            idealCustomerIntensity: i.customerIntensity,
          } : {}),
        }));
        return {
          ...prevJourney,
          stages: getBlueprintJourneyStages(phase, blueprintStagesRef.current),
          interactions: stamped,
        };
      });
      return phase;
    });

    // Reset main question navigation for new phase
    setMainQuestionIndex(0);
    setCompletedByQuestion(new Map());

    // Derive phase questions for the new phase
    const prep = prepQuestionsRef.current;
    const wp = dialoguePhaseToWorkshopPhase(phase);
    const phaseQuestions = wp && prep?.phases?.[wp]?.questions
      ? [...prep.phases[wp].questions].sort((a, b) => a.order - b.order)
      : [];

    // Only replace with seed/prep pads if not listening (no real data yet)
    if (!listening) {
      if (phaseQuestions.length > 0) {
        // Load sub-pads for the first main question (auto-generates starters if no prep subs)
        const subPads = loadPrepSubPads(phaseQuestions[0], 0);
        setStickyPads(subPads.length > 0 ? subPads : getSeedPadsForPhase(phase).slice(0, 4));
      } else {
        setStickyPads(getSeedPadsForPhase(phase).slice(0, 4));
      }
      setSelectedPadId(null);
    }

    // Sync to server — include the first main question as the new goal
    const firstQ = phaseQuestions[0];
    syncGuidanceState({
      dialoguePhase: phase,
      currentMainQuestion: firstQ
        ? { text: firstQ.text, lens: firstQ.lens || null, purpose: firstQ.purpose, grounding: firstQ.grounding, phase: firstQ.phase }
        : null,
    });
  }, [listening, syncGuidanceState, loadPrepSubPads]);

  // ── "Peeling the Onion" question navigation ─────────────
  const handleNextQuestion = useCallback(() => {
    // Archive current sub-pads into completedByQuestion
    const activeSubs = stickyPads.filter(
      (p) => p.mainQuestionIndex === mainQuestionIndex && p.source !== 'seed',
    );
    if (activeSubs.length > 0) {
      setCompletedByQuestion((prev) => {
        const next = new Map(prev);
        next.set(mainQuestionIndex, [...(prev.get(mainQuestionIndex) || []), ...activeSubs]);
        return next;
      });
    }

    const nextIdx = mainQuestionIndex + 1;
    if (nextIdx >= mainQuestions.length) return; // already at last question

    setMainQuestionIndex(nextIdx);

    // Load prep sub-pads for the next main question
    const nextQ = mainQuestions[nextIdx];
    if (nextQ) {
      const subPads = loadPrepSubPads(nextQ, nextIdx);
      // Keep signal/seed pads, remove old main-question sub-pads, add new ones
      setStickyPads((prev) => {
        const kept = prev.filter(
          (p) => p.source === 'signal' || p.source === 'seed' || p.mainQuestionIndex !== mainQuestionIndex,
        );
        return [...kept, ...subPads];
      });
      // Sync new main question goal to server so agents target it
      syncGuidanceState({
        currentMainQuestion: { text: nextQ.text, lens: nextQ.lens || null, purpose: nextQ.purpose, grounding: nextQ.grounding, phase: nextQ.phase },
      });
    }
  }, [mainQuestionIndex, mainQuestions, stickyPads, loadPrepSubPads, syncGuidanceState]);

  const handlePrevQuestion = useCallback(() => {
    if (mainQuestionIndex <= 0) return;
    const prevIdx = mainQuestionIndex - 1;
    setMainQuestionIndex(prevIdx);

    // Restore completed sub-pads from history
    const restored = completedByQuestion.get(prevIdx) || [];
    const prevQ = mainQuestions[prevIdx];
    const freshSubs = prevQ ? loadPrepSubPads(prevQ, prevIdx) : [];
    const subsToUse = restored.length > 0 ? restored : freshSubs;

    setStickyPads((prev) => {
      const kept = prev.filter(
        (p) => p.source === 'signal' || p.source === 'seed' || p.mainQuestionIndex !== mainQuestionIndex,
      );
      return [...kept, ...subsToUse];
    });

    // Sync previous main question goal to server
    if (prevQ) {
      syncGuidanceState({
        currentMainQuestion: { text: prevQ.text, lens: prevQ.lens || null, purpose: prevQ.purpose, grounding: prevQ.grounding, phase: prevQ.phase },
      });
    }
  }, [mainQuestionIndex, mainQuestions, completedByQuestion, stickyPads, loadPrepSubPads, syncGuidanceState]);

  // ── Theme management callbacks ──────────────────────────
  const handleAdvanceTheme = useCallback(() => {
    setThemes((prev) => {
      const currentActive = prev.find((t) => t.id === activeThemeId);
      const queued = prev.filter((t) => t.status === 'queued').sort((a, b) => a.order - b.order);

      let updated = prev;
      // Complete current active theme
      if (currentActive) {
        updated = updated.map((t) =>
          t.id === currentActive.id
            ? { ...t, status: 'completed' as const, completedAtMs: Date.now() }
            : t,
        );
      }

      // Activate next queued theme
      const next = queued[0];
      if (next) {
        updated = updated.map((t) =>
          t.id === next.id
            ? { ...t, status: 'active' as const, startedAtMs: Date.now() }
            : t,
        );
        setActiveThemeId(next.id);
        syncGuidanceState({ activeThemeId: next.id, themes: updated });
      } else {
        setActiveThemeId(null);
        syncGuidanceState({ activeThemeId: null, themes: updated });
      }

      return updated;
    });
  }, [activeThemeId, syncGuidanceState]);

  const handleToggleFreeflow = useCallback(() => {
    setFreeflowMode((prev) => {
      const next = !prev;
      syncGuidanceState({ freeflowMode: next });
      return next;
    });
  }, [syncGuidanceState]);

  const handleAddTheme = useCallback((title: string) => {
    const newTheme: GuidedTheme = {
      id: `theme-${Date.now()}`,
      title,
      description: '',
      lens: null,
      source: 'facilitator',
      status: 'queued',
      order: themes.length,
      startedAtMs: null,
      completedAtMs: null,
      sourceSignalIds: [],
    };
    setThemes((prev) => {
      const updated = [...prev, newTheme];
      syncGuidanceState({ themes: updated });
      return updated;
    });
  }, [themes.length, syncGuidanceState]);

  // (Synthesis data fetching moved to Discovery tab)

  // ── Init: load prep questions from DB on mount ─────────
  useEffect(() => {
    fetch(`/api/workshops/${workshopId}/guidance-state?init=true`)
      .then((r) => r.json())
      .then((data) => {
        // Build dynamic lens colors: blueprint lenses > research dimensions > defaults.
        // Blueprint already incorporates research overrides plus industry-specific
        // lenses (e.g. airline contact centre), so it is the preferred source.
        const bpJson = data.guidanceState?.blueprint;
        const bp = bpJson ? readBlueprintFromJson(bpJson) : null;
        const research = data.guidanceState?.prepContext?.research as WorkshopPrepResearch | null | undefined;

        if (bp?.lenses?.length) {
          // Build color map from blueprint lenses (same shape as getDimensionColors)
          const bpColors: Record<string, { bg: string; text: string; accent: string; label: string }> = {};
          for (const lens of bp.lenses) {
            bpColors[lens.name] = {
              bg: lens.color,
              text: darkenHex(lens.color),
              accent: lightenHex(lens.color),
              label: lens.name,
            };
          }
          bpColors['General'] = { bg: '#e2e8f0', text: '#1e293b', accent: '#cbd5e1', label: 'Explore' };
          setCustomLensColors(bpColors);
          setBlueprintSource('blueprint');
        } else if (research?.industryDimensions?.length) {
          setCustomLensColors(getDimensionColors(research));
          setBlueprintSource('research_override');
        } else {
          setBlueprintSource('legacy_fallback');
        }

        // Populate lens names + keyword maps from blueprint
        if (bp?.lenses?.length) {
          const names = bp.lenses.map(l => l.name);
          blueprintLensNamesRef.current = names;
          setBlueprintLensNames(names);
          const customDimensions = bp.lenses.map(l => ({ name: l.name, keywords: l.keywords }));
          customKeywordMapRef.current = buildKeywordLensMap(customDimensions);
          customLensToDomainRef.current = buildLensToDomain(bp.lenses.map(l => l.name));
        }
        if (bp?.journeyStages?.length) {
          blueprintStagesRef.current = bp.journeyStages;
          setLiveJourney(prev => ({
            ...prev,
            stages: bp.journeyStages.map(s => s.name),
          }));
        }
        if (bp?.actorTaxonomy?.length) {
          setLiveJourney(prev => ({
            ...prev,
            actors: bp.actorTaxonomy.map(a => ({
              name: a.label,
              role: a.description,
              mentionCount: 0,
            })),
          }));
        }

        // Populate data sufficiency from guidance state
        const gs = data.guidanceState;
        if (gs) {
          setDataSufficiency({
            hasResearch: !!gs.prepContext?.research,
            hasDiscoveryBriefing: !!gs.prepContext?.discoveryIntelligence,
            hasBlueprint: !!gs.blueprint,
            hasHistoricalMetrics: !!gs.historicalMetrics,
            metricsCount: gs.historicalMetrics?.series?.length ?? 0,
          });
        }

        if (data.customQuestions && typeof data.customQuestions === 'object') {
          const cq = data.customQuestions as PrepQuestionSet;
          prepQuestionsRef.current = cq;
          setPrepQuestionsVersion(v => v + 1); // trigger useMemo re-run (refs don't cause re-renders)

          // "Peeling the Onion": load sub-pads for the first main question
          const wp = dialoguePhaseToWorkshopPhase(dialoguePhase);
          const phaseQuestions = wp && cq.phases?.[wp]?.questions
            ? [...cq.phases[wp].questions].sort((a, b) => a.order - b.order)
            : [];

          if (phaseQuestions.length > 0) {
            // Load sub-pads for first main question (index 0)
            const subPads = loadPrepSubPads(phaseQuestions[0], 0);
            if (subPads.length > 0) {
              setStickyPads(subPads);
            } else {
              // No sub-pads generated — fall back to old model
              const prepPads = buildSessionPadsFromPrep(cq, dialoguePhase).slice(0, 4);
              if (prepPads.length > 0) setStickyPads(prepPads);
            }
            // Sync first main question as the goal for agents
            const firstQ = phaseQuestions[0];
            syncGuidanceState({
              currentMainQuestion: { text: firstQ.text, lens: firstQ.lens || null, purpose: firstQ.purpose, grounding: firstQ.grounding, phase: firstQ.phase },
            });
          } else {
            const prepPads = buildSessionPadsFromPrep(cq, dialoguePhase).slice(0, 4);
            if (prepPads.length > 0) setStickyPads(prepPads);
          }
        }
        setPrepLoaded(true);
      })
      .catch(() => { setPrepLoaded(true); /* fall back to seed pads — already set */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]); // Only on mount

  // ── Auto-advance: move to next question when coverage threshold reached ──
  useEffect(() => {
    const activePad = stickyPads.find((p) => p.coverageState === 'active' && p.source === 'prep');
    if (!activePad || activePad.coveragePercent < COVERAGE_THRESHOLD) return;

    setStickyPads((prev) => {
      // Mark current active as covered
      const updated = prev.map((p) =>
        p.id === activePad.id ? { ...p, coverageState: 'covered' as const } : p,
      );

      // Find next queued pad and activate it
      const nextQueued = updated
        .filter((p) => p.coverageState === 'queued')
        .sort((a, b) => b.signalStrength - a.signalStrength)[0];

      if (nextQueued) {
        return updated.map((p) =>
          p.id === nextQueued.id ? { ...p, coverageState: 'active' as const } : p,
        );
      }

      return updated;
    });
  }, [stickyPads]);

  // ── Buffered pipeline (Stages 3-5) ────────────────────
  const runBufferedPipeline = useCallback((nodes: CogNode[], nowMs: number) => {
    const nodesArr = nodes;

    // Stage 3: Gap & Signal Detection
    const detectedSignals = detectSignals(nodesArr, contradictionsRef.current, nowMs, blueprintLensNamesRef.current.length ? blueprintLensNamesRef.current : undefined);
    setSignals(detectedSignals);

    // Stage 3 also: Lens Coverage
    const coverage = calculateLensCoverage(nodesArr, blueprintLensNamesRef.current.length ? blueprintLensNamesRef.current : undefined);
    setLensCoverage(coverage);

    // Stage 4: Sticky Pad Generation (phase-aware) — only for signal-generated pads
    setStickyPads(prev => {
      // Generate new signal pads
      const bpReimagineSet = blueprintLensNamesRef.current.length
        ? new Set(blueprintLensNamesRef.current)
        : undefined;
      const withSignals = generateStickyPads(detectedSignals, prev, nowMs, dialoguePhase, bpReimagineSet);

      // Calculate coverage for all sub-pads (prep, agent, signal — not seeds)
      return withSignals.map((pad) => {
        if (!pad.prompt || pad.source === 'seed') return pad;
        const newCoverage = calculateQuestionCoverage(pad, nodesArr);
        return { ...pad, coveragePercent: Math.max(pad.coveragePercent, newCoverage) };
      });
    });

    // Stage 5: Live Journey Construction (progressive, preserves facilitator edits)
    // phaseAdded is stamped on each new interaction so Output can filter by phase
    setLiveJourney(prev => buildLiveJourney(nodesArr, prev, getBlueprintJourneyStages(dialoguePhase, blueprintStagesRef.current), dialoguePhase));

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

        // ── Hemisphere node — only for meaningful phrases ──
        // Short fragments ("Just see.", "the", "in particular") are noise.
        // Require at least 4 words to appear as a dot on the hemisphere.
        const nodeRawText = String(p.dataPoint.rawText ?? '');
        const wordCount = nodeRawText.trim().split(/\s+/).filter(w => w.length > 0).length;

        if (wordCount >= 4) {
          // Run keyword inference so dots position correctly
          // (CaptureAPI sends raw transcripts with no domain classification)
          const kwLensResults = nodeRawText.length >= 3 ? inferKeywordLenses(nodeRawText, customKeywordMapRef.current) : [];
          const kwDomains = kwLensResults.map(kw => ({
                domain: (customLensToDomainRef.current ?? LENS_TO_DOMAIN)[kw.lens] ?? kw.lens,
                relevance: Math.min(0.95, kw.relevance + 0.4),
                reasoning: kw.evidence,
              })).filter(d => !!d.domain);


          const hNode: HemisphereNodeDatum = {
            dataPointId,
            createdAtMs,
            rawText: nodeRawText,
            dataPointSource: String(p.dataPoint.source ?? ''),
            speakerId: p.dataPoint.speakerId || p.transcriptChunk?.speakerId || null,
            dialoguePhase: (['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as const).includes(dialoguePhaseRef.current as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH')
              ? (dialoguePhaseRef.current as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH')
              : null,
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
            agenticAnalysis: kwDomains.length > 0 ? {
              domains: kwDomains,
              themes: [],
              actors: [],
              semanticMeaning: '',
              sentimentTone: 'neutral',
              overallConfidence: 0.5,
            } : null,
          };
          setHemisphereNodes(prev => {
            if (prev[dataPointId]) return prev;
            return { ...prev, [dataPointId]: hNode };
          });

          setNodeCount(c => c + 1);
          nodeCountSinceLastRunRef.current++;
        }
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
          const updated = applyLensMapping(existing, analysis, {
            effectiveLenses: blueprintLensNamesRef.current.length ? blueprintLensNamesRef.current : undefined,
            keywordMap: customKeywordMapRef.current ?? undefined,
          });
          const next = new Map(prev);
          next.set(dataPointId, updated);
          return next;
        });

        // Update hemisphere node — enrich domains with keyword inference
        setHemisphereNodes(prev => {
          const existing = prev[dataPointId];
          if (!existing) return prev;

          // Merge CaptureAPI domains with keyword-inferred domains
          // Keyword domains get max CaptureAPI relevance so they can compete
          const maxApiRelevance = analysis.domains.reduce((m, d) => Math.max(m, d.relevance), 0.5);
          const enrichedDomains = [...analysis.domains];
          if (existing.rawText && existing.rawText.length >= 3) {
            const kwLenses = inferKeywordLenses(existing.rawText, customKeywordMapRef.current);
            const existingDomains = new Set(enrichedDomains.map(d => d.domain));
            for (const kw of kwLenses) {
              const domain = (customLensToDomainRef.current ?? LENS_TO_DOMAIN)[kw.lens];
              if (!domain) continue;
              if (existingDomains.has(domain)) {
                // Boost existing domain to at least match CaptureAPI max
                const idx = enrichedDomains.findIndex(d => d.domain === domain);
                if (idx >= 0) {
                  enrichedDomains[idx] = { ...enrichedDomains[idx], relevance: Math.max(enrichedDomains[idx].relevance, maxApiRelevance) };
                }
              } else {
                // Add keyword domain at same relevance as CaptureAPI's best
                enrichedDomains.push({ domain, relevance: maxApiRelevance, reasoning: kw.evidence });
              }
            }
          }

          return {
            ...prev,
            [dataPointId]: {
              ...existing,
              agenticAnalysis: { ...analysis, domains: enrichedDomains },
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

    // ── Agent conversation events ────────────────────────
    es.addEventListener('agent.conversation', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const entry = evt.payload as AgentConversationEntry;
        if (entry?.agent && entry?.message) {
          setAgentConversation((prev) => [...prev, entry]);
        }
      } catch { /* ignore */ }
    });

    // ── Theme suggested by Theme Agent → add to queue ────
    es.addEventListener('theme.suggested', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const payload = evt.payload as { theme: GuidedTheme };
        if (payload?.theme) {
          setThemes((prev) => {
            // Avoid duplicates
            if (prev.some((t) => t.id === payload.theme.id)) return prev;
            return [...prev, payload.theme];
          });
        }
      } catch { /* ignore */ }
    });

    // ── Pad generated by Facilitation Agent → add to queue ─
    es.addEventListener('pad.generated', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const payload = evt.payload as { pad: StickyPad };
        if (payload?.pad) {
          setStickyPads((prev) => {
            if (prev.some((p) => p.id === payload.pad.id)) return prev;
            // Agent-generated pads enter as active sub-pads for the current main question
            const agentPad: StickyPad = {
              ...payload.pad,
              source: payload.pad.source || 'agent',
              questionId: payload.pad.questionId || null,
              grounding: payload.pad.grounding || payload.pad.provenance?.description || null,
              coveragePercent: payload.pad.coveragePercent || 0,
              coverageState: payload.pad.coverageState || 'active',
              lens: payload.pad.lens || null,
              mainQuestionIndex: payload.pad.mainQuestionIndex ?? mainQuestionIndex,
              journeyGapId: payload.pad.journeyGapId || null,
              padLabel: payload.pad.padLabel || null,
            };
            return [...prev, agentPad];
          });
        }
      } catch { /* ignore */ }
    });

    // ── Question coverage assessed by agent → update percentage ─
    es.addEventListener('question.coverage', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        const payload = evt.payload as { questionId: string; coveragePercent: number };
        if (payload?.questionId && typeof payload.coveragePercent === 'number') {
          setStickyPads((prev) =>
            prev.map((p) =>
              p.questionId === payload.questionId
                ? { ...p, coveragePercent: Math.max(p.coveragePercent, payload.coveragePercent) }
                : p,
            ),
          );
        }
      } catch { /* ignore */ }
    });

    // ── Constraint mapped by Constraint Agent ─────────────
    es.addEventListener('constraint.mapped', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
        // Constraint events are logged to agent conversation for visibility
        const payload = evt.payload as Record<string, unknown>;
        if (payload) {
          setAgentConversation((prev) => [
            ...prev,
            {
              timestampMs: Date.now(),
              agent: 'constraint-agent',
              to: 'orchestrator',
              message: `Constraint mapped: ${payload.label || 'Unknown'} (${payload.type || 'general'})`,
              type: 'acknowledgement',
            },
          ]);
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

  // ── Auto-save: fetch workshop name + snapshot list ────
  useEffect(() => {
    fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.workshop?.name) setWorkshopName(data.workshop.name); })
      .catch(() => {});
  }, [workshopId]);

  const fetchCgSnapshots = useCallback(async () => {
    try {
      const r = await fetch(snapshotUrl);
      const json = await r.json().catch(() => null);
      if (json?.ok && Array.isArray(json.snapshots)) setCgSnapshots(json.snapshots);
    } catch { /* ignore */ }
  }, [snapshotUrl]);

  useEffect(() => { void fetchCgSnapshots(); }, [fetchCgSnapshots]);

  // ── Auto-save function: persist hemisphereNodes to LiveWorkshopSnapshot ──
  const autoSave = useCallback(async (): Promise<string | null> => {
    const nodeKeys = Object.keys(hemisphereNodes);
    // Filter out live: streaming nodes — only save permanent nodes
    const permanentNodes: Record<string, HemisphereNodeDatum> = {};
    for (const key of nodeKeys) {
      if (!key.startsWith('live:')) permanentNodes[key] = hemisphereNodes[key];
    }
    if (Object.keys(permanentNodes).length === 0) return null;

    const now = new Date();
    const datePart = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const timePart = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const autoSaveName = workshopName
      ? `${workshopName} — ${datePart} ${timePart}`
      : `Auto-save ${now.toISOString().slice(0, 19).replace('T', ' ')}`;

    const payload = {
      v: 1,
      source: 'cognitive-guidance',
      dialoguePhase,
      nodesById: permanentNodes,
    };

    try {
      const existing = cgSnapshots.find(s => s.dialoguePhase === dialoguePhase);
      let r;
      if (existing) {
        r = await fetch(`${snapshotUrl}/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        });
      } else {
        r = await fetch(snapshotUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: autoSaveName, dialoguePhase, payload }),
        });
      }
      const json = (await r.json().catch(() => null)) as
        | { ok?: boolean; snapshot?: { id: string }; error?: string }
        | null;
      if (r.ok && json?.ok) {
        setLastAutoSaveTime(new Date());
        const savedId = existing ? existing.id : (json?.snapshot?.id ?? null);
        if (!existing) void fetchCgSnapshots();
        setLastSavedSnapshotId(savedId);
        return savedId;
      }
      return null;
    } catch { return null; }
  }, [hemisphereNodes, workshopName, dialoguePhase, cgSnapshots, snapshotUrl, fetchCgSnapshots]);

  // Auto-save every 3 minutes while listening
  useEffect(() => {
    if (!listening) return;
    // Save immediately when listening starts (may be empty, that's fine)
    const timeout = setTimeout(() => { void autoSave(); }, 5000); // 5s delay for initial nodes
    const interval = setInterval(() => { void autoSave(); }, 3 * 60_000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [listening, autoSave]);

  // ── Versioned session auto-save (full state, every 30s) ────────────
  const fetchSessionVersions = useCallback(async () => {
    try {
      const r = await fetch(`${versionUrl}?limit=50`);
      const json = await r.json().catch(() => null);
      if (json?.ok && Array.isArray(json.versions)) {
        setSessionVersions(json.versions);
        if (json.versions.length > 0) {
          setCurrentVersion(json.versions[0].version);
        }
      }
    } catch { /* ignore */ }
  }, [versionUrl]);

  useEffect(() => { void fetchSessionVersions(); }, [fetchSessionVersions]);

  // ── Auto-restore: load latest session version on mount ──────────────────────
  // NOTE: deliberately does NOT guard on `listening` — SSE reconnects immediately
  // on page reload and would set listening=true before this effect could run,
  // causing all saved hemisphere data to be permanently lost on reload.
  // Incoming live nodes merge safely on top of restored state.
  const hasAutoRestoredRef = useRef(false);
  useEffect(() => {
    if (hasAutoRestoredRef.current) return;           // only once per mount
    if (cogNodes.size > 0) return;                    // real-time data already present
    if (Object.keys(hemisphereNodes).length > 0) return; // already restored
    if (sessionVersions.length === 0) return;          // nothing to restore yet
    hasAutoRestoredRef.current = true;
    void restoreFromVersion(sessionVersions[0].id);
  }, [sessionVersions]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoSaveVersion = useCallback(async () => {
    // Build permanent hemisphere nodes (filter out live: streaming nodes)
    const permanentNodes: Record<string, HemisphereNodeDatum> = {};
    for (const [key, val] of Object.entries(hemisphereNodes)) {
      if (!key.startsWith('live:')) permanentNodes[key] = val;
    }
    // Don't save if nothing meaningful exists
    if (Object.keys(permanentNodes).length === 0 && stickyPads.length === 0) return;

    // Quick-hash to skip saves when nothing changed
    const quickHash = `${Object.keys(permanentNodes).length}-${stickyPads.length}-${mainQuestionIndex}-${dialoguePhase}-${agentConversation.length}`;
    if (quickHash === lastVersionHashRef.current) return;

    const payload: LiveSessionVersionPayload = {
      v: 2,
      savedAtMs: Date.now(),
      dialoguePhase,
      mainQuestionIndex,
      hemisphereNodes: permanentNodes,
      cogNodes: Array.from(cogNodes.entries()),
      stickyPads,
      completedByQuestion: Array.from(completedByQuestion.entries()),
      signals,
      liveJourney,
      sessionConfidence,
      themes,
      activeThemeId,
      lensCoverage: Array.from(lensCoverage.entries()),
      agentConversation,
      journeyCompletionState: null,
      customLensColors,
    };

    try {
      setVersionSaveStatus('saving');
      const r = await fetch(versionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dialoguePhase, payload }),
      });
      const json = await r.json().catch(() => null);
      if (r.ok && json?.ok) {
        setCurrentVersion(json.version.version);
        lastVersionHashRef.current = quickHash;
        setVersionSaveStatus('saved');
        void fetchSessionVersions();
        setTimeout(() => setVersionSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
      } else {
        setVersionSaveStatus('error');
      }
    } catch {
      setVersionSaveStatus('error');
    }
  }, [
    hemisphereNodes, cogNodes, stickyPads, completedByQuestion, signals,
    liveJourney, sessionConfidence, themes, activeThemeId, lensCoverage,
    agentConversation, customLensColors,
    dialoguePhase, mainQuestionIndex, versionUrl, fetchSessionVersions,
  ]);

  // Auto-save version every 30 seconds while listening
  useEffect(() => {
    if (!listening) return;
    const timeout = setTimeout(() => { void autoSaveVersion(); }, 10_000);
    const interval = setInterval(() => { void autoSaveVersion(); }, 30_000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [listening, autoSaveVersion]);

  const restoreFromVersion = useCallback(async (versionId: string) => {
    try {
      const r = await fetch(`${versionUrl}/${versionId}`);
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) {
        toast.error('Failed to load version');
        return;
      }
      const p = json.version.payload as LiveSessionVersionPayload;

      // Restore all state
      setDialoguePhase(p.dialoguePhase as DialoguePhase);
      dialoguePhaseRef.current = p.dialoguePhase as DialoguePhase;
      setMainQuestionIndex(p.mainQuestionIndex);
      setHemisphereNodes(p.hemisphereNodes as Record<string, HemisphereNodeDatum>);
      setCogNodes(new Map(p.cogNodes as Array<[string, CogNode]>));
      setStickyPads(p.stickyPads);
      setCompletedByQuestion(new Map(p.completedByQuestion));
      setSignals(p.signals);
      setLiveJourney(p.liveJourney as LiveJourneyData);
      setSessionConfidence(p.sessionConfidence as SessionConfidence);
      setThemes(p.themes as GuidedTheme[]);
      setActiveThemeId(p.activeThemeId);
      setLensCoverage(new Map(p.lensCoverage as Array<[Lens, LensCoverage]>));
      setAgentConversation(p.agentConversation as AgentConversationEntry[]);
      if (p.customLensColors) setCustomLensColors(p.customLensColors);

      setNodeCount(Object.keys(p.hemisphereNodes).length);
      setCurrentVersion(json.version.version);
      lastVersionHashRef.current = '';

      toast.success(`Restored to version ${json.version.version}`);
    } catch {
      toast.error('Failed to restore version');
    }
  }, [versionUrl]);

  const handleVersionLabel = useCallback(async (versionId: string, label: string) => {
    try {
      await fetch(`${versionUrl}/${versionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      void fetchSessionVersions();
    } catch { /* ignore */ }
  }, [versionUrl, fetchSessionVersions]);

  // ── Poll event outbox for all derived events (durable cross-isolate delivery) ──
  // Events emitted inside after() callbacks don't reach the SSE endpoint on Vercel
  // serverless (different isolates). The outbox table is the source of truth.
  // SSE listeners above are kept as best-effort bonus (work in local dev).
  const lastOutboxCursorRef = useRef<string>(new Date().toISOString());
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const mainQuestionIndexRef = useRef(mainQuestionIndex);
  useEffect(() => { mainQuestionIndexRef.current = mainQuestionIndex; }, [mainQuestionIndex]);

  useEffect(() => {
    if (!listening) return;

    const POLL_TYPES = [
      'datapoint.created',
      'pad.generated',
      'agent.conversation',
      'classification.updated',
      'belief.created',
      'belief.reinforced',
      'belief.stabilised',
      'contradiction.detected',
      'agentic.analyzed',
    ].join(',');

    const dispatchOutboxEvent = (type: string, payload: unknown) => {
      try {
        switch (type) {
          case 'datapoint.created': {
            const p = payload as DataPointCreatedPayload;
            const dataPointId = p?.dataPoint?.id;
            if (!dataPointId) return;
            const createdAtMs =
              typeof p.dataPoint.createdAt === 'string'
                ? Date.parse(p.dataPoint.createdAt)
                : p.dataPoint.createdAt instanceof Date
                  ? p.dataPoint.createdAt.getTime()
                  : Date.now();
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

            // Hemisphere node -- only for meaningful phrases (4+ words)
            const nodeRawText = String(p.dataPoint.rawText ?? '');
            const wordCount = nodeRawText.trim().split(/\s+/).filter(w => w.length > 0).length;
            if (wordCount >= 4) {
              const kwLensResults = nodeRawText.length >= 3 ? inferKeywordLenses(nodeRawText, customKeywordMapRef.current) : [];
              const kwDomains = kwLensResults.map(kw => ({
                domain: (customLensToDomainRef.current ?? LENS_TO_DOMAIN)[kw.lens] ?? kw.lens,
                relevance: Math.min(0.95, kw.relevance + 0.4),
                reasoning: kw.evidence,
              })).filter(d => !!d.domain);

              setHemisphereNodes(prev => ({
                ...prev,
                [dataPointId]: {
                  dataPointId,
                  createdAtMs,
                  rawText: nodeRawText,
                  dataPointSource: String(p.dataPoint.source ?? ''),
                  speakerId: p.dataPoint.speakerId || p.transcriptChunk?.speakerId || null,
                  dialoguePhase: (['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as const).includes(dialoguePhaseRef.current as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH')
                    ? (dialoguePhaseRef.current as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH')
                    : null,
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
                  agenticAnalysis: kwDomains.length > 0 ? {
                    domains: kwDomains,
                    themes: [],
                    actors: [],
                    semanticMeaning: '',
                    sentimentTone: 'neutral',
                    overallConfidence: 0.5,
                  } : null,
                },
              }));
            }
            nodeCountSinceLastRunRef.current++;
            break;
          }

          case 'classification.updated': {
            const p = payload as ClassificationUpdatedPayload;
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
            break;
          }

          case 'agentic.analyzed': {
            const p = payload as AgenticAnalyzedPayload;
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
              const updated = applyLensMapping(existing, analysis, {
                effectiveLenses: blueprintLensNamesRef.current.length ? blueprintLensNamesRef.current : undefined,
                keywordMap: customKeywordMapRef.current ?? undefined,
              });
              const next = new Map(prev);
              next.set(dataPointId, updated);
              return next;
            });
            setHemisphereNodes(prev => {
              const existing = prev[dataPointId];
              if (!existing) return prev;
              const maxApiRelevance = analysis.domains.reduce(
                (m: number, d) => Math.max(m, d.relevance),
                0.5
              );
              const enrichedDomains = [...analysis.domains];
              if (existing.rawText && existing.rawText.length >= 3) {
                const kwLenses = inferKeywordLenses(existing.rawText, customKeywordMapRef.current);
                const existingDomains = new Set(enrichedDomains.map(d => d.domain));
                for (const kw of kwLenses) {
                  const domain = (customLensToDomainRef.current ?? LENS_TO_DOMAIN)[kw.lens];
                  if (!domain) continue;
                  if (existingDomains.has(domain)) {
                    const idx = enrichedDomains.findIndex(d => d.domain === domain);
                    if (idx >= 0) {
                      enrichedDomains[idx] = { ...enrichedDomains[idx], relevance: Math.max(enrichedDomains[idx].relevance, maxApiRelevance) };
                    }
                  } else {
                    enrichedDomains.push({ domain, relevance: maxApiRelevance, reasoning: kw.evidence });
                  }
                }
              }
              return {
                ...prev,
                [dataPointId]: {
                  ...existing,
                  agenticAnalysis: { ...analysis, domains: enrichedDomains },
                },
              };
            });
            break;
          }

          case 'belief.stabilised': {
            stabilisedCountRef.current++;
            break;
          }

          case 'contradiction.detected': {
            const c = (payload as Record<string, any>)?.contradiction;
            if (c) {
              contradictionsRef.current.push({
                id: c.id || `c_${Date.now()}`,
                beliefA: c.beliefA?.label || '',
                beliefB: c.beliefB?.label || '',
                resolved: false,
              });
            }
            break;
          }

          case 'agent.conversation': {
            const entry = payload as AgentConversationEntry;
            if (entry?.agent && entry?.message) {
              setAgentConversation(prev => [...prev, entry]);
            }
            break;
          }

          case 'pad.generated': {
            const pad = (payload as Record<string, any>)?.pad;
            if (pad) {
              setStickyPads(prev => {
                if (prev.some(p => p.id === pad.id)) return prev;
                const agentPad: StickyPad = {
                  ...pad,
                  source: pad.source || 'agent',
                  questionId: pad.questionId || null,
                  grounding: pad.grounding || pad.provenance?.description || null,
                  coveragePercent: pad.coveragePercent || 0,
                  coverageState: pad.coverageState || 'active',
                  lens: pad.lens || null,
                  mainQuestionIndex: pad.mainQuestionIndex ?? mainQuestionIndexRef.current,
                  journeyGapId: pad.journeyGapId || null,
                  padLabel: pad.padLabel || null,
                };
                return [...prev, agentPad];
              });
            }
            break;
          }

          // belief.created and belief.reinforced — no UI handler currently
          default:
            break;
        }
      } catch { /* ignore dispatch errors */ }
    };

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/workshops/${encodeURIComponent(workshopId)}/events/poll?after=${encodeURIComponent(lastOutboxCursorRef.current)}&types=${POLL_TYPES}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const events = data.events as Array<{
          id: string;
          type: string;
          payload: unknown;
          createdAt: string;
        }>;
        if (!events || events.length === 0) return;

        // Advance cursor to latest event
        lastOutboxCursorRef.current = events[events.length - 1].createdAt;

        // Dispatch each event with dedup (SSE may also deliver these — idempotent)
        for (const evt of events) {
          if (seenEventIdsRef.current.has(evt.id)) continue;
          seenEventIdsRef.current.add(evt.id);
          dispatchOutboxEvent(evt.type, evt.payload);
        }
      } catch { /* polling errors are non-fatal */ }
    };

    const interval = setInterval(poll, 3000);
    poll(); // Immediate first poll
    return () => clearInterval(interval);
  }, [listening, workshopId]);

  // Use real nodes if available; otherwise empty array.
  const hemisphereNodeArray = useMemo(() => {
    return Object.values(hemisphereNodes);
  }, [hemisphereNodes]);

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

  // Auto-move overflow pads to covered when >maxVisible active.
  // Must also set status='snoozed' so they leave allActivePads on the next render —
  // otherwise the canvas keeps firing onOverflow in a setTimeout loop.
  const handleOverflowPads = useCallback((padIds: string[]) => {
    setStickyPads(prev => prev.map(p =>
      padIds.includes(p.id) ? { ...p, status: 'snoozed' as const, coverageState: 'covered' as const } : p
    ));
  }, []);

  // (Old handleSkipQuestion / handleRevisitQuestion removed — replaced by handleNextQuestion / handlePrevQuestion)

  // ── Computed: sub-pads for current main question ──────────
  const activeSubPads = useMemo(
    () => stickyPads.filter(
      // Exclude seed AND signal pads — signal pads have their own canvas below
      (p) => p.mainQuestionIndex === mainQuestionIndex && p.source !== 'seed' && p.source !== 'signal' && p.status === 'active',
    ),
    [stickyPads, mainQuestionIndex],
  );

  const coveredSubPads = useMemo(
    () => stickyPads.filter(
      (p) => p.mainQuestionIndex === mainQuestionIndex && p.coverageState === 'covered',
    ),
    [stickyPads, mainQuestionIndex],
  );

  // Main question completion percent (sub-pad coverage)
  const mainQuestionCompletionPercent = useMemo(() => {
    if (activeSubPads.length === 0 && coveredSubPads.length === 0) return 0;
    const allSubPads = [...activeSubPads, ...coveredSubPads];
    const avgSubCoverage = allSubPads.length > 0
      ? allSubPads.reduce((s, p) => s + p.coveragePercent, 0) / allSubPads.length
      : 0;
    return Math.round(avgSubCoverage);
  }, [activeSubPads, coveredSubPads]);

  // Signal-generated + seed pads (shown below main question area)
  const signalPads = useMemo(
    () => stickyPads.filter((p) => p.source === 'signal' || p.source === 'seed'),
    [stickyPads],
  );

  // (Radar chart / word cloud data transforms moved to Discovery tab)

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6">
        {/* ── Workflow breadcrumb ─────────────────────── */}
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Link href={`/admin/workshops/${workshopId}`} className="hover:text-foreground transition-colors">
            Workshop
          </Link>
          <ArrowRight className="h-3 w-3" />
          <Link href={`/admin/workshops/${workshopId}/prep`} className="hover:text-foreground transition-colors">
            Prep
          </Link>
          <ArrowRight className="h-3 w-3" />
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" />
            Live Workshop
          </span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Live Workshop</h1>
              <p className="text-sm text-muted-foreground">
                {PHASE_LABELS[dialoguePhase]} — {listening ? `${nodeCount} contributions captured` : 'Ready to go live'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!listening ? (
              <Button onClick={() => setMicDialogOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Radio className="h-4 w-4 mr-2" />
                Go Live
              </Button>
            ) : (
              <Button onClick={async () => {
                audio.stopCapture();
                stopListening();
                const savedId = await autoSave();
                if (savedId) {
                  setLastSavedSnapshotId(savedId);
                  await fetchCgSnapshots();
                  toast.success('Session saved — View in Hemisphere', {
                    action: {
                      label: 'Open',
                      onClick: () => { window.open(`/admin/workshops/${workshopId}/hemisphere`, '_blank'); },
                    },
                    duration: 8000,
                  });
                }
              }} variant="destructive" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
            {listening && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
                {lastAutoSaveTime && (
                  <span className="text-muted-foreground ml-1">
                    · saved {lastAutoSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </span>
            )}
            {/* Version badge + history trigger */}
            {currentVersion > 0 && (
              <button
                onClick={() => setVersionHistoryOpen(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="View version history"
              >
                <History className="h-3 w-3" />
                v{currentVersion}
                {versionSaveStatus === 'saving' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {versionSaveStatus === 'saved' && <Check className="h-3 w-3 text-emerald-500" />}
                {versionSaveStatus === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              </button>
            )}
            {/* Audio level sound bar — 5 animated bars */}
            {audio.capturing && (
              <div className="flex items-end gap-0.5 h-5 ml-1">
                {[0.6, 0.3, 0.8, 0.4, 0.7].map((sensitivity, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-emerald-500 transition-all duration-75"
                    style={{
                      height: `${Math.max(3, Math.min(20, audio.audioLevel * sensitivity * 0.6))}px`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Mic Setup Dialog */}
          <MicSetupDialog
            open={micDialogOpen}
            onOpenChange={setMicDialogOpen}
            micPermission={audio.micPermission}
            micDevices={audio.micDevices}
            selectedMicId={audio.selectedMicId}
            onSelectMic={audio.setSelectedMicId}
            micLevel={audio.micLevel}
            micTesting={audio.micTesting}
            captureError={audio.captureError}
            onStartTest={() => void audio.startMicTest()}
            onStopTest={() => void audio.stopMicTest()}
            onRefreshDevices={() => void audio.refreshMicDevices()}
            onGoLive={async () => {
              setMicDialogOpen(false);
              await audio.startCapture();
              startListening();
            }}
          />
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

        {/* Data Sufficiency Bar */}
        <DataSufficiencyBar
          hasResearch={dataSufficiency.hasResearch}
          hasDiscoveryBriefing={dataSufficiency.hasDiscoveryBriefing}
          hasBlueprint={dataSufficiency.hasBlueprint}
          hasHistoricalMetrics={dataSufficiency.hasHistoricalMetrics}
          metricsCount={dataSufficiency.metricsCount}
          sessionConfidence={sessionConfidence}
        />

        {/* Blueprint source indicator */}
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <span className={`inline-block w-2 h-2 rounded-full ${
            blueprintSource === 'blueprint' ? 'bg-green-500' :
            blueprintSource === 'research_override' ? 'bg-amber-500' :
            'bg-gray-400'
          }`} />
          <span>
            Lens source: {blueprintSource === 'blueprint' ? 'Workshop blueprint' :
              blueprintSource === 'research_override' ? 'Research dimensions' :
              'Default fallback'}
          </span>
        </div>

        {/* Lens Coverage Bar + Gap Indicators */}
        <div className="mt-3">
          <LensCoverageBar coverage={lensCoverage} lensNames={blueprintLensNames} lensColors={customLensColors} />
        </div>
        <GapIndicatorStrip signals={signals} />

        {/* Metric Contradiction Alerts */}
        <MetricContradictionAlert
          signals={signals.filter((s) => !dismissedAlerts.has(s.id))}
          onDismiss={(id) => setDismissedAlerts((prev) => new Set(prev).add(id))}
        />

        {/* ═══ PRIMARY CANVAS — Main Question + Sub-Pads Grid ═══ */}
        <div className="mt-4 space-y-4">
          {/* Main Question Card (full width, amber) */}
          {currentMainQ && mainQuestions.length > 0 ? (
            <>
              <MainQuestionCard
                question={{
                  id: currentMainQ.id,
                  phase: currentMainQ.phase as FacilitationQuestion['phase'],
                  lens: (currentMainQ.lens as FacilitationQuestion['lens']) ?? null,
                  text: currentMainQ.text,
                  purpose: currentMainQ.purpose,
                  grounding: currentMainQ.grounding,
                  order: currentMainQ.order,
                  isEdited: currentMainQ.isEdited,
                  subQuestions: currentMainQ.subQuestions || [],
                }}
                questionIndex={mainQuestionIndex}
                totalQuestions={mainQuestions.length}
                phaseLabel={PHASE_LABELS[dialoguePhase]}
                completionPercent={mainQuestionCompletionPercent}
                onPrevious={handlePrevQuestion}
                onNext={handleNextQuestion}
              />

              {/* Sub-pads grid (left ~75%) + Covered strip (right ~25%) */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
                {/* Active sub-pads */}
                <div>
                  {activeSubPads.length > 0 ? (
                    <StickyPadCanvas
                      pads={activeSubPads}
                      selectedPadId={selectedPadId}
                      onSelectPad={setSelectedPadId}
                      onDismissPad={handleDismissPad}
                      onSnoozePad={handleSnoozePad}
                      maxVisible={4}
                      customLensColors={customLensColors}
                      onOverflow={handleOverflowPads}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Sub-questions will appear here as the dialogue progresses
                      </p>
                    </div>
                  )}

                  {/* Signal-generated pads below */}
                  {signalPads.length > 0 && (
                    <div className="mt-4">
                      <StickyPadCanvas
                        pads={signalPads}
                        selectedPadId={selectedPadId}
                        onSelectPad={setSelectedPadId}
                        onDismissPad={handleDismissPad}
                        onSnoozePad={handleSnoozePad}
                        maxVisible={4}
                        customLensColors={customLensColors}
                      />
                    </div>
                  )}
                </div>

                {/* Covered strip — collapsible accordion by main question */}
                <div className="rounded-lg border bg-card/50 p-3">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Covered
                  </h3>
                  {/* Current question's covered sub-pads */}
                  {coveredSubPads.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Q{mainQuestionIndex + 1} — Current
                      </p>
                      <div className="space-y-1">
                        {coveredSubPads.map((pad) => (
                          <div key={pad.id} className="text-xs p-1.5 rounded bg-muted/50 text-muted-foreground truncate">
                            {pad.prompt}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Previous questions' completed sub-pads (accordion) */}
                  {Array.from(completedByQuestion.entries())
                    .sort(([a], [b]) => b - a)
                    .map(([qIdx, pads]) => (
                      <div key={qIdx} className="mb-2">
                        <button
                          onClick={() => setCollapsedSections((prev) => {
                            const next = new Set(prev);
                            next.has(qIdx) ? next.delete(qIdx) : next.add(qIdx);
                            return next;
                          })}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left"
                        >
                          <ChevronRight className={`h-3 w-3 transition-transform ${!collapsedSections.has(qIdx) ? 'rotate-90' : ''}`} />
                          Q{qIdx + 1} ({pads.length} subs)
                        </button>
                        {!collapsedSections.has(qIdx) && (
                          <div className="ml-4 mt-1 space-y-1">
                            {pads.map((pad) => (
                              <div key={pad.id} className="text-xs p-1.5 rounded bg-muted/50 text-muted-foreground truncate">
                                {pad.prompt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  {coveredSubPads.length === 0 && completedByQuestion.size === 0 && (
                    <p className="text-xs text-muted-foreground/60 italic">No covered sub-questions yet</p>
                  )}
                </div>
              </div>
            </>
          ) : !prepLoaded ? (
            /* Still loading prep questions — show placeholder instead of seed pads */
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-12 text-center">
              <p className="text-sm text-muted-foreground animate-pulse">
                Loading session questions…
              </p>
            </div>
          ) : (
            /* Fallback: seed pads when no main questions available (prep loaded but had none) */
            <StickyPadCanvas
              pads={stickyPads}
              selectedPadId={selectedPadId}
              onSelectPad={setSelectedPadId}
              onDismissPad={handleDismissPad}
              onSnoozePad={handleSnoozePad}
              customLensColors={customLensColors}
            />
          )}
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
                lensNames={blueprintLensNames}
              />
            </div>
          </div>
          <SignalClusterPanel
            signals={signals}
            sessionConfidence={sessionConfidence}
          />
        </div>

        {/* ═══ AGENT ORCHESTRATION PANEL ═══ */}
        <div className="mt-4">
          <AgentOrchestrationPanel
            entries={agentConversation}
            collapsed={agentPanelCollapsed}
            onToggleCollapse={() => setAgentPanelCollapsed((c) => !c)}
            title="LIVE AGENT ORCHESTRATION"
          />
        </div>

        {/* ═══ EXPANDED HEMISPHERE MODAL ═══ */}
        {hemisphereExpanded && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setHemisphereExpanded(false); }}
          >
            <div className="relative w-[96vw] max-w-6xl bg-card rounded-xl shadow-2xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
                <h2 className="text-sm font-semibold">Hemisphere — All Contributions</h2>
                <button
                  onClick={() => setHemisphereExpanded(false)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4">
                <HemisphereNodes
                  nodes={hemisphereNodeArray}
                  originTimeMs={null}
                  onNodeClick={(node) => { setExpandedNode(node); }}
                  lensNames={blueprintLensNames}
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

        {/* ═══ VERSION HISTORY PANEL ═══ */}
        <VersionHistoryPanel
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
          versions={sessionVersions}
          currentVersion={currentVersion}
          isLive={listening}
          onRestore={restoreFromVersion}
          onLabel={handleVersionLabel}
        />
      </div>
    </div>
  );
}


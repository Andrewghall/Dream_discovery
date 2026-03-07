'use client';

/**
 * usePadStateMachine
 *
 * Manages the sticky pad lifecycle, main question navigation, coverage
 * scoring, and auto-advance logic. Extracted from cognitive-guidance
 * page for reuse on the live page.
 *
 * Key behaviors:
 * - Loads prep sub-pads from WorkshopQuestionSet for each main question
 * - Auto-marks pads as covered when coveragePercent >= coverageThreshold
 * - Auto-advances to next main question when all sub-pads are covered
 * - Manual next/prev available as override
 * - Syncs currentMainQuestion to guidance state server
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  StickyPad,
  StickyPadType,
  DialoguePhase,
  CogNode,
} from '@/lib/cognitive-guidance/pipeline';
import { calculateQuestionCoverage } from '@/lib/cognitive-guidance/pipeline';

// -----------------------------------------------------------------------
// Types from cognitive-guidance/page.tsx (extracted for reuse)
// -----------------------------------------------------------------------

type WorkshopPhase = 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

type PrepSubQuestion = {
  id: string;
  lens: string;
  text: string;
  purpose: string;
};

type PrepQuestion = {
  id: string;
  phase: string;
  lens: string | null;
  text: string;
  purpose: string;
  grounding: string;
  order: number;
  isEdited?: boolean;
  subQuestions?: PrepSubQuestion[];
};

type PrepPhaseData = {
  label: string;
  description: string;
  lensOrder: string[];
  questions: PrepQuestion[];
};

export type PrepQuestionSet = {
  phases: Record<string, PrepPhaseData>;
  designRationale: string;
  generatedAtMs: number;
};

export type GuidanceStateOverrides = {
  activeThemeId?: string | null;
  themes?: unknown[];
  freeflowMode?: boolean;
  dialoguePhase?: DialoguePhase;
  coverageThreshold?: number;
  currentMainQuestion?: {
    text: string;
    lens: string | null;
    purpose: string;
    grounding: string;
    phase: string;
  } | null;
};

// -----------------------------------------------------------------------
// Hook options
// -----------------------------------------------------------------------

export interface PadStateMachineOptions {
  workshopId: string;
  dialoguePhase: DialoguePhase;
  prepQuestions: PrepQuestionSet | null;
  coverageThreshold: number; // from guidance state, persisted per workshop
  journeyCompletionState: {
    overallCompletionPercent: number;
  } | null;
  cogNodes: CogNode[] | null; // null = rely on agent-assessed coverage only
  onSyncGuidanceState: (overrides: GuidanceStateOverrides) => Promise<void>;
}

export interface PadStateMachineReturn {
  // Pad state
  stickyPads: StickyPad[];
  setStickyPads: React.Dispatch<React.SetStateAction<StickyPad[]>>;

  // Main question navigation
  mainQuestions: PrepQuestion[];
  mainQuestionIndex: number;
  currentMainQuestion: PrepQuestion | null;
  handleNextQuestion: () => void;
  handlePrevQuestion: () => void;
  handlePhaseChange: (phase: DialoguePhase) => void;

  // Computed pad subsets
  activeSubPads: StickyPad[];
  coveredSubPads: StickyPad[];
  signalPads: StickyPad[];
  mainQuestionCompletionPercent: number;

  // Completed history
  completedByQuestion: Map<number, StickyPad[]>;
  collapsedSections: Set<number>;
  setCollapsedSections: React.Dispatch<React.SetStateAction<Set<number>>>;

  // Actions
  handleDismissPad: (id: string) => void;
  handleSnoozePad: (id: string) => void;
  handleOverflowPads: (padIds: string[]) => void;
  addAgentPad: (pad: StickyPad) => void;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function dialoguePhaseToWorkshopPhase(phase: DialoguePhase): WorkshopPhase | null {
  switch (phase) {
    case 'REIMAGINE': return 'REIMAGINE';
    case 'CONSTRAINTS': return 'CONSTRAINTS';
    case 'DEFINE_APPROACH': return 'DEFINE_APPROACH';
    default: return null;
  }
}

function lensToStickyPadType(lens: string | null): StickyPadType {
  switch (lens) {
    case 'People': return 'GAP_PROBE';
    case 'Organisation': return 'ENABLER_PROBE';
    case 'Customer': return 'CUSTOMER_IMPACT';
    case 'Technology': return 'RISK_PROBE';
    case 'Regulation': return 'RISK_PROBE';
    case 'General': return 'CLARIFICATION';
    default: return 'CLARIFICATION';
  }
}

const PHASE_PROMPTS: Record<string, Record<string, string>> = {
  REIMAGINE: {
    People: 'In the ideal world, how would people experience this? Describe the perfect day.',
    Organisation: 'What would the ideal points of engagement look like -- with no friction at all?',
    Customer: 'Describe the perfect experience from the customer\'s perspective -- what does amazing look like?',
    Technology: 'If technology were limitless, what would this look like?',
    Regulation: 'Imagine a world with no regulatory barriers -- what becomes possible?',
    General: 'Paint the picture -- what does the ideal future state look like here?',
  },
  CONSTRAINTS: {
    People: 'What people-related limitations stand between today and that vision?',
    Organisation: 'What organisational constraints -- structure, budget, politics -- block progress here?',
    Customer: 'What customer-side barriers exist? Adoption, behaviour, access?',
    Technology: 'What technology constraints are we dealing with -- legacy systems, integration, data?',
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

// -----------------------------------------------------------------------
// Hook implementation
// -----------------------------------------------------------------------

export function usePadStateMachine(
  options: PadStateMachineOptions,
): PadStateMachineReturn {
  const {
    dialoguePhase,
    prepQuestions,
    coverageThreshold,
    journeyCompletionState,
    cogNodes,
    onSyncGuidanceState,
  } = options;

  // ---- State ----
  const [stickyPads, setStickyPads] = useState<StickyPad[]>([]);
  const [mainQuestionIndex, setMainQuestionIndex] = useState(0);
  const [completedByQuestion, setCompletedByQuestion] = useState<Map<number, StickyPad[]>>(new Map());
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const prepRef = useRef(prepQuestions);
  prepRef.current = prepQuestions;

  // ---- Derived: main questions for current phase ----

  const mainQuestions = useMemo(() => {
    const prep = prepRef.current;
    if (!prep) return [];
    const wp = dialoguePhaseToWorkshopPhase(dialoguePhase);
    if (!wp) return [];
    const phaseData = prep.phases?.[wp];
    if (!phaseData?.questions?.length) return [];
    return [...phaseData.questions].sort((a, b) => a.order - b.order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialoguePhase, prepQuestions]);

  const currentMainQuestion = mainQuestions[mainQuestionIndex] ?? null;

  // ---- Load prep sub-pads for a question ----

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
        coverageState: 'active' as StickyPad['coverageState'],
        lens: sq.lens || null,
        mainQuestionIndex: qIndex,
        journeyGapId: null,
        padLabel: null,
      }));
    }

    // Fallback: generate starter sub-pads from the question itself
    const prep = prepRef.current;
    const wp = dialoguePhaseToWorkshopPhase(dialoguePhase);
    const phaseLenses = (wp && prep?.phases?.[wp]?.lensOrder) ? prep.phases[wp].lensOrder : [];

    const qLens = question.lens || 'General';
    const otherLenses = phaseLenses.filter((l) => l !== qLens).slice(0, 2);
    const starterLenses = [qLens, ...otherLenses];

    const prompts = PHASE_PROMPTS[dialoguePhase] || PHASE_PROMPTS.REIMAGINE;

    return starterLenses.map((lens, i) => ({
      id: `auto:${question.id}:${lens.toLowerCase()}`,
      type: lensToStickyPadType(lens),
      prompt: prompts[lens] || `Explore this from the ${lens} lens`,
      signalStrength: 0.85 - (i * 0.05),
      provenance: {
        triggerType: 'repeated_theme' as const,
        sourceNodeIds: [] as string[],
        description: `Auto-generated starter for "${question.text}" -- ${lens} lens`,
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

  // ---- Auto-advance: coverage threshold triggers pad state transitions ----

  useEffect(() => {
    const activePad = stickyPads.find(
      (p) => p.coverageState === 'active' && p.source === 'prep',
    );
    if (!activePad || activePad.coveragePercent < coverageThreshold) return;

    setStickyPads((prev) => {
      // Mark current active as covered
      const updated = prev.map((p) =>
        p.id === activePad.id ? { ...p, coverageState: 'covered' as const } : p,
      );

      // Find next queued pad and activate it
      const nextQueued = updated
        .filter((p) => p.coverageState === 'queued' && p.mainQuestionIndex === mainQuestionIndex)
        .sort((a, b) => b.signalStrength - a.signalStrength)[0];

      if (nextQueued) {
        return updated.map((p) =>
          p.id === nextQueued.id ? { ...p, coverageState: 'active' as const } : p,
        );
      }

      return updated;
    });
  }, [stickyPads, coverageThreshold, mainQuestionIndex]);

  // ---- Auto-advance to next main question when all subs covered ----

  useEffect(() => {
    // Check if all sub-pads for current question are covered
    const allSubsForQuestion = stickyPads.filter(
      (p) => p.mainQuestionIndex === mainQuestionIndex && p.source !== 'seed' && p.source !== 'signal',
    );
    if (allSubsForQuestion.length === 0) return;

    const allCovered = allSubsForQuestion.every((p) => p.coverageState === 'covered');
    if (!allCovered) return;
    if (mainQuestionIndex >= mainQuestions.length - 1) return; // Last question

    // Auto-advance: archive current subs and move to next question
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
    setMainQuestionIndex(nextIdx);

    const nextQ = mainQuestions[nextIdx];
    if (nextQ) {
      const subPads = loadPrepSubPads(nextQ, nextIdx);
      setStickyPads((prev) => {
        const kept = prev.filter(
          (p) => p.source === 'signal' || p.source === 'seed' || p.mainQuestionIndex !== mainQuestionIndex,
        );
        return [...kept, ...subPads];
      });
      void onSyncGuidanceState({
        currentMainQuestion: {
          text: nextQ.text,
          lens: nextQ.lens || null,
          purpose: nextQ.purpose,
          grounding: nextQ.grounding,
          phase: nextQ.phase,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickyPads, mainQuestionIndex, mainQuestions.length]);

  // ---- Coverage recalculation when cogNodes change ----

  useEffect(() => {
    if (!cogNodes || cogNodes.length === 0) return;

    setStickyPads((prev) =>
      prev.map((pad) => {
        if (!pad.prompt || pad.source === 'seed') return pad;
        const newCoverage = calculateQuestionCoverage(pad, cogNodes);
        if (newCoverage === pad.coveragePercent) return pad;
        return { ...pad, coveragePercent: newCoverage };
      }),
    );
  }, [cogNodes]);

  // ---- Computed subsets ----

  const activeSubPads = useMemo(
    () =>
      stickyPads.filter(
        (p) =>
          p.mainQuestionIndex === mainQuestionIndex &&
          p.source !== 'seed' &&
          p.status === 'active' &&
          p.coverageState !== 'covered',
      ),
    [stickyPads, mainQuestionIndex],
  );

  const coveredSubPads = useMemo(
    () =>
      stickyPads.filter(
        (p) => p.mainQuestionIndex === mainQuestionIndex && p.coverageState === 'covered',
      ),
    [stickyPads, mainQuestionIndex],
  );

  const signalPads = useMemo(
    () => stickyPads.filter((p) => p.source === 'signal' || p.source === 'seed'),
    [stickyPads],
  );

  const mainQuestionCompletionPercent = useMemo(() => {
    const allSubPads = stickyPads.filter(
      (p) =>
        p.mainQuestionIndex === mainQuestionIndex &&
        p.source !== 'seed' &&
        p.source !== 'signal',
    );
    const avgSubCoverage =
      allSubPads.length > 0
        ? allSubPads.reduce((s, p) => s + p.coveragePercent, 0) / allSubPads.length
        : 0;
    const journeyFactor = journeyCompletionState?.overallCompletionPercent ?? 0;
    return Math.round(
      journeyFactor > 0 ? avgSubCoverage * 0.7 + journeyFactor * 0.3 : avgSubCoverage,
    );
  }, [stickyPads, mainQuestionIndex, journeyCompletionState]);

  // ---- Question navigation callbacks ----

  const handleNextQuestion = useCallback(() => {
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
    if (nextIdx >= mainQuestions.length) return;

    setMainQuestionIndex(nextIdx);

    const nextQ = mainQuestions[nextIdx];
    if (nextQ) {
      const subPads = loadPrepSubPads(nextQ, nextIdx);
      setStickyPads((prev) => {
        const kept = prev.filter(
          (p) => p.source === 'signal' || p.source === 'seed' || p.mainQuestionIndex !== mainQuestionIndex,
        );
        return [...kept, ...subPads];
      });
      void onSyncGuidanceState({
        currentMainQuestion: {
          text: nextQ.text,
          lens: nextQ.lens || null,
          purpose: nextQ.purpose,
          grounding: nextQ.grounding,
          phase: nextQ.phase,
        },
      });
    }
  }, [mainQuestionIndex, mainQuestions, stickyPads, loadPrepSubPads, onSyncGuidanceState]);

  const handlePrevQuestion = useCallback(() => {
    if (mainQuestionIndex <= 0) return;
    const prevIdx = mainQuestionIndex - 1;
    setMainQuestionIndex(prevIdx);

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

    if (prevQ) {
      void onSyncGuidanceState({
        currentMainQuestion: {
          text: prevQ.text,
          lens: prevQ.lens || null,
          purpose: prevQ.purpose,
          grounding: prevQ.grounding,
          phase: prevQ.phase,
        },
      });
    }
  }, [mainQuestionIndex, mainQuestions, completedByQuestion, stickyPads, loadPrepSubPads, onSyncGuidanceState]);

  const handlePhaseChange = useCallback((phase: DialoguePhase) => {
    // Reset main question navigation for new phase
    setMainQuestionIndex(0);
    setCompletedByQuestion(new Map());

    // Derive phase questions for the new phase
    const prep = prepRef.current;
    const wp = dialoguePhaseToWorkshopPhase(phase);
    const phaseQuestions = wp && prep?.phases?.[wp]?.questions
      ? [...prep.phases[wp].questions].sort((a, b) => a.order - b.order)
      : [];

    if (phaseQuestions.length > 0) {
      const subPads = loadPrepSubPads(phaseQuestions[0], 0);
      setStickyPads(subPads);
    } else {
      setStickyPads([]);
    }

    // Sync to server -- include the first main question as the new goal
    const firstQ = phaseQuestions[0];
    void onSyncGuidanceState({
      dialoguePhase: phase,
      currentMainQuestion: firstQ
        ? {
            text: firstQ.text,
            lens: firstQ.lens || null,
            purpose: firstQ.purpose,
            grounding: firstQ.grounding,
            phase: firstQ.phase,
          }
        : null,
    });
  }, [loadPrepSubPads, onSyncGuidanceState]);

  // ---- Pad action callbacks ----

  const handleDismissPad = useCallback((id: string) => {
    setStickyPads((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'dismissed' as const } : p)),
    );
  }, []);

  const handleSnoozePad = useCallback((id: string) => {
    setStickyPads((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: 'snoozed' as const, snoozedUntilMs: Date.now() + 60_000 }
          : p,
      ),
    );
  }, []);

  const handleOverflowPads = useCallback((padIds: string[]) => {
    setStickyPads((prev) =>
      prev.map((p) =>
        padIds.includes(p.id) ? { ...p, coverageState: 'covered' as const } : p,
      ),
    );
  }, []);

  const addAgentPad = useCallback((pad: StickyPad) => {
    setStickyPads((prev) => {
      // Dedup by id
      if (prev.some((p) => p.id === pad.id)) return prev;
      // Ensure mainQuestionIndex is set
      const enriched = {
        ...pad,
        mainQuestionIndex: pad.mainQuestionIndex ?? mainQuestionIndex,
      };
      return [...prev, enriched];
    });
  }, [mainQuestionIndex]);

  return {
    stickyPads,
    setStickyPads,
    mainQuestions,
    mainQuestionIndex,
    currentMainQuestion,
    handleNextQuestion,
    handlePrevQuestion,
    handlePhaseChange,
    activeSubPads,
    coveredSubPads,
    signalPads,
    mainQuestionCompletionPercent,
    completedByQuestion,
    collapsedSections,
    setCollapsedSections,
    handleDismissPad,
    handleSnoozePad,
    handleOverflowPads,
    addAgentPad,
  };
}

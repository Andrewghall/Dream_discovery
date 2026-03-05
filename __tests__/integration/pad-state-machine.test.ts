/**
 * Integration Tests - Pad State Machine (Coverage Logic)
 *
 * Tests the pure-logic coverage and auto-advance behaviours from
 * usePadStateMachine without React hooks. Simulates:
 * - Coverage threshold triggers (active -> covered transitions)
 * - Queued pad promotion (queued -> active when current covers)
 * - Auto-advance to next main question when all subs are covered
 * - Phase change resets
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { StickyPad, CoverageState, StickyPadSource, StickyPadType } from '@/lib/cognitive-guidance/pipeline';

// -----------------------------------------------------------------------
// Helpers: recreate the pure logic from use-pad-state-machine.ts
// These mirror the useEffect at lines 290-314 and 319-365
// -----------------------------------------------------------------------

/**
 * Coverage threshold auto-transition.
 * Mirrors the first useEffect in usePadStateMachine:
 * - If the current active prep pad has coveragePercent >= threshold,
 *   mark it covered and promote the next queued pad.
 */
function applyCoverageThreshold(
  pads: StickyPad[],
  threshold: number,
  mainQuestionIndex: number,
): StickyPad[] {
  const activePad = pads.find(
    (p) => p.coverageState === 'active' && p.source === 'prep',
  );
  if (!activePad || activePad.coveragePercent < threshold) return pads;

  // Mark current active as covered
  let updated = pads.map((p) =>
    p.id === activePad.id ? { ...p, coverageState: 'covered' as CoverageState } : p,
  );

  // Find next queued pad and activate it
  const nextQueued = updated
    .filter(
      (p) =>
        p.coverageState === 'queued' &&
        p.mainQuestionIndex === mainQuestionIndex,
    )
    .sort((a, b) => b.signalStrength - a.signalStrength)[0];

  if (nextQueued) {
    updated = updated.map((p) =>
      p.id === nextQueued.id ? { ...p, coverageState: 'active' as CoverageState } : p,
    );
  }

  return updated;
}

/**
 * Check if auto-advance to next main question should occur.
 * Mirrors the second useEffect in usePadStateMachine:
 * - All sub-pads for the current question must be 'covered'
 * - Must not be the last question
 */
function shouldAutoAdvance(
  pads: StickyPad[],
  mainQuestionIndex: number,
  totalMainQuestions: number,
): boolean {
  const allSubsForQuestion = pads.filter(
    (p) =>
      p.mainQuestionIndex === mainQuestionIndex &&
      p.source !== 'seed' &&
      p.source !== 'signal',
  );
  if (allSubsForQuestion.length === 0) return false;

  const allCovered = allSubsForQuestion.every(
    (p) => p.coverageState === 'covered',
  );
  if (!allCovered) return false;
  if (mainQuestionIndex >= totalMainQuestions - 1) return false;

  return true;
}

/**
 * Compute main question completion percent.
 * Mirrors the mainQuestionCompletionPercent useMemo.
 */
function computeCompletionPercent(
  pads: StickyPad[],
  mainQuestionIndex: number,
  journeyCompletionPercent: number | null,
): number {
  const allSubPads = pads.filter(
    (p) =>
      p.mainQuestionIndex === mainQuestionIndex &&
      p.source !== 'seed' &&
      p.source !== 'signal',
  );
  const avgSubCoverage =
    allSubPads.length > 0
      ? allSubPads.reduce((s, p) => s + p.coveragePercent, 0) / allSubPads.length
      : 0;
  const journeyFactor = journeyCompletionPercent ?? 0;
  return Math.round(
    journeyFactor > 0 ? avgSubCoverage * 0.7 + journeyFactor * 0.3 : avgSubCoverage,
  );
}

// -----------------------------------------------------------------------
// Test pad factory
// -----------------------------------------------------------------------

let padCounter = 0;

function makePad(overrides: Partial<StickyPad> = {}): StickyPad {
  padCounter++;
  return {
    id: `test-pad-${padCounter}`,
    type: 'CLARIFICATION' as StickyPadType,
    prompt: `Test question ${padCounter}`,
    signalStrength: 0.8,
    provenance: {
      triggerType: 'repeated_theme',
      sourceNodeIds: [],
      description: 'test',
    },
    createdAtMs: Date.now(),
    status: 'active',
    snoozedUntilMs: null,
    source: 'prep' as StickyPadSource,
    questionId: 'q1',
    grounding: 'test grounding',
    coveragePercent: 0,
    coverageState: 'active' as CoverageState,
    lens: 'People',
    mainQuestionIndex: 0,
    journeyGapId: null,
    padLabel: null,
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('Pad State Machine - Coverage Logic', () => {
  beforeEach(() => {
    padCounter = 0;
  });

  describe('Coverage Threshold Auto-Move', () => {
    it('marks active pad as covered when coverage >= threshold', () => {
      const threshold = 70;
      const pads = [
        makePad({ id: 'sub1', coverageState: 'active', coveragePercent: 72, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'queued', coveragePercent: 0, mainQuestionIndex: 0, source: 'prep', signalStrength: 0.7 }),
      ];

      const result = applyCoverageThreshold(pads, threshold, 0);

      const sub1 = result.find((p) => p.id === 'sub1')!;
      const sub2 = result.find((p) => p.id === 'sub2')!;

      expect(sub1.coverageState).toBe('covered');
      expect(sub2.coverageState).toBe('active');
    });

    it('does NOT transition when coverage is below threshold', () => {
      const threshold = 70;
      const pads = [
        makePad({ id: 'sub1', coverageState: 'active', coveragePercent: 65, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'queued', coveragePercent: 0, source: 'prep' }),
      ];

      const result = applyCoverageThreshold(pads, threshold, 0);

      expect(result.find((p) => p.id === 'sub1')!.coverageState).toBe('active');
      expect(result.find((p) => p.id === 'sub2')!.coverageState).toBe('queued');
    });

    it('promotes highest signalStrength queued pad when multiple queued pads exist', () => {
      const threshold = 70;
      const pads = [
        makePad({ id: 'sub1', coverageState: 'active', coveragePercent: 80, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'queued', signalStrength: 0.6, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sub3', coverageState: 'queued', signalStrength: 0.9, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sub4', coverageState: 'queued', signalStrength: 0.3, mainQuestionIndex: 0, source: 'prep' }),
      ];

      const result = applyCoverageThreshold(pads, threshold, 0);

      expect(result.find((p) => p.id === 'sub1')!.coverageState).toBe('covered');
      // sub3 has highest signalStrength (0.9) among queued pads
      expect(result.find((p) => p.id === 'sub3')!.coverageState).toBe('active');
      // Others remain queued
      expect(result.find((p) => p.id === 'sub2')!.coverageState).toBe('queued');
      expect(result.find((p) => p.id === 'sub4')!.coverageState).toBe('queued');
    });

    it('does not promote queued pads from a different mainQuestionIndex', () => {
      const threshold = 70;
      const pads = [
        makePad({ id: 'sub1', coverageState: 'active', coveragePercent: 85, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'queued', mainQuestionIndex: 1, source: 'prep', signalStrength: 0.9 }),
      ];

      const result = applyCoverageThreshold(pads, threshold, 0);

      expect(result.find((p) => p.id === 'sub1')!.coverageState).toBe('covered');
      // sub2 belongs to mainQuestionIndex 1, so it should NOT be promoted
      expect(result.find((p) => p.id === 'sub2')!.coverageState).toBe('queued');
    });

    it('only considers prep-sourced pads for threshold transition', () => {
      const threshold = 70;
      const pads = [
        makePad({ id: 'agent-pad', coverageState: 'active', coveragePercent: 90, source: 'agent' }),
        makePad({ id: 'prep-pad', coverageState: 'active', coveragePercent: 50, source: 'prep' }),
        makePad({ id: 'queued-pad', coverageState: 'queued', source: 'prep' }),
      ];

      const result = applyCoverageThreshold(pads, threshold, 0);

      // The agent pad has 90% coverage but the function only looks for prep-sourced active pads
      // The prep-pad is at 50%, below threshold, so no transition
      expect(result.find((p) => p.id === 'agent-pad')!.coverageState).toBe('active');
      expect(result.find((p) => p.id === 'prep-pad')!.coverageState).toBe('active');
      expect(result.find((p) => p.id === 'queued-pad')!.coverageState).toBe('queued');
    });

    it('handles coverage exactly at threshold (edge case)', () => {
      const threshold = 70;
      const pads = [
        makePad({ id: 'sub1', coverageState: 'active', coveragePercent: 70, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'queued', source: 'prep', mainQuestionIndex: 0 }),
      ];

      const result = applyCoverageThreshold(pads, threshold, 0);

      // 70 >= 70 is true, so it should transition
      expect(result.find((p) => p.id === 'sub1')!.coverageState).toBe('covered');
      expect(result.find((p) => p.id === 'sub2')!.coverageState).toBe('active');
    });
  });

  describe('Full Main-Question Auto-Advance', () => {
    it('auto-advances to next main question when all subs covered', () => {
      const pads = [
        makePad({ id: 'sub1', coverageState: 'covered', coveragePercent: 80, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'covered', coveragePercent: 75, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sub3', coverageState: 'covered', coveragePercent: 90, mainQuestionIndex: 0, source: 'agent' }),
      ];

      const result = shouldAutoAdvance(pads, 0, 5);
      expect(result).toBe(true);
    });

    it('does NOT auto-advance when some subs are still active', () => {
      const pads = [
        makePad({ id: 'sub1', coverageState: 'covered', mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'active', mainQuestionIndex: 0, source: 'prep' }),
      ];

      const result = shouldAutoAdvance(pads, 0, 5);
      expect(result).toBe(false);
    });

    it('does NOT auto-advance when some subs are queued', () => {
      const pads = [
        makePad({ id: 'sub1', coverageState: 'covered', mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'queued', mainQuestionIndex: 0, source: 'prep' }),
      ];

      const result = shouldAutoAdvance(pads, 0, 5);
      expect(result).toBe(false);
    });

    it('does NOT auto-advance on the last question', () => {
      const pads = [
        makePad({ id: 'sub1', coverageState: 'covered', mainQuestionIndex: 4, source: 'prep' }),
        makePad({ id: 'sub2', coverageState: 'covered', mainQuestionIndex: 4, source: 'prep' }),
      ];

      // Question index 4 of 5 total (0-indexed) -> last question
      const result = shouldAutoAdvance(pads, 4, 5);
      expect(result).toBe(false);
    });

    it('ignores signal and seed pads when checking all-covered', () => {
      const pads = [
        makePad({ id: 'prep-1', coverageState: 'covered', mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'agent-1', coverageState: 'covered', mainQuestionIndex: 0, source: 'agent' }),
        // signal and seed pads are NOT counted for auto-advance
        makePad({ id: 'signal-1', coverageState: 'active', mainQuestionIndex: 0, source: 'signal' }),
        makePad({ id: 'seed-1', coverageState: 'active', mainQuestionIndex: 0, source: 'seed' }),
      ];

      const result = shouldAutoAdvance(pads, 0, 3);
      // prep and agent are covered; signal/seed are excluded from the check
      expect(result).toBe(true);
    });

    it('does NOT auto-advance when there are no sub-pads for the question', () => {
      const pads: StickyPad[] = [];

      const result = shouldAutoAdvance(pads, 0, 5);
      expect(result).toBe(false);
    });

    it('only considers pads for the current mainQuestionIndex', () => {
      const pads = [
        makePad({ id: 'q0-1', coverageState: 'covered', mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'q0-2', coverageState: 'covered', mainQuestionIndex: 0, source: 'prep' }),
        // Question 1 has an uncovered pad -- but we are checking question 0
        makePad({ id: 'q1-1', coverageState: 'active', mainQuestionIndex: 1, source: 'prep' }),
      ];

      const result = shouldAutoAdvance(pads, 0, 3);
      expect(result).toBe(true);
    });
  });

  describe('Completion Percent Calculation', () => {
    it('computes average sub-pad coverage when no journey data', () => {
      const pads = [
        makePad({ id: 'p1', coveragePercent: 60, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'p2', coveragePercent: 80, mainQuestionIndex: 0, source: 'prep' }),
      ];

      const result = computeCompletionPercent(pads, 0, null);
      // Average: (60 + 80) / 2 = 70
      expect(result).toBe(70);
    });

    it('blends sub-pad coverage with journey completion when available', () => {
      const pads = [
        makePad({ id: 'p1', coveragePercent: 60, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'p2', coveragePercent: 80, mainQuestionIndex: 0, source: 'prep' }),
      ];

      // Average sub: 70, journey: 50
      // Blended: 70 * 0.7 + 50 * 0.3 = 49 + 15 = 64
      const result = computeCompletionPercent(pads, 0, 50);
      expect(result).toBe(64);
    });

    it('excludes signal and seed pads from completion calculation', () => {
      const pads = [
        makePad({ id: 'p1', coveragePercent: 80, mainQuestionIndex: 0, source: 'prep' }),
        makePad({ id: 'sig1', coveragePercent: 10, mainQuestionIndex: 0, source: 'signal' }),
        makePad({ id: 'seed1', coveragePercent: 5, mainQuestionIndex: 0, source: 'seed' }),
      ];

      const result = computeCompletionPercent(pads, 0, null);
      // Only prep pad counts: 80
      expect(result).toBe(80);
    });

    it('returns 0 when no relevant sub-pads exist', () => {
      const pads: StickyPad[] = [];
      const result = computeCompletionPercent(pads, 0, null);
      expect(result).toBe(0);
    });
  });
});

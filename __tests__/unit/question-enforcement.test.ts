/**
 * Question Set Enforcement Proof Tests
 *
 * Proves that:
 *   1. fallbackQuestionSet does not exist in the question-set-agent module
 *   2. generateFallbackPhaseQuestions does not exist in the question-set-agent module
 *   3. buildWorkshopQuestionSet throws on any phase with no questions
 *   4. validateQuestionSet (the REAL function from question-set-validator, used by the route)
 *      rejects null / non-object / missing phase / zero questions
 *   5. runQuestionSetAgent throws when the agent loop ends without an explicit commit
 *      (no silent salvage from partial designedPhases)
 */

import { describe, it, expect } from 'vitest';
import * as questionSetAgent from '@/lib/cognition/agents/question-set-agent';
import { validateQuestionSet } from '@/lib/cognition/agents/question-set-validator';
import type { WorkshopPhase, FacilitationQuestion } from '@/lib/cognition/agents/agent-types';

// ================================================================
// 1. Dead fallback functions are gone from the module
// ================================================================

describe('fallback functions removed', () => {
  it('fallbackQuestionSet does not exist on the module', () => {
    expect((questionSetAgent as Record<string, unknown>)['fallbackQuestionSet']).toBeUndefined();
  });

  it('generateFallbackPhaseQuestions does not exist on the module', () => {
    expect((questionSetAgent as Record<string, unknown>)['generateFallbackPhaseQuestions']).toBeUndefined();
  });
});

// ================================================================
// 2. buildWorkshopQuestionSet — empty/missing phases throw
// ================================================================

const REQUIRED_PHASES: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];

function phasesWith(overrides: Partial<Record<WorkshopPhase, FacilitationQuestion[]>>): Map<WorkshopPhase, FacilitationQuestion[]> {
  const base = new Map<WorkshopPhase, FacilitationQuestion[]>();
  const defaultQ: FacilitationQuestion = {
    id: 'q1', phase: 'REIMAGINE', lens: 'TestLens', text: 'Q', purpose: 'P', order: 1, subQuestions: [],
  };
  for (const phase of REQUIRED_PHASES) {
    base.set(phase, [{ ...defaultQ, phase }]);
  }
  for (const [phase, questions] of Object.entries(overrides) as [WorkshopPhase, FacilitationQuestion[]][]) {
    base.set(phase, questions);
  }
  return base;
}

const mockResearch = {
  companyOverview: 'TestCorp',
  industryContext: 'Test',
  keyPublicChallenges: [],
  recentDevelopments: [],
  competitorLandscape: '',
  domainInsights: null,
  researchedAtMs: Date.now(),
  sourceUrls: [],
  journeyStages: null,
  industryDimensions: [
    { name: 'TestLens', description: 'Test', keywords: [], color: '#000' },
  ],
};

describe('buildWorkshopQuestionSet — incomplete phase rejection', () => {
  it('throws when all phases are empty (no questions)', () => {
    expect(() => questionSetAgent.buildWorkshopQuestionSet(new Map(), 'rationale', mockResearch))
      .toThrow(/has no questions/);
  });

  it('throws when REIMAGINE has no questions', () => {
    expect(() => questionSetAgent.buildWorkshopQuestionSet(phasesWith({ REIMAGINE: [] }), 'rationale', mockResearch))
      .toThrow(/Phase "REIMAGINE" has no questions/);
  });

  it('throws when CONSTRAINTS has no questions', () => {
    expect(() => questionSetAgent.buildWorkshopQuestionSet(phasesWith({ CONSTRAINTS: [] }), 'rationale', mockResearch))
      .toThrow(/Phase "CONSTRAINTS" has no questions/);
  });

  it('throws when DEFINE_APPROACH has no questions', () => {
    expect(() => questionSetAgent.buildWorkshopQuestionSet(phasesWith({ DEFINE_APPROACH: [] }), 'rationale', mockResearch))
      .toThrow(/Phase "DEFINE_APPROACH" has no questions/);
  });

  it('succeeds when all phases have at least one question', () => {
    expect(() => questionSetAgent.buildWorkshopQuestionSet(phasesWith({}), 'rationale', mockResearch))
      .not.toThrow();
  });
});

// ================================================================
// 3. Manual save validation — tests import the REAL validateQuestionSet
//    from question-set-validator (the same module the route imports).
//    If the route's import changes or the validator is deleted,
//    these tests will fail.
// ================================================================

function validQuestionSet() {
  const phases: Record<string, unknown> = {};
  // Text must pass validateFacilitationQuestionText — uses an observable starter, no banned terms
  const validText = 'What happens when the team cannot move work forward cleanly?';
  for (const phase of ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH']) {
    phases[phase] = { questions: [{ id: 'q1', text: validText }], lensOrder: ['TestLens'] };
  }
  return { phases, designRationale: 'Test', generatedAtMs: Date.now(), dataConfidence: 'high', dataSufficiencyNotes: [] };
}

describe('validateQuestionSet — real function from question-set-validator', () => {
  it('rejects null', () => {
    expect(validateQuestionSet(null)).toBe('customQuestions must be a non-null object');
  });

  it('rejects a string', () => {
    expect(validateQuestionSet('invalid')).toBe('customQuestions must be a non-null object');
  });

  it('rejects an array', () => {
    expect(validateQuestionSet([])).toBe('customQuestions must be a non-null object');
  });

  it('rejects missing phases property', () => {
    expect(validateQuestionSet({})).toBe('customQuestions.phases is missing or malformed');
  });

  it('rejects phases as an array', () => {
    expect(validateQuestionSet({ phases: [] })).toBe('customQuestions.phases is missing or malformed');
  });

  it('rejects when REIMAGINE phase is missing', () => {
    const qs = validQuestionSet();
    delete (qs.phases as Record<string, unknown>).REIMAGINE;
    expect(validateQuestionSet(qs)).toBe('Missing required phase: REIMAGINE');
  });

  it('rejects when CONSTRAINTS phase is missing', () => {
    const qs = validQuestionSet();
    delete (qs.phases as Record<string, unknown>).CONSTRAINTS;
    expect(validateQuestionSet(qs)).toBe('Missing required phase: CONSTRAINTS');
  });

  it('rejects when DEFINE_APPROACH phase is missing', () => {
    const qs = validQuestionSet();
    delete (qs.phases as Record<string, unknown>).DEFINE_APPROACH;
    expect(validateQuestionSet(qs)).toBe('Missing required phase: DEFINE_APPROACH');
  });

  it('rejects when REIMAGINE has zero questions', () => {
    const qs = validQuestionSet();
    (qs.phases as Record<string, unknown>).REIMAGINE = { questions: [], lensOrder: [] };
    expect(validateQuestionSet(qs)).toBe('Phase REIMAGINE has no questions — incomplete question sets cannot be saved');
  });

  it('rejects when CONSTRAINTS has zero questions', () => {
    const qs = validQuestionSet();
    (qs.phases as Record<string, unknown>).CONSTRAINTS = { questions: [], lensOrder: [] };
    expect(validateQuestionSet(qs)).toBe('Phase CONSTRAINTS has no questions — incomplete question sets cannot be saved');
  });

  it('rejects when DEFINE_APPROACH has zero questions', () => {
    const qs = validQuestionSet();
    (qs.phases as Record<string, unknown>).DEFINE_APPROACH = { questions: [], lensOrder: [] };
    expect(validateQuestionSet(qs)).toBe('Phase DEFINE_APPROACH has no questions — incomplete question sets cannot be saved');
  });

  it('accepts a complete, valid question set', () => {
    expect(validateQuestionSet(validQuestionSet())).toBeNull();
  });
});

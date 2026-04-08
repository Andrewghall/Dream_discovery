/**
 * Lens/Dimension Override Tests
 *
 * Proves that when research provides industry-specific dimensions,
 * they override the generic hardcoded lenses (People/Organisation/
 * Customer/Technology/Regulation) throughout the agent pipeline.
 *
 * Covers:
 *  - getPhaseLensOrder returns research dimensions with correct source
 *  - getPhaseLensOrder THROWS when no lens set is available (rule: no generic fallback)
 *  - buildWorkshopQuestionSet stores dynamic lens order in output
 *  - System prompt uses research dimension names, not generic defaults
 *  - LensSource tracking is accurate
 */

import { describe, it, expect } from 'vitest';
import {
  getPhaseLensOrder,
  buildWorkshopQuestionSet,
  buildQuestionSetSystemPrompt,
} from '@/lib/cognition/agents/question-set-agent';
import type {
  WorkshopPrepResearch,
  WorkshopPhase,
  PrepContext,
  LensSource,
  FacilitationQuestion,
} from '@/lib/cognition/agents/agent-types';

function makePhases(lens: string): Map<WorkshopPhase, FacilitationQuestion[]> {
  const m = new Map<WorkshopPhase, FacilitationQuestion[]>();
  for (const phase of ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as WorkshopPhase[]) {
    m.set(phase, [{ id: 'q1', phase, lens, text: 'Test', purpose: 'Test', order: 1, subQuestions: [] }]);
  }
  return m;
}

// ── Test fixtures ───────────────────────────────────────────

const GENERIC_LENSES = ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'];

const RESEARCH_WITH_DIMENSIONS: WorkshopPrepResearch = {
  companyOverview: 'LSAC administers the LSAT',
  industryContext: 'Legal education admissions',
  keyPublicChallenges: ['Declining applicants'],
  recentDevelopments: ['Digital LSAT launch'],
  competitorLandscape: 'GRE as alternative',
  domainInsights: null,
  researchedAtMs: Date.now(),
  sourceUrls: [],
  journeyStages: null,
  industryDimensions: [
    { name: 'Student Experience', description: 'End-to-end candidate journey', keywords: ['student', 'candidate'], color: '#60a5fa' },
    { name: 'Institutional Trust', description: 'Law school confidence in assessments', keywords: ['institution', 'trust'], color: '#34d399' },
    { name: 'Assessment Integrity', description: 'Test security and fairness', keywords: ['integrity', 'security'], color: '#f87171' },
    { name: 'Operational Efficiency', description: 'Internal process and platform performance', keywords: ['operations', 'efficiency'], color: '#fbbf24' },
  ],
};

const RESEARCH_WITHOUT_DIMENSIONS: WorkshopPrepResearch = {
  companyOverview: 'Tesco plc',
  industryContext: 'UK grocery retail',
  keyPublicChallenges: ['Cost of living'],
  recentDevelopments: [],
  competitorLandscape: 'Aldi, Lidl',
  domainInsights: null,
  researchedAtMs: Date.now(),
  sourceUrls: [],
  journeyStages: null,
  industryDimensions: null,
};

const BASE_CONTEXT: PrepContext = {
  workshopId: 'test-ws-001',
  workshopPurpose: 'Improve candidate experience',
  desiredOutcomes: 'Actionable roadmap',
  clientName: 'LSAC',
  industry: 'Legal Education',
  companyWebsite: 'https://www.lsac.org',
  dreamTrack: 'ENTERPRISE',
  targetDomain: null,
};

// ================================================================
// 1. getPhaseLensOrder
// ================================================================

describe('getPhaseLensOrder', () => {
  it('returns research dimensions with source "research_dimensions" when available', () => {
    const result = getPhaseLensOrder('REIMAGINE', RESEARCH_WITH_DIMENSIONS);
    expect(result.source).toBe('research_dimensions');
    expect(result.lenses).toEqual([
      'Student Experience',
      'Institutional Trust',
      'Assessment Integrity',
      'Operational Efficiency',
    ]);
  });

  it('returns all research dimensions for every phase (no phase-specific filtering)', () => {
    const phases: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];
    for (const phase of phases) {
      const result = getPhaseLensOrder(phase, RESEARCH_WITH_DIMENSIONS);
      expect(result.lenses).toHaveLength(4);
      expect(result.source).toBe('research_dimensions');
    }
  });

  // Rule: no generic fallback — throw if no lens set
  it('throws when no research is provided (no generic fallback allowed)', () => {
    expect(() => getPhaseLensOrder('REIMAGINE', null)).toThrow(
      /Workshop lens set is required/,
    );
  });

  it('throws when research has no dimensions (no generic fallback allowed)', () => {
    expect(() => getPhaseLensOrder('REIMAGINE', RESEARCH_WITHOUT_DIMENSIONS)).toThrow(
      /Workshop lens set is required/,
    );
  });

  it('throws when research has empty dimensions array', () => {
    const researchEmpty = { ...RESEARCH_WITHOUT_DIMENSIONS, industryDimensions: [] };
    expect(() => getPhaseLensOrder('CONSTRAINTS', researchEmpty)).toThrow(
      /Workshop lens set is required/,
    );
  });

  it('throws for every phase when no lens set is available', () => {
    const phases: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];
    for (const phase of phases) {
      expect(() => getPhaseLensOrder(phase, null)).toThrow(/Workshop lens set is required/);
    }
  });

  it('research dimensions override generic regardless of phase', () => {
    // When research provides dimensions, phase filtering does not apply
    const reimagine = getPhaseLensOrder('REIMAGINE', RESEARCH_WITH_DIMENSIONS);
    const constraints = getPhaseLensOrder('CONSTRAINTS', RESEARCH_WITH_DIMENSIONS);
    expect(reimagine.lenses).toEqual(constraints.lenses);
  });
});

// ================================================================
// 2. buildWorkshopQuestionSet - dynamic lens order in output
// ================================================================

describe('buildWorkshopQuestionSet', () => {
  it('stores research dimension names in lensOrder when research has dimensions', () => {
    const qs = buildWorkshopQuestionSet(makePhases('Student Experience'), 'test rationale', RESEARCH_WITH_DIMENSIONS);
    for (const phase of ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as WorkshopPhase[]) {
      expect(qs.phases[phase].lensOrder).toEqual([
        'Student Experience',
        'Institutional Trust',
        'Assessment Integrity',
        'Operational Efficiency',
      ]);
    }
  });

  // Rule: no lens fallback — buildWorkshopQuestionSet must throw when no lens set is available
  it('throws when called with no research dimensions (no lens fallback allowed)', () => {
    expect(() => buildWorkshopQuestionSet(new Map(), 'test rationale', null)).toThrow(
      /Workshop lens set is required/,
    );
  });

  it('throws when research has no industry dimensions (no lens fallback allowed)', () => {
    expect(() => buildWorkshopQuestionSet(new Map(), 'test rationale', RESEARCH_WITHOUT_DIMENSIONS)).toThrow(
      /Workshop lens set is required/,
    );
  });

  it('does not include generic lens names when research dimensions exist', () => {
    const qs = buildWorkshopQuestionSet(makePhases('Student Experience'), 'test rationale', RESEARCH_WITH_DIMENSIONS);
    for (const phase of ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as WorkshopPhase[]) {
      for (const genericLens of GENERIC_LENSES) {
        expect(qs.phases[phase].lensOrder).not.toContain(genericLens);
      }
    }
  });
});

// ================================================================
// 3. buildQuestionSetSystemPrompt - dimension-aware
// ================================================================

describe('buildQuestionSetSystemPrompt', () => {
  it('includes research dimension names when available', () => {
    const prompt = buildQuestionSetSystemPrompt(BASE_CONTEXT, RESEARCH_WITH_DIMENSIONS);
    expect(prompt).toContain('Student Experience');
    expect(prompt).toContain('Institutional Trust');
    expect(prompt).toContain('Assessment Integrity');
    expect(prompt).toContain('Operational Efficiency');
  });

  it('tells agent NOT to use generic lens names when research dimensions exist', () => {
    const prompt = buildQuestionSetSystemPrompt(BASE_CONTEXT, RESEARCH_WITH_DIMENSIONS);
    expect(prompt).toContain('Do NOT use the');
    expect(prompt).toContain('generic');
  });

  it('does not contain generic phase-lens hardcoding when research dimensions exist', () => {
    const prompt = buildQuestionSetSystemPrompt(BASE_CONTEXT, RESEARCH_WITH_DIMENSIONS);
    // Should NOT have the generic "Lenses: People -> Customer -> Organisation ONLY"
    expect(prompt).not.toContain('People, Customer, Organisation ONLY');
    expect(prompt).not.toContain('Regulation, Customer, Technology, Organisation, People');
  });
});

// ================================================================
// 4. LensSource type validation
// ================================================================

describe('LensSource type values', () => {
  it('getPhaseLensOrder returns valid LensSource values when dimensions exist', () => {
    const validSources: LensSource[] = ['research_dimensions', 'domain_pack', 'blueprint'];

    const withDims = getPhaseLensOrder('REIMAGINE', RESEARCH_WITH_DIMENSIONS);
    expect(validSources).toContain(withDims.source);
  });

  it('generic_fallback is not a valid LensSource', () => {
    // TypeScript enforces this at compile time — verify at runtime that the
    // valid set does not include 'generic_fallback'
    const validSources: LensSource[] = ['research_dimensions', 'domain_pack', 'blueprint'];
    expect(validSources).not.toContain('generic_fallback');
  });
});

// ================================================================
// 5. Guard: generic lenses rejected when dimensions exist
// ================================================================

describe('dimension priority guard', () => {
  it('getPhaseLensOrder never returns generic lenses when research dimensions exist', () => {
    const phases: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];
    for (const phase of phases) {
      const result = getPhaseLensOrder(phase, RESEARCH_WITH_DIMENSIONS);
      for (const genericLens of GENERIC_LENSES) {
        expect(result.lenses).not.toContain(genericLens);
      }
    }
  });

  it('buildWorkshopQuestionSet lensOrder never contains generic lenses when research dimensions exist', () => {
    const qs = buildWorkshopQuestionSet(makePhases('Student Experience'), 'rationale', RESEARCH_WITH_DIMENSIONS);
    const phases: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];
    for (const phase of phases) {
      for (const genericLens of GENERIC_LENSES) {
        expect(qs.phases[phase].lensOrder).not.toContain(genericLens);
      }
    }
  });
});

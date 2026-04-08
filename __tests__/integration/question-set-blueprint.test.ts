/**
 * Question Set Agent -- Blueprint Integration Tests
 *
 * Covers:
 *  - getPhaseLensOrder() priority: blueprint > research (throws if neither present)
 *  - buildQuestionSetSystemPrompt() with/without blueprint constraints
 *  - buildWorkshopQuestionSet() includes dataConfidence and dataSufficiencyNotes
 *  - get_blueprint_constraints tool handler behavior
 */

import { describe, it, expect } from 'vitest';
import {
  getPhaseLensOrder,
  buildQuestionSetSystemPrompt,
  buildWorkshopQuestionSet,
} from '@/lib/cognition/agents/question-set-agent';
import { generateBlueprint } from '@/lib/cognition/workshop-blueprint-generator';
import { DEFAULT_BLUEPRINT } from '@/lib/workshop/blueprint';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';
import type {
  WorkshopPrepResearch,
  PrepContext,
  FacilitationQuestion,
  WorkshopPhase,
} from '@/lib/cognition/agents/agent-types';

// ================================================================
// Helpers
// ================================================================

const baseContext: PrepContext = {
  workshopId: 'test-ws-1',
  workshopPurpose: 'Assess contact centre operational maturity',
  desiredOutcomes: 'Evidence-based improvement roadmap',
  clientName: 'TestCorp',
  industry: 'Telecommunications',
  companyWebsite: 'https://testcorp.example.com',
  dreamTrack: 'DOMAIN',
  targetDomain: 'Contact Centre',
};

const mockResearch: WorkshopPrepResearch = {
  companyOverview: 'TestCorp is a telecom company',
  industryContext: 'Telecommunications sector',
  keyPublicChallenges: ['Customer churn', 'Agent attrition'],
  recentDevelopments: ['AI rollout', 'New CRM platform'],
  competitorLandscape: 'Competitive market',
  domainInsights: 'Contact centre specific insights',
  researchedAtMs: Date.now(),
  sourceUrls: [],
  journeyStages: [
    { name: 'Contact Initiation', description: 'Customer reaches out', typicalTouchpoints: ['phone', 'chat'] },
    { name: 'Resolution Delivery', description: 'Issue gets resolved', typicalTouchpoints: ['agent', 'self-service'] },
  ],
  industryDimensions: [
    { name: 'Agent Experience', description: 'How agents feel about their work', keywords: ['agent', 'employee'], color: '#60a5fa' },
    { name: 'Customer Satisfaction', description: 'End customer happiness', keywords: ['customer', 'satisfaction'], color: '#a78bfa' },
    { name: 'Operational Efficiency', description: 'Process and cost metrics', keywords: ['efficiency', 'operations'], color: '#34d399' },
  ],
};

function ccBlueprint(): WorkshopBlueprint {
  return generateBlueprint({
    industry: 'Telecommunications',
    dreamTrack: 'DOMAIN',
    engagementType: 'diagnostic_baseline',
    domainPack: 'contact_centre',
    purpose: 'Assess operational maturity',
    outcomes: 'Evidence-based improvement roadmap',
  });
}

function ccBlueprintWithResearch(): WorkshopBlueprint {
  return generateBlueprint({
    industry: 'Telecommunications',
    dreamTrack: 'DOMAIN',
    engagementType: 'diagnostic_baseline',
    domainPack: 'contact_centre',
    purpose: 'Assess operational maturity',
    outcomes: 'Evidence-based improvement roadmap',
    researchDimensions: mockResearch.industryDimensions,
    researchJourneyStages: mockResearch.journeyStages,
  });
}

// ================================================================
// getPhaseLensOrder() priority tests
// ================================================================

describe('getPhaseLensOrder -- blueprint priority', () => {
  it('returns blueprint lenses when blueprint has phaseLensPolicy', () => {
    const bp = ccBlueprintWithResearch();
    const result = getPhaseLensOrder('REIMAGINE', mockResearch, bp);
    // Blueprint (with research overrides) should be used, not raw research
    expect(result.lenses.length).toBeGreaterThan(0);
    expect(result.source).not.toBe('generic_fallback');
  });

  it('falls back to research dimensions when blueprint is null', () => {
    const result = getPhaseLensOrder('REIMAGINE', mockResearch, null);
    expect(result.lenses).toEqual(['Agent Experience', 'Customer Satisfaction', 'Operational Efficiency']);
    expect(result.source).toBe('research_dimensions');
  });

  it('throws when both blueprint and research are null (no generic fallback allowed)', () => {
    expect(() => getPhaseLensOrder('REIMAGINE', null, null)).toThrow(
      /Workshop lens set is required/,
    );
  });

  it('blueprint takes priority over research even when both are provided', () => {
    const bp = ccBlueprint(); // Domain pack based, no research overrides
    const result = getPhaseLensOrder('CONSTRAINTS', mockResearch, bp);
    // Blueprint should win -- it has domain pack lenses from contact_centre
    expect(result.source).toBe('domain_pack');
  });

  it('returns blueprint research_dimensions source when blueprint has research-derived lenses', () => {
    const bp = ccBlueprintWithResearch();
    const result = getPhaseLensOrder('DEFINE_APPROACH', mockResearch, bp);
    // Blueprint has research overrides, no domainPack on the generated blueprint
    expect(result.source).not.toBe('generic_fallback');
  });

  it('handles empty phaseLensPolicy in blueprint gracefully', () => {
    const bp: WorkshopBlueprint = {
      ...DEFAULT_BLUEPRINT,
      phaseLensPolicy: { REIMAGINE: [], CONSTRAINTS: [], DEFINE_APPROACH: [] },
    };
    const result = getPhaseLensOrder('REIMAGINE', mockResearch, bp);
    // Empty arrays should fall through to research
    expect(result.lenses).toEqual(['Agent Experience', 'Customer Satisfaction', 'Operational Efficiency']);
    expect(result.source).toBe('research_dimensions');
  });
});

// ================================================================
// buildQuestionSetSystemPrompt() -- blueprint constraint injection
// ================================================================

describe('buildQuestionSetSystemPrompt -- blueprint constraints', () => {
  it('includes REQUIRED TOPICS when blueprint has requiredTopics', () => {
    const bp = ccBlueprint();
    const ctx: PrepContext = { ...baseContext, blueprint: bp };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);

    expect(prompt).toContain('QUESTION CONSTRAINTS (from workshop blueprint)');
    expect(prompt).toContain('REQUIRED TOPICS');
    // Contact centre blueprint should include AHT-related topics
    expect(prompt).toContain('Handle time');
  });

  it('includes FORBIDDEN TOPICS when blueprint has forbiddenTopics', () => {
    const bp = ccBlueprint();
    const ctx: PrepContext = { ...baseContext, blueprint: bp };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);

    expect(prompt).toContain('FORBIDDEN TOPICS');
    // Contact centre should forbid M&A strategy
    expect(prompt).toContain('M&A');
  });

  it('includes FOCUS AREAS when blueprint has focusAreas', () => {
    const bp = ccBlueprint();
    const ctx: PrepContext = { ...baseContext, blueprint: bp };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);

    expect(prompt).toContain('FOCUS AREAS');
  });

  it('includes DOMAIN METRICS when blueprint has domainMetrics', () => {
    const bp = ccBlueprint();
    const ctx: PrepContext = { ...baseContext, blueprint: bp };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);

    expect(prompt).toContain('DOMAIN METRICS');
    expect(prompt).toContain('AHT');
    expect(prompt).toContain('FCR');
    expect(prompt).toContain('CSAT');
  });

  it('includes QUESTION POLICY from blueprint', () => {
    const bp = ccBlueprint();
    const ctx: PrepContext = { ...baseContext, blueprint: bp };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);

    expect(prompt).toContain('QUESTION POLICY');
    expect(prompt).toContain('questions per phase');
    expect(prompt).toContain('sub-questions per main');
  });

  it('omits constraint section when blueprint has no questionConstraints', () => {
    const ctx: PrepContext = { ...baseContext, blueprint: null };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);

    expect(prompt).not.toContain('QUESTION CONSTRAINTS');
    expect(prompt).not.toContain('REQUIRED TOPICS');
    expect(prompt).not.toContain('FORBIDDEN TOPICS');
  });

  it('omits constraint section when blueprint is DEFAULT_BLUEPRINT (empty constraints)', () => {
    const ctx: PrepContext = { ...baseContext, blueprint: { ...DEFAULT_BLUEPRINT } };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);

    // DEFAULT_BLUEPRINT has no questionConstraints (null)
    expect(prompt).not.toContain('QUESTION CONSTRAINTS');
  });

  it('uses blueprint question count in YOUR APPROACH section', () => {
    const bp = ccBlueprint();
    const ctx: PrepContext = { ...baseContext, blueprint: bp };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);

    const qPerPhase = bp.questionPolicy.questionsPerPhase;
    expect(prompt).toContain(`Design ${qPerPhase} facilitation questions per phase`);
  });

  it('includes diagnosticFocus when present in blueprint', () => {
    const bp = ccBlueprint();
    // The CC blueprint with diagnostic_baseline should have diagnosticFocus
    if (bp.diagnosticFocus) {
      const ctx: PrepContext = { ...baseContext, blueprint: bp };
      const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);
      expect(prompt).toContain('DIAGNOSTIC FOCUS');
    }
  });

  it('does not contain em-dashes (U+2014)', () => {
    const bp = ccBlueprint();
    const ctx: PrepContext = { ...baseContext, blueprint: bp };
    const prompt = buildQuestionSetSystemPrompt(ctx, mockResearch, null);
    expect(prompt).not.toContain('\u2014');
  });
});

// ================================================================
// buildWorkshopQuestionSet() -- data sufficiency
// ================================================================

function makePhases(): Map<WorkshopPhase, FacilitationQuestion[]> {
  const phases = new Map<WorkshopPhase, FacilitationQuestion[]>();
  for (const phase of ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as WorkshopPhase[]) {
    phases.set(phase, [{
      id: 'test-q',
      phase,
      lens: 'Agent Experience',
      text: 'Test question',
      purpose: 'Test',
      order: 1,
      subQuestions: [],
    }]);
  }
  return phases;
}

describe('buildWorkshopQuestionSet -- data sufficiency', () => {
  it('includes dataConfidence in output', () => {
    const result = buildWorkshopQuestionSet(
      makePhases(), 'Test rationale', mockResearch, null, 'high', ['All data available'],
    );
    expect(result.dataConfidence).toBe('high');
  });

  it('includes dataSufficiencyNotes in output', () => {
    const notes = ['No Discovery data', 'Research was limited'];
    const result = buildWorkshopQuestionSet(
      makePhases(), 'Test rationale', mockResearch, null, 'moderate', notes,
    );
    expect(result.dataSufficiencyNotes).toEqual(notes);
  });

  it('defaults to low confidence when not provided', () => {
    const result = buildWorkshopQuestionSet(
      makePhases(), 'Test rationale', mockResearch,
    );
    expect(result.dataConfidence).toBe('low');
    expect(result.dataSufficiencyNotes).toEqual(['No data confidence assessment available']);
  });

  it('uses blueprint lenses in phase lens order', () => {
    const bp = ccBlueprintWithResearch();
    const result = buildWorkshopQuestionSet(
      makePhases(), 'Test rationale', mockResearch, bp, 'high', [],
    );
    // CONSTRAINTS phase should use blueprint lenses, not generic defaults
    const constraintLenses = result.phases.CONSTRAINTS.lensOrder;
    expect(constraintLenses).not.toEqual(['Regulation', 'Customer', 'Technology', 'Organisation', 'People']);
  });

  it('throws when a phase has no questions (incomplete question set not allowed)', () => {
    expect(() => buildWorkshopQuestionSet(
      new Map(), 'Test rationale', mockResearch,
    )).toThrow(/has no questions/);
  });

  it('has generatedAtMs timestamp', () => {
    const before = Date.now();
    const result = buildWorkshopQuestionSet(
      makePhases(), 'Test rationale', mockResearch,
    );
    expect(result.generatedAtMs).toBeGreaterThanOrEqual(before);
  });
});

// ================================================================
// Enterprise blueprint (no domain constraints)
// ================================================================

describe('Enterprise blueprint -- no domain constraints', () => {
  it('system prompt omits constraint block for enterprise without engagement type', () => {
    const bp = generateBlueprint({
      industry: 'Financial Services',
      dreamTrack: 'ENTERPRISE',
      engagementType: null,
      domainPack: null,
      purpose: 'Strategic assessment',
      outcomes: 'Transformation roadmap',
    });

    const ctx: PrepContext = {
      ...baseContext,
      dreamTrack: 'ENTERPRISE',
      targetDomain: null,
      blueprint: bp,
    };

    const prompt = buildQuestionSetSystemPrompt(ctx, null, null);
    // Enterprise without engagement type has no questionConstraints
    expect(prompt).not.toContain('REQUIRED TOPICS');
  });

  it('system prompt includes constraints for enterprise + transformation sprint', () => {
    const bp = generateBlueprint({
      industry: 'Financial Services',
      dreamTrack: 'ENTERPRISE',
      engagementType: 'transformation_sprint',
      domainPack: 'enterprise',
      purpose: 'Strategic assessment',
      outcomes: 'Transformation roadmap',
    });

    const ctx: PrepContext = {
      ...baseContext,
      dreamTrack: 'ENTERPRISE',
      targetDomain: null,
      blueprint: bp,
    };

    const prompt = buildQuestionSetSystemPrompt(ctx, null, null);
    expect(prompt).toContain('REQUIRED TOPICS');
    // Enterprise + transformation sprint should have transformation-specific topics
    expect(prompt).toContain('30/60/90');
  });
});

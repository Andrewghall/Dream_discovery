/**
 * Workshop Blueprint Generator Tests
 *
 * Covers:
 *  - Contact centre + diagnostic baseline (domain journey, metrics, actors)
 *  - HR + cultural alignment (HR journey, engagement modifier merge)
 *  - Enterprise strategic + transformation sprint (default journey, enterprise constraints)
 *  - Edge cases: empty input, unknown pack, engagement-only
 *  - Schema validation for all generated blueprints
 */

import { describe, it, expect } from 'vitest';
import {
  generateBlueprint,
  type GeneratorInput,
} from '@/lib/cognition/workshop-blueprint-generator';
import { WorkshopBlueprintSchema } from '@/lib/workshop/blueprint';

// ================================================================
// Helpers
// ================================================================

const emptyInput: GeneratorInput = {
  industry: null,
  dreamTrack: null,
  engagementType: null,
  domainPack: null,
  purpose: null,
  outcomes: null,
};

function expectValid(bp: ReturnType<typeof generateBlueprint>) {
  const result = WorkshopBlueprintSchema.safeParse(bp);
  if (!result.success) {
    console.error('Validation issues:', result.error.issues);
  }
  expect(result.success).toBe(true);
}

// ================================================================
// 1. Contact Centre + Diagnostic Baseline
// ================================================================

describe('Contact centre + diagnostic baseline', () => {
  const bp = generateBlueprint({
    industry: 'Telecommunications',
    dreamTrack: 'DOMAIN',
    engagementType: 'diagnostic_baseline',
    domainPack: 'contact_centre',
    purpose: 'Assess operational maturity',
    outcomes: 'Evidence-based improvement roadmap',
  });

  it('passes schema validation', () => {
    expectValid(bp);
  });

  it('has contact centre journey stages', () => {
    expect(bp.journeyStages).toHaveLength(6);
    expect(bp.journeyStages[0].name).toBe('Contact Initiation');
    expect(bp.journeyStages[3].name).toBe('Resolution Delivery');
    expect(bp.journeyStages[5].name).toBe('Follow-up & Feedback');
  });

  it('has contact centre domain metrics', () => {
    expect(bp.questionConstraints.domainMetrics).toContain('AHT');
    expect(bp.questionConstraints.domainMetrics).toContain('FCR');
    expect(bp.questionConstraints.domainMetrics).toContain('CSAT');
    expect(bp.questionConstraints.domainMetrics).toContain('Service Level');
  });

  it('has contact centre required topics', () => {
    const required = bp.questionConstraints.requiredTopics;
    expect(required.some((t) => t.includes('Handle time'))).toBe(true);
    expect(required.some((t) => t.includes('First contact resolution'))).toBe(true);
    expect(required.some((t) => t.includes('Quality assurance'))).toBe(true);
  });

  it('merges diagnostic baseline additional required', () => {
    const required = bp.questionConstraints.requiredTopics;
    expect(required.some((t) => t.includes('Current state maturity'))).toBe(true);
    expect(required.some((t) => t.includes('severity scoring'))).toBe(true);
  });

  it('has contact centre forbidden topics', () => {
    const forbidden = bp.questionConstraints.forbiddenTopics;
    expect(forbidden.some((t) => t.includes('M&A'))).toBe(true);
    expect(forbidden.some((t) => t.includes('Product development'))).toBe(true);
  });

  it('has merged focus areas from domain + engagement', () => {
    const focus = bp.questionConstraints.focusAreas;
    // Domain focus
    expect(focus.some((f) => f.includes('Agent empowerment'))).toBe(true);
    // Engagement focus
    expect(focus.some((f) => f.includes('Baseline measurement'))).toBe(true);
    expect(focus.some((f) => f.includes('Quick win'))).toBe(true);
  });

  it('has non-empty actor taxonomy from contact centre pack', () => {
    expect(bp.actorTaxonomy.length).toBeGreaterThan(5);
    const keys = bp.actorTaxonomy.map((a) => a.key);
    expect(keys).toContain('agent');
    expect(keys).toContain('team_leader');
    expect(keys).toContain('quality_analyst');
  });

  it('preserves diagnostic focus from engagement type', () => {
    expect(bp.diagnosticFocus).toBeTruthy();
    expect(bp.diagnosticFocus).toContain('Current state assessment');
  });

  it('preserves workshop identity', () => {
    expect(bp.industry).toBe('Telecommunications');
    expect(bp.dreamTrack).toBe('DOMAIN');
    expect(bp.purpose).toBe('Assess operational maturity');
  });
});

// ================================================================
// 2. HR + Cultural Alignment
// ================================================================

describe('HR + cultural alignment', () => {
  const bp = generateBlueprint({
    industry: 'Healthcare',
    dreamTrack: 'ENTERPRISE',
    engagementType: 'cultural_alignment',
    domainPack: 'hr_people',
    purpose: 'Diagnose cultural gaps',
    outcomes: 'Culture transformation roadmap',
  });

  it('passes schema validation', () => {
    expectValid(bp);
  });

  it('has HR journey stages', () => {
    expect(bp.journeyStages).toHaveLength(6);
    expect(bp.journeyStages[0].name).toBe('Attract');
    expect(bp.journeyStages[2].name).toBe('Onboard');
    expect(bp.journeyStages[5].name).toBe('Transition');
  });

  it('has HR domain metrics', () => {
    expect(bp.questionConstraints.domainMetrics).toContain('Engagement Score');
    expect(bp.questionConstraints.domainMetrics).toContain('Attrition');
    expect(bp.questionConstraints.domainMetrics).toContain('Internal Mobility');
  });

  it('has HR required topics', () => {
    const required = bp.questionConstraints.requiredTopics;
    expect(required.some((t) => t.includes('Talent pipeline'))).toBe(true);
    expect(required.some((t) => t.includes('Employee engagement'))).toBe(true);
    expect(required.some((t) => t.includes('Retention'))).toBe(true);
  });

  it('merges cultural alignment additional topics', () => {
    const required = bp.questionConstraints.requiredTopics;
    expect(required.some((t) => t.includes('Values-in-practice'))).toBe(true);
    expect(required.some((t) => t.includes('Psychological safety'))).toBe(true);
  });

  it('merges cultural alignment additional focus', () => {
    const focus = bp.questionConstraints.focusAreas;
    expect(focus.some((f) => f.includes('Leadership-frontline perception'))).toBe(true);
    expect(focus.some((f) => f.includes('Cultural enablers'))).toBe(true);
  });

  it('has HR forbidden topics', () => {
    const forbidden = bp.questionConstraints.forbiddenTopics;
    expect(forbidden.some((t) => t.includes('revenue'))).toBe(true);
    expect(forbidden.some((t) => t.includes('Product feature'))).toBe(true);
  });

  it('has HR actor taxonomy', () => {
    expect(bp.actorTaxonomy.length).toBeGreaterThan(5);
    const keys = bp.actorTaxonomy.map((a) => a.key);
    expect(keys).toContain('chro');
    expect(keys).toContain('talent_lead');
  });
});

// ================================================================
// 3. Enterprise Strategic + Transformation Sprint
// ================================================================

describe('Enterprise strategic + transformation sprint', () => {
  const bp = generateBlueprint({
    industry: 'Financial Services',
    dreamTrack: 'ENTERPRISE',
    engagementType: 'transformation_sprint',
    domainPack: 'enterprise',
    purpose: 'Rapid diagnostic for transformation programme',
    outcomes: '30/60/90 day action plan',
  });

  it('passes schema validation', () => {
    expectValid(bp);
  });

  it('uses default journey stages (enterprise has no custom template)', () => {
    // Enterprise pack has no entry in DOMAIN_JOURNEY_TEMPLATES,
    // so composeBlueprint default stages apply
    expect(bp.journeyStages).toHaveLength(6);
    expect(bp.journeyStages[0].name).toBe('Discovery');
    expect(bp.journeyStages[5].name).toBe('Growth');
  });

  it('has enterprise required topics', () => {
    const required = bp.questionConstraints.requiredTopics;
    expect(required.some((t) => t.includes('Strategic alignment'))).toBe(true);
    expect(required.some((t) => t.includes('Leadership capability'))).toBe(true);
    expect(required.some((t) => t.includes('Transformation readiness'))).toBe(true);
  });

  it('merges transformation sprint additional topics', () => {
    const required = bp.questionConstraints.requiredTopics;
    expect(required.some((t) => t.includes('30/60/90'))).toBe(true);
    expect(required.some((t) => t.includes('Stakeholder alignment'))).toBe(true);
  });

  it('merges transformation sprint additional focus', () => {
    const focus = bp.questionConstraints.focusAreas;
    expect(focus.some((f) => f.includes('Critical path'))).toBe(true);
    expect(focus.some((f) => f.includes('Risk mitigation'))).toBe(true);
  });

  it('has enterprise domain metrics', () => {
    expect(bp.questionConstraints.domainMetrics).toContain('Revenue');
    expect(bp.questionConstraints.domainMetrics).toContain('Margin');
    expect(bp.questionConstraints.domainMetrics).toContain('Digital Maturity');
  });

  it('enterprise has no forbidden topics', () => {
    expect(bp.questionConstraints.forbiddenTopics).toHaveLength(0);
  });

  it('has enterprise actor taxonomy', () => {
    expect(bp.actorTaxonomy.length).toBeGreaterThan(5);
    const keys = bp.actorTaxonomy.map((a) => a.key);
    expect(keys).toContain('ceo');
    expect(keys).toContain('cto');
  });

  it('has transformation sprint diagnostic focus', () => {
    expect(bp.diagnosticFocus).toContain('Fast-cycle');
  });
});

// ================================================================
// 4. Edge Cases
// ================================================================

describe('Edge cases', () => {
  it('empty input produces valid blueprint with default everything', () => {
    const bp = generateBlueprint(emptyInput);
    expectValid(bp);
    expect(bp.journeyStages).toHaveLength(6);
    expect(bp.journeyStages[0].name).toBe('Discovery');
    expect(bp.questionConstraints.requiredTopics).toHaveLength(0);
    expect(bp.questionConstraints.forbiddenTopics).toHaveLength(0);
    expect(bp.questionConstraints.focusAreas).toHaveLength(0);
    expect(bp.questionConstraints.domainMetrics).toHaveLength(0);
    expect(bp.lenses).toHaveLength(5);
  });

  it('unknown domain pack falls back to defaults', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'nonexistent_pack',
    });
    expectValid(bp);
    expect(bp.journeyStages).toHaveLength(6);
    expect(bp.journeyStages[0].name).toBe('Discovery');
    expect(bp.questionConstraints.requiredTopics).toHaveLength(0);
    expect(bp.lenses).toHaveLength(5);
    expect(bp.actorTaxonomy).toHaveLength(0);
  });

  it('engagement-only (no domain pack) applies engagement modifiers', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      engagementType: 'operational_deep_dive',
    });
    expectValid(bp);
    const required = bp.questionConstraints.requiredTopics;
    expect(required.some((t) => t.includes('Root cause'))).toBe(true);
    expect(required.some((t) => t.includes('friction mapping'))).toBe(true);
    const focus = bp.questionConstraints.focusAreas;
    expect(focus.some((f) => f.includes('Workaround'))).toBe(true);
    // No domain metrics without a domain pack
    expect(bp.questionConstraints.domainMetrics).toHaveLength(0);
  });

  it('domain pack only (no engagement type) applies domain constraints', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'sales',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Prospecting');
    expect(bp.questionConstraints.domainMetrics).toContain('Win Rate');
    expect(bp.questionConstraints.requiredTopics.some((t) => t.includes('Pipeline health'))).toBe(true);
    // No engagement modifier additions
    expect(bp.questionConstraints.requiredTopics.every((t) => !t.includes('Root cause'))).toBe(true);
  });

  it('compliance pack produces compliance journey', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'compliance',
      engagementType: 'diagnostic_baseline',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Regulatory Identification');
    expect(bp.journeyStages[5].name).toBe('Remediation');
    expect(bp.questionConstraints.domainMetrics).toContain('Audit Findings');
  });

  it('customer engagement pack produces CX journey', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'customer_engagement',
      engagementType: 'ai_enablement',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Awareness');
    expect(bp.journeyStages[5].name).toBe('Advocacy');
    expect(bp.questionConstraints.domainMetrics).toContain('CLV');
    // AI enablement modifiers merged
    expect(bp.questionConstraints.requiredTopics.some((t) => t.includes('AI readiness'))).toBe(true);
  });

  it('uppercase engagement type key works', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      engagementType: 'OPERATIONAL_DEEP_DIVE',
      domainPack: 'contact_centre',
    });
    expectValid(bp);
    expect(bp.questionConstraints.requiredTopics.some((t) => t.includes('Root cause'))).toBe(true);
    expect(bp.questionConstraints.domainMetrics).toContain('AHT');
  });
});

// ================================================================
// 5. All Packs Produce Valid Blueprints
// ================================================================

describe('All domain packs produce valid blueprints', () => {
  const packs = ['contact_centre', 'customer_engagement', 'hr_people', 'sales', 'compliance', 'enterprise'];
  const engagements = ['diagnostic_baseline', 'operational_deep_dive', 'ai_enablement', 'transformation_sprint', 'cultural_alignment'];

  for (const pack of packs) {
    for (const engagement of engagements) {
      it(`${pack} + ${engagement} passes validation`, () => {
        const bp = generateBlueprint({
          industry: 'Test',
          dreamTrack: 'DOMAIN',
          engagementType: engagement,
          domainPack: pack,
          purpose: 'Test purpose',
          outcomes: 'Test outcomes',
        });
        expectValid(bp);
        expect(bp.questionConstraints.requiredTopics.length).toBeGreaterThan(0);
        expect(bp.questionConstraints.focusAreas.length).toBeGreaterThan(0);
      });
    }
  }
});

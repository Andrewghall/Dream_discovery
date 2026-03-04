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

  it('uses airline-specific journey stages when airline context is detected', () => {
    const airlineBp = generateBlueprint({
      industry: 'Transport & Logistics',
      dreamTrack: 'DOMAIN',
      engagementType: 'operational_deep_dive',
      domainPack: 'contact_centre',
      purpose: 'Improve airline contact centre handling of flight disruptions',
      outcomes: 'Reduce passenger effort during delay, cancellation, and baggage issues',
    });
    expectValid(airlineBp);
    expect(airlineBp.journeyStages).toHaveLength(6);
    expect(airlineBp.journeyStages[0].name).toBe('Trip Planning & Booking Support');
    expect(airlineBp.journeyStages[3].name).toBe('Disruption & Recovery');
    expect(airlineBp.journeyStages[5].name).toBe('Loyalty & Retention Follow-up');
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

// ================================================================
// 6. Research Overrides
// ================================================================

describe('Research journey stage overrides', () => {
  const researchStages = [
    { name: 'Application', description: 'Student applies to programme', typicalTouchpoints: ['website', 'form'] },
    { name: 'Acceptance', description: 'Offer and enrolment', typicalTouchpoints: ['email', 'portal'] },
    { name: 'Orientation', description: 'First week immersion', typicalTouchpoints: ['campus', 'LMS'] },
    { name: 'Graduation', description: 'Completing the programme', typicalTouchpoints: ['ceremony', 'alumni'] },
  ];

  it('overrides domain template with research journey stages', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
      researchJourneyStages: researchStages,
    });
    expectValid(bp);
    expect(bp.journeyStages).toHaveLength(4);
    expect(bp.journeyStages[0].name).toBe('Application');
    expect(bp.journeyStages[3].name).toBe('Graduation');
  });

  it('overrides default journey stages when no domain pack', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      researchJourneyStages: researchStages,
    });
    expectValid(bp);
    expect(bp.journeyStages).toHaveLength(4);
    expect(bp.journeyStages[0].name).toBe('Application');
  });

  it('ignores null research journey stages', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
      researchJourneyStages: null,
    });
    expectValid(bp);
    // Should use contact centre domain template
    expect(bp.journeyStages[0].name).toBe('Contact Initiation');
  });

  it('ignores empty research journey stages array', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
      researchJourneyStages: [],
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Contact Initiation');
  });

  it('drops typicalTouchpoints from research stages', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      researchJourneyStages: researchStages,
    });
    // JourneyStageEntry only has name + description
    for (const stage of bp.journeyStages) {
      expect(Object.keys(stage)).toEqual(['name', 'description']);
    }
  });
});

describe('Research dimension overrides', () => {
  const researchDims = [
    { name: 'Student Experience', description: 'Quality of student lifecycle', keywords: ['student', 'experience', 'learning'], color: '#60a5fa' },
    { name: 'Institutional Trust', description: 'Reputation and governance', keywords: ['trust', 'governance', 'reputation'], color: '#34d399' },
    { name: 'Digital Capability', description: 'Technology and data maturity', keywords: ['technology', 'digital', 'data'], color: '#fbbf24' },
  ];

  it('overrides default lenses with research dimensions', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      researchDimensions: researchDims,
    });
    expectValid(bp);
    expect(bp.lenses).toHaveLength(3);
    expect(bp.lenses[0].name).toBe('Student Experience');
    expect(bp.lenses[1].name).toBe('Institutional Trust');
    expect(bp.lenses[2].name).toBe('Digital Capability');
  });

  it('overrides domain pack lenses with research dimensions', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
      researchDimensions: researchDims,
    });
    expectValid(bp);
    expect(bp.lenses).toHaveLength(3);
    expect(bp.lenses[0].name).toBe('Student Experience');
  });

  it('rebuilds phaseLensPolicy from research dimensions', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      researchDimensions: researchDims,
    });
    // CONSTRAINTS and DEFINE_APPROACH should include all research lenses
    expect(bp.phaseLensPolicy.CONSTRAINTS).toHaveLength(3);
    expect(bp.phaseLensPolicy.DEFINE_APPROACH).toHaveLength(3);
    // REIMAGINE should include "Student Experience" (contains "experience" keyword match)
    expect(bp.phaseLensPolicy.REIMAGINE.length).toBeGreaterThan(0);
    expect(bp.phaseLensPolicy.REIMAGINE).toContain('Student Experience');
  });

  it('REIMAGINE falls back to first 3 lenses when no keyword matches', () => {
    const noMatchDims = [
      { name: 'Alpha', description: 'First dim', keywords: ['alpha'], color: '#aaa' },
      { name: 'Beta', description: 'Second dim', keywords: ['beta'], color: '#bbb' },
      { name: 'Gamma', description: 'Third dim', keywords: ['gamma'], color: '#ccc' },
      { name: 'Delta', description: 'Fourth dim', keywords: ['delta'], color: '#ddd' },
    ];
    const bp = generateBlueprint({
      ...emptyInput,
      researchDimensions: noMatchDims,
    });
    expectValid(bp);
    // No keyword matches, so falls back to first 3
    expect(bp.phaseLensPolicy.REIMAGINE).toHaveLength(3);
    expect(bp.phaseLensPolicy.REIMAGINE).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('ignores null research dimensions', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      researchDimensions: null,
    });
    expectValid(bp);
    expect(bp.lenses).toHaveLength(5); // default
  });

  it('ignores empty research dimensions array', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      researchDimensions: [],
    });
    expectValid(bp);
    expect(bp.lenses).toHaveLength(5); // default
  });

  it('preserves lens color and keywords from research', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      researchDimensions: researchDims,
    });
    expect(bp.lenses[0].color).toBe('#60a5fa');
    expect(bp.lenses[0].keywords).toEqual(['student', 'experience', 'learning']);
  });
});

describe('Research + domain + engagement layering', () => {
  const researchStages = [
    { name: 'Enrol', description: 'Student enrolment', typicalTouchpoints: ['portal'] },
    { name: 'Learn', description: 'Active learning', typicalTouchpoints: ['LMS'] },
    { name: 'Graduate', description: 'Completion', typicalTouchpoints: ['ceremony'] },
  ];

  it('layers all three correctly: research overrides journey, domain provides constraints, engagement adds modifiers', () => {
    const bp = generateBlueprint({
      industry: 'Education',
      dreamTrack: 'DOMAIN',
      engagementType: 'ai_enablement',
      domainPack: 'contact_centre',
      purpose: 'Assess AI readiness',
      outcomes: 'Use case catalogue',
      researchJourneyStages: researchStages,
    });
    expectValid(bp);
    // Research overrides CC journey stages
    expect(bp.journeyStages).toHaveLength(3);
    expect(bp.journeyStages[0].name).toBe('Enrol');
    // Domain provides question constraints (CC metrics)
    expect(bp.questionConstraints.domainMetrics).toContain('AHT');
    // Engagement adds modifiers
    expect(bp.questionConstraints.requiredTopics.some((t) => t.includes('AI readiness'))).toBe(true);
    // Identity preserved
    expect(bp.industry).toBe('Education');
  });
});

// ================================================================
// 7. Blueprint Versioning
// ================================================================

describe('Blueprint versioning', () => {
  it('starts at version 0 when no previousVersion provided', () => {
    const bp = generateBlueprint(emptyInput);
    expectValid(bp);
    expect(bp.blueprintVersion).toBe(0);
  });

  it('increments from previousVersion', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      previousVersion: 2,
    });
    expectValid(bp);
    expect(bp.blueprintVersion).toBe(3);
  });

  it('increments from 0 to 1', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      previousVersion: 0,
    });
    expectValid(bp);
    expect(bp.blueprintVersion).toBe(1);
  });

  it('all pack + engagement combos have blueprintVersion 0 by default', () => {
    const packs = ['contact_centre', 'hr_people', 'enterprise'];
    for (const pack of packs) {
      const bp = generateBlueprint({
        ...emptyInput,
        domainPack: pack,
        engagementType: 'diagnostic_baseline',
      });
      expect(bp.blueprintVersion).toBe(0);
    }
  });
});

// ================================================================
// 8. Airline Contact Centre Context Detection
// ================================================================

describe('Airline contact centre industry detection', () => {
  it('clientName "Aer Lingus" triggers airline journey stages', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
      engagementType: 'operational_deep_dive',
      clientName: 'Aer Lingus',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Trip Planning & Booking Support');
    expect(bp.journeyStages[3].name).toBe('Disruption & Recovery');
    expect(bp.journeyStages[5].name).toBe('Loyalty & Retention Follow-up');
  });

  it('clientName "Air Jordan" triggers airline journey stages', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
      engagementType: 'operational_deep_dive',
      clientName: 'Air Jordan Airways',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Trip Planning & Booking Support');
  });

  it('industry "airline" triggers airline journey stages', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      industry: 'Airline',
      domainPack: 'contact_centre',
      engagementType: 'diagnostic_baseline',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Trip Planning & Booking Support');
  });

  it('airline context produces airline-specific lenses (8 lenses)', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      industry: 'Aviation',
      domainPack: 'contact_centre',
      engagementType: 'operational_deep_dive',
    });
    expectValid(bp);
    const lensNames = bp.lenses.map((l) => l.name);
    expect(lensNames).toContain('Customer Experience');
    expect(lensNames).toContain('People & Workforce');
    expect(lensNames).toContain('Operations');
    expect(lensNames).toContain('Technology');
    expect(lensNames).toContain('Training & Capability');
    expect(lensNames).toContain('Regulation & Compliance');
    expect(lensNames).toContain('Organisation & Leadership');
    expect(lensNames).toContain('Culture');
    expect(bp.lenses).toHaveLength(8);
  });

  it('non-airline contact centre retains generic contact centre stages', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      industry: 'Telecommunications',
      domainPack: 'contact_centre',
      engagementType: 'diagnostic_baseline',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Contact Initiation');
    expect(bp.journeyStages[3].name).toBe('Resolution Delivery');
    // Lenses should be the generic domain pack set (5 lenses)
    expect(bp.lenses).toHaveLength(5);
    const lensNames = bp.lenses.map((l) => l.name);
    expect(lensNames).not.toContain('Culture');
  });

  it('non-airline contact centre keeps 5 generic lenses', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      industry: 'Retail',
      domainPack: 'contact_centre',
      engagementType: 'operational_deep_dive',
    });
    expectValid(bp);
    expect(bp.lenses).toHaveLength(5);
    const lensNames = bp.lenses.map((l) => l.name);
    expect(lensNames).toContain('People');
    expect(lensNames).toContain('Customer');
  });

  it('airline phaseLensPolicy includes customer-facing lenses in REIMAGINE', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      industry: 'Aviation',
      domainPack: 'contact_centre',
      engagementType: 'operational_deep_dive',
    });
    expectValid(bp);
    expect(bp.phaseLensPolicy.REIMAGINE).toContain('Customer Experience');
    expect(bp.phaseLensPolicy.REIMAGINE).toContain('People & Workforce');
    expect(bp.phaseLensPolicy.REIMAGINE).toContain('Culture');
    // CONSTRAINTS and DEFINE_APPROACH should include all 8
    expect(bp.phaseLensPolicy.CONSTRAINTS).toHaveLength(8);
    expect(bp.phaseLensPolicy.DEFINE_APPROACH).toHaveLength(8);
  });

  it('research overrides take priority over airline lenses', () => {
    const researchDims = [
      { name: 'Passenger Trust', description: 'Trust in the airline', keywords: ['trust'], color: '#aaa' },
      { name: 'Ops Agility', description: 'Operational agility', keywords: ['agility'], color: '#bbb' },
    ];
    const bp = generateBlueprint({
      ...emptyInput,
      industry: 'Aviation',
      domainPack: 'contact_centre',
      researchDimensions: researchDims,
    });
    expectValid(bp);
    expect(bp.lenses).toHaveLength(2);
    expect(bp.lenses[0].name).toBe('Passenger Trust');
    expect(bp.lenses[1].name).toBe('Ops Agility');
  });

  it('purpose text with "flight" triggers airline context', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
      purpose: 'Assess contact centre handling flight disruptions and rebooking',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Trip Planning & Booking Support');
    expect(bp.lenses).toHaveLength(8);
  });

  it('outcomes text with "passenger" triggers airline context', () => {
    const bp = generateBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
      outcomes: 'Improve passenger experience during delays and cancellations',
    });
    expectValid(bp);
    expect(bp.journeyStages[0].name).toBe('Trip Planning & Booking Support');
  });
});

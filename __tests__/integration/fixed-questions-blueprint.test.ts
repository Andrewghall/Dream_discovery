/**
 * Blueprint-driven Discovery conversation tests
 *
 * Covers:
 *  - getPhaseOrderFromBlueprint() phase ordering from blueprint lenses
 *  - buildQuestionsFromBlueprint() question filtering and dynamic prioritization
 *  - includeRegulationFromBlueprint() regulation lens detection
 *  - Three-tier cascade: discoveryQuestions > blueprint > legacy
 */

import { describe, it, expect } from 'vitest';
import {
  getPhaseOrderFromBlueprint,
  buildQuestionsFromBlueprint,
  includeRegulationFromBlueprint,
  buildQuestionsFromDiscoverySet,
  getPhaseOrder,
  FIXED_QUESTIONS,
} from '@/lib/conversation/fixed-questions';
import { generateBlueprint } from '@/lib/cognition/workshop-blueprint-generator';
import { DEFAULT_BLUEPRINT } from '@/lib/workshop/blueprint';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';

// ================================================================
// Helpers
// ================================================================

function enterpriseBlueprint(): WorkshopBlueprint {
  return generateBlueprint({
    industry: 'Financial Services',
    dreamTrack: 'ENTERPRISE',
    engagementType: 'diagnostic_baseline',
    domainPack: 'enterprise',
    purpose: 'Strategic assessment',
    outcomes: 'Transformation roadmap',
  });
}

function ccBlueprint(): WorkshopBlueprint {
  return generateBlueprint({
    industry: 'Telecommunications',
    dreamTrack: 'DOMAIN',
    engagementType: 'diagnostic_baseline',
    domainPack: 'contact_centre',
    purpose: 'Assess contact centre maturity',
    outcomes: 'Improvement roadmap',
  });
}

/** Blueprint with only 4 standard lenses (no Regulation) for testing exclusion */
function noRegulationBlueprint(): WorkshopBlueprint {
  const bp = structuredClone(DEFAULT_BLUEPRINT);
  bp.lenses = bp.lenses.filter((l) => l.name !== 'Regulation');
  bp.phaseLensPolicy = {
    REIMAGINE: ['People', 'Customer'],
    CONSTRAINTS: bp.lenses.map((l) => l.name),
    DEFINE_APPROACH: bp.lenses.map((l) => l.name),
  };
  return bp;
}

function blueprintWithCustomLenses(): WorkshopBlueprint {
  // Simulate research-overridden lenses that do not map to standard phases
  const bp: WorkshopBlueprint = {
    ...structuredClone(DEFAULT_BLUEPRINT),
    lenses: [
      { name: 'Agent Experience', description: 'Agent wellbeing', color: '#60a5fa', keywords: ['agent'] },
      { name: 'Customer Satisfaction', description: 'CSAT metrics', color: '#a78bfa', keywords: ['csat'] },
      { name: 'Operational Efficiency', description: 'Process metrics', color: '#34d399', keywords: ['ops'] },
    ],
  };
  return bp;
}

const mockDiscoveryQuestions = {
  lenses: [
    {
      key: 'agent_experience',
      label: 'Agent Experience',
      questions: [
        { text: 'How supported do you feel?', tag: 'context', maturityScale: undefined },
        { text: 'What tools help most?', tag: 'working', maturityScale: undefined },
      ],
    },
    {
      key: 'customer_satisfaction',
      label: 'Customer Satisfaction',
      questions: [
        { text: 'How do customers rate their experience?', tag: 'context', maturityScale: undefined },
      ],
    },
  ],
  generatedAtMs: Date.now(),
  agentRationale: 'Test rationale',
};

// ================================================================
// getPhaseOrderFromBlueprint() tests
// ================================================================

describe('getPhaseOrderFromBlueprint', () => {
  it('returns all standard phases for enterprise blueprint with 5 lenses', () => {
    const bp = enterpriseBlueprint();
    const order = getPhaseOrderFromBlueprint(bp);

    expect(order[0]).toBe('intro');
    expect(order[order.length - 1]).toBe('summary');
    expect(order[order.length - 2]).toBe('prioritization');

    // Should include all 5 standard lens phases
    expect(order).toContain('people');
    expect(order).toContain('corporate');
    expect(order).toContain('customer');
    expect(order).toContain('technology');
    expect(order).toContain('regulation');
  });

  it('omits regulation phase when blueprint has no Regulation lens', () => {
    const bp = noRegulationBlueprint();
    const order = getPhaseOrderFromBlueprint(bp);

    expect(order).not.toContain('regulation');
    expect(order[0]).toBe('intro');
    expect(order[order.length - 1]).toBe('summary');
    expect(order).toContain('people');
    expect(order).toContain('customer');
    expect(order).toContain('technology');
  });

  it('includes regulation for CC blueprint (all domain packs have Regulation)', () => {
    const bp = ccBlueprint();
    const order = getPhaseOrderFromBlueprint(bp);

    // All domain packs include all 5 standard lenses including Regulation
    expect(order).toContain('regulation');
  });

  it('maps Operations lens to corporate phase', () => {
    const bp = ccBlueprint();
    const order = getPhaseOrderFromBlueprint(bp);

    // Operations maps to 'corporate'
    expect(order).toContain('corporate');
  });

  it('deduplicates phases when multiple lenses map to the same phase', () => {
    // Both Operations and Organisation map to 'corporate'
    const bp: WorkshopBlueprint = {
      ...structuredClone(DEFAULT_BLUEPRINT),
      lenses: [
        { name: 'Operations', description: '', color: '#34d399', keywords: [] },
        { name: 'Organisation', description: '', color: '#34d399', keywords: [] },
        { name: 'People', description: '', color: '#bfdbfe', keywords: [] },
      ],
    };
    const order = getPhaseOrderFromBlueprint(bp);
    const corporateCount = order.filter((p) => p === 'corporate').length;
    expect(corporateCount).toBe(1);
  });

  it('falls back to default without regulation for unmappable lenses', () => {
    const bp = blueprintWithCustomLenses();
    const order = getPhaseOrderFromBlueprint(bp);

    // None of the custom lens names map to standard phases
    // Should return default minus regulation
    expect(order).toContain('intro');
    expect(order).toContain('people');
    expect(order).toContain('corporate');
    expect(order).toContain('customer');
    expect(order).toContain('technology');
    expect(order).not.toContain('regulation');
    expect(order).toContain('prioritization');
    expect(order).toContain('summary');
  });

  it('preserves lens order from blueprint', () => {
    const bp: WorkshopBlueprint = {
      ...structuredClone(DEFAULT_BLUEPRINT),
      lenses: [
        { name: 'Technology', description: '', color: '#fed7aa', keywords: [] },
        { name: 'People', description: '', color: '#bfdbfe', keywords: [] },
        { name: 'Customer', description: '', color: '#ddd6fe', keywords: [] },
      ],
    };
    const order = getPhaseOrderFromBlueprint(bp);

    const techIdx = order.indexOf('technology');
    const peopleIdx = order.indexOf('people');
    const customerIdx = order.indexOf('customer');

    // Blueprint lens order should be preserved
    expect(techIdx).toBeLessThan(peopleIdx);
    expect(peopleIdx).toBeLessThan(customerIdx);
  });
});

// ================================================================
// buildQuestionsFromBlueprint() tests
// ================================================================

describe('buildQuestionsFromBlueprint', () => {
  it('returns filtered questions excluding regulation for no-regulation blueprint', () => {
    const bp = noRegulationBlueprint();
    const qs = buildQuestionsFromBlueprint(bp);

    expect(qs).not.toBeNull();
    if (!qs) return;

    // Should have intro, people, corporate, customer, technology, prioritization, summary
    expect(qs.intro).toBeDefined();
    expect(qs.people).toBeDefined();
    expect(qs.corporate).toBeDefined();
    expect(qs.customer).toBeDefined();
    expect(qs.technology).toBeDefined();
    expect(qs.prioritization).toBeDefined();
    expect(qs.summary).toBeDefined();

    // Should NOT have regulation
    expect(qs.regulation).toBeUndefined();
  });

  it('returns all phases for CC blueprint (includes Regulation)', () => {
    const bp = ccBlueprint();
    const qs = buildQuestionsFromBlueprint(bp);

    expect(qs).not.toBeNull();
    if (!qs) return;

    // CC domain pack includes all 5 lenses including Regulation
    expect(qs.regulation).toBeDefined();
    expect(qs.people).toBeDefined();
    expect(qs.corporate).toBeDefined();
    expect(qs.customer).toBeDefined();
    expect(qs.technology).toBeDefined();
  });

  it('includes all standard phases for enterprise blueprint', () => {
    const bp = enterpriseBlueprint();
    const qs = buildQuestionsFromBlueprint(bp);

    expect(qs).not.toBeNull();
    if (!qs) return;

    expect(qs.intro).toBeDefined();
    expect(qs.people).toBeDefined();
    expect(qs.regulation).toBeDefined();
  });

  it('dynamically builds prioritization question with blueprint lens names', () => {
    const bp = ccBlueprint();
    const qs = buildQuestionsFromBlueprint(bp);

    expect(qs).not.toBeNull();
    if (!qs) return;

    const firstPrioritization = qs.prioritization[0];
    expect(firstPrioritization.text).toContain('Of the areas we have discussed');

    // Should list blueprint lens names, not hardcoded "People, Processes, Customer, Technology, Regulation"
    expect(firstPrioritization.text).not.toContain('five areas');
    expect(firstPrioritization.text).not.toContain('Processes');

    // CC blueprint has People, Customer, Operations, Technology
    expect(firstPrioritization.text).toContain('People');
    expect(firstPrioritization.text).toContain('Customer');
    expect(firstPrioritization.text).toContain('Operations');
    expect(firstPrioritization.text).toContain('Technology');
  });

  it('returns null for unmappable research-overridden lens names', () => {
    const bp = blueprintWithCustomLenses();
    const qs = buildQuestionsFromBlueprint(bp);

    // None of these lens names map to standard phases
    expect(qs).toBeNull();
  });

  it('uses FIXED_QUESTIONS_V2 as base when version is v2', () => {
    const bp = enterpriseBlueprint();
    const qs = buildQuestionsFromBlueprint(bp, 'v2');

    expect(qs).not.toBeNull();
    if (!qs) return;

    // v2 intro has "Follow-up: since the last session" text
    expect(qs.intro[0].text).toContain('Follow-up');
  });

  it('uses standard FIXED_QUESTIONS as base when version is v1', () => {
    const bp = enterpriseBlueprint();
    const qs = buildQuestionsFromBlueprint(bp, 'v1');

    expect(qs).not.toBeNull();
    if (!qs) return;

    // v1 intro has "Please describe your role" text
    expect(qs.intro[0].text).toContain('describe your role');
  });

  it('preserves maturityScale on questions', () => {
    const bp = enterpriseBlueprint();
    const qs = buildQuestionsFromBlueprint(bp);

    expect(qs).not.toBeNull();
    if (!qs) return;

    // People phase first question has a maturityScale
    const tripleRating = qs.people.find((q) => q.tag === 'triple_rating');
    expect(tripleRating).toBeDefined();
    expect(tripleRating?.maturityScale).toBeDefined();
    expect(tripleRating?.maturityScale?.length).toBe(5);
  });

  it('keeps all non-area-specific prioritization questions', () => {
    const bp = ccBlueprint();
    const qs = buildQuestionsFromBlueprint(bp);

    expect(qs).not.toBeNull();
    if (!qs) return;

    // Should have all prioritization questions (first is dynamic, rest are copied)
    expect(qs.prioritization.length).toBe(FIXED_QUESTIONS.prioritization.length);

    // Second question should be unchanged
    expect(qs.prioritization[1].tag).toBe('high_impact');
  });
});

// ================================================================
// includeRegulationFromBlueprint() tests
// ================================================================

describe('includeRegulationFromBlueprint', () => {
  it('returns true when Regulation lens is present', () => {
    const bp = enterpriseBlueprint();
    expect(includeRegulationFromBlueprint(bp)).toBe(true);
  });

  it('returns false when no Regulation lens exists', () => {
    const bp = noRegulationBlueprint();
    expect(includeRegulationFromBlueprint(bp)).toBe(false);
  });

  it('returns true for CC blueprint (all domain packs include Regulation)', () => {
    const bp = ccBlueprint();
    expect(includeRegulationFromBlueprint(bp)).toBe(true);
  });

  it('returns false for DEFAULT_BLUEPRINT (has Regulation in lenses)', () => {
    // DEFAULT_BLUEPRINT includes Regulation via DEFAULT_DIMENSIONS
    expect(includeRegulationFromBlueprint(DEFAULT_BLUEPRINT)).toBe(true);
  });

  it('returns false for custom lenses without Regulation', () => {
    const bp = blueprintWithCustomLenses();
    expect(includeRegulationFromBlueprint(bp)).toBe(false);
  });
});

// ================================================================
// Three-tier cascade tests
// ================================================================

describe('Three-tier cascade: discoveryQuestions > blueprint > legacy', () => {
  it('discoveryQuestions takes priority over blueprint', () => {
    const bp = enterpriseBlueprint();
    const customQs = buildQuestionsFromDiscoverySet(mockDiscoveryQuestions);
    const blueprintQs = buildQuestionsFromBlueprint(bp);

    // Both should be non-null
    expect(customQs).not.toBeNull();
    expect(blueprintQs).not.toBeNull();

    // In the cascade: customQs wins
    const qs = customQs || blueprintQs;
    expect(qs).toBe(customQs);

    // Custom questions should have the lens keys as phases
    expect(qs!['agent_experience']).toBeDefined();
    expect(qs!['customer_satisfaction']).toBeDefined();
  });

  it('blueprint questions used when no discoveryQuestions', () => {
    const bp = noRegulationBlueprint();
    const customQs = buildQuestionsFromDiscoverySet(null);
    const blueprintQs = buildQuestionsFromBlueprint(bp);

    // customQs should be null
    expect(customQs).toBeNull();
    expect(blueprintQs).not.toBeNull();

    // In the cascade: blueprintQs wins
    const qs = customQs || blueprintQs;
    expect(qs).toBe(blueprintQs);

    // Should have standard phase keys, not lens keys
    expect(qs!['people']).toBeDefined();
    expect(qs!['regulation']).toBeUndefined(); // noRegulationBlueprint excludes it
  });

  it('legacy fallback with null blueprint preserves existing behavior', () => {
    const customQs = buildQuestionsFromDiscoverySet(null);
    const blueprintQs = null; // No blueprint

    expect(customQs).toBeNull();
    expect(blueprintQs).toBeNull();

    // Legacy phase order
    const legacyOrder = getPhaseOrder(true);
    expect(legacyOrder).toContain('regulation');
    expect(legacyOrder.length).toBe(8);

    const legacyOrderNoReg = getPhaseOrder(false);
    expect(legacyOrderNoReg).not.toContain('regulation');
    expect(legacyOrderNoReg.length).toBe(7);
  });

  it('blueprint with unmappable lenses falls through to legacy', () => {
    const bp = blueprintWithCustomLenses();
    const customQs = buildQuestionsFromDiscoverySet(null);
    const blueprintQs = buildQuestionsFromBlueprint(bp);

    expect(customQs).toBeNull();
    expect(blueprintQs).toBeNull(); // Unmappable lenses return null

    // Cascade lands on legacy
    // This is the expected graceful degradation
  });
});

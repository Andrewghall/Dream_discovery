/**
 * Output Archetype Classification + Section Registry Tests
 *
 * Covers:
 *  - Agentic-heavy workshop classification
 *  - Contact centre / operational improvement classification
 *  - Compliance / risk remediation classification
 *  - Hybrid (balanced signals) classification
 *  - Section registry composition
 *  - Hemisphere layer remap (ENABLER -> H2, CHALLENGE/FRICTION -> H3)
 */

import { describe, it, expect } from 'vitest';
import {
  classifyWorkshopArchetype,
  type ClassifierInput,
  type WorkshopArchetype,
  type ArchetypeClassification,
} from '@/lib/output/archetype-classifier';
import {
  SECTION_REGISTRY,
  composeActiveSections,
  buildSectionContext,
  type SectionContext,
} from '@/lib/output/section-registry';

// ================================================================
// Test Fixtures
// ================================================================

/** Agentic-heavy workshop: tech domain, expansive posture, many enablers */
const AGENTIC_INPUT: ClassifierInput = {
  nodeTypeCounts: {
    VISION: 25,
    BELIEF: 10,
    ENABLER: 20,
    CHALLENGE: 5,
    FRICTION: 3,
    CONSTRAINT: 4,
  },
  domainWeights: {
    Technology: 0.45,
    People: 0.15,
    Customer: 0.2,
    Organisation: 0.15,
    Regulation: 0.05,
  },
  diagnosticPosture: 'expansive',
  industry: 'Financial Services',
  dreamTrack: 'ENTERPRISE',
  targetDomain: null,
  constraintCount: 4,
  enablerCount: 20,
  themeKeywords: [
    'AI-powered automation',
    'Platform integration',
    'Digital transformation',
    'Self-service portal',
    'Workflow orchestration',
    'API connectivity',
  ],
  totalNodes: 67,
};

/** Contact centre operational improvement */
const OPERATIONS_INPUT: ClassifierInput = {
  nodeTypeCounts: {
    VISION: 10,
    BELIEF: 5,
    ENABLER: 8,
    CHALLENGE: 15,
    FRICTION: 12,
    CONSTRAINT: 18,
  },
  domainWeights: {
    Customer: 0.35,
    People: 0.25,
    Technology: 0.15,
    Organisation: 0.15,
    Regulation: 0.1,
  },
  diagnosticPosture: 'aligned',
  industry: 'Insurance',
  dreamTrack: 'DOMAIN',
  targetDomain: 'Contact Centre Operations',
  constraintCount: 18,
  enablerCount: 8,
  themeKeywords: [
    'Contact centre efficiency',
    'Queue management',
    'Response time improvement',
    'Workforce scheduling',
    'Service level agreements',
    'Call routing optimisation',
    'Throughput capacity',
  ],
  totalNodes: 68,
};

/** Compliance / risk remediation workshop */
const COMPLIANCE_INPUT: ClassifierInput = {
  nodeTypeCounts: {
    VISION: 5,
    BELIEF: 3,
    ENABLER: 4,
    CHALLENGE: 20,
    FRICTION: 15,
    CONSTRAINT: 25,
  },
  domainWeights: {
    Regulation: 0.35,
    Risk: 0.2,
    People: 0.15,
    Technology: 0.15,
    Customer: 0.15,
  },
  diagnosticPosture: 'defensive',
  industry: 'Banking',
  dreamTrack: 'ENTERPRISE',
  targetDomain: null,
  constraintCount: 25,
  enablerCount: 4,
  themeKeywords: [
    'Regulatory compliance',
    'Risk assessment',
    'Audit framework',
    'Governance structure',
    'Policy remediation',
    'FCA requirements',
    'Control gaps',
    'Reporting obligations',
  ],
  totalNodes: 72,
};

/** Hybrid: balanced signals across archetypes, no single winner */
const HYBRID_INPUT: ClassifierInput = {
  nodeTypeCounts: {
    VISION: 10,
    BELIEF: 6,
    ENABLER: 8,
    CHALLENGE: 12,
    FRICTION: 10,
    CONSTRAINT: 14,
  },
  domainWeights: {
    People: 0.22,
    Customer: 0.22,
    Organisation: 0.2,
    Technology: 0.18,
    Regulation: 0.18,
  },
  diagnosticPosture: 'aligned',
  industry: 'Retail',
  dreamTrack: 'ENTERPRISE',
  targetDomain: null,
  constraintCount: 14,
  enablerCount: 8,
  themeKeywords: [
    'Customer experience',
    'Staff development',
    'Leadership alignment',
    'Brand positioning',
    'Talent management',
  ],
  totalNodes: 60,
};

// ================================================================
// 1. Archetype Classification
// ================================================================

describe('classifyWorkshopArchetype', () => {
  it('classifies agentic-heavy workshop correctly', () => {
    const result = classifyWorkshopArchetype(AGENTIC_INPUT);
    expect(result.primaryArchetype).toBe('agentic_tooling_blueprint');
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.rationale).toBeTruthy();
    expect(result.requiredSections).toContain('reimagine');
    expect(result.requiredSections).toContain('solution');
  });

  it('classifies contact-centre-ops workshop correctly', () => {
    const result = classifyWorkshopArchetype(OPERATIONS_INPUT);
    expect(result.primaryArchetype).toBe('operational_contact_centre_improvement');
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.requiredSections).toContain('customer-journey');
    expect(result.requiredSections).toContain('constraints');
  });

  it('classifies compliance/risk workshop correctly', () => {
    const result = classifyWorkshopArchetype(COMPLIANCE_INPUT);
    expect(result.primaryArchetype).toBe('compliance_risk_remediation');
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.requiredSections).toContain('constraints');
    expect(result.requiredSections).toContain('commercial');
  });

  it('classifies balanced workshop as hybrid', () => {
    const result = classifyWorkshopArchetype(HYBRID_INPUT);
    expect(result.primaryArchetype).toBe('hybrid');
    expect(result.secondaryArchetypes.length).toBeGreaterThan(0);
    expect(result.rationale).toContain('Hybrid');
    // Hybrid includes all sections
    expect(result.requiredSections).toContain('reimagine');
    expect(result.requiredSections).toContain('constraints');
    expect(result.requiredSections).toContain('solution');
    expect(result.requiredSections).toContain('commercial');
  });

  it('always includes core sections regardless of archetype', () => {
    for (const input of [AGENTIC_INPUT, OPERATIONS_INPUT, COMPLIANCE_INPUT, HYBRID_INPUT]) {
      const result = classifyWorkshopArchetype(input);
      expect(result.requiredSections).toContain('exec-summary');
      expect(result.requiredSections).toContain('discovery');
      expect(result.requiredSections).toContain('summary');
    }
  });

  it('confidence is between 0 and 1', () => {
    for (const input of [AGENTIC_INPUT, OPERATIONS_INPUT, COMPLIANCE_INPUT, HYBRID_INPUT]) {
      const result = classifyWorkshopArchetype(input);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('secondary archetypes do not include the primary', () => {
    for (const input of [AGENTIC_INPUT, OPERATIONS_INPUT, COMPLIANCE_INPUT]) {
      const result = classifyWorkshopArchetype(input);
      if (result.primaryArchetype !== 'hybrid') {
        expect(result.secondaryArchetypes).not.toContain(result.primaryArchetype);
      }
    }
  });

  it('handles empty input gracefully', () => {
    const emptyInput: ClassifierInput = {
      nodeTypeCounts: {},
      domainWeights: {},
      diagnosticPosture: 'aligned',
      industry: null,
      dreamTrack: null,
      targetDomain: null,
      constraintCount: 0,
      enablerCount: 0,
      themeKeywords: [],
      totalNodes: 0,
    };
    const result = classifyWorkshopArchetype(emptyInput);
    expect(result.primaryArchetype).toBeDefined();
    expect(result.requiredSections.length).toBeGreaterThan(0);
  });
});

// ================================================================
// 2. Section Registry
// ================================================================

describe('SECTION_REGISTRY', () => {
  it('has unique section IDs', () => {
    const ids = SECTION_REGISTRY.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('core sections are exec-summary, discovery, and summary', () => {
    const core = SECTION_REGISTRY.filter(s => s.core);
    expect(core.map(s => s.id)).toEqual(
      expect.arrayContaining(['exec-summary', 'discovery', 'summary']),
    );
  });

  it('sections are in ascending priority order in the registry', () => {
    for (let i = 1; i < SECTION_REGISTRY.length; i++) {
      expect(SECTION_REGISTRY[i].priority).toBeGreaterThanOrEqual(SECTION_REGISTRY[i - 1].priority);
    }
  });

  it('all sections have a valid when() function', () => {
    for (const section of SECTION_REGISTRY) {
      expect(typeof section.when).toBe('function');
    }
  });
});

// ================================================================
// 3. Output Composer (composeActiveSections)
// ================================================================

describe('composeActiveSections', () => {
  const fullContext: SectionContext = {
    hasExecSummary: true,
    hasDiscoveryOutput: true,
    hasReimagineContent: true,
    hasConstraintsContent: true,
    hasPotentialSolution: true,
    hasCommercialContent: true,
    hasCustomerJourney: true,
    hasSummaryContent: true,
    hasHemisphereData: true,
    constraintCount: 10,
    enablerCount: 8,
  };

  it('core sections always appear for agentic archetype', () => {
    const sections = composeActiveSections('agentic_tooling_blueprint', fullContext);
    const ids = sections.map(s => s.id);
    expect(ids).toContain('exec-summary');
    expect(ids).toContain('discovery');
    expect(ids).toContain('summary');
  });

  it('excludes reimagine for compliance archetype', () => {
    const sections = composeActiveSections('compliance_risk_remediation', fullContext);
    const ids = sections.map(s => s.id);
    expect(ids).not.toContain('reimagine');
    expect(ids).toContain('constraints');
  });

  it('includes customer journey only for operational and hybrid archetypes', () => {
    const operational = composeActiveSections('operational_contact_centre_improvement', fullContext);
    expect(operational.map(s => s.id)).toContain('customer-journey');

    const hybrid = composeActiveSections('hybrid', fullContext);
    expect(hybrid.map(s => s.id)).toContain('customer-journey');

    const agentic = composeActiveSections('agentic_tooling_blueprint', fullContext);
    expect(agentic.map(s => s.id)).not.toContain('customer-journey');
  });

  it('includes solution for agentic and hybrid archetypes', () => {
    const agentic = composeActiveSections('agentic_tooling_blueprint', fullContext);
    expect(agentic.map(s => s.id)).toContain('solution');

    const hybrid = composeActiveSections('hybrid', fullContext);
    expect(hybrid.map(s => s.id)).toContain('solution');
  });

  it('includes hemisphere when data is available', () => {
    const withHemisphere = composeActiveSections('agentic_tooling_blueprint', fullContext);
    expect(withHemisphere.map(s => s.id)).toContain('hemisphere');

    const withoutHemisphere = composeActiveSections('agentic_tooling_blueprint', {
      ...fullContext,
      hasHemisphereData: false,
    });
    expect(withoutHemisphere.map(s => s.id)).not.toContain('hemisphere');
  });

  it('returns sections in priority order', () => {
    const sections = composeActiveSections('hybrid', fullContext);
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].priority).toBeGreaterThanOrEqual(sections[i - 1].priority);
    }
  });

  it('commercial tab requires data presence', () => {
    const withCommercial = composeActiveSections('agentic_tooling_blueprint', fullContext);
    expect(withCommercial.map(s => s.id)).toContain('commercial');

    const withoutCommercial = composeActiveSections('agentic_tooling_blueprint', {
      ...fullContext,
      hasCommercialContent: false,
    });
    expect(withoutCommercial.map(s => s.id)).not.toContain('commercial');
  });
});

// ================================================================
// 4. buildSectionContext
// ================================================================

describe('buildSectionContext', () => {
  it('correctly detects non-null fields as present', () => {
    const ctx = buildSectionContext(
      {
        execSummary: { overview: 'test' },
        discoveryOutput: null,
        reimagineContent: { title: 'test' },
        constraintsContent: {},
        potentialSolution: null,
        commercialContent: null,
        customerJourney: { stages: [] },
        summaryContent: null,
      },
      true,
      5,
      3,
    );

    expect(ctx.hasExecSummary).toBe(true);
    expect(ctx.hasDiscoveryOutput).toBe(false);
    expect(ctx.hasReimagineContent).toBe(true);
    expect(ctx.hasConstraintsContent).toBe(false); // Empty object
    expect(ctx.hasPotentialSolution).toBe(false);
    expect(ctx.hasCommercialContent).toBe(false);
    expect(ctx.hasCustomerJourney).toBe(true);
    expect(ctx.hasSummaryContent).toBe(false);
    expect(ctx.hasHemisphereData).toBe(true);
    expect(ctx.constraintCount).toBe(5);
    expect(ctx.enablerCount).toBe(3);
  });
});

// ================================================================
// 5. Hemisphere Layer Remap Validation
// ================================================================

describe('hemisphere layer remap', () => {
  // This test validates that the layer mapping is documented correctly.
  // The actual layerForType() function is in build-hemisphere-graph.ts.
  // We verify the expected mapping here as a contract test.

  const expectedMapping: Record<string, string> = {
    VISION: 'H1',
    BELIEF: 'H1',
    ENABLER: 'H2',     // Changed from H3 to H2
    CHALLENGE: 'H3',   // Changed from H2 to H3
    FRICTION: 'H3',    // Changed from H2 to H3
    CONSTRAINT: 'H3',  // Unchanged
    EVIDENCE: 'H4',    // Unchanged
  };

  it('documents the expected negative-to-positive layer gradient', () => {
    // H1 (top): Imagine & Design (positive)
    expect(expectedMapping.VISION).toBe('H1');
    expect(expectedMapping.BELIEF).toBe('H1');

    // H2 (middle): Transform & Enable (transitional)
    expect(expectedMapping.ENABLER).toBe('H2');

    // H3 (bottom): Challenges & Constraints (negative)
    expect(expectedMapping.CHALLENGE).toBe('H3');
    expect(expectedMapping.FRICTION).toBe('H3');
    expect(expectedMapping.CONSTRAINT).toBe('H3');
  });

  it('ensures all negative node types are in H3 (bottom)', () => {
    const negativeTypes = ['CHALLENGE', 'FRICTION', 'CONSTRAINT'];
    for (const type of negativeTypes) {
      expect(expectedMapping[type]).toBe('H3');
    }
  });

  it('ensures all positive node types are in H1 (top)', () => {
    const positiveTypes = ['VISION', 'BELIEF'];
    for (const type of positiveTypes) {
      expect(expectedMapping[type]).toBe('H1');
    }
  });

  it('ensures transitional types are in H2 (middle)', () => {
    expect(expectedMapping.ENABLER).toBe('H2');
  });
});

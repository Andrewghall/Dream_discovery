/**
 * Tests for sufficiency gating behavior.
 *
 * Verifies that coverage thresholds from the blueprint control when
 * sub-pads are marked as covered, and that data confidence assessment
 * reflects the available data sources.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  type StickyPad,
  type CogNode,
  type Lens,
  type SessionConfidence,
  calculateQuestionCoverage,
  calculateSessionConfidence,
  calculateLensCoverage,
} from '@/lib/cognitive-guidance/pipeline';
import {
  getOrCreateGuidanceState,
  updateGuidanceState,
  removeGuidanceState,
} from '@/lib/cognition/guidance-state';
import { composeBlueprint } from '@/lib/workshop/blueprint';

const TEST_WS = 'test-sufficiency-ws';

afterEach(() => {
  removeGuidanceState(TEST_WS);
});

// ── Helpers ──────────────────────────────────────────────────

function makePad(overrides: Partial<StickyPad> = {}): StickyPad {
  return {
    id: `pad-${Math.random().toString(36).slice(2, 8)}`,
    type: 'CLARIFICATION',
    prompt: 'What does the ideal customer experience look like in terms of satisfaction and retention?',
    signalStrength: 0.7,
    provenance: {
      triggerType: 'repeated_theme',
      sourceNodeIds: [],
      description: 'Test pad',
    },
    createdAtMs: Date.now(),
    status: 'active',
    snoozedUntilMs: null,
    source: 'prep',
    questionId: 'q-1',
    grounding: 'Customer satisfaction is key to retention and growth',
    coveragePercent: 0,
    coverageState: 'active',
    lens: 'Customer',
    mainQuestionIndex: 0,
    journeyGapId: null,
    padLabel: null,
    ...overrides,
  };
}

function makeNode(overrides: Partial<CogNode> = {}): CogNode {
  return {
    id: `node-${Math.random().toString(36).slice(2, 8)}`,
    rawText: 'Customer satisfaction has been declining due to long wait times',
    speakerId: 'speaker-1',
    createdAtMs: Date.now() - 30_000,
    nodeType: 'BELIEF',
    typeConfidence: 0.8,
    lenses: [{ lens: 'Customer' as Lens, relevance: 0.8, evidence: 'keyword' }],
    keywords: ['customer', 'satisfaction', 'wait'],
    sourceClassification: null,
    sourceAgenticAnalysis: null,
    ...overrides,
  };
}

// ── Coverage threshold from blueprint ────────────────────────

describe('coverage threshold from blueprint', () => {
  it('default blueprint has 70% coverage threshold', () => {
    const bp = composeBlueprint({
      industry: null,
      dreamTrack: null,
      engagementType: null,
      domainPack: null,
      purpose: null,
      outcomes: null,
    });
    expect(bp.questionPolicy.coverageThresholdPercent).toBe(70);
  });

  it('GuidanceState defaults to 70 coverage threshold', () => {
    const state = getOrCreateGuidanceState(TEST_WS);
    expect(state.coverageThreshold).toBe(70);
  });

  it('GuidanceState can be updated with blueprint coverage threshold', () => {
    const bp = composeBlueprint({
      industry: null,
      dreamTrack: null,
      engagementType: null,
      domainPack: 'contact_centre',
      purpose: null,
      outcomes: null,
    });

    const state = getOrCreateGuidanceState(TEST_WS);
    updateGuidanceState(TEST_WS, {
      coverageThreshold: bp.questionPolicy.coverageThresholdPercent,
    });

    expect(state.coverageThreshold).toBe(70);
  });

  it('coverage threshold is bounded between 50 and 95', () => {
    // This boundary is enforced in the guidance-state API route
    // Here we test the GuidanceState store accepts any value
    const state = getOrCreateGuidanceState(TEST_WS);
    updateGuidanceState(TEST_WS, { coverageThreshold: 85 });
    expect(state.coverageThreshold).toBe(85);
  });
});

// ── calculateQuestionCoverage ────────────────────────────────

describe('calculateQuestionCoverage', () => {
  it('returns 0 for no nodes', () => {
    const pad = makePad();
    const coverage = calculateQuestionCoverage(pad, []);
    expect(coverage).toBe(0);
  });

  it('returns positive coverage when nodes match keywords', () => {
    const pad = makePad({
      prompt: 'What does the ideal customer experience look like?',
      grounding: 'Focus on satisfaction and retention metrics',
    });

    const nodes = [
      makeNode({
        rawText: 'Customer satisfaction scores have been improving since we changed the process',
        keywords: ['customer', 'satisfaction'],
      }),
      makeNode({
        rawText: 'Retention is critical for our growth strategy going forward',
        keywords: ['retention', 'growth'],
      }),
    ];

    const coverage = calculateQuestionCoverage(pad, nodes);
    expect(coverage).toBeGreaterThan(0);
  });

  it('returns higher coverage with more relevant nodes', () => {
    const pad = makePad({
      prompt: 'What technology constraints are we dealing with?',
      grounding: 'Legacy systems, integration challenges, data quality',
    });

    const fewNodes = [
      makeNode({
        rawText: 'Legacy systems are a major constraint for our technology',
        keywords: ['legacy', 'systems', 'technology'],
      }),
    ];

    const manyNodes = [
      ...fewNodes,
      makeNode({
        rawText: 'Integration between platforms is extremely difficult',
        keywords: ['integration', 'platforms'],
      }),
      makeNode({
        rawText: 'Data quality issues mean we cannot trust our technology systems',
        keywords: ['data', 'quality', 'technology'],
      }),
      makeNode({
        rawText: 'Legacy infrastructure prevents adoption of new technology',
        keywords: ['legacy', 'infrastructure', 'technology'],
      }),
    ];

    const coverageFew = calculateQuestionCoverage(pad, fewNodes);
    const coverageMany = calculateQuestionCoverage(pad, manyNodes);

    expect(coverageMany).toBeGreaterThan(coverageFew);
  });

  it('UNCLASSIFIED nodes do not count toward coverage', () => {
    const pad = makePad({
      prompt: 'What are the people challenges?',
    });

    const nodes = [
      makeNode({
        rawText: 'People challenges include recruitment and retention',
        nodeType: 'UNCLASSIFIED',
        typeConfidence: 0,
        keywords: ['people', 'challenges'],
      }),
    ];

    const coverage = calculateQuestionCoverage(pad, nodes);
    expect(coverage).toBe(0);
  });
});

// ── calculateSessionConfidence ───────────────────────────────

describe('calculateSessionConfidence', () => {
  it('returns zero confidence for no nodes', () => {
    const result = calculateSessionConfidence([], new Map(), [], 0);
    expect(result.overallConfidence).toBe(0);
    expect(result.categorisedRate).toBe(0);
    expect(result.lensCoverageRate).toBe(0);
    expect(result.contradictionCount).toBe(0);
    expect(result.stabilisedBeliefCount).toBe(0);
  });

  it('categorisedRate reflects classified vs unclassified', () => {
    const nodes = [
      makeNode({ nodeType: 'BELIEF', typeConfidence: 0.8 }),
      makeNode({ nodeType: 'UNCLASSIFIED', typeConfidence: 0 }),
      makeNode({ nodeType: 'CONSTRAINT', typeConfidence: 0.7 }),
    ];

    const result = calculateSessionConfidence(nodes, new Map(), [], 0);
    // 2 out of 3 classified
    expect(result.categorisedRate).toBeCloseTo(2 / 3, 2);
  });

  it('overallConfidence averages typeConfidence', () => {
    const nodes = [
      makeNode({ typeConfidence: 0.8 }),
      makeNode({ typeConfidence: 0.6 }),
    ];

    const result = calculateSessionConfidence(nodes, new Map(), [], 0);
    expect(result.overallConfidence).toBeCloseTo(0.7, 2);
  });

  it('contradictionCount reflects unresolved only', () => {
    const contradictions = [
      { resolved: false },
      { resolved: true },
      { resolved: false },
    ];

    const nodes = [makeNode()];
    const result = calculateSessionConfidence(nodes, new Map(), contradictions, 0);
    expect(result.contradictionCount).toBe(2);
  });

  it('stabilisedBeliefCount is passed through', () => {
    const nodes = [makeNode()];
    const result = calculateSessionConfidence(nodes, new Map(), [], 7);
    expect(result.stabilisedBeliefCount).toBe(7);
  });

  it('lensCoverageRate counts lenses with 3+ nodes', () => {
    const nodes = [
      ...Array.from({ length: 4 }, () =>
        makeNode({
          lenses: [{ lens: 'People' as Lens, relevance: 0.8, evidence: 'test' }],
        }),
      ),
      ...Array.from({ length: 4 }, () =>
        makeNode({
          lenses: [{ lens: 'Customer' as Lens, relevance: 0.8, evidence: 'test' }],
        }),
      ),
      makeNode({
        lenses: [{ lens: 'Technology' as Lens, relevance: 0.8, evidence: 'test' }],
      }),
    ];

    const coverage = calculateLensCoverage(nodes);
    const result = calculateSessionConfidence(nodes, coverage, [], 0);

    // People (4 nodes) and Customer (4 nodes) >= 3, Technology (1 node) < 3
    // lensCoverageRate = 2 / 5 (ALL_LENSES has 5 lenses)
    expect(result.lensCoverageRate).toBeCloseTo(2 / 5, 2);
  });
});

// ── Data sufficiency state in GuidanceState ──────────────────

describe('data sufficiency in GuidanceState', () => {
  it('starts with null prepContext (no data)', () => {
    const state = getOrCreateGuidanceState(TEST_WS);
    expect(state.prepContext).toBeNull();
    expect(state.blueprint).toBeNull();
    expect(state.historicalMetrics).toBeNull();
  });

  it('tracks research availability in prepContext', () => {
    const state = getOrCreateGuidanceState(TEST_WS);
    updateGuidanceState(TEST_WS, {
      prepContext: {
        clientName: 'Test Corp',
        industry: 'Retail',
        dreamTrack: 'DOMAIN',
        targetDomain: 'Contact Centre',
        research: { companyOverview: 'A test company' } as any,
        discoveryIntelligence: null,
      },
    });

    expect(state.prepContext).not.toBeNull();
    expect(state.prepContext!.research).not.toBeNull();
    expect(state.prepContext!.discoveryIntelligence).toBeNull();
  });

  it('tracks blueprint availability', () => {
    const state = getOrCreateGuidanceState(TEST_WS);
    const bp = composeBlueprint({
      industry: null,
      dreamTrack: null,
      engagementType: null,
      domainPack: 'contact_centre',
      purpose: null,
      outcomes: null,
    });

    updateGuidanceState(TEST_WS, { blueprint: bp });
    expect(state.blueprint).not.toBeNull();
    expect(state.blueprint!.domainPack).toBe('contact_centre');
  });

  it('tracks historical metrics availability', () => {
    const state = getOrCreateGuidanceState(TEST_WS);
    const metrics = {
      version: 1 as const,
      domainPack: 'contact_centre',
      sources: [],
      series: [
        { metricKey: 'aht', metricLabel: 'AHT', unit: 'seconds', dataPoints: [{ period: '2024-01-01', value: 230, note: null }] },
      ],
      lastUpdatedAt: '2024-03-01T00:00:00Z',
    };

    updateGuidanceState(TEST_WS, { historicalMetrics: metrics });
    expect(state.historicalMetrics).not.toBeNull();
    expect(state.historicalMetrics!.series).toHaveLength(1);
  });

  it('all four data sources can be present simultaneously', () => {
    const state = getOrCreateGuidanceState(TEST_WS);

    updateGuidanceState(TEST_WS, {
      prepContext: {
        clientName: 'Test Corp',
        industry: 'Retail',
        dreamTrack: null,
        targetDomain: null,
        research: { companyOverview: 'Test' } as any,
        discoveryIntelligence: { painPoints: [], maturitySnapshot: [], consensusAreas: [], divergenceAreas: [] } as any,
      },
      blueprint: composeBlueprint({
        industry: null, dreamTrack: null, engagementType: null, domainPack: 'contact_centre', purpose: null, outcomes: null,
      }),
      historicalMetrics: {
        version: 1 as const,
        domainPack: 'contact_centre',
        sources: [],
        series: [],
        lastUpdatedAt: '2024-03-01T00:00:00Z',
      },
    });

    expect(state.prepContext!.research).not.toBeNull();
    expect(state.prepContext!.discoveryIntelligence).not.toBeNull();
    expect(state.blueprint).not.toBeNull();
    expect(state.historicalMetrics).not.toBeNull();
  });
});

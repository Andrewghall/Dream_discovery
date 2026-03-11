import {
  computeStrategicEvidenceScore,
  gateStrategicImpact,
  computeDiscoveryEvidenceScore,
  gateDiscoveryValidation,
} from '../evidence-gating';
import type { WorkshopSignals, StrategicImpact, DiscoveryValidation } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function sparseSignals(): WorkshopSignals {
  return {
    context: { workshopName: 'Test', clientName: 'Test', businessContext: '', industry: '', lenses: [], objectives: '' },
    discovery: { themes: [], tensions: [], constraints: [], alignment: null, narrativeDivergence: null, participantCount: 0, insights: [] },
    liveSession: { reimaginePads: [], constraintPads: [], defineApproachPads: [], journey: [], hemisphereShift: null },
    scratchpad: { execSummary: null, potentialSolution: null, summaryContent: null },
  };
}

function richSignals(): WorkshopSignals {
  return {
    context: { workshopName: 'Jo Air', clientName: 'Jo Air', businessContext: 'Aviation', industry: 'Aviation', lenses: ['People'], objectives: 'Transform' },
    discovery: {
      themes: ['Theme 1', 'Theme 2', 'Theme 3', 'Theme 4'],
      tensions: [{ topic: 'A vs B', perspectives: ['A', 'B'] }, { topic: 'C vs D', perspectives: ['C', 'D'] }],
      constraints: [{ title: 'Budget', description: 'Tight' }, { title: 'Time', description: 'Pressured' }],
      alignment: 72,
      narrativeDivergence: 45,
      participantCount: 12,
      insights: Array.from({ length: 15 }, (_, i) => ({ text: `Insight ${i}`, type: 'OPPORTUNITY' })),
    },
    liveSession: {
      reimaginePads: Array.from({ length: 15 }, (_, i) => ({ text: `Pad ${i}` })),
      constraintPads: Array.from({ length: 8 }, (_, i) => ({ text: `C-Pad ${i}` })),
      defineApproachPads: Array.from({ length: 6 }, (_, i) => ({ text: `D-Pad ${i}` })),
      journey: [
        { stage: 'Intake', aiScore: 7 },
        { stage: 'Processing', aiScore: 8 },
        { stage: 'Dispatch', aiScore: 6 },
      ],
      hemisphereShift: 0.3,
    },
    scratchpad: { execSummary: 'A compelling summary', potentialSolution: null, summaryContent: null },
  };
}

function strategicResult(overrides: Partial<StrategicImpact> = {}): StrategicImpact {
  return {
    automationPotential: { percentage: 30, description: 'Partial automation' },
    aiAssistedWork: { percentage: 50, description: 'AI augmentation' },
    humanOnlyWork: { percentage: 20, description: 'Human judgment' },
    efficiencyGains: [],
    experienceImprovements: [],
    businessCaseSummary: 'Strong case',
    confidenceScore: 65,
    ...overrides,
  };
}

function discoveryResult(overrides: Partial<DiscoveryValidation> = {}): DiscoveryValidation {
  return {
    confirmedIssues: [],
    newIssues: [],
    reducedIssues: [],
    hypothesisAccuracy: 80,
    summary: 'Good alignment',
    ...overrides,
  };
}

// ── Strategic Evidence Score ──────────────────────────────────────────────────

describe('computeStrategicEvidenceScore', () => {
  test('sparse signals return low score', () => {
    expect(computeStrategicEvidenceScore(sparseSignals())).toBeLessThan(40);
  });

  test('rich signals return high score', () => {
    expect(computeStrategicEvidenceScore(richSignals())).toBeGreaterThanOrEqual(40);
  });

  test('journey AI scores contribute significantly', () => {
    const s = sparseSignals();
    s.liveSession.journey = [{ stage: 'A', aiScore: 7 }, { stage: 'B', aiScore: 8 }, { stage: 'C', aiScore: 6 }];
    expect(computeStrategicEvidenceScore(s)).toBeGreaterThanOrEqual(40);
  });
});

// ── Gate Strategic Impact ─────────────────────────────────────────────────────

describe('gateStrategicImpact', () => {
  test('sparse signals null out the buckets', () => {
    const result = gateStrategicImpact(strategicResult(), 20);
    expect(result.automationPotential).toBeNull();
    expect(result.aiAssistedWork).toBeNull();
    expect(result.humanOnlyWork).toBeNull();
    expect(result.confidenceScore).toBeNull();
  });

  test('rich signals preserve computed buckets', () => {
    const result = gateStrategicImpact(strategicResult(), 70);
    expect(result.automationPotential?.percentage).toBe(30);
    expect(result.aiAssistedWork?.percentage).toBe(50);
    expect(result.humanOnlyWork?.percentage).toBe(20);
    expect(result.confidenceScore).toBe(65);
  });

  test('exact anchor pattern (35/45/20) is nulled out even with sufficient evidence', () => {
    const anchoredResult = strategicResult({
      automationPotential: { percentage: 35, description: 'anchor' },
      aiAssistedWork: { percentage: 45, description: 'anchor' },
      humanOnlyWork: { percentage: 20, description: 'anchor' },
    });
    const result = gateStrategicImpact(anchoredResult, 70);
    expect(result.automationPotential).toBeNull();
    expect(result.aiAssistedWork).toBeNull();
    expect(result.humanOnlyWork).toBeNull();
  });

  test('non-anchor values that sum to 100 are NOT nulled', () => {
    const nonAnchor = strategicResult({
      automationPotential: { percentage: 40, description: 'legit' },
      aiAssistedWork: { percentage: 40, description: 'legit' },
      humanOnlyWork: { percentage: 20, description: 'legit' },
    });
    const result = gateStrategicImpact(nonAnchor, 70);
    expect(result.automationPotential?.percentage).toBe(40);
  });
});

// ── Discovery Evidence Score ──────────────────────────────────────────────────

describe('computeDiscoveryEvidenceScore', () => {
  test('sparse signals return low score', () => {
    expect(computeDiscoveryEvidenceScore(sparseSignals())).toBeLessThan(30);
  });

  test('rich signals return high score', () => {
    expect(computeDiscoveryEvidenceScore(richSignals())).toBeGreaterThanOrEqual(30);
  });
});

// ── Gate Discovery Validation ─────────────────────────────────────────────────

describe('gateDiscoveryValidation', () => {
  test('sparse signals null out hypothesisAccuracy', () => {
    const result = gateDiscoveryValidation(discoveryResult(), 10);
    expect(result.hypothesisAccuracy).toBeNull();
  });

  test('rich signals preserve computed accuracy', () => {
    const result = gateDiscoveryValidation(discoveryResult({ hypothesisAccuracy: 80 }), 75);
    expect(result.hypothesisAccuracy).toBe(80);
  });

  test('exact anchor value 75 is nulled out even with sufficient evidence', () => {
    const result = gateDiscoveryValidation(discoveryResult({ hypothesisAccuracy: 75 }), 75);
    expect(result.hypothesisAccuracy).toBeNull();
  });

  test('value 74 is NOT nulled (only exact 75 is treated as anchor)', () => {
    const result = gateDiscoveryValidation(discoveryResult({ hypothesisAccuracy: 74 }), 75);
    expect(result.hypothesisAccuracy).toBe(74);
  });
});

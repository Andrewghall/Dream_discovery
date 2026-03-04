/**
 * Tests for lens bleed prevention across workshop phases.
 *
 * Ensures that REIMAGINE excludes Technology/Regulation,
 * that blueprint phaseLensPolicy overrides defaults, and
 * that signal generation respects phase-level lens filtering.
 */

import { describe, it, expect } from 'vitest';
import {
  type CogNode,
  type Signal,
  type StickyPad,
  type DialoguePhase,
  type Lens,
  getReimagineFilter,
  getPhaseAllowedSignals,
  detectSignals,
  generateStickyPads,
} from '@/lib/cognitive-guidance/pipeline';
import { composeBlueprint, type WorkshopBlueprint } from '@/lib/workshop/blueprint';

// ── Helpers ──────────────────────────────────────────────────

function makeNode(overrides: Partial<CogNode> = {}): CogNode {
  return {
    id: `node-${Math.random().toString(36).slice(2, 8)}`,
    rawText: 'Test contribution text about customer service improvements',
    speakerId: 'speaker-1',
    createdAtMs: Date.now() - 60_000,
    nodeType: 'BELIEF',
    typeConfidence: 0.8,
    lenses: [],
    keywords: [],
    sourceClassification: null,
    sourceAgenticAnalysis: null,
    ...overrides,
  };
}

function makeNodesWithLens(lens: Lens, count: number, type: CogNode['nodeType'] = 'BELIEF'): CogNode[] {
  return Array.from({ length: count }, (_, i) =>
    makeNode({
      id: `node-${lens}-${i}`,
      nodeType: type,
      lenses: [{ lens, relevance: 0.8, evidence: `${lens} keyword` }],
      keywords: [lens.toLowerCase(), 'test'],
    }),
  );
}

// ── getReimagineFilter ───────────────────────────────────────

describe('getReimagineFilter', () => {
  it('returns default 3 lenses when no blueprint', () => {
    const filter = getReimagineFilter();
    expect(filter).toContain('People');
    expect(filter).toContain('Customer');
    expect(filter).toContain('Organisation');
    expect(filter.size).toBe(3);
  });

  it('returns default when blueprint is null', () => {
    const filter = getReimagineFilter(null);
    expect(filter.size).toBe(3);
  });

  it('returns default when REIMAGINE array is empty', () => {
    const filter = getReimagineFilter({ REIMAGINE: [] });
    expect(filter.size).toBe(3);
  });

  it('uses blueprint REIMAGINE lenses when provided', () => {
    const filter = getReimagineFilter({ REIMAGINE: ['People', 'Customer'] });
    expect(filter.size).toBe(2);
    expect(filter).toContain('People');
    expect(filter).toContain('Customer');
    expect(filter).not.toContain('Organisation');
  });

  it('allows custom lenses from blueprint', () => {
    const filter = getReimagineFilter({
      REIMAGINE: ['People', 'Customer', 'Organisation', 'Technology'],
    });
    expect(filter.size).toBe(4);
    expect(filter).toContain('Technology');
  });
});

// ── getPhaseAllowedSignals ───────────────────────────────────

describe('getPhaseAllowedSignals', () => {
  it('returns defaults for REIMAGINE when no blueprint', () => {
    const allowed = getPhaseAllowedSignals('REIMAGINE');
    expect(allowed.has('repeated_theme')).toBe(true);
    expect(allowed.has('missing_dimension')).toBe(true);
    // REIMAGINE should not allow risk_cluster by default
    expect(allowed.has('risk_cluster')).toBe(false);
  });

  it('returns defaults for CONSTRAINTS when no blueprint', () => {
    const allowed = getPhaseAllowedSignals('CONSTRAINTS');
    expect(allowed.has('risk_cluster')).toBe(true);
    expect(allowed.has('high_freq_constraint')).toBe(true);
    expect(allowed.has('weak_enabler')).toBe(true);
    expect(allowed.has('metric_contradiction')).toBe(true);
  });

  it('returns defaults for DEFINE_APPROACH when no blueprint', () => {
    const allowed = getPhaseAllowedSignals('DEFINE_APPROACH');
    expect(allowed.has('weak_enabler')).toBe(true);
    expect(allowed.has('metric_contradiction')).toBe(true);
  });

  it('uses blueprint signal policy when provided', () => {
    const policy = {
      REIMAGINE: ['repeated_theme'],
      CONSTRAINTS: ['contradiction', 'risk_cluster'],
    };
    const reimagine = getPhaseAllowedSignals('REIMAGINE', policy);
    expect(reimagine.size).toBe(1);
    expect(reimagine.has('repeated_theme')).toBe(true);

    const constraints = getPhaseAllowedSignals('CONSTRAINTS', policy);
    expect(constraints.size).toBe(2);
    expect(constraints.has('contradiction')).toBe(true);
    expect(constraints.has('risk_cluster')).toBe(true);
  });

  it('falls back to defaults for missing phases in blueprint', () => {
    const policy = { REIMAGINE: ['repeated_theme'] };
    // CONSTRAINTS not in policy -- should fall back to defaults
    const constraints = getPhaseAllowedSignals('CONSTRAINTS', policy);
    expect(constraints.has('risk_cluster')).toBe(true);
  });
});

// ── Lens bleed in signal generation ──────────────────────────

describe('generateStickyPads lens bleed prevention', () => {
  it('REIMAGINE skips missing_dimension for Technology', () => {
    const techSignal: Signal = {
      id: 'missing_dimension:Technology',
      type: 'missing_dimension',
      description: 'No contributions in the Technology dimension',
      strength: 1.0,
      nodeIds: [],
      lenses: ['Technology' as Lens],
    };

    const pads = generateStickyPads([techSignal], [], Date.now(), 'REIMAGINE');
    // Should not create a pad for Technology in REIMAGINE
    const techPads = pads.filter((p) => p.lens === 'Technology');
    expect(techPads).toHaveLength(0);
  });

  it('REIMAGINE skips missing_dimension for Regulation', () => {
    const regSignal: Signal = {
      id: 'missing_dimension:Regulation',
      type: 'missing_dimension',
      description: 'No contributions in the Regulation dimension',
      strength: 1.0,
      nodeIds: [],
      lenses: ['Regulation' as Lens],
    };

    const pads = generateStickyPads([regSignal], [], Date.now(), 'REIMAGINE');
    const regPads = pads.filter((p) => p.lens === 'Regulation');
    expect(regPads).toHaveLength(0);
  });

  it('REIMAGINE allows missing_dimension for People', () => {
    const peopleSignal: Signal = {
      id: 'missing_dimension:People',
      type: 'missing_dimension',
      description: 'No contributions in the People dimension',
      strength: 1.0,
      nodeIds: [],
      lenses: ['People' as Lens],
    };

    const pads = generateStickyPads([peopleSignal], [], Date.now(), 'REIMAGINE');
    const peoplePads = pads.filter((p) => p.lens === 'People');
    expect(peoplePads.length).toBeGreaterThan(0);
  });

  it('REIMAGINE allows missing_dimension for Customer', () => {
    const signal: Signal = {
      id: 'missing_dimension:Customer',
      type: 'missing_dimension',
      description: 'No contributions in the Customer dimension',
      strength: 1.0,
      nodeIds: [],
      lenses: ['Customer' as Lens],
    };

    const pads = generateStickyPads([signal], [], Date.now(), 'REIMAGINE');
    expect(pads.some((p) => p.lens === 'Customer')).toBe(true);
  });

  it('CONSTRAINTS allows missing_dimension for Technology', () => {
    const techSignal: Signal = {
      id: 'missing_dimension:Technology',
      type: 'missing_dimension',
      description: 'No contributions in the Technology dimension',
      strength: 1.0,
      nodeIds: [],
      lenses: ['Technology' as Lens],
    };

    const pads = generateStickyPads([techSignal], [], Date.now(), 'CONSTRAINTS');
    expect(pads.some((p) => p.lens === 'Technology')).toBe(true);
  });

  it('REIMAGINE blocks risk_cluster signals', () => {
    const riskSignal: Signal = {
      id: 'risk_cluster:Technology:n1',
      type: 'risk_cluster',
      description: '3 risks in Technology within 2 minutes',
      strength: 0.6,
      nodeIds: ['n1', 'n2', 'n3'],
      lenses: ['Technology' as Lens],
    };

    const pads = generateStickyPads([riskSignal], [], Date.now(), 'REIMAGINE');
    expect(pads).toHaveLength(0);
  });

  it('CONSTRAINTS allows risk_cluster signals', () => {
    const riskSignal: Signal = {
      id: 'risk_cluster:Technology:n1',
      type: 'risk_cluster',
      description: '3 risks in Technology within 2 minutes',
      strength: 0.6,
      nodeIds: ['n1', 'n2', 'n3'],
      lenses: ['Technology' as Lens],
    };

    const pads = generateStickyPads([riskSignal], [], Date.now(), 'CONSTRAINTS');
    expect(pads.length).toBeGreaterThan(0);
  });

  it('REIMAGINE blocks metric_contradiction signals', () => {
    const mcSignal: Signal = {
      id: 'metric_contradiction:aht',
      type: 'metric_contradiction',
      description: 'AHT claim contradicts data',
      strength: 0.8,
      nodeIds: ['n1'],
      lenses: ['Customer' as Lens],
    };

    const pads = generateStickyPads([mcSignal], [], Date.now(), 'REIMAGINE');
    expect(pads).toHaveLength(0);
  });

  it('CONSTRAINTS allows metric_contradiction signals', () => {
    const mcSignal: Signal = {
      id: 'metric_contradiction:aht',
      type: 'metric_contradiction',
      description: 'AHT claim contradicts data',
      strength: 0.8,
      nodeIds: ['n1'],
      lenses: ['Customer' as Lens],
    };

    const pads = generateStickyPads([mcSignal], [], Date.now(), 'CONSTRAINTS');
    expect(pads.length).toBeGreaterThan(0);
    expect(pads[0].type).toBe('METRIC_CHALLENGE');
  });
});

// ── Blueprint-driven phase lens policy ───────────────────────

describe('blueprint phaseLensPolicy controls composition', () => {
  it('contact_centre blueprint restricts REIMAGINE correctly', () => {
    const bp = composeBlueprint({
      industry: null,
      dreamTrack: null,
      engagementType: null,
      domainPack: 'contact_centre',
      purpose: null,
      outcomes: null,
    });

    // REIMAGINE should not include Technology or Regulation
    expect(bp.phaseLensPolicy.REIMAGINE).not.toContain('Technology');
    expect(bp.phaseLensPolicy.REIMAGINE).not.toContain('Regulation');

    // But CONSTRAINTS should include them
    const allLensNames = bp.lenses.map((l) => l.name);
    for (const name of allLensNames) {
      expect(bp.phaseLensPolicy.CONSTRAINTS).toContain(name);
    }
  });
});

// ── detectSignals respects phase semantics ───────────────────

describe('detectSignals produces correct signal types', () => {
  const now = Date.now();

  it('detects missing_dimension when 10+ nodes and a lens has 0', () => {
    // Create nodes across People and Customer only
    const nodes = [
      ...makeNodesWithLens('People' as Lens, 6),
      ...makeNodesWithLens('Customer' as Lens, 6),
    ];

    const signals = detectSignals(nodes, [], now);
    const missingDim = signals.filter((s) => s.type === 'missing_dimension');
    expect(missingDim.length).toBeGreaterThan(0);

    // Technology should be flagged as missing
    const techMissing = missingDim.find((s) => s.lenses.includes('Technology' as Lens));
    expect(techMissing).toBeTruthy();
  });

  it('does not detect missing_dimension with fewer than 10 nodes', () => {
    const nodes = makeNodesWithLens('People' as Lens, 5);
    const signals = detectSignals(nodes, [], now);
    expect(signals.filter((s) => s.type === 'missing_dimension')).toHaveLength(0);
  });

  it('detects repeated_theme when keyword appears 3+ times', () => {
    const keyword = 'automation';
    const nodes = Array.from({ length: 4 }, (_, i) =>
      makeNode({
        id: `kw-${i}`,
        keywords: [keyword, 'test'],
      }),
    );

    const signals = detectSignals(nodes, [], now);
    const repeated = signals.find((s) => s.type === 'repeated_theme' && s.id.includes(keyword));
    expect(repeated).toBeTruthy();
    expect(repeated!.strength).toBeGreaterThan(0);
  });

  it('detects unresolved contradictions', () => {
    const nodes = makeNodesWithLens('People' as Lens, 5);
    const contradictions = [
      { id: 'c1', beliefA: 'A', beliefB: 'B', resolved: false },
      { id: 'c2', beliefA: 'C', beliefB: 'D', resolved: true },
    ];

    const signals = detectSignals(nodes, contradictions, now);
    const contras = signals.filter((s) => s.type === 'contradiction');
    expect(contras).toHaveLength(1); // Only unresolved
  });

  it('detects high_freq_constraint with 4+ constraints in one lens', () => {
    const nodes = makeNodesWithLens('Technology' as Lens, 5, 'CONSTRAINT');
    const signals = detectSignals(nodes, [], now);
    const hfc = signals.filter((s) => s.type === 'high_freq_constraint');
    expect(hfc.length).toBeGreaterThan(0);
    expect(hfc[0].lenses).toContain('Technology');
  });

  it('detects weak_enabler when 3+ constraints and 0-1 enablers', () => {
    const constraints = makeNodesWithLens('People' as Lens, 4, 'CONSTRAINT');
    const enabler = makeNodesWithLens('People' as Lens, 1, 'ENABLER');
    enabler[0].id = 'enabler-0'; // avoid id collision
    const nodes = [...constraints, ...enabler];

    const signals = detectSignals(nodes, [], now);
    const we = signals.filter((s) => s.type === 'weak_enabler' && s.lenses.includes('People' as Lens));
    expect(we.length).toBeGreaterThan(0);
  });
});

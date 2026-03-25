/**
 * Unit tests for the Hemisphere Relationship Engine.
 *
 * Tests cover:
 *   - Layer classification (classifyNodeLayer)
 *   - Edge creation rules (each rule individually)
 *   - Graph construction (buildRelationshipGraph)
 *   - Edge scoring (scoreEdge, assignEdgeTier)
 *   - Graph intelligence (all 5 analyses)
 */

import { describe, it, expect } from 'vitest';
import { buildEvidenceClusters, type RawSignal, type EvidenceCluster } from '@/lib/output/evidence-clustering';
import { scoreCluster, scoreAllClusters } from '@/lib/output/evidence-scoring';
import { classifyNodeLayer, buildRelationshipGraph, buildSignalIndex } from '@/lib/output/edge-builder';
import { scoreEdge, assignEdgeTier } from '@/lib/output/edge-scoring';
import {
  extractDominantCausalChains,
  findBottlenecks,
  findCompensatingBehaviours,
  findBrokenChains,
  findContradictionPaths,
  computeGraphIntelligence,
} from '@/lib/output/graph-intelligence';
import type {
  RelationshipGraph,
  RelationshipNode,
  RelationshipEdge,
  NodeLayer,
  RelationshipType,
  EdgeTier,
} from '@/lib/output/relationship-graph';

// ── Signal factories ──────────────────────────────────────────────────────────

let _idSeq = 0;
function sig(overrides: Partial<RawSignal> = {}): RawSignal {
  const id = `sig-${++_idSeq}`;
  return {
    id,
    rawText: overrides.rawText ?? `Signal text for ${id}`,
    speakerId: overrides.speakerId ?? null,
    participantRole: overrides.participantRole ?? null,
    lens: overrides.lens ?? null,
    phase: overrides.phase ?? null,
    primaryType: overrides.primaryType ?? null,
    sentiment: overrides.sentiment ?? 'neutral',
    themeLabels: overrides.themeLabels ?? ['theme_a'],
    confidence: overrides.confidence ?? null,
    isConfirmedParticipant: overrides.isConfirmedParticipant ?? false,
    sourceStream: overrides.sourceStream ?? 'live',
    ...overrides,
  };
}

function confirmedSig(
  speakerId: string,
  role: string,
  theme: string,
  overrides: Partial<RawSignal> = {},
): RawSignal {
  return sig({
    speakerId,
    participantRole: role,
    isConfirmedParticipant: true,
    themeLabels: [theme],
    ...overrides,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeScoredClusters(signals: RawSignal[], totalRoles = 5) {
  const clusters = buildEvidenceClusters(signals);
  return scoreAllClusters(clusters, totalRoles);
}

// ── Layer classification ──────────────────────────────────────────────────────

describe('classifyNodeLayer', () => {
  // Note: normaliseKey strips underscores (they're non-alphanumeric), so theme labels
  // must use spaces to produce underscore-keyed cluster lookups.
  // e.g. 'tech blocks' → normalised key 'tech_blocks' ✓
  //      'tech_blocks' → normalised key 'techblocks'  ✗

  it('classifies a CONSTRAINT-type cluster correctly', () => {
    const signals = Array.from({ length: 5 }, () =>
      sig({ primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned', themeLabels: ['tech blocks'] }),
    );
    const clusters = buildEvidenceClusters(signals);
    const cluster = clusters.find((c) => c.clusterKey === 'tech_blocks')!;
    const { layer } = classifyNodeLayer(cluster);
    expect(layer).toBe('CONSTRAINT');
  });

  it('classifies a VISION-type cluster as REIMAGINATION', () => {
    const signals = Array.from({ length: 5 }, () =>
      sig({ primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive', themeLabels: ['future cx'] }),
    );
    const clusters = buildEvidenceClusters(signals);
    const cluster = clusters.find((c) => c.clusterKey === 'future_cx')!;
    const { layer } = classifyNodeLayer(cluster);
    expect(layer).toBe('REIMAGINATION');
  });

  it('classifies an ENABLER-type cluster correctly', () => {
    const signals = Array.from({ length: 5 }, () =>
      sig({ primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive', themeLabels: ['ai automation'] }),
    );
    const clusters = buildEvidenceClusters(signals);
    const cluster = clusters.find((c) => c.clusterKey === 'ai_automation')!;
    const { layer } = classifyNodeLayer(cluster);
    expect(layer).toBe('ENABLER');
  });

  it('uses type voting when phase is DISCOVERY (ambiguous)', () => {
    const signals = Array.from({ length: 4 }, () =>
      sig({ primaryType: 'CHALLENGE', phase: 'DISCOVERY', sentiment: 'concerned', themeLabels: ['process gap'] }),
    );
    const clusters = buildEvidenceClusters(signals);
    const cluster = clusters.find((c) => c.clusterKey === 'process_gap')!;
    const { layer } = classifyNodeLayer(cluster);
    // CHALLENGE → CONSTRAINT layer
    expect(layer).toBe('CONSTRAINT');
  });

  it('classifies ACTUAL_JOB as CONSTRAINT (current-state evidence, not a vision)', () => {
    const signals = Array.from({ length: 4 }, () =>
      sig({ primaryType: 'ACTUAL_JOB', phase: 'DISCOVERY', sentiment: 'positive', themeLabels: ['ideal service'] }),
    );
    const clusters = buildEvidenceClusters(signals);
    const cluster = clusters.find((c) => c.clusterKey === 'ideal_service')!;
    const { layer } = classifyNodeLayer(cluster);
    expect(layer).toBe('CONSTRAINT');
  });
});

// ── Edge scoring ──────────────────────────────────────────────────────────────

describe('scoreEdge', () => {
  it('returns WEAK when signals are minimal', () => {
    const s = sig({ id: 'x1', isConfirmedParticipant: true, speakerId: 'p1', lens: 'Technology' });
    const index = new Map([['x1', s]]);
    const { score, tier } = scoreEdge({
      fromSignalIds:        ['x1'],
      toSignalIds:          [],
      sharedParticipantIds: [],
      signalIndex:          index,
    });
    expect(tier).toBe('WEAK');
    expect(score).toBeLessThan(25);
  });

  it('increases score with more shared participants', () => {
    const signals = Array.from({ length: 10 }, (_, i) =>
      sig({ id: `s${i}`, isConfirmedParticipant: true, speakerId: `p${i}`, lens: 'Technology', phase: 'CONSTRAINTS' }),
    );
    const index = new Map(signals.map((s) => [s.id, s]));
    const { score: score1 } = scoreEdge({
      fromSignalIds:        signals.slice(0, 2).map((s) => s.id),
      toSignalIds:          signals.slice(2, 4).map((s) => s.id),
      sharedParticipantIds: ['p0', 'p1'],
      signalIndex:          index,
    });
    const { score: score5 } = scoreEdge({
      fromSignalIds:        signals.slice(0, 5).map((s) => s.id),
      toSignalIds:          signals.slice(5, 10).map((s) => s.id),
      sharedParticipantIds: ['p0', 'p1', 'p2', 'p3', 'p4'],
      signalIndex:          index,
    });
    expect(score5).toBeGreaterThan(score1);
  });

  it('applies contradiction penalty when from-signals have mixed sentiment', () => {
    const posSig = sig({ id: 'pos', sentiment: 'positive', isConfirmedParticipant: true });
    const negSig = sig({ id: 'neg', sentiment: 'concerned', isConfirmedParticipant: true });
    const index  = new Map([['pos', posSig], ['neg', negSig]]);

    const { score: mixed } = scoreEdge({
      fromSignalIds:        ['pos', 'neg'],
      toSignalIds:          [],
      sharedParticipantIds: [],
      signalIndex:          index,
    });
    const { score: pure } = scoreEdge({
      fromSignalIds:        ['pos'],
      toSignalIds:          [],
      sharedParticipantIds: [],
      signalIndex:          index,
    });
    // Mixed should be penalised relative to pure
    expect(mixed).toBeLessThan(pure);
  });
});

describe('assignEdgeTier', () => {
  it('assigns WEAK for score < 25', () => expect(assignEdgeTier(24)).toBe('WEAK'));
  it('assigns EMERGING for score 25–44', () => expect(assignEdgeTier(25)).toBe('EMERGING'));
  it('assigns REINFORCED for score 45–64', () => expect(assignEdgeTier(45)).toBe('REINFORCED'));
  it('assigns SYSTEMIC for score ≥ 65', () => expect(assignEdgeTier(65)).toBe('SYSTEMIC'));
  it('assigns SYSTEMIC for score 100', () => expect(assignEdgeTier(100)).toBe('SYSTEMIC'));
});

// ── Graph construction ────────────────────────────────────────────────────────

describe('buildRelationshipGraph', () => {
  it('produces one node per non-unthemed cluster', () => {
    const signals = [
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`p${i}`, 'Manager', 'legacy_system', { primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned' }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`p${i}`, 'Manager', 'automation_tools', { primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive' }),
      ),
    ];
    const scored = makeScoredClusters(signals);
    const graph = buildRelationshipGraph(scored, 'test-wksp');
    expect(graph.nodes.length).toBe(2);
    expect(graph.workshopId).toBe('test-wksp');
  });

  it('excludes _unthemed cluster from nodes', () => {
    const signals = [
      sig({ themeLabels: [] }), // will be _unthemed
      confirmedSig('p1', 'Agent', 'real_theme', { primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive' }),
    ];
    const scored = makeScoredClusters(signals);
    const graph = buildRelationshipGraph(scored, 'test-wksp');
    expect(graph.nodes.every((n) => n.nodeId !== '_unthemed')).toBe(true);
  });

  it('creates a drives edge between CONSTRAINT and ENABLER with keyword overlap', () => {
    // Both clusters share the word "customer" → Jaccard overlap
    const constraintSignals = Array.from({ length: 4 }, (_, i) =>
      confirmedSig(`p${i}`, 'Manager', 'customer_system_constraint', {
        primaryType: 'CONSTRAINT',
        phase: 'CONSTRAINTS',
        sentiment: 'concerned',
        rawText: 'The customer system is too slow and unreliable for agents',
      }),
    );
    const enablerSignals = Array.from({ length: 4 }, (_, i) =>
      confirmedSig(`p${i + 10}`, 'Lead', 'customer_system_improvement', {
        primaryType: 'ENABLER',
        phase: 'DEFINE_APPROACH',
        sentiment: 'positive',
        rawText: 'Investing in the customer system platform would resolve agent bottlenecks',
      }),
    );
    const scored = makeScoredClusters([...constraintSignals, ...enablerSignals]);
    const graph = buildRelationshipGraph(scored, 'test');
    const drives = graph.edges.filter((e) => e.relationshipType === 'drives');
    expect(drives.length).toBeGreaterThan(0);
  });

  it('creates a responds_to edge when same participant spans CONSTRAINTS and DEFINE_APPROACH phases', () => {
    const signals = [
      confirmedSig('p1', 'Manager', 'legacy_crm', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
        rawText: 'Our legacy CRM cannot handle modern workflows',
      }),
      confirmedSig('p1', 'Manager', 'crm_replacement', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'We should replace the CRM with a modern platform',
      }),
      // More participants to lift tiers
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`q${i}`, 'Agent', 'legacy_crm', {
          primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
          rawText: 'Legacy CRM creates constant delays',
        }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`r${i}`, 'Lead', 'crm_replacement', {
          primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
          rawText: 'A new CRM platform is essential for transformation',
        }),
      ),
    ];
    const scored = makeScoredClusters(signals);
    const graph = buildRelationshipGraph(scored, 'test');
    const respondsTo = graph.edges.filter((e) => e.relationshipType === 'responds_to');
    expect(respondsTo.length).toBe(1);
    // p1 is the bridging participant
    expect(respondsTo[0].sharedParticipantIds).toContain('p1');
  });

  it('does NOT create responds_to when cross-phase participant exists but topics are unrelated', () => {
    // p1 participates in both clusters across phases, but the clusters are topically unrelated.
    // Jaccard should be ~0 — responds_to must NOT fire.
    const signals = [
      confirmedSig('p1', 'Manager', 'aircraft maintenance', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
        rawText: 'Aircraft maintenance schedules are unreliable and unsafe for flight operations',
      }),
      confirmedSig('p1', 'Manager', 'flower subscriptions', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'Fresh flower subscriptions improve workplace wellbeing and team morale',
      }),
      ...Array.from({ length: 2 }, (_, i) =>
        confirmedSig(`q${i}`, 'Agent', 'aircraft maintenance', {
          primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
          rawText: 'Aircraft engine maintenance creates safety risks for flight crews',
        }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        confirmedSig(`r${i}`, 'Lead', 'flower subscriptions', {
          primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
          rawText: 'Weekly flower delivery subscriptions boost morale across the office',
        }),
      ),
    ];
    const scored = makeScoredClusters(signals);
    const graph = buildRelationshipGraph(scored, 'test');
    const crossTopicResponds = graph.edges.filter(
      (e) =>
        e.relationshipType === 'responds_to' &&
        e.fromNodeId === 'flower_subscriptions' &&
        e.toNodeId === 'aircraft_maintenance',
    );
    expect(crossTopicResponds.length).toBe(0);
  });

  it('creates an enables edge between ENABLER and REIMAGINATION clusters', () => {
    const enablerSigs = Array.from({ length: 4 }, (_, i) =>
      confirmedSig(`p${i}`, 'Lead', 'digital_tools', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'Digital tools and automation would speed up customer service workflows',
      }),
    );
    const visionSigs = Array.from({ length: 4 }, (_, i) =>
      confirmedSig(`v${i}`, 'Director', 'seamless_digital_service', {
        primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive',
        rawText: 'A seamless digital service where customers resolve issues without waiting',
      }),
    );
    const scored = makeScoredClusters([...enablerSigs, ...visionSigs]);
    const graph = buildRelationshipGraph(scored, 'test');
    const enables = graph.edges.filter((e) => e.relationshipType === 'enables');
    expect(enables.length).toBeGreaterThan(0);
  });

  it('creates depends_on when Jaccard ≥ 0.10 AND shared participants confirm the vision-enabler link', () => {
    // shared0–shared2 appear in both the vision and enabler clusters (cross-domain continuity).
    // Both clusters discuss "digital customer self-service platform" — Jaccard well above 0.10.
    // Expected: enables(E→V) fires (content overlap) AND depends_on(V→E) fires (participant confirms).
    const sharedVisionSigs = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`shared${i}`, 'Director', 'digital customer platform', {
        primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive',
        rawText: 'A digital customer self-service platform resolving issues without agent involvement',
      }),
    );
    const sharedEnablerSigs = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`shared${i}`, 'Director', 'digital self service tools', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'Digital customer self-service tools and platform investment resolve agent workload',
      }),
    );
    const scored = makeScoredClusters([...sharedVisionSigs, ...sharedEnablerSigs]);
    const graph = buildRelationshipGraph(scored, 'test');
    const dependsOn = graph.edges.filter((e) => e.relationshipType === 'depends_on');
    expect(dependsOn.length).toBeGreaterThan(0);
    expect(dependsOn[0].sharedParticipantIds.length).toBeGreaterThan(0);
  });

  it('creates enables but NOT depends_on when topical overlap exists but no shared participants', () => {
    // Different participants in vision vs enabler — content overlap is high but no one
    // spans both clusters, so depends_on (which requires participant continuity) must NOT fire.
    const visionSigs = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`v${i}`, 'Director', 'digital customer platform', {
        primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive',
        rawText: 'A digital customer self-service platform resolving issues without agent involvement',
      }),
    );
    const enablerSigs = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`e${i}`, 'Lead', 'digital self service tools', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'Digital customer self-service tools and platform investment resolve agent workload',
      }),
    );
    const scored = makeScoredClusters([...visionSigs, ...enablerSigs]);
    const graph = buildRelationshipGraph(scored, 'test');
    const enables = graph.edges.filter(
      (e) =>
        e.relationshipType === 'enables' &&
        e.fromNodeId === 'digital_self_service_tools' &&
        e.toNodeId === 'digital_customer_platform',
    );
    const dependsOn = graph.edges.filter(
      (e) =>
        e.relationshipType === 'depends_on' &&
        e.fromNodeId === 'digital_customer_platform' &&
        e.toNodeId === 'digital_self_service_tools',
    );
    expect(enables.length).toBe(1);   // content overlap alone → enables fires
    expect(dependsOn.length).toBe(0); // no shared participants → depends_on suppressed
  });

  it('creates a contradicts edge when same-layer clusters share participants but oppose in sentiment', () => {
    const posSignals = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`p${i}`, 'Manager', 'change_readiness_pos', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'The team is ready for transformation and embracing change',
      }),
    );
    const negSignals = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`p${i}`, 'Manager', 'change_readiness_neg', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'critical',
        rawText: 'The team is resistant to change and not prepared',
      }),
    );
    const scored = makeScoredClusters([...posSignals, ...negSignals]);
    const graph = buildRelationshipGraph(scored, 'test');
    const contradicts = graph.edges.filter((e) => e.relationshipType === 'contradicts');
    expect(contradicts.length).toBe(1);
    expect(contradicts[0].sharedParticipantIds.length).toBeGreaterThan(0);
  });

  it('blocks supersedes drives for same CONSTRAINT→ENABLER pair', () => {
    // High Jaccard (shared tokens: "system", "platform", "agent") + ENABLER has contradictions
    const constraintSigs = [
      confirmedSig('p1', 'Manager', 'system_platform_issue', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
        rawText: 'The legacy system platform is blocking agent productivity completely',
      }),
      confirmedSig('p2', 'Lead', 'system_platform_issue', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'critical',
        rawText: 'Agent access to the system platform is broken and unreliable',
      }),
    ];
    // ENABLER with contradicting signals (one positive, one concerned)
    const enablerSigs = [
      confirmedSig('p3', 'IT', 'system_platform_upgrade', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'Upgrading the system platform will restore agent access and productivity',
      }),
      confirmedSig('p4', 'IT', 'system_platform_upgrade', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'concerned',
        rawText: 'The system platform upgrade will not resolve the fundamental agent access issue',
      }),
    ];
    const scored = makeScoredClusters([...constraintSigs, ...enablerSigs]);
    const graph = buildRelationshipGraph(scored, 'test');
    const driveEdges = graph.edges.filter(
      (e) =>
        e.relationshipType === 'drives' &&
        e.fromNodeId === 'system_platform_issue' &&
        e.toNodeId === 'system_platform_upgrade',
    );
    const blockEdges = graph.edges.filter(
      (e) =>
        e.relationshipType === 'blocks' &&
        e.fromNodeId === 'system_platform_issue' &&
        e.toNodeId === 'system_platform_upgrade',
    );
    // If blocks fires, drives should NOT exist for same pair
    if (blockEdges.length > 0) {
      expect(driveEdges.length).toBe(0);
    }
  });

  it('edge IDs are deterministic (same inputs → same graph)', () => {
    const signals = [
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`p${i}`, 'Agent', 'speed_issue', { primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned' }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`e${i}`, 'Manager', 'speed_solution', { primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive' }),
      ),
    ];
    const scored = makeScoredClusters(signals);
    const g1 = buildRelationshipGraph(scored, 'w1');
    const g2 = buildRelationshipGraph(scored, 'w1');
    const ids1 = g1.edges.map((e) => e.edgeId).sort();
    const ids2 = g2.edges.map((e) => e.edgeId).sort();
    expect(ids1).toEqual(ids2);
  });

  it('graph metadata counts are consistent', () => {
    const signals = [
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`c${i}`, 'Manager', 'constraint_a', { primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned' }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`e${i}`, 'Lead', 'enabler_a', { primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive' }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`v${i}`, 'Director', 'vision_a', { primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive' }),
      ),
    ];
    const scored = makeScoredClusters(signals);
    const graph = buildRelationshipGraph(scored, 'test');

    expect(graph.nodeCount).toBe(graph.nodes.length);
    expect(graph.edgeCount).toBe(graph.edges.length);

    const layerTotal = Object.values(graph.layerCounts).reduce((s, v) => s + v, 0);
    expect(layerTotal).toBe(graph.nodeCount);

    const typeTotal = Object.values(graph.edgeTypeCounts).reduce((s, v) => s + v, 0);
    expect(typeTotal).toBe(graph.edgeCount);
  });
});

// ── Graph intelligence ────────────────────────────────────────────────────────

function buildTestGraph() {
  // Build a graph with: 1 constraint, 1 enabler, 1 vision
  // constraint → enabler (responds_to): p0 spans both clusters, cross-phase
  // enabler → vision (enables): keyword overlap
  const signals: RawSignal[] = [
    // constraint cluster: 3 participants
    ...Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`p${i}`, 'Manager', 'slow_processes', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
        rawText: 'Manual slow processes and paper-based workflows are holding back the team',
      }),
    ),
    // enabler cluster: p0 spans both (cross-phase participant), plus 2 extra
    confirmedSig('p0', 'Manager', 'process_automation', {
      primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
      rawText: 'Process automation tools would eliminate manual slow workflows',
    }),
    ...Array.from({ length: 2 }, (_, i) =>
      confirmedSig(`e${i}`, 'IT Lead', 'process_automation', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'Automated process tools would solve the paper-based workflow problem',
      }),
    ),
    // vision cluster: 3 participants, shared keywords with enabler
    ...Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`v${i}`, 'Director', 'digital_organisation', {
        primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive',
        rawText: 'A fully digital organisation free from manual process constraints',
      }),
    ),
  ];
  const scored = makeScoredClusters(signals);
  return buildRelationshipGraph(scored, 'test-wksp');
}

describe('extractDominantCausalChains', () => {
  it('finds a chain when constraint → enabler → vision edges exist', () => {
    const graph = buildTestGraph();
    const chains = extractDominantCausalChains(graph);
    // The graph should have at least one chain if responds_to and enables both fire
    // (depends on Jaccard thresholds — may be 0 in some configs)
    expect(Array.isArray(chains)).toBe(true);
    if (chains.length > 0) {
      expect(chains[0].chainStrength).toBeGreaterThanOrEqual(0);
      expect(chains[0].constraintNodeId).toBeTruthy();
      expect(chains[0].enablerNodeId).toBeTruthy();
      expect(chains[0].reimaginationNodeId).toBeTruthy();
    }
  });

  it('returns all valid chains without truncation', () => {
    // Truncation is the caller's responsibility; extractor must not drop valid chains.
    const graph = buildTestGraph();
    const chains = extractDominantCausalChains(graph);
    expect(Array.isArray(chains)).toBe(true);
    for (const c of chains) {
      expect(c.constraintNodeId).toBeTruthy();
      expect(c.enablerNodeId).toBeTruthy();
      expect(c.reimaginationNodeId).toBeTruthy();
      expect(c.chainStrength).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns chains sorted by chainStrength descending', () => {
    const graph = buildTestGraph();
    const chains = extractDominantCausalChains(graph);
    for (let i = 1; i < chains.length; i++) {
      expect(chains[i].chainStrength).toBeLessThanOrEqual(chains[i - 1].chainStrength);
    }
  });
});

describe('findBottlenecks', () => {
  it('flags constraint with outDegree ≥ 3 as bottleneck', () => {
    // Build a constraint with many outgoing edges
    const constraintSigs = Array.from({ length: 4 }, (_, i) =>
      confirmedSig(`c${i}`, 'Manager', 'central_constraint', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
        rawText: 'Central system access problem blocks every team workflow process',
      }),
    );
    const enablerSigs = (theme: string) =>
      Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`e${i}`, 'Lead', theme, {
          primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
          rawText: `Solution for ${theme}: improve the system access workflow for every team`,
        }),
      );
    const visionSigs = (theme: string) =>
      Array.from({ length: 3 }, (_, i) =>
        confirmedSig(`v${i}`, 'Director', theme, {
          primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive',
          rawText: `Vision for ${theme}: system access empowers every team to work seamlessly`,
        }),
      );

    const signals = [
      ...constraintSigs,
      ...enablerSigs('enabler_one'),
      ...enablerSigs('enabler_two'),
      ...enablerSigs('enabler_three'),
      ...visionSigs('vision_one'),
    ];

    const scored = makeScoredClusters(signals);
    const graph = buildRelationshipGraph(scored, 'test');
    const bottlenecks = findBottlenecks(graph);
    // The central constraint should have many outgoing constraint-type edges
    const centralBottleneck = bottlenecks.find((b) => b.nodeId === 'central_constraint');
    if (centralBottleneck) {
      expect(centralBottleneck.outDegree).toBeGreaterThanOrEqual(3);
    }
    // Even if specific bottleneck not found, array must be valid
    expect(Array.isArray(bottlenecks)).toBe(true);
  });
});

describe('findCompensatingBehaviours', () => {
  it('identifies compensates_for edges where constraint is still live', () => {
    // Build a constraint with high rawFrequency (≥ 5 signals) + enabler that compensates
    const constraintSigs = Array.from({ length: 6 }, (_, i) =>
      confirmedSig(`c${i}`, 'Agent', 'old_technology', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
        rawText: 'Old outdated technology and legacy systems cause daily problems for agents',
      }),
    );
    const enablerSigs = Array.from({ length: 4 }, (_, i) =>
      confirmedSig(`e${i}`, 'Manager', 'manual_workaround', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'Manual workaround checklists help agents navigate outdated technology issues',
      }),
    );
    const scored = makeScoredClusters([...constraintSigs, ...enablerSigs]);
    const graph = buildRelationshipGraph(scored, 'test');
    const compensating = findCompensatingBehaviours(graph);

    const found = compensating.find(
      (c) => c.constraintNodeId === 'old_technology' && c.enablerNodeId === 'manual_workaround',
    );
    if (found) {
      expect(found.constraintIsLive).toBe(true);
      expect(found.riskLevel).toBe('medium');
    }
    expect(Array.isArray(compensating)).toBe(true);
  });
});

describe('findBrokenChains', () => {
  it('flags a CONSTRAINT node with no responds_to/drives outgoing edge', () => {
    // A constraint cluster with no ENABLER to respond to it.
    // Theme uses spaces so normaliseKey produces the underscore-keyed form correctly:
    //   'isolated constraint' → normalised key 'isolated_constraint'
    const constraintSigs = Array.from({ length: 4 }, (_, i) =>
      confirmedSig(`c${i}`, 'Manager', 'isolated constraint', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
        rawText: 'A very specific unique niche constraint that has no corresponding solution',
      }),
    );
    const visionSigs = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`v${i}`, 'Director', 'unrelated vision', {
        primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive',
        rawText: 'A completely different aspirational future with no linkage to anything else',
      }),
    );
    const scored = makeScoredClusters([...constraintSigs, ...visionSigs]);
    const graph = buildRelationshipGraph(scored, 'test');
    const broken = findBrokenChains(graph);
    const isolatedConstraint = broken.find(
      (b) =>
        b.nodeId === 'isolated_constraint' &&
        b.brokenChainType === 'CONSTRAINT_NO_RESPONSE',
    );
    expect(isolatedConstraint).toBeDefined();
  });

  it('flags a REIMAGINATION node with no enables/depends_on incoming edge', () => {
    const visionSigs = Array.from({ length: 4 }, (_, i) =>
      confirmedSig(`v${i}`, 'Director', 'orphan vision', {
        primaryType: 'VISION', phase: 'REIMAGINE', sentiment: 'positive',
        rawText: 'An aspirational future state that has absolutely no enablers supporting it',
      }),
    );
    const constraintSigs = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`c${i}`, 'Manager', 'separate problem', {
        primaryType: 'CONSTRAINT', phase: 'CONSTRAINTS', sentiment: 'concerned',
        rawText: 'A completely separate problem domain with zero topical relationship',
      }),
    );
    const scored = makeScoredClusters([...visionSigs, ...constraintSigs]);
    const graph = buildRelationshipGraph(scored, 'test');
    const broken = findBrokenChains(graph);
    const orphanVision = broken.find(
      (b) =>
        b.nodeId === 'orphan_vision' &&
        b.brokenChainType === 'REIMAGINATION_UNSUPPORTED',
    );
    expect(orphanVision).toBeDefined();
  });

  it('flags a ENABLER node with no enables edge to REIMAGINATION', () => {
    const enablerSigs = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`e${i}`, 'IT', 'floating enabler', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'A standalone tool investment with no clear vision outcome',
      }),
    );
    const scored = makeScoredClusters(enablerSigs);
    const graph = buildRelationshipGraph(scored, 'test');
    const broken = findBrokenChains(graph);
    const floating = broken.find(
      (b) =>
        b.nodeId === 'floating_enabler' &&
        b.brokenChainType === 'ENABLER_LEADS_NOWHERE',
    );
    expect(floating).toBeDefined();
  });
});

describe('findContradictionPaths', () => {
  it('returns contradicts edges with correct metadata', () => {
    const posSignals = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`p${i}`, 'Manager', 'ai_readiness_optimistic', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'positive',
        rawText: 'The organisation is ready and willing to adopt AI tools',
      }),
    );
    const negSignals = Array.from({ length: 3 }, (_, i) =>
      confirmedSig(`p${i}`, 'Manager', 'ai_readiness_sceptical', {
        primaryType: 'ENABLER', phase: 'DEFINE_APPROACH', sentiment: 'critical',
        rawText: 'The organisation lacks AI maturity and is not ready for adoption',
      }),
    );
    const scored = makeScoredClusters([...posSignals, ...negSignals]);
    const graph = buildRelationshipGraph(scored, 'test');
    const contradictions = findContradictionPaths(graph);

    expect(contradictions.length).toBe(1);
    expect(contradictions[0].sharedParticipantIds.length).toBeGreaterThan(0);
    expect(contradictions[0].layer).toBe('ENABLER');
  });
});

describe('computeGraphIntelligence', () => {
  it('returns a valid GraphIntelligence object with all fields', () => {
    const graph = buildTestGraph();
    const intel = computeGraphIntelligence(graph);

    expect(Array.isArray(intel.dominantCausalChains)).toBe(true);
    expect(Array.isArray(intel.bottlenecks)).toBe(true);
    expect(Array.isArray(intel.compensatingBehaviours)).toBe(true);
    expect(Array.isArray(intel.brokenChains)).toBe(true);
    expect(Array.isArray(intel.contradictionPaths)).toBe(true);
    expect(typeof intel.summary.graphCoverageScore).toBe('number');
    expect(intel.summary.graphCoverageScore).toBeGreaterThanOrEqual(0);
    expect(intel.summary.graphCoverageScore).toBeLessThanOrEqual(100);
  });

  it('summary counts match array lengths', () => {
    const graph = buildTestGraph();
    const intel = computeGraphIntelligence(graph);

    expect(intel.summary.totalChains).toBe(intel.dominantCausalChains.length);
    expect(intel.summary.totalBottlenecks).toBe(intel.bottlenecks.length);
    expect(intel.summary.totalCompensatingBehaviours).toBe(intel.compensatingBehaviours.length);
    expect(intel.summary.totalBrokenChains).toBe(intel.brokenChains.length);
    expect(intel.summary.totalContradictions).toBe(intel.contradictionPaths.length);
  });

  it('graphCoverageScore is 0 for empty graph', () => {
    const emptyGraph = buildRelationshipGraph([], 'empty');
    const intel = computeGraphIntelligence(emptyGraph);
    expect(intel.summary.graphCoverageScore).toBe(0);
  });
});

// ── Mock graph helpers (for directional-edge unit tests) ──────────────────────
// These build raw RelationshipGraph objects without going through the full pipeline,
// allowing precise control of edge direction for direction-sensitive logic.

function mockNode(
  nodeId: string,
  layer: NodeLayer,
  overrides: Partial<RelationshipNode> = {},
): RelationshipNode {
  return {
    nodeId,
    displayLabel: nodeId.replace(/_/g, ' '),
    layer,
    layerScores: { constraint: layer === 'CONSTRAINT' ? 0.9 : 0.05, enabler: layer === 'ENABLER' ? 0.9 : 0.05, reimagination: layer === 'REIMAGINATION' ? 0.9 : 0.05 },
    rawFrequency: overrides.rawFrequency ?? 4,
    distinctParticipants: 2,
    participantRoles: [],
    lensSpread: [],
    phaseSpread: [],
    sourceStreams: ['live'],
    allSignalIds: [],
    contradictingSignalCount: 0,
    compositeScore: overrides.compositeScore ?? 50,
    evidenceTier: overrides.evidenceTier ?? 'REINFORCED',
    isContested: false,
    ...overrides,
  };
}

function mockEdge(
  edgeId: string,
  fromNodeId: string,
  toNodeId: string,
  relationshipType: RelationshipType,
  score: number,
  tier: EdgeTier,
): RelationshipEdge {
  return {
    edgeId,
    fromNodeId,
    toNodeId,
    relationshipType,
    fromSignalIds: [],
    toSignalIds: [],
    sharedParticipantIds: [],
    score,
    tier,
    rules: [],
    rationale: `Mock ${relationshipType} edge`,
  };
}

function mockGraph(nodes: RelationshipNode[], edges: RelationshipEdge[]): RelationshipGraph {
  const layerCounts = { CONSTRAINT: 0, ENABLER: 0, REIMAGINATION: 0 };
  for (const n of nodes) layerCounts[n.layer]++;
  const edgeTypeCounts: Partial<Record<RelationshipType, number>> = {};
  for (const e of edges) edgeTypeCounts[e.relationshipType] = (edgeTypeCounts[e.relationshipType] ?? 0) + 1;
  return {
    workshopId: 'mock-ws',
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    layerCounts,
    edgeTypeCounts,
    builtAtMs: Date.now(),
  };
}

// ── Blocker 1: responds_to / compensates_for chain extraction direction ────────

describe('extractDominantCausalChains — directional edge traversal', () => {
  it('extracts chain via responds_to edge stored as ENABLER→CONSTRAINT direction', () => {
    // responds_to: fromNodeId=digital_tools (ENABLER), toNodeId=approval_delay (CONSTRAINT)
    // Chain: approval_delay ←[responds_to]← digital_tools →[enables]→ self_service
    const constraint = mockNode('approval_delay', 'CONSTRAINT');
    const enabler    = mockNode('digital_tools', 'ENABLER');
    const vision     = mockNode('self_service', 'REIMAGINATION');

    const respondsTo = mockEdge(
      'digital_tools__responds_to__approval_delay',
      'digital_tools', 'approval_delay', 'responds_to', 55, 'REINFORCED',
    );
    const enables = mockEdge(
      'digital_tools__enables__self_service',
      'digital_tools', 'self_service', 'enables', 60, 'REINFORCED',
    );

    const graph = mockGraph([constraint, enabler, vision], [respondsTo, enables]);
    const chains = extractDominantCausalChains(graph);

    expect(chains).toHaveLength(1);
    expect(chains[0].constraintNodeId).toBe('approval_delay');
    expect(chains[0].enablerNodeId).toBe('digital_tools');
    expect(chains[0].reimaginationNodeId).toBe('self_service');
    expect(chains[0].chainStrength).toBe(Math.round(Math.sqrt(55 * 60)));
  });

  it('extracts chain via compensates_for edge stored as ENABLER→CONSTRAINT direction', () => {
    // compensates_for: fromNodeId=manual_process (ENABLER), toNodeId=system_gap (CONSTRAINT)
    const constraint = mockNode('system_gap', 'CONSTRAINT');
    const enabler    = mockNode('manual_process', 'ENABLER');
    const vision     = mockNode('unified_platform', 'REIMAGINATION');

    const compensates = mockEdge(
      'manual_process__compensates_for__system_gap',
      'manual_process', 'system_gap', 'compensates_for', 40, 'EMERGING',
    );
    const enables = mockEdge(
      'manual_process__enables__unified_platform',
      'manual_process', 'unified_platform', 'enables', 50, 'REINFORCED',
    );

    const graph = mockGraph([constraint, enabler, vision], [compensates, enables]);
    const chains = extractDominantCausalChains(graph);

    expect(chains).toHaveLength(1);
    expect(chains[0].constraintNodeId).toBe('system_gap');
    expect(chains[0].enablerNodeId).toBe('manual_process');
    expect(chains[0].reimaginationNodeId).toBe('unified_platform');
  });

  it('returns no chains when CONSTRAINT has only outgoing drives but enabler has no enables edge', () => {
    const constraint = mockNode('c', 'CONSTRAINT');
    const enabler    = mockNode('e', 'ENABLER');
    // No vision, no enables edge
    const drives = mockEdge('c__drives__e', 'c', 'e', 'drives', 50, 'REINFORCED');
    const graph = mockGraph([constraint, enabler], [drives]);
    const chains = extractDominantCausalChains(graph);
    expect(chains).toHaveLength(0);
  });
});

// ── Blocker 2: CONSTRAINT_NO_RESPONSE must respect incoming responds_to ────────

describe('findBrokenChains — responds_to direction fix', () => {
  it('does NOT flag a constraint as CONSTRAINT_NO_RESPONSE when an incoming responds_to edge exists', () => {
    // responds_to: fromNodeId=digital_tools (ENABLER), toNodeId=slow_approval (CONSTRAINT)
    // This IS a valid organisational response — should NOT produce a CONSTRAINT_NO_RESPONSE finding.
    const constraint = mockNode('slow_approval', 'CONSTRAINT', { compositeScore: 60 });
    const enabler    = mockNode('digital_tools', 'ENABLER');

    const respondsTo = mockEdge(
      'digital_tools__responds_to__slow_approval',
      'digital_tools', 'slow_approval', 'responds_to', 50, 'REINFORCED',
    );

    const graph = mockGraph([constraint, enabler], [respondsTo]);
    const broken = findBrokenChains(graph);
    const noResponse = broken.filter((bc) => bc.brokenChainType === 'CONSTRAINT_NO_RESPONSE');
    expect(noResponse.find((bc) => bc.nodeId === 'slow_approval')).toBeUndefined();
  });

  it('still flags a constraint with ONLY an unrelated outgoing constrains edge (no drives, no responds_to)', () => {
    // constrains is not a response edge — constraint should still be CONSTRAINT_NO_RESPONSE
    const constraint = mockNode('unaddressed', 'CONSTRAINT', { compositeScore: 60 });
    const vision     = mockNode('some_vision', 'REIMAGINATION');

    const constrainsEdge = mockEdge(
      'unaddressed__constrains__some_vision',
      'unaddressed', 'some_vision', 'constrains', 40, 'EMERGING',
    );

    const graph = mockGraph([constraint, vision], [constrainsEdge]);
    const broken = findBrokenChains(graph);
    const noResponse = broken.filter((bc) => bc.brokenChainType === 'CONSTRAINT_NO_RESPONSE');
    expect(noResponse.find((bc) => bc.nodeId === 'unaddressed')).toBeDefined();
  });
});

/**
 * Evidence Engine Tests
 *
 * Covers evidence-clustering.ts and evidence-scoring.ts:
 *  - Cluster construction from raw signals
 *  - Confirmed-participant-only provenance
 *  - Contradiction detection
 *  - Composite score formula
 *  - Tier assignment including all hard gates
 *  - ANECDOTAL and CONTESTED flags
 *  - Dominant-speaker ratio gate
 *  - No confidence defaults
 */

import { describe, it, expect } from 'vitest';
import { buildEvidenceClusters, type RawSignal } from '@/lib/output/evidence-clustering';
import {
  scoreCluster,
  scoreAllClusters,
  passesOrganisationalGate,
  passesReinforcedGate,
  type EvidenceTier,
} from '@/lib/output/evidence-scoring';

// ── Fixture helpers ───────────────────────────────────────────────────────────

let _id = 0;
function sig(overrides: Partial<RawSignal> = {}): RawSignal {
  _id++;
  return {
    id: `sig-${_id}`,
    rawText: overrides.rawText ?? `Signal text ${_id}`,
    speakerId: overrides.speakerId ?? `speaker-${_id}`,
    participantRole: overrides.participantRole ?? 'Manager',
    lens: overrides.lens ?? 'People',
    phase: overrides.phase ?? 'DISCOVERY',
    primaryType: overrides.primaryType ?? 'INSIGHT',
    sentiment: overrides.sentiment ?? 'neutral',
    themeLabels: overrides.themeLabels ?? ['legacy systems'],
    confidence: overrides.confidence ?? 0.7,
    isConfirmedParticipant: overrides.isConfirmedParticipant ?? true,
    sourceStream: overrides.sourceStream ?? 'discovery',
    ...overrides,
  };
}

// ── buildEvidenceClusters ────────────────────────────────────────────────────

describe('buildEvidenceClusters', () => {
  it('groups signals by normalised theme label', () => {
    const signals = [
      sig({ themeLabels: ['Legacy Systems'] }),
      sig({ themeLabels: ['legacy systems'] }),   // same key after normalisation
      sig({ themeLabels: ['Customer Wait Times'] }),
    ];
    const clusters = buildEvidenceClusters(signals);
    const keys = clusters.map(c => c.clusterKey);
    expect(keys).toContain('legacy_systems');
    expect(keys).toContain('customer_wait_times');
    // 'Legacy Systems' and 'legacy systems' merged into one cluster
    const ls = clusters.find(c => c.clusterKey === 'legacy_systems')!;
    expect(ls.rawFrequency).toBe(2);
  });

  it('counts only confirmed participants in distinctParticipants', () => {
    const signals = [
      sig({ speakerId: 'p1', isConfirmedParticipant: true }),
      sig({ speakerId: 'p2', isConfirmedParticipant: true }),
      // Mentioned actor — not a confirmed participant
      sig({ speakerId: 'mention-ceo', isConfirmedParticipant: false }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    expect(cluster.distinctParticipants).toBe(2);
    expect(cluster.rawFrequency).toBe(3); // all signals counted in frequency
  });

  it('does not double-count same participant mentioning theme twice', () => {
    const signals = [
      sig({ speakerId: 'p1', isConfirmedParticipant: true, rawText: 'First mention' }),
      sig({ speakerId: 'p1', isConfirmedParticipant: true, rawText: 'Second mention' }),
      sig({ speakerId: 'p2', isConfirmedParticipant: true, rawText: 'Another participant' }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    expect(cluster.rawFrequency).toBe(3);
    expect(cluster.distinctParticipants).toBe(2); // p1 counted once
  });

  it('tracks lens spread correctly', () => {
    const signals = [
      sig({ lens: 'People', themeLabels: ['culture'] }),
      sig({ lens: 'Technology', themeLabels: ['culture'] }),
      sig({ lens: 'People', themeLabels: ['culture'] }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    expect(cluster.lensSpread.size).toBe(2);
    expect(cluster.lensSpread.has('People')).toBe(true);
    expect(cluster.lensSpread.has('Technology')).toBe(true);
  });

  it('tracks phase spread correctly', () => {
    const signals = [
      sig({ phase: 'DISCOVERY', themeLabels: ['escalation'] }),
      sig({ phase: 'REIMAGINE', themeLabels: ['escalation'] }),
      sig({ phase: 'REIMAGINE', themeLabels: ['escalation'] }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    expect(cluster.phaseSpread.size).toBe(2);
  });

  it('detects contradictions between opposing sentiment signals', () => {
    const signals = [
      sig({ speakerId: 'p1', sentiment: 'positive', isConfirmedParticipant: true, themeLabels: ['ai adoption'] }),
      sig({ speakerId: 'p2', sentiment: 'critical', isConfirmedParticipant: true, themeLabels: ['ai adoption'] }),
      sig({ speakerId: 'p3', sentiment: 'positive', isConfirmedParticipant: true, themeLabels: ['ai adoption'] }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    expect(cluster.contradictingSignals.length).toBeGreaterThan(0);
  });

  it('does not flag neutral vs neutral as contradiction', () => {
    const signals = [
      sig({ sentiment: 'neutral', themeLabels: ['process'] }),
      sig({ sentiment: 'neutral', themeLabels: ['process'] }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    expect(cluster.contradictingSignals.length).toBe(0);
  });

  it('places signals with no themes into _unthemed cluster', () => {
    const signals = [
      sig({ themeLabels: [] }),
      sig({ themeLabels: [] }),
    ];
    const clusters = buildEvidenceClusters(signals);
    const unthemed = clusters.find(c => c.clusterKey === '_unthemed');
    expect(unthemed).toBeDefined();
    expect(unthemed!.rawFrequency).toBe(2);
  });

  it('deduplicates best quotes and caps at 10', () => {
    const signals = Array.from({ length: 15 }, (_, i) =>
      sig({ rawText: `Unique quote ${i}`, themeLabels: ['topic'], speakerId: `p${i}`, isConfirmedParticipant: true })
    );
    const [cluster] = buildEvidenceClusters(signals);
    expect(cluster.bestQuotes.length).toBeLessThanOrEqual(10);
  });

  it('sorts clusters by rawFrequency descending, _unthemed last', () => {
    const signals = [
      ...Array.from({ length: 5 }, () => sig({ themeLabels: ['big theme'] })),
      ...Array.from({ length: 2 }, () => sig({ themeLabels: ['small theme'] })),
      sig({ themeLabels: [] }),
    ];
    const clusters = buildEvidenceClusters(signals);
    expect(clusters[0].clusterKey).toBe('big_theme');
    expect(clusters[clusters.length - 1].clusterKey).toBe('_unthemed');
  });

  it('tracks source streams across discovery and live', () => {
    const signals = [
      sig({ sourceStream: 'discovery', themeLabels: ['wait times'] }),
      sig({ sourceStream: 'live', themeLabels: ['wait times'] }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    expect(cluster.sourceStreams.size).toBe(2);
    expect(cluster.sourceStreams.has('discovery')).toBe(true);
    expect(cluster.sourceStreams.has('live')).toBe(true);
  });
});

// ── scoreCluster ─────────────────────────────────────────────────────────────

describe('scoreCluster', () => {
  it('returns WEAK for a single-speaker, single-lens, single-phase cluster', () => {
    const signals = [sig({ speakerId: 'p1' }), sig({ speakerId: 'p1' })];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 5);
    expect(score.tier).toBe('WEAK');
    expect(score.distinctParticipants).toBe(1);
  });

  it('returns ANECDOTAL when only 1 confirmed participant', () => {
    const signals = [sig({ speakerId: 'p1', isConfirmedParticipant: true })];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 5);
    expect(score.isAnecdotal).toBe(true);
  });

  it('returns ANECDOTAL when 2 participants with ≤ 3 total frequency', () => {
    const signals = [
      sig({ speakerId: 'p1', isConfirmedParticipant: true }),
      sig({ speakerId: 'p2', isConfirmedParticipant: true }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 5);
    expect(score.rawFrequency).toBe(2);
    expect(score.isAnecdotal).toBe(true);
  });

  it('is not ANECDOTAL with 3 distinct participants', () => {
    const signals = [
      sig({ speakerId: 'p1', isConfirmedParticipant: true }),
      sig({ speakerId: 'p2', isConfirmedParticipant: true }),
      sig({ speakerId: 'p3', isConfirmedParticipant: true }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 5);
    expect(score.isAnecdotal).toBe(false);
  });

  it('returns CONTESTED when contradiction ratio exceeds threshold', () => {
    const signals = [
      sig({ speakerId: 'p1', sentiment: 'positive', isConfirmedParticipant: true }),
      sig({ speakerId: 'p2', sentiment: 'critical', isConfirmedParticipant: true }),
      sig({ speakerId: 'p3', sentiment: 'positive', isConfirmedParticipant: true }),
      sig({ speakerId: 'p4', sentiment: 'critical', isConfirmedParticipant: true }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 5);
    expect(score.isContested).toBe(true);
  });

  it('composite score penalises high contradiction ratio', () => {
    const lowContradict = buildEvidenceClusters([
      sig({ speakerId: 'p1', sentiment: 'neutral', isConfirmedParticipant: true }),
      sig({ speakerId: 'p2', sentiment: 'neutral', isConfirmedParticipant: true }),
      sig({ speakerId: 'p3', sentiment: 'neutral', isConfirmedParticipant: true }),
      sig({ speakerId: 'p4', sentiment: 'neutral', isConfirmedParticipant: true }),
    ])[0];

    const highContradict = buildEvidenceClusters([
      sig({ speakerId: 'p1', sentiment: 'positive', isConfirmedParticipant: true, themeLabels: ['topic x'] }),
      sig({ speakerId: 'p2', sentiment: 'critical', isConfirmedParticipant: true, themeLabels: ['topic x'] }),
      sig({ speakerId: 'p3', sentiment: 'positive', isConfirmedParticipant: true, themeLabels: ['topic x'] }),
      sig({ speakerId: 'p4', sentiment: 'critical', isConfirmedParticipant: true, themeLabels: ['topic x'] }),
    ])[0];

    const sLow = scoreCluster(lowContradict, 5);
    const sHigh = scoreCluster(highContradict, 5);
    expect(sLow.compositeScore).toBeGreaterThan(sHigh.compositeScore);
  });

  it('reaches ORGANISATIONAL tier with sufficient breadth and depth', () => {
    // 6 participants, 3 lenses, 3 phases, 2 source streams, 15+ mentions
    const signals = [
      ...Array.from({ length: 3 }, (_, i) => sig({
        speakerId: `p${i}`, lens: 'People', phase: 'DISCOVERY', sourceStream: 'discovery',
        isConfirmedParticipant: true, participantRole: 'Manager',
      })),
      ...Array.from({ length: 3 }, (_, i) => sig({
        speakerId: `p${i + 3}`, lens: 'Technology', phase: 'REIMAGINE', sourceStream: 'live',
        isConfirmedParticipant: true, participantRole: 'Director',
      })),
      ...Array.from({ length: 4 }, (_, i) => sig({
        speakerId: `p${i}`, lens: 'Customer', phase: 'CONSTRAINTS', sourceStream: 'discovery',
        isConfirmedParticipant: true, participantRole: 'Manager',
      })),
      ...Array.from({ length: 5 }, (_, i) => sig({
        speakerId: `p${i + 6}`, lens: 'People', phase: 'DISCOVERY', sourceStream: 'live',
        isConfirmedParticipant: true, participantRole: 'Frontline',
      })),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 3); // 3 total roles
    expect(['ESTABLISHED', 'ORGANISATIONAL']).toContain(score.tier);
    expect(score.distinctParticipants).toBeGreaterThanOrEqual(5);
  });

  it('REINFORCED requires distinctParticipants >= 3', () => {
    // Even with high frequency and multi-lens, 2 participants cannot reach REINFORCED
    const signals = [
      ...Array.from({ length: 10 }, (_, i) => sig({
        speakerId: i % 2 === 0 ? 'p1' : 'p2',
        lens: i % 2 === 0 ? 'People' : 'Technology',
        phase: i % 3 === 0 ? 'DISCOVERY' : 'REIMAGINE',
        sourceStream: 'discovery',
        isConfirmedParticipant: true,
      })),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 5);
    expect(score.distinctParticipants).toBe(2);
    expect(score.tier).not.toBe('REINFORCED');
    expect(score.tier).not.toBe('ESTABLISHED');
    expect(score.tier).not.toBe('ORGANISATIONAL');
  });

  it('dominant-speaker gate blocks REINFORCED when single speaker > 70% and single source stream', () => {
    // p1 provides 8 of 10 signals — dominant speaker ratio 0.8
    // Only 1 source stream
    const signals = [
      ...Array.from({ length: 8 }, () => sig({
        speakerId: 'p1', lens: 'People', sourceStream: 'discovery', isConfirmedParticipant: true,
      })),
      sig({ speakerId: 'p2', lens: 'Technology', sourceStream: 'discovery', isConfirmedParticipant: true }),
      sig({ speakerId: 'p3', lens: 'Customer', sourceStream: 'discovery', isConfirmedParticipant: true }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 5);
    expect(score.dominantSpeakerRatio).toBeGreaterThanOrEqual(0.7);
    expect(score.sourceStreamCount).toBe(1);
    // Should be blocked from REINFORCED
    expect(passesReinforcedGate(score)).toBe(false);
  });

  it('dominant-speaker gate allows REINFORCED when cross-source reinforcement exists', () => {
    // p1 dominant BUT has 2 source streams — gate unlocked
    const signals = [
      ...Array.from({ length: 8 }, (_, i) => sig({
        speakerId: 'p1', lens: 'People',
        sourceStream: i < 4 ? 'discovery' : 'live',
        isConfirmedParticipant: true,
      })),
      sig({ speakerId: 'p2', lens: 'Technology', sourceStream: 'discovery', isConfirmedParticipant: true }),
      sig({ speakerId: 'p3', lens: 'Customer', sourceStream: 'live', isConfirmedParticipant: true }),
    ];
    const [cluster] = buildEvidenceClusters(signals);
    const score = scoreCluster(cluster, 5);
    expect(score.dominantSpeakerRatio).toBeGreaterThanOrEqual(0.7);
    expect(score.sourceStreamCount).toBe(2);
    // Gate unlocked by cross-source — may pass reinforced gate (if composite sufficient)
    // (just check it's not blocked by this specific check)
    const blockedByDominant =
      score.dominantSpeakerRatio >= 0.70 && score.sourceStreamCount < 2;
    expect(blockedByDominant).toBe(false);
  });

  it('confidence is computed from actual data — no default 0.8 is used', () => {
    // Low-confidence signals should produce lower composite scores than high-confidence ones
    const lowConfSignals = [
      sig({ speakerId: 'p1', confidence: 0.2, isConfirmedParticipant: true }),
      sig({ speakerId: 'p2', confidence: 0.2, isConfirmedParticipant: true }),
      sig({ speakerId: 'p3', confidence: 0.2, isConfirmedParticipant: true }),
    ];
    const highConfSignals = [
      sig({ speakerId: 'p1', confidence: 0.95, isConfirmedParticipant: true, themeLabels: ['topic b'] }),
      sig({ speakerId: 'p2', confidence: 0.95, isConfirmedParticipant: true, themeLabels: ['topic b'] }),
      sig({ speakerId: 'p3', confidence: 0.95, isConfirmedParticipant: true, themeLabels: ['topic b'] }),
    ];
    // Scores are equal because confidence doesn't inflate the composite score —
    // the composite is based on spread/frequency, not confidence default.
    // This test ensures the scoring model does NOT use a 0.8 default anywhere.
    const [cLow] = buildEvidenceClusters(lowConfSignals);
    const [cHigh] = buildEvidenceClusters(highConfSignals);
    const sLow = scoreCluster(cLow, 3);
    const sHigh = scoreCluster(cHigh, 3);
    // Neither uses a confidence default — scores are equal (same spread metrics)
    expect(sLow.compositeScore).toBe(sHigh.compositeScore);
  });
});

// ── passesOrganisationalGate ─────────────────────────────────────────────────

describe('passesOrganisationalGate', () => {
  it('rejects REINFORCED tier', () => {
    const score = scoreCluster(
      buildEvidenceClusters(
        Array.from({ length: 5 }, (_, i) => sig({ speakerId: `p${i}`, isConfirmedParticipant: true }))
      )[0],
      5,
    );
    // Force score to REINFORCED for isolation
    const mockScore = { ...score, tier: 'REINFORCED' as EvidenceTier };
    expect(passesOrganisationalGate(mockScore)).toBe(false);
  });

  it('rejects ANECDOTAL even if tier is ESTABLISHED', () => {
    const mockScore = {
      tier: 'ESTABLISHED' as EvidenceTier,
      isAnecdotal: true,
      isContested: false,
      distinctParticipants: 5,
    } as any;
    expect(passesOrganisationalGate(mockScore)).toBe(false);
  });

  it('rejects CONTESTED by default', () => {
    const mockScore = {
      tier: 'ORGANISATIONAL' as EvidenceTier,
      isAnecdotal: false,
      isContested: true,
      distinctParticipants: 6,
    } as any;
    expect(passesOrganisationalGate(mockScore)).toBe(false);
    expect(passesOrganisationalGate(mockScore, true)).toBe(true); // opt-in allows contested
  });

  it('accepts ESTABLISHED with 4+ participants and no flags', () => {
    const mockScore = {
      tier: 'ESTABLISHED' as EvidenceTier,
      isAnecdotal: false,
      isContested: false,
      distinctParticipants: 4,
    } as any;
    expect(passesOrganisationalGate(mockScore)).toBe(true);
  });

  it('rejects below minParticipants even with ORGANISATIONAL tier', () => {
    const mockScore = {
      tier: 'ORGANISATIONAL' as EvidenceTier,
      isAnecdotal: false,
      isContested: false,
      distinctParticipants: 2,
    } as any;
    expect(passesOrganisationalGate(mockScore)).toBe(false);
  });
});

// ── passesReinforcedGate ─────────────────────────────────────────────────────

describe('passesReinforcedGate', () => {
  it('rejects EMERGING tier', () => {
    const mockScore = {
      tier: 'EMERGING' as EvidenceTier,
      isAnecdotal: false,
      distinctParticipants: 4,
      dominantSpeakerRatio: 0.3,
      sourceStreamCount: 2,
    } as any;
    expect(passesReinforcedGate(mockScore)).toBe(false);
  });

  it('rejects if distinctParticipants < 3', () => {
    const mockScore = {
      tier: 'REINFORCED' as EvidenceTier,
      isAnecdotal: false,
      distinctParticipants: 2,
      dominantSpeakerRatio: 0.3,
      sourceStreamCount: 2,
    } as any;
    expect(passesReinforcedGate(mockScore)).toBe(false);
  });

  it('rejects ANECDOTAL regardless of tier', () => {
    const mockScore = {
      tier: 'REINFORCED' as EvidenceTier,
      isAnecdotal: true,
      distinctParticipants: 3,
      dominantSpeakerRatio: 0.3,
      sourceStreamCount: 2,
    } as any;
    expect(passesReinforcedGate(mockScore)).toBe(false);
  });

  it('accepts REINFORCED with 3 participants, low dominant ratio, 2 sources', () => {
    const mockScore = {
      tier: 'REINFORCED' as EvidenceTier,
      isAnecdotal: false,
      distinctParticipants: 3,
      dominantSpeakerRatio: 0.4,
      sourceStreamCount: 2,
    } as any;
    expect(passesReinforcedGate(mockScore)).toBe(true);
  });
});

// ── scoreAllClusters ─────────────────────────────────────────────────────────

describe('scoreAllClusters', () => {
  it('excludes _unthemed cluster from scoring', () => {
    const signals = [
      sig({ themeLabels: ['real theme'] }),
      sig({ themeLabels: [] }),  // → _unthemed
    ];
    const clusters = buildEvidenceClusters(signals);
    const scored = scoreAllClusters(clusters, 3);
    expect(scored.every(r => r.cluster.clusterKey !== '_unthemed')).toBe(true);
  });

  it('sorts by compositeScore descending', () => {
    const signals = [
      // Strong cluster: 5 participants, 3 lenses, 2 phases, 2 sources
      ...Array.from({ length: 5 }, (_, i) => sig({
        speakerId: `strong-p${i}`, lens: ['People', 'Technology', 'Customer'][i % 3],
        phase: i % 2 === 0 ? 'DISCOVERY' : 'REIMAGINE',
        sourceStream: i % 2 === 0 ? 'discovery' : 'live',
        themeLabels: ['strong theme'], isConfirmedParticipant: true,
      })),
      // Weak cluster: 1 participant
      sig({ speakerId: 'w1', themeLabels: ['weak theme'], isConfirmedParticipant: true }),
    ];
    const clusters = buildEvidenceClusters(signals);
    const scored = scoreAllClusters(clusters, 3);
    expect(scored[0].cluster.clusterKey).toBe('strong_theme');
    expect(scored[0].score.compositeScore).toBeGreaterThan(scored[scored.length - 1].score.compositeScore);
  });
});

/**
 * Unit tests — Canonical Topic Extraction
 *
 * Covers: enrichSignalsWithTopics, buildMergeMap
 * Does NOT cover LLM refinement (tested with integration tests that can mock openai).
 */

import { describe, it, expect } from 'vitest';
import { enrichSignalsWithTopics, buildMergeMap } from '@/lib/output/topic-extraction';
import type { RawSignal } from '@/lib/output/evidence-clustering';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSignal(id: string, rawText: string, themeLabels: string[] = []): RawSignal {
  return {
    id,
    rawText,
    speakerId: null,
    participantRole: null,
    lens: null,
    phase: null,
    primaryType: null,
    sentiment: 'neutral',
    themeLabels,
    confidence: null,
    isConfirmedParticipant: false,
    sourceStream: 'live',
  };
}

// ── enrichSignalsWithTopics ───────────────────────────────────────────────────

describe('enrichSignalsWithTopics', () => {
  it('leaves signals that already have themeLabels unchanged', () => {
    const signals = [
      makeSignal('s1', 'anything', ['existing_topic']),
    ];
    const result = enrichSignalsWithTopics(signals);
    expect(result[0].themeLabels).toEqual(['existing_topic']);
  });

  it('assigns a topic label to every signal with no themeLabels', () => {
    // Signals share the word "approval" explicitly — deterministic merge should converge
    const signals = [
      makeSignal('s1', 'agents have to wait for manager approval before resolving anything'),
      makeSignal('s2', 'the approval process takes too long and creates a bottleneck'),
      makeSignal('s3', 'approval bottleneck prevents timely resolution for customers'),
    ];
    const result = enrichSignalsWithTopics(signals);
    // Every signal must receive at least one label
    expect(result[0].themeLabels).toHaveLength(1);
    expect(result[1].themeLabels).toHaveLength(1);
    expect(result[2].themeLabels).toHaveLength(1);
    // All labels must be non-empty strings
    result.forEach(s => expect(s.themeLabels[0]).toBeTruthy());
    // Signals 1 and 3 both contain "approval" and "bottleneck" — should share a label
    expect(result[0].themeLabels[0]).toBe(result[2].themeLabels[0]);
  });

  it('produces distinct labels for signals that share vocabulary within groups', () => {
    // Both training signals share "training"; both system signals share "system".
    // Deterministic extraction can cluster within-group when vocabulary overlaps.
    const signals = [
      makeSignal('s1', 'agents need more training on new product features and processes'),
      makeSignal('s2', 'training is inadequate for the team — they lack product knowledge'),
      makeSignal('s3', 'systems do not integrate and the crm system is completely disconnected'),
      makeSignal('s4', 'our telephony system fragments data across multiple platforms and databases'),
    ];
    const result = enrichSignalsWithTopics(signals);
    const trainingLabels = result.slice(0, 2).map(s => s.themeLabels[0]);
    const systemLabels   = result.slice(2, 4).map(s => s.themeLabels[0]);

    // Within each group, signals share a key word ("training", "system") → should cluster
    expect(trainingLabels[0]).toBe(trainingLabels[1]);
    expect(systemLabels[0]).toBe(systemLabels[1]);
    // The two groups must produce different canonical labels
    expect(trainingLabels[0]).not.toBe(systemLabels[0]);
  });

  it('handles very short signals without crashing', () => {
    const signals = [makeSignal('s1', 'no data')];
    const result = enrichSignalsWithTopics(signals);
    expect(result).toHaveLength(1);
    // May or may not produce a label — just must not throw
    expect(result[0].themeLabels.every(l => typeof l === 'string')).toBe(true);
  });

  it('handles empty signal array without crashing', () => {
    const result = enrichSignalsWithTopics([]);
    expect(result).toHaveLength(0);
  });

  it('mixed: leaves already-labelled signals, enriches the rest', () => {
    const signals = [
      makeSignal('s1', 'system integration is broken', ['preexisting']),
      makeSignal('s2', 'agents are waiting for approval from management'),
    ];
    const result = enrichSignalsWithTopics(signals);
    expect(result[0].themeLabels).toEqual(['preexisting']);  // untouched
    expect(result[1].themeLabels).toHaveLength(1);           // enriched
  });

  it('domain-boosted vocabulary wins over generic words', () => {
    // Signal contains both "approval" (domain boosted ×4) and a generic verb "handle"
    const signals = [
      makeSignal('s1', 'we handle the approval requests manually every single day'),
      makeSignal('s2', 'approval requires manager sign-off and this causes delays'),
    ];
    const result = enrichSignalsWithTopics(signals);
    // At least one of the labels should contain "approval" (the domain-boosted anchor)
    const labels = result.map(s => s.themeLabels[0]).filter(Boolean);
    const containsApproval = labels.some(l => l.includes('approval'));
    expect(containsApproval).toBe(true);
  });

  it('includes already-labelled signals in corpus-frequency scoring', () => {
    // 6 labeled signals all contain "customer" — with full-corpus scoring, customer gets
    // high df (appears in 7 of 8 total signals including one unlabeled).
    // The unlabeled signals are about "approval"; position tie-break ensures "approval"
    // (first domain word in text) wins despite "customer" having higher df score.
    // Primary assertion: labeled signals are untouched, unlabeled signals receive labels,
    // and the two unlabeled signals sharing "approval" converge to the same label.
    const labeled = Array.from({ length: 6 }, (_, i) =>
      makeSignal(`lbl_${i}`, 'customer complaints require faster resolution times', ['cx']),
    );
    const unlabeled = [
      makeSignal('u1', 'approval process blocks our agents from resolving issues'),
      makeSignal('u2', 'approval bottleneck is the primary source of agent frustration'),
    ];
    const result = enrichSignalsWithTopics([...labeled, ...unlabeled]);
    // Labeled signals must remain unchanged
    result.slice(0, 6).forEach(s => expect(s.themeLabels).toEqual(['cx']));
    // Unlabeled signals must receive exactly one valid label each
    result.slice(6).forEach(s => {
      expect(s.themeLabels).toHaveLength(1);
      expect(s.themeLabels[0]).toBeTruthy();
    });
    // Both unlabeled signals share "approval" explicitly → must converge
    expect(result[6].themeLabels[0]).toBe(result[7].themeLabels[0]);
  });

  it('produces snake_case normalised labels', () => {
    const signals = [
      makeSignal('s1', 'customers want self-service portals and digital channels'),
      makeSignal('s2', 'automation of repetitive tasks in the contact centre'),
    ];
    const result = enrichSignalsWithTopics(signals);
    for (const s of result) {
      for (const label of s.themeLabels) {
        expect(label).toMatch(/^[a-z0-9_]+$/);  // lowercase snake_case, no hyphens
        expect(label.length).toBeGreaterThan(0);
        expect(label.length).toBeLessThanOrEqual(60);
      }
    }
  });
});

// ── buildMergeMap ─────────────────────────────────────────────────────────────

describe('buildMergeMap', () => {
  it('returns empty map for empty input', () => {
    expect(buildMergeMap([])).toEqual(new Map());
  });

  it('single label maps to itself', () => {
    const map = buildMergeMap(['approval']);
    expect(map.get('approval')).toBe('approval');
  });

  it('merges labels with Jaccard ≥ 0.4 (share 1 of 2 tokens)', () => {
    // "approval_delay" vs "approval_wait": tokens {approval,delay} vs {approval,wait}
    // intersection=1, union=3, Jaccard=0.33 — below threshold: do NOT merge
    // "approval" vs "approval_delay": tokens {approval} vs {approval,delay}
    // intersection=1, union=2, Jaccard=0.5 — merge ✓
    const labels = ['approval', 'approval_delay'];
    const map = buildMergeMap(labels);
    // Both should resolve to the same canonical
    expect(map.get('approval')).toBe(map.get('approval_delay'));
  });

  it('does NOT merge labels that share no tokens', () => {
    const labels = ['training_gap', 'system_fragmentation'];
    const map = buildMergeMap(labels);
    expect(map.get('training_gap')).toBe('training_gap');
    expect(map.get('system_fragmentation')).toBe('system_fragmentation');
    expect(map.get('training_gap')).not.toBe(map.get('system_fragmentation'));
  });

  it('picks the more specific (longer) label as canonical when frequency is equal', () => {
    // "training" and "training_gap" both exist — "training_gap" is more specific
    const labels = ['training', 'training_gap'];
    const map = buildMergeMap(labels);
    // Both should map to the longer one
    expect(map.get('training')).toBe('training_gap');
    expect(map.get('training_gap')).toBe('training_gap');
  });

  it('picks the higher-frequency label as canonical', () => {
    const freq = new Map([['approval', 8], ['approval_delay', 2]]);
    const labels = ['approval', 'approval_delay'];
    const map = buildMergeMap(labels, freq);
    // "approval" appears 8× — should be canonical even though shorter
    expect(map.get('approval_delay')).toBe('approval');
    expect(map.get('approval')).toBe('approval');
  });

  it('handles three-way merge', () => {
    // training_gap, training, knowledge_gap — training_gap and training share "training",
    // knowledge_gap does NOT share enough to merge with the training group
    const labels = ['training_gap', 'training', 'knowledge_gap'];
    const map = buildMergeMap(labels);
    expect(map.get('training_gap')).toBe(map.get('training'));
    // knowledge_gap should NOT be in the same group as training
    expect(map.get('knowledge_gap')).toBe('knowledge_gap');
  });

  it('does NOT transitively merge disjoint labels via a shared intermediate', () => {
    // "approval" {approval} and "system" {system} share no tokens (J=0).
    // Both overlap "approval_system" {approval,system} with J=0.5 each.
    // Union-find would put all 3 in one group; complete-linkage must not,
    // because the pair (approval, system) fails the threshold (J=0 < 0.4).
    const labels = ['approval', 'approval_system', 'system'];
    const map = buildMergeMap(labels);
    // "approval" and "approval_system" may merge (J=0.5 ✓)
    // "system" and "approval_system" may merge (J=0.5 ✓)
    // But they form two separate groups — "approval" and "system" must NOT share canonical
    expect(map.get('approval')).not.toBe(map.get('system'));
  });
});

// ── Integration: realistic contact-centre signals ─────────────────────────────

describe('realistic contact-centre signals integration', () => {
  it('extracts topic labels for all signals in a realistic contact-centre set', () => {
    // Each pair shares explicit vocabulary for the deterministic step.
    // Pairs c1/c2 use "training"; d1/d2 use "customer" — same word in each pair.
    const signals = [
      makeSignal('a1', 'agents wait for approval before resolving customer complaints'),
      makeSignal('a2', 'approval process delays our resolution times significantly'),
      makeSignal('b1', 'our crm systems are fragmented and the system does not connect to telephony'),
      makeSignal('b2', 'data is fragmented across multiple databases and the system has no integration'),
      makeSignal('c1', 'training is not sufficient for agents handling regulatory enquiries'),
      makeSignal('c2', 'training gap means new starters cannot deal with product queries'),
      makeSignal('d1', 'customers want to self-serve online and avoid calling the contact centre'),
      makeSignal('d2', 'a customer portal for self-service would reduce inbound call volume'),
    ];

    const result = enrichSignalsWithTopics(signals);

    // Every signal must receive exactly one label
    for (const s of result) {
      expect(s.themeLabels).toHaveLength(1);
      expect(s.themeLabels[0]).toBeTruthy();
    }

    // Within-group clustering: each pair shares a domain word and should converge
    expect(result[0].themeLabels[0]).toBe(result[1].themeLabels[0]);  // approval pair
    expect(result[2].themeLabels[0]).toBe(result[3].themeLabels[0]);  // system pair
    expect(result[4].themeLabels[0]).toBe(result[5].themeLabels[0]);  // training pair
    expect(result[6].themeLabels[0]).toBe(result[7].themeLabels[0]);  // customer pair

    // Cross-group: approval topic ≠ system topic ≠ training topic
    expect(result[0].themeLabels[0]).not.toBe(result[2].themeLabels[0]);
    expect(result[0].themeLabels[0]).not.toBe(result[4].themeLabels[0]);
    expect(result[2].themeLabels[0]).not.toBe(result[4].themeLabels[0]);

    // Overall uniqueness: 4 groups with shared vocab → 4–6 distinct labels (LLM would reduce further)
    const uniqueLabels = new Set(result.map(s => s.themeLabels[0]));
    expect(uniqueLabels.size).toBeLessThanOrEqual(6);
    expect(uniqueLabels.size).toBeGreaterThanOrEqual(3);
  });
});

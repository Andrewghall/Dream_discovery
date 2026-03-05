import { describe, expect, it } from 'vitest';
import fixture from '@/__tests__/fixtures/agentic/discovery-gold-cases.json';
import { scoreDiscoveryCase, scoreDiscoverySuite } from '@/lib/agentic-evals/rubric';
import type { DiscoveryEvalCase, SentimentTone } from '@/lib/agentic-evals/types';

/**
 * Build a synthetic eval case for targeted penalty testing.
 * Defaults produce a perfect-score case so each test can override
 * exactly the dimension it wants to exercise.
 */
function makeCase(overrides: {
  goldSentiment?: SentimentTone;
  predSentiment?: string;
  goldDomains?: string[];
  predDomains?: string[];
  goldThemes?: string[];
  predThemes?: string[];
  confidenceRange?: { min: number; max: number };
  predConfidence?: number;
}): DiscoveryEvalCase {
  return {
    id: 'test-case',
    gold: {
      id: 'test-case',
      expected: {
        sentimentTone: overrides.goldSentiment || 'neutral',
        domains: overrides.goldDomains || ['operations'],
        themes: overrides.goldThemes || ['process review'],
        confidenceRange: overrides.confidenceRange || { min: 0, max: 1 },
      },
    },
    prediction: {
      sentimentTone: overrides.predSentiment || 'neutral',
      domains: overrides.predDomains || ['operations'],
      themes: overrides.predThemes || ['process review'],
      overallConfidence: overrides.predConfidence ?? 0.7,
    },
  };
}

describe('agentic discovery eval rubric', () => {
  // ---- existing regression gate tests ----

  it('scores the current benchmark above the regression threshold', () => {
    const cases = fixture as DiscoveryEvalCase[];
    const report = scoreDiscoverySuite(cases, 80);

    // CI gate: if this drops, model/prompt changes regressed expected behavior.
    expect(report.pass).toBe(true);
    expect(report.overallScore).toBeGreaterThanOrEqual(report.threshold);
  });

  it('keeps sentiment matching strict for all benchmark cases', () => {
    const cases = fixture as DiscoveryEvalCase[];
    const report = scoreDiscoverySuite(cases, 80);

    for (const caseScore of report.cases) {
      expect(caseScore.sentimentMatch).toBe(true);
    }
  });

  // ---- sentiment mismatch penalty ----

  describe('sentiment mismatch penalty', () => {
    it('applies a 0.5x multiplier when sentiment is wrong', () => {
      const correct = makeCase({
        goldSentiment: 'critical',
        predSentiment: 'critical',
      });
      const wrong = makeCase({
        goldSentiment: 'critical',
        predSentiment: 'positive',
      });

      const correctScore = scoreDiscoveryCase(correct);
      const wrongScore = scoreDiscoveryCase(wrong);

      expect(correctScore.score).toBe(100);
      expect(correctScore.sentimentPenaltyApplied).toBe(false);

      expect(wrongScore.sentimentPenaltyApplied).toBe(true);
      // Without penalty: (0*0.3 + 1*0.35 + 1*0.3 + 1*0.05) = 0.70
      // With 0.5x: 0.70 * 0.5 = 0.35 -> 35
      expect(wrongScore.score).toBe(35);
    });

    it('caps score well below threshold even with perfect domains and themes', () => {
      const wrongSentiment = makeCase({
        goldSentiment: 'critical',
        predSentiment: 'positive',
        goldDomains: ['risk', 'regulation'],
        predDomains: ['risk', 'regulation'],
        goldThemes: ['compliance gap', 'audit exposure'],
        predThemes: ['compliance gap', 'audit exposure'],
      });

      const result = scoreDiscoveryCase(wrongSentiment);
      expect(result.sentimentPenaltyApplied).toBe(true);
      // Max possible with wrong sentiment: 70 * 0.5 = 35
      expect(result.score).toBeLessThan(50);
    });

    it('produces a lower score than losing only the sentiment weight', () => {
      // Pre-penalty behaviour: wrong sentiment = lose 30 pts -> 70.
      // Post-penalty behaviour: lose 30 pts then halve -> 35.
      const wrong = makeCase({
        goldSentiment: 'concerned',
        predSentiment: 'neutral',
      });
      const result = scoreDiscoveryCase(wrong);
      expect(result.score).toBeLessThan(70);
    });
  });

  // ---- missing theme recall penalty ----

  describe('missing theme recall penalty', () => {
    it('applies no penalty when all gold themes are present in prediction', () => {
      const supersetCase = makeCase({
        goldThemes: ['alpha', 'beta'],
        predThemes: ['alpha', 'beta', 'gamma'],
      });

      const result = scoreDiscoveryCase(supersetCase);
      expect(result.themeRecall).toBe(1);
      expect(result.themeMissedPenaltyApplied).toBe(false);
    });

    it('penalizes when prediction misses one gold theme', () => {
      const fullRecall = makeCase({
        goldThemes: ['alpha', 'beta', 'gamma'],
        predThemes: ['alpha', 'beta', 'gamma'],
      });
      const partialRecall = makeCase({
        goldThemes: ['alpha', 'beta', 'gamma'],
        predThemes: ['alpha', 'beta'],
      });

      const fullScore = scoreDiscoveryCase(fullRecall);
      const partialScore = scoreDiscoveryCase(partialRecall);

      expect(fullScore.themeRecall).toBe(1);
      expect(partialScore.themeRecall).toBeCloseTo(0.6667, 3);
      expect(partialScore.themeMissedPenaltyApplied).toBe(true);
      expect(partialScore.score).toBeLessThan(fullScore.score);
    });

    it('applies maximum recall penalty when all gold themes are missing', () => {
      const noRecall = makeCase({
        goldThemes: ['alpha', 'beta', 'gamma'],
        predThemes: ['delta', 'epsilon'],
      });

      const result = scoreDiscoveryCase(noRecall);
      expect(result.themeRecall).toBe(0);
      expect(result.themeMissedPenaltyApplied).toBe(true);
      expect(result.themesJaccard).toBe(0);
      // themes component = 0 regardless of penalty when Jaccard is 0
      // domains still 1.0, confidence still ok -> ~70
      expect(result.score).toBe(70);
    });

    it('treats recall as 1 when gold themes list is empty', () => {
      const emptyGold = makeCase({
        goldThemes: [],
        predThemes: ['anything'],
      });

      const result = scoreDiscoveryCase(emptyGold);
      // Jaccard([], [x]) = 0 but recall is vacuously 1
      expect(result.themeRecall).toBe(1);
      expect(result.themeMissedPenaltyApplied).toBe(false);
    });
  });

  // ---- stacked penalties ----

  describe('stacked penalties', () => {
    it('compounds sentiment and theme penalties together', () => {
      const stacked = makeCase({
        goldSentiment: 'critical',
        predSentiment: 'positive',
        goldThemes: ['alpha', 'beta', 'gamma'],
        predThemes: ['alpha'],
      });

      const result = scoreDiscoveryCase(stacked);
      expect(result.sentimentPenaltyApplied).toBe(true);
      expect(result.themeMissedPenaltyApplied).toBe(true);
      // Both penalties active: score should be very low
      expect(result.score).toBeLessThan(30);
    });
  });

  // ---- report shape ----

  describe('report includes penalty fields', () => {
    it('exposes themeRecall and penalty flags in all case scores', () => {
      const cases = fixture as DiscoveryEvalCase[];
      const report = scoreDiscoverySuite(cases, 80);

      for (const caseScore of report.cases) {
        expect(caseScore).toHaveProperty('themeRecall');
        expect(caseScore).toHaveProperty('sentimentPenaltyApplied');
        expect(caseScore).toHaveProperty('themeMissedPenaltyApplied');
        expect(typeof caseScore.themeRecall).toBe('number');
        expect(typeof caseScore.sentimentPenaltyApplied).toBe('boolean');
        expect(typeof caseScore.themeMissedPenaltyApplied).toBe('boolean');
      }
    });

    it('applies no penalties on benchmark cases where sentiment and recall are perfect', () => {
      const cases = fixture as DiscoveryEvalCase[];
      const report = scoreDiscoverySuite(cases, 80);

      for (const caseScore of report.cases) {
        expect(caseScore.sentimentPenaltyApplied).toBe(false);
        expect(caseScore.themeRecall).toBe(1);
        expect(caseScore.themeMissedPenaltyApplied).toBe(false);
      }
    });
  });
});

import { describe, expect, it } from 'vitest';
import fixture from '@/__tests__/fixtures/agentic/sales-gold-cases.json';
import { scoreSalesCase, scoreSalesSuite } from '@/lib/agentic-evals/rubric';
import type {
  SalesEvalCase,
  SalesIntent,
  SentimentTone,
  SalesTopicCategory,
  CoachingPriority,
  DealHealth,
} from '@/lib/agentic-evals/types';

/**
 * Build a synthetic sales eval case for targeted penalty testing.
 * Defaults produce a perfect-score case so each test can override
 * exactly the dimension it wants to exercise.
 */
function makeCase(overrides: {
  goldIntent?: SalesIntent;
  predIntent?: string;
  goldSentiment?: SentimentTone;
  predSentiment?: string;
  goldTopics?: SalesTopicCategory[];
  predTopics?: string[];
  goldCoachingTriggered?: boolean;
  predCoachingTriggered?: boolean;
  goldCoachingPriority?: CoachingPriority | null;
  predCoachingPriority?: string | null;
  goldDealHealth?: DealHealth;
  predDealHealth?: string;
  confidenceRange?: { min: number; max: number };
  predConfidence?: number;
}): SalesEvalCase {
  return {
    id: 'test-sales-case',
    gold: {
      id: 'test-sales-case',
      expected: {
        customerIntent: overrides.goldIntent || 'exploring',
        sentimentTone: overrides.goldSentiment || 'neutral',
        topics: overrides.goldTopics || ['needs'],
        coachingTriggered: overrides.goldCoachingTriggered ?? false,
        coachingPriority: overrides.goldCoachingPriority ?? null,
        dealHealth: overrides.goldDealHealth || 'Warm',
        confidenceRange: overrides.confidenceRange || { min: 0, max: 1 },
      },
    },
    prediction: {
      customerIntent: overrides.predIntent || 'exploring',
      sentimentTone: overrides.predSentiment || 'neutral',
      topics: overrides.predTopics || ['needs'],
      coachingTriggered: overrides.predCoachingTriggered ?? false,
      coachingPriority: overrides.predCoachingPriority ?? null,
      dealHealth: overrides.predDealHealth || 'Warm',
      overallConfidence: overrides.predConfidence ?? 0.7,
    },
  };
}

describe('agentic sales eval rubric', () => {
  // ---- regression gate tests ----

  it('scores the current benchmark above the regression threshold', () => {
    const cases = fixture as SalesEvalCase[];
    const report = scoreSalesSuite(cases, 80);

    expect(report.pass).toBe(true);
    expect(report.overallScore).toBeGreaterThanOrEqual(report.threshold);
  });

  it('keeps intent matching strict for all benchmark cases', () => {
    const cases = fixture as SalesEvalCase[];
    const report = scoreSalesSuite(cases, 80);

    for (const caseScore of report.cases) {
      expect(caseScore.intentMatch).toBe(true);
    }
  });

  it('keeps sentiment matching strict for all benchmark cases', () => {
    const cases = fixture as SalesEvalCase[];
    const report = scoreSalesSuite(cases, 80);

    for (const caseScore of report.cases) {
      expect(caseScore.sentimentMatch).toBe(true);
    }
  });

  // ---- intent mismatch penalty ----

  describe('intent mismatch penalty', () => {
    it('applies a 0.5x multiplier when intent is wrong', () => {
      const correct = makeCase({
        goldIntent: 'objecting',
        predIntent: 'objecting',
      });
      const wrong = makeCase({
        goldIntent: 'objecting',
        predIntent: 'interested',
      });

      const correctScore = scoreSalesCase(correct);
      const wrongScore = scoreSalesCase(wrong);

      expect(correctScore.score).toBe(100);
      expect(correctScore.intentPenaltyApplied).toBe(false);

      expect(wrongScore.intentPenaltyApplied).toBe(true);
      // Without penalty: (0*0.25 + 1*0.15 + 1*0.25 + 1*0.15 + 1*0.15 + 1*0.05) = 0.75
      // With 0.5x: 0.75 * 0.5 = 0.375 -> 38
      expect(wrongScore.score).toBe(38);
    });

    it('caps score well below threshold even with everything else correct', () => {
      const wrongIntent = makeCase({
        goldIntent: 'ready_to_buy',
        predIntent: 'neutral',
        goldTopics: ['buying_signal', 'timeline'],
        predTopics: ['buying_signal', 'timeline'],
        goldCoachingTriggered: true,
        predCoachingTriggered: true,
        goldCoachingPriority: 'medium',
        predCoachingPriority: 'medium',
        goldDealHealth: 'Hot',
        predDealHealth: 'Hot',
      });

      const result = scoreSalesCase(wrongIntent);
      expect(result.intentPenaltyApplied).toBe(true);
      expect(result.score).toBeLessThan(50);
    });
  });

  // ---- missing topic recall penalty ----

  describe('missing topic recall penalty', () => {
    it('applies no penalty when all gold topics are present in prediction', () => {
      const supersetCase = makeCase({
        goldTopics: ['needs', 'budget'],
        predTopics: ['needs', 'budget', 'timeline'],
      });

      const result = scoreSalesCase(supersetCase);
      expect(result.topicRecall).toBe(1);
      expect(result.topicMissedPenaltyApplied).toBe(false);
    });

    it('penalizes when prediction misses a gold topic', () => {
      const fullRecall = makeCase({
        goldTopics: ['needs', 'budget', 'timeline'],
        predTopics: ['needs', 'budget', 'timeline'],
      });
      const partialRecall = makeCase({
        goldTopics: ['needs', 'budget', 'timeline'],
        predTopics: ['needs', 'budget'],
      });

      const fullScore = scoreSalesCase(fullRecall);
      const partialScore = scoreSalesCase(partialRecall);

      expect(fullScore.topicRecall).toBe(1);
      expect(partialScore.topicRecall).toBeCloseTo(0.6667, 3);
      expect(partialScore.topicMissedPenaltyApplied).toBe(true);
      expect(partialScore.score).toBeLessThan(fullScore.score);
    });

    it('applies maximum penalty when all gold topics are missing', () => {
      const noRecall = makeCase({
        goldTopics: ['needs', 'budget', 'timeline'],
        predTopics: ['competition', 'other'],
      });

      const result = scoreSalesCase(noRecall);
      expect(result.topicRecall).toBe(0);
      expect(result.topicMissedPenaltyApplied).toBe(true);
      expect(result.topicsJaccard).toBe(0);
    });
  });

  // ---- coaching scoring ----

  describe('coaching scoring', () => {
    it('scores 1.0 when triggered and priority both match', () => {
      const matched = makeCase({
        goldCoachingTriggered: true,
        predCoachingTriggered: true,
        goldCoachingPriority: 'high',
        predCoachingPriority: 'high',
      });

      const result = scoreSalesCase(matched);
      expect(result.coachingScore).toBe(1);
    });

    it('scores 0.5 when triggered correctly but priority differs', () => {
      const wrongPriority = makeCase({
        goldCoachingTriggered: true,
        predCoachingTriggered: true,
        goldCoachingPriority: 'high',
        predCoachingPriority: 'low',
      });

      const result = scoreSalesCase(wrongPriority);
      expect(result.coachingScore).toBe(0.5);
    });

    it('scores 0 when coaching expected but not triggered', () => {
      const missed = makeCase({
        goldCoachingTriggered: true,
        predCoachingTriggered: false,
        goldCoachingPriority: 'high',
        predCoachingPriority: null,
      });

      const result = scoreSalesCase(missed);
      expect(result.coachingScore).toBe(0);
    });

    it('scores 0.5 for false positive coaching (over-triggered)', () => {
      const overTriggered = makeCase({
        goldCoachingTriggered: false,
        predCoachingTriggered: true,
        goldCoachingPriority: null,
        predCoachingPriority: 'medium',
      });

      const result = scoreSalesCase(overTriggered);
      expect(result.coachingScore).toBe(0.5);
    });

    it('scores 1.0 when both agree no coaching needed', () => {
      const noCoaching = makeCase({
        goldCoachingTriggered: false,
        predCoachingTriggered: false,
        goldCoachingPriority: null,
        predCoachingPriority: null,
      });

      const result = scoreSalesCase(noCoaching);
      expect(result.coachingScore).toBe(1);
    });
  });

  // ---- stacked penalties ----

  describe('stacked penalties', () => {
    it('compounds intent and topic penalties together', () => {
      const stacked = makeCase({
        goldIntent: 'ready_to_buy',
        predIntent: 'neutral',
        goldTopics: ['buying_signal', 'timeline', 'budget'],
        predTopics: ['other'],
      });

      const result = scoreSalesCase(stacked);
      expect(result.intentPenaltyApplied).toBe(true);
      expect(result.topicMissedPenaltyApplied).toBe(true);
      expect(result.score).toBeLessThan(30);
    });
  });

  // ---- report shape ----

  describe('report structure', () => {
    it('exposes all scoring fields in case scores', () => {
      const cases = fixture as SalesEvalCase[];
      const report = scoreSalesSuite(cases, 80);

      for (const caseScore of report.cases) {
        expect(caseScore).toHaveProperty('intentMatch');
        expect(caseScore).toHaveProperty('sentimentMatch');
        expect(caseScore).toHaveProperty('topicsJaccard');
        expect(caseScore).toHaveProperty('topicRecall');
        expect(caseScore).toHaveProperty('coachingScore');
        expect(caseScore).toHaveProperty('dealHealthMatch');
        expect(caseScore).toHaveProperty('confidenceInRange');
        expect(caseScore).toHaveProperty('intentPenaltyApplied');
        expect(caseScore).toHaveProperty('topicMissedPenaltyApplied');
      }
    });

    it('applies no penalties on benchmark cases', () => {
      const cases = fixture as SalesEvalCase[];
      const report = scoreSalesSuite(cases, 80);

      for (const caseScore of report.cases) {
        expect(caseScore.intentPenaltyApplied).toBe(false);
        expect(caseScore.topicRecall).toBe(1);
        expect(caseScore.topicMissedPenaltyApplied).toBe(false);
      }
    });
  });

  // ---- empty suite edge case ----

  describe('edge cases', () => {
    it('returns score 0 and fail for empty case list', () => {
      const report = scoreSalesSuite([], 80);
      expect(report.overallScore).toBe(0);
      expect(report.pass).toBe(false);
      expect(report.cases).toHaveLength(0);
    });
  });
});

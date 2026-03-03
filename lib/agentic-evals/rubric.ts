import type {
  AgenticDiscoveryPrediction,
  DiscoveryEvalCase,
  DiscoveryEvalReport,
  DiscoveryCaseScore,
  SalesEvalCase,
  SalesEvalReport,
  SalesCaseScore,
} from '@/lib/agentic-evals/types';

const WEIGHTS = {
  sentiment: 0.3,
  domains: 0.35,
  themes: 0.3,
  confidence: 0.05,
} as const;

/**
 * Penalty multipliers applied on top of base scoring.
 *
 * sentimentMismatch: When predicted sentiment does not match gold,
 *   the final weighted score is multiplied by this factor.
 *   Effect: wrong sentiment caps score at ~35 even with perfect
 *   domains/themes/confidence.
 *
 * missedThemeFactor: Scales the themes component by
 *   (1 - missedThemeFactor * (1 - themeRecall)).
 *   Themes Jaccard already penalises mismatches symmetrically;
 *   this adds an extra recall-weighted penalty so that missing
 *   expected gold themes hurts more than having extra predictions.
 */
const PENALTIES = {
  sentimentMismatch: 0.5,
  missedThemeFactor: 0.5,
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeList(values: string[]): string[] {
  const items = values
    .map((v) => normalizeLabel(v))
    .filter(Boolean);
  return [...new Set(items)];
}

function jaccard(a: string[], b: string[]): number {
  const aSet = new Set(normalizeList(a));
  const bSet = new Set(normalizeList(b));
  if (aSet.size === 0 && bSet.size === 0) return 1;
  if (aSet.size === 0 || bSet.size === 0) return 0;

  let intersection = 0;
  for (const item of aSet) {
    if (bSet.has(item)) intersection++;
  }

  const union = aSet.size + bSet.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

/**
 * Theme recall: proportion of gold themes found in the prediction.
 * Returns 1 when gold is empty (nothing to miss).
 */
function themeRecall(predicted: string[], gold: string[]): number {
  const predSet = new Set(normalizeList(predicted));
  const goldNorm = normalizeList(gold);
  if (goldNorm.length === 0) return 1;
  let found = 0;
  for (const item of goldNorm) {
    if (predSet.has(item)) found++;
  }
  return found / goldNorm.length;
}

function confidenceInRange(confidence: number, min: number, max: number): boolean {
  if (!Number.isFinite(confidence)) return false;
  return confidence >= min && confidence <= max;
}

export function scoreDiscoveryCase(testCase: DiscoveryEvalCase): DiscoveryCaseScore {
  const expected = testCase.gold.expected;
  const prediction = testCase.prediction;

  const sentimentMatch =
    normalizeLabel(prediction.sentimentTone) === normalizeLabel(expected.sentimentTone);
  const domainsJaccardVal = jaccard(prediction.domains, expected.domains);
  const themesJaccardVal = jaccard(prediction.themes, expected.themes);
  const recallVal = themeRecall(prediction.themes, expected.themes);

  const confRange = expected.confidenceRange || { min: 0, max: 1 };
  const confidenceMatched = confidenceInRange(prediction.overallConfidence, confRange.min, confRange.max);

  // Recall penalty: reduce themes score when gold themes are missing
  const recallDeficit = 1 - recallVal;
  const themeMissedPenaltyApplied = recallDeficit > 0;
  const adjustedThemesScore = clamp01(
    themesJaccardVal * (1 - PENALTIES.missedThemeFactor * recallDeficit)
  );

  let weighted =
    (sentimentMatch ? 1 : 0) * WEIGHTS.sentiment +
    clamp01(domainsJaccardVal) * WEIGHTS.domains +
    adjustedThemesScore * WEIGHTS.themes +
    (confidenceMatched ? 1 : 0) * WEIGHTS.confidence;

  // Sentiment mismatch multiplier: halves the final score
  const sentimentPenaltyApplied = !sentimentMatch;
  if (sentimentPenaltyApplied) {
    weighted *= PENALTIES.sentimentMismatch;
  }

  return {
    id: testCase.id,
    score: Math.round(weighted * 100),
    sentimentMatch,
    domainsJaccard: Number(domainsJaccardVal.toFixed(4)),
    themesJaccard: Number(themesJaccardVal.toFixed(4)),
    confidenceInRange: confidenceMatched,
    themeRecall: Number(recallVal.toFixed(4)),
    sentimentPenaltyApplied,
    themeMissedPenaltyApplied,
  };
}

export function scoreDiscoverySuite(cases: DiscoveryEvalCase[], threshold: number = 75): DiscoveryEvalReport {
  if (cases.length === 0) {
    return {
      overallScore: 0,
      pass: false,
      threshold,
      cases: [],
    };
  }

  const caseScores = cases.map(scoreDiscoveryCase);
  const total = caseScores.reduce((sum, c) => sum + c.score, 0);
  const overallScore = Math.round(total / caseScores.length);

  return {
    overallScore,
    pass: overallScore >= threshold,
    threshold,
    cases: caseScores,
  };
}

// ---- Sales eval scoring ----

const SALES_WEIGHTS = {
  intent: 0.25,
  sentiment: 0.15,
  topics: 0.25,
  coaching: 0.15,
  dealHealth: 0.15,
  confidence: 0.05,
} as const;

/**
 * Sales-specific penalties mirror the discovery approach.
 *
 * intentMismatch: When predicted intent does not match gold,
 *   the final weighted score is multiplied by this factor.
 *
 * missedTopicFactor: Extra recall-weighted penalty for missing
 *   expected topic categories beyond Jaccard.
 */
const SALES_PENALTIES = {
  intentMismatch: 0.5,
  missedTopicFactor: 0.5,
} as const;

/**
 * Coaching accuracy: weighted match of triggered flag + priority.
 *
 * When gold expects coaching:
 *   - triggered correct + priority correct = 1.0
 *   - triggered correct + priority wrong   = 0.5
 *   - not triggered at all                 = 0.0
 *
 * When gold expects no coaching:
 *   - correctly not triggered = 1.0
 *   - over-triggered          = 0.5 (false positive, mild penalty)
 */
function scoreCoaching(
  predTriggered: boolean,
  predPriority: string | null,
  goldTriggered: boolean,
  goldPriority: string | null,
): number {
  if (!goldTriggered) {
    return predTriggered ? 0.5 : 1;
  }
  // Gold expects coaching
  if (!predTriggered) return 0;
  const priorityMatch =
    normalizeLabel(predPriority || '') === normalizeLabel(goldPriority || '');
  return priorityMatch ? 1 : 0.5;
}

export function scoreSalesCase(testCase: SalesEvalCase): SalesCaseScore {
  const expected = testCase.gold.expected;
  const prediction = testCase.prediction;

  const intentMatch =
    normalizeLabel(prediction.customerIntent) === normalizeLabel(expected.customerIntent);
  const sentimentMatch =
    normalizeLabel(prediction.sentimentTone) === normalizeLabel(expected.sentimentTone);
  const topicsJaccardVal = jaccard(prediction.topics, expected.topics);
  const topicRecallVal = themeRecall(prediction.topics, expected.topics);
  const coachingVal = scoreCoaching(
    prediction.coachingTriggered,
    prediction.coachingPriority,
    expected.coachingTriggered,
    expected.coachingPriority,
  );
  const dealHealthMatch =
    normalizeLabel(prediction.dealHealth) === normalizeLabel(expected.dealHealth);

  const confRange = expected.confidenceRange || { min: 0, max: 1 };
  const confidenceMatched = confidenceInRange(
    prediction.overallConfidence,
    confRange.min,
    confRange.max,
  );

  // Topic recall penalty (same pattern as discovery themes)
  const topicRecallDeficit = 1 - topicRecallVal;
  const topicMissedPenaltyApplied = topicRecallDeficit > 0;
  const adjustedTopicsScore = clamp01(
    topicsJaccardVal * (1 - SALES_PENALTIES.missedTopicFactor * topicRecallDeficit)
  );

  let weighted =
    (intentMatch ? 1 : 0) * SALES_WEIGHTS.intent +
    (sentimentMatch ? 1 : 0) * SALES_WEIGHTS.sentiment +
    adjustedTopicsScore * SALES_WEIGHTS.topics +
    clamp01(coachingVal) * SALES_WEIGHTS.coaching +
    (dealHealthMatch ? 1 : 0) * SALES_WEIGHTS.dealHealth +
    (confidenceMatched ? 1 : 0) * SALES_WEIGHTS.confidence;

  // Intent mismatch multiplier: halves the final score
  const intentPenaltyApplied = !intentMatch;
  if (intentPenaltyApplied) {
    weighted *= SALES_PENALTIES.intentMismatch;
  }

  return {
    id: testCase.id,
    score: Math.round(weighted * 100),
    intentMatch,
    sentimentMatch,
    topicsJaccard: Number(topicsJaccardVal.toFixed(4)),
    topicRecall: Number(topicRecallVal.toFixed(4)),
    coachingScore: Number(coachingVal.toFixed(4)),
    dealHealthMatch,
    confidenceInRange: confidenceMatched,
    intentPenaltyApplied,
    topicMissedPenaltyApplied,
  };
}

export function scoreSalesSuite(cases: SalesEvalCase[], threshold: number = 75): SalesEvalReport {
  if (cases.length === 0) {
    return {
      overallScore: 0,
      pass: false,
      threshold,
      cases: [],
    };
  }

  const caseScores = cases.map(scoreSalesCase);
  const total = caseScores.reduce((sum, c) => sum + c.score, 0);
  const overallScore = Math.round(total / caseScores.length);

  return {
    overallScore,
    pass: overallScore >= threshold,
    threshold,
    cases: caseScores,
  };
}

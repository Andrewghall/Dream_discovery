/**
 * Unit quality gate — per-unit filter applied after semantic splitting.
 *
 * Operates on individual meaning units, not full passages.
 * This is where business-anchor and signal-strength checks now live
 * (removed from runCommitGuard so TSM filters only structural garbage).
 *
 * A unit passes if it has:
 *   - ≥ 5 words
 *   - a finite predicate (or is a clean imperative)
 *   - referential dependency < 0.85
 *   - at least one signal type OR a business anchor
 */

import { extractFeatures } from './thought-feature-extractor';
import { DEFAULT_LENS_PACK } from './lens-pack-ontology';
import { CLEAN_IMPERATIVE } from './thought-validity-engine';

export interface UnitQualityResult {
  pass: boolean;
  reason: string | null;
  score: number; // 0–1 informational
}

const UNIT_MIN_WORDS = 5;
const REFERENTIAL_BLOCK = 0.85;

export function evaluateUnitQuality(text: string): UnitQualityResult {
  const t = text.trim();
  const wc = t.split(/\s+/).filter(Boolean).length;

  if (wc < UNIT_MIN_WORDS) {
    return { pass: false, reason: `too short — ${wc} words`, score: 0.0 };
  }

  const features = extractFeatures(t, DEFAULT_LENS_PACK);

  if (!features.has_predicate && !CLEAN_IMPERATIVE.test(t)) {
    return { pass: false, reason: 'no finite predicate — fragment', score: 0.1 };
  }

  if (features.referential_dependency_score > REFERENTIAL_BLOCK) {
    return { pass: false, reason: 'pure referential — no standalone meaning', score: 0.1 };
  }

  const signalStrength = Math.max(
    features.causal_signal_score,
    features.action_signal_score,
    features.constraint_signal_score,
    features.problem_signal_score,
    features.decision_signal_score,
    features.target_state_signal_score,
  );

  if (features.business_anchor_score === 0 && signalStrength === 0) {
    return { pass: false, reason: 'no signal and no business anchor', score: 0.15 };
  }

  const score = Math.min(
    0.30 +
    features.business_anchor_score * 0.30 +
    signalStrength * 0.20 +
    (features.has_subject ? 0.10 : 0) +
    features.specificity_score * 0.10,
    1.0,
  );

  return { pass: true, reason: null, score: parseFloat(score.toFixed(2)) };
}

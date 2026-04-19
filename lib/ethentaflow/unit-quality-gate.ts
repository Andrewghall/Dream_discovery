/**
 * Unit quality gate — per-unit filter applied after semantic splitting.
 *
 * Operates on individual meaning units, not full passages.
 * Runs in two stages:
 *
 * Stage 1 — Hard blockers (deterministic, no feature extraction):
 *   - Minimum word count
 *   - Minimum substantive token count (filters agreement fragments / ASR noise)
 *
 * Stage 2 — Feature-based checks:
 *   - Finite predicate required (or clean imperative)
 *   - Referential dependency below threshold
 *   - At least one signal type OR a business anchor
 */

import { extractFeatures } from './thought-feature-extractor';
import { DEFAULT_LENS_PACK } from './lens-pack-ontology';
import { CLEAN_IMPERATIVE } from './thought-validity-engine';

export interface UnitQualityResult {
  pass: boolean;
  reason: string | null;
  score: number; // 0–1 informational
}

// ── Stage 1 constants ───────────────────────────────────────────────────────

const UNIT_MIN_WORDS = 5;
const MIN_SUBSTANTIVE_TOKENS = 2;

// Function words, pronouns, auxiliaries, fillers, and acknowledgment tokens
// that carry no standalone semantic weight.
const FUNCTION_WORDS = new Set([
  // Pronouns
  'i', 'you', 'we', 'they', 'he', 'she', 'it', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'our', 'their', 'its', 'myself', 'yourself', 'himself', 'herself',
  // Articles & determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'some', 'any', 'each', 'every',
  // Conjunctions & prepositions
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'to', 'of', 'in', 'on', 'at', 'by', 'with', 'about', 'as', 'into', 'from',
  'up', 'out', 'off', 'over', 'under', 'between', 'through', 'during', 'before', 'after',
  // Auxiliaries
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall',
  // Fillers & acknowledgments — words that appear in agreement fragments
  'yes', 'no', 'ok', 'okay', 'yeah', 'yep', 'nope',
  'right', 'exactly', 'sure', 'well', 'just', 'also', 'too',
  'very', 'really', 'so', 'then', 'now', 'here',
]);

/**
 * Count words that carry independent semantic weight.
 * Strips punctuation, lowercases, then removes all function words.
 * A unit below MIN_SUBSTANTIVE_TOKENS is an agreement fragment or ASR noise.
 */
function countSubstantiveTokens(text: string): number {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !FUNCTION_WORDS.has(w))
    .length;
}

// ── Stage 2 constants ───────────────────────────────────────────────────────

const REFERENTIAL_BLOCK = 0.85;

// ── Public API ──────────────────────────────────────────────────────────────

export function evaluateUnitQuality(text: string): UnitQualityResult {
  const t = text.trim();
  const wc = t.split(/\s+/).filter(Boolean).length;

  // ── Stage 1: Hard blockers ──────────────────────────────────────────────

  if (wc < UNIT_MIN_WORDS) {
    return { pass: false, reason: `too short — ${wc} words`, score: 0.0 };
  }

  const substantiveCount = countSubstantiveTokens(t);
  if (substantiveCount < MIN_SUBSTANTIVE_TOKENS) {
    return {
      pass: false,
      reason: `agreement fragment or ASR noise — only ${substantiveCount} substantive token(s)`,
      score: 0.0,
    };
  }

  // ── Stage 2: Feature-based checks ──────────────────────────────────────

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

  // Note: business_anchor+signal gate intentionally removed.
  // Stage 1 (substantive token count) is the noise gate for agreement fragments.
  // Human-centred insights carry no business vocabulary but are valid DataPoints.

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

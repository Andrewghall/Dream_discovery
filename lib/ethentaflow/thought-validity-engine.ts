import type { ThoughtFeatures, ValidityResult } from './types';

// Weights for validity formula
const W = {
  self_containment: 0.22,
  structural_completeness: 0.22,
  business_anchor: 0.22,
  signal_strength: 0.16,
  specificity: 0.10,
  continuity: 0.08,
  referential_penalty: 0.20,
  ambiguity_penalty: 0.12,
};

// Commit threshold — raw score must exceed this after penalties
const COMMIT_THRESHOLD = 0.52;
// Escalate threshold — borderline ambiguous cases
const ESCALATE_THRESHOLD = 0.42;
// Discard threshold — clearly noise
const DISCARD_THRESHOLD = 0.25;

// Clean business imperatives: clear action + subject implied
// e.g. "Hire a second engineer", "Fix the onboarding process", "Remove that approval step"
export const CLEAN_IMPERATIVE = /^(hire|fire|fix|remove|add|build|stop|start|change|replace|reduce|increase|improve|automate|migrate|review|audit|define|create|deploy|eliminate|consolidate|integrate|streamline|restructure|realign|address|resolve|escalate|investigate|prioritise|prioritize|implement|roll out|sign off|sign-off|shut down|wind down)\b/i;

export function scoreValidity(features: ThoughtFeatures, continuity: number): ValidityResult {
  const reasons: string[] = [];

  // ─── Hard rules (checked first, override scoring) ─────────────────────────

  if (features.word_count < 4) {
    return {
      validity_score: 0,
      decision: 'hold',
      confidence: 1.0,
      reasons: ['too short — fewer than 4 words'],
      hard_rule_applied: 'MIN_WORD_COUNT',
      score_breakdown: zeroBreakdown(),
      thought_completeness: 'fragment' as const,
    };
  }

  if (features.has_dangling_end) {
    return {
      validity_score: 0,
      decision: 'hold',
      confidence: 1.0,
      reasons: ['ends with dangling conjunction — incomplete thought'],
      hard_rule_applied: 'DANGLING_END',
      score_breakdown: zeroBreakdown(),
      thought_completeness: 'fragment' as const,
    };
  }

  if (features.opening_pronoun && features.business_anchor_score < 0.25) {
    return {
      validity_score: 0,
      decision: 'hold',
      confidence: 0.9,
      reasons: [`starts with external pronoun "${features.opening_pronoun}" with no business anchor`],
      hard_rule_applied: 'EXTERNAL_PRONOUN_NO_ANCHOR',
      score_breakdown: zeroBreakdown(),
      thought_completeness: 'fragment' as const,
    };
  }

  if (features.referential_dependency_score > 0.75) {
    return {
      validity_score: 0,
      decision: 'hold',
      confidence: 0.9,
      reasons: ['high referential dependency — depends on prior context'],
      hard_rule_applied: 'HIGH_REFERENTIAL_DEPENDENCY',
      score_breakdown: zeroBreakdown(),
      thought_completeness: 'fragment' as const,
    };
  }

  if (!features.has_predicate && !CLEAN_IMPERATIVE.test('')) {
    // Only apply no-predicate hard rule if it's not a clean imperative
    // We'll re-check below with the actual text hint
  }

  // ─── Soft scoring ─────────────────────────────────────────────────────────

  // Self-containment: inverse of referential dependency, bonus for external ref absence
  const self_containment = Math.max(
    1.0 - features.referential_dependency_score - (features.has_external_reference ? 0.2 : 0),
    0,
  );

  // Structural completeness: subject + predicate + business object
  let structural_completeness = 0;
  if (features.has_subject) structural_completeness += 0.4;
  if (features.has_predicate) structural_completeness += 0.4;
  if (features.has_business_object) structural_completeness += 0.2;

  // Business anchor
  const business_anchor = features.business_anchor_score;

  // Signal strength: best of any signal type
  const signal_strength = Math.max(
    features.causal_signal_score,
    features.action_signal_score,
    features.constraint_signal_score,
    features.problem_signal_score,
    features.decision_signal_score,
    features.target_state_signal_score,
  );

  // Specificity
  const specificity = features.specificity_score;

  // Continuity (passed in from state machine — e.g. speaker previously committed a related node)
  const cont = Math.max(0, Math.min(continuity, 1));

  // Penalties
  const referential_penalty = features.referential_dependency_score;
  const ambiguity_penalty = features.ambiguity_score;

  // Raw score
  const raw =
    W.self_containment * self_containment +
    W.structural_completeness * structural_completeness +
    W.business_anchor * business_anchor +
    W.signal_strength * signal_strength +
    W.specificity * specificity +
    W.continuity * cont -
    W.referential_penalty * referential_penalty -
    W.ambiguity_penalty * ambiguity_penalty;

  const validity_score = Math.max(0, Math.min(raw, 1));

  const score_breakdown = {
    self_containment,
    structural_completeness,
    business_anchor,
    signal_strength,
    specificity,
    continuity: cont,
    referential_penalty,
    ambiguity_penalty,
    raw: validity_score,
  };

  // Collect reason signals
  if (self_containment < 0.5) reasons.push('low self-containment');
  if (structural_completeness < 0.4) reasons.push('incomplete structure — missing subject or predicate');
  if (business_anchor < 0.2) reasons.push('no business domain anchor');
  if (signal_strength === 0) reasons.push('no identifiable signal type');
  if (ambiguity_penalty > 0.4) reasons.push('high ambiguity — vague language with no specific anchor');
  if (specificity > 0.3) reasons.push(`specificity present (score: ${specificity.toFixed(2)})`);
  if (signal_strength > 0) reasons.push(`signal: ${features.primary_type_hint ?? 'observation'}`);

  // Resolution confidence — weighted structural integrity score
  const sig_strength_c = Math.max(
    features.causal_signal_score, features.action_signal_score,
    features.constraint_signal_score, features.problem_signal_score,
    features.decision_signal_score, features.target_state_signal_score,
  );
  const structural_c =
    (features.has_subject ? 0.4 : 0) +
    (features.has_predicate ? 0.4 : 0) +
    (features.has_business_object ? 0.2 : 0);
  const signal_resolved_score =
    sig_strength_c > 0 && (features.business_anchor_score > 0 || features.has_business_object)
      ? sig_strength_c : 0;

  const resolution_confidence =
    0.25 * structural_c +
    0.20 * (features.business_anchor_score > 0 ? 1.0 : 0) +
    0.20 * signal_resolved_score +
    0.15 * (1.0 - Math.min(features.referential_dependency_score, 1.0)) +
    0.10 * ((features.specificity_score > 0 || features.has_numeric_reference || features.has_proper_nouns) ? 1.0 : 0) +
    0.10 * (features.has_resolution_signal ? 1.0 : 0) -
    0.30 * (features.has_continuation_signal ? 1.0 : 0);

  const thought_completeness: ValidityResult['thought_completeness'] =
    resolution_confidence >= 0.60 ? 'complete' :
    resolution_confidence >= 0.35 ? 'developing' :
    'fragment';

  // No-predicate hard rule (deferred — needs context about clean imperative)
  if (!features.has_predicate && validity_score < COMMIT_THRESHOLD) {
    return {
      validity_score,
      decision: 'hold',
      confidence: 0.8,
      reasons: [...reasons, 'no predicate — not a complete statement'],
      hard_rule_applied: 'NO_PREDICATE',
      score_breakdown,
      thought_completeness,
    };
  }

  // Decision
  let decision: ValidityResult['decision'];
  let confidence: number;

  if (validity_score >= COMMIT_THRESHOLD) {
    decision = 'commit';
    confidence = Math.min((validity_score - COMMIT_THRESHOLD) / (1 - COMMIT_THRESHOLD) + 0.5, 1.0);
    reasons.unshift(`score ${validity_score.toFixed(3)} ≥ commit threshold ${COMMIT_THRESHOLD}`);
  } else if (validity_score >= ESCALATE_THRESHOLD) {
    // Borderline — escalate to LLM (Phase 4). For now, treat as hold.
    decision = 'hold';
    confidence = 0.4;
    reasons.unshift(`score ${validity_score.toFixed(3)} in escalation band — borderline`);
  } else if (validity_score >= DISCARD_THRESHOLD) {
    decision = 'hold';
    confidence = 0.6;
    reasons.unshift(`score ${validity_score.toFixed(3)} — below commit threshold`);
  } else {
    decision = 'discard';
    confidence = 0.8;
    reasons.unshift(`score ${validity_score.toFixed(3)} — too low, discarding`);
  }

  return {
    validity_score,
    decision,
    confidence,
    reasons,
    hard_rule_applied: null,
    score_breakdown,
    thought_completeness,
  };
}

function zeroBreakdown(): ValidityResult['score_breakdown'] {
  return {
    self_containment: 0,
    structural_completeness: 0,
    business_anchor: 0,
    signal_strength: 0,
    specificity: 0,
    continuity: 0,
    referential_penalty: 0,
    ambiguity_penalty: 0,
    raw: 0,
  };
}

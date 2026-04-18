import type { ThoughtFeatures } from './types';
import { CLEAN_IMPERATIVE } from './thought-validity-engine';

export interface GuardResult {
  blocked: boolean;
  reason: string | null;
}

// Bare pronoun/article left dangling at sentence end — e.g. "they eat. I." or "...and we."
// Case-sensitive: only catches pronouns as written (I is always uppercase)
const ORPHAN_TRAILING_TOKEN = /\b(I|we|they|he|she|it|you|the|a|an|our|their|his|her|its)\s*[.,!?]?\s*$/;

// Infinitive "to be" — not a finite predicate; used to strip false predicate signal
const INFINITIVE_BE = /\bto be\b/gi;

// Referential dependency threshold above which the guard hard-blocks
const REFERENTIAL_BLOCK_THRESHOLD = 0.6;

// Business anchor floor — below this with zero signal, the text has nothing to say
const ANCHOR_FLOOR = 0.15;

function computeSigStrength(f: ThoughtFeatures): number {
  return Math.max(
    f.causal_signal_score,
    f.action_signal_score,
    f.constraint_signal_score,
    f.problem_signal_score,
    f.decision_signal_score,
    f.target_state_signal_score,
  );
}

/**
 * Single authoritative commit guard.
 * Used identically by ThoughtStateMachine.commit() and the /transcript POST route.
 * No score, continuity bonus, force-decide, or silence expiry can bypass this.
 */
export function runCommitGuard(text: string, features: ThoughtFeatures): GuardResult {
  const t = text.trim();

  // 1. Orphan trailing token — stray pronoun/article at sentence end
  if (ORPHAN_TRAILING_TOKEN.test(t)) {
    return { blocked: true, reason: 'GUARD:ORPHAN_TRAILING_TOKEN' };
  }

  // 2. Dangling conjunction at end — thought is incomplete
  if (features.has_dangling_end) {
    return { blocked: true, reason: 'GUARD:DANGLING_END' };
  }

  // 3. No finite predicate — infinitive "to be" is stripped before checking
  const withoutInfinitiveBe = t.replace(INFINITIVE_BE, '');
  const hasFinitePredicate =
    features.has_predicate &&
    /\b(is|are|was|were|been|have|has|had|do|does|did|will|would|could|should|can|need|want|think|know|see|say|said|mean|means|get|got|make|makes|take|takes|keep|kept|run|runs|goes|went|come|comes|work|works|use|uses|feel|feels|bring|brings|show|shows|tell|tells|build|built|create|creates|find|found|give|gives|move|moves|stop|stops|start|starts|help|helps|change|changes|allow|allows|require|requires|prevent|prevents|cause|causes|need|needs|fail|fails|break|breaks|lack|lacks|drive|drives|block|blocks|limit|limits|increase|increases|decrease|decreases|reduce|reduces|improve|improves|affect|affects|impact|impacts|depend|depends|scale|scales|support|supports|enable|enables|integrate|integrates|eat|eats|ate)\b/i.test(withoutInfinitiveBe);

  if (!hasFinitePredicate && !CLEAN_IMPERATIVE.test(t)) {
    return { blocked: true, reason: 'GUARD:NO_FINITE_PREDICATE' };
  }

  // 4. High referential dependency — relies too heavily on prior context
  if (features.referential_dependency_score > REFERENTIAL_BLOCK_THRESHOLD) {
    return { blocked: true, reason: 'GUARD:REFERENTIAL_DEPENDENCY' };
  }

  // 5. No business anchor and no signal — structurally complete noise
  const sigStrength = computeSigStrength(features);
  if (features.business_anchor_score < ANCHOR_FLOOR && sigStrength === 0) {
    return { blocked: true, reason: 'GUARD:NO_ANCHOR_NO_SIGNAL' };
  }

  return { blocked: false, reason: null };
}

export function logGuardResult(
  label: string,
  text: string,
  features: ThoughtFeatures,
  result: GuardResult,
): void {
  const sigStrength = computeSigStrength(features);
  console.log(`[EthentaFlow:${label}]`, JSON.stringify({
    text: text.substring(0, 80),
    has_dangling_end: features.has_dangling_end,
    has_predicate: features.has_predicate,
    referential_dependency_score: +features.referential_dependency_score.toFixed(3),
    business_anchor_score: +features.business_anchor_score.toFixed(3),
    signal_strength: +sigStrength.toFixed(3),
    target_state_signal_score: +features.target_state_signal_score.toFixed(3),
    blocked: result.blocked,
    reason: result.reason,
  }));
}

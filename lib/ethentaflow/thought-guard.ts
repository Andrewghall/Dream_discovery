import type { ThoughtFeatures } from './types';
import { CLEAN_IMPERATIVE } from './thought-validity-engine';

export interface GuardResult {
  blocked: boolean;
  reason: string | null;
  is_semantically_closed: boolean;
  closure_reason: string;
}

// Bare pronoun/article left dangling at sentence end
const ORPHAN_TRAILING_TOKEN = /\b(I|we|they|he|she|it|you|the|a|an|our|their|his|her|its)\s*[.,!?]?\s*$/;

// Infinitive "to be" — not a finite predicate
const INFINITIVE_BE = /\bto be\b/gi;

const REFERENTIAL_BLOCK_THRESHOLD = 0.6;
const ANCHOR_FLOOR = 0.15;

// ── Semantic closure ──────────────────────────────────────────────────────────
//
// A thought is semantically closed if it could stand alone as a complete,
// human-readable statement. Aggregation is not enough — completion is required.
//
// Rules applied in order. First match wins.

// Trailing conjunctions and continuation words — these always mean the speaker
// hasn't finished.
const TRAILING_CONJUNCTION = /\b(and|but|so|because|which|or|if|when|that|for|as|although|however|yet|whereas|since|unless|until|similarly|additionally|furthermore|moreover|therefore|consequently|also|plus|then|hence|thus|while|though|whether|both|either|neither|not only|despite|except|including|regarding|concerning|following|considering)\s*[,.]?\s*$/i;

// Trailing preposition — classic incomplete clause ending
const TRAILING_PREPOSITION = /\b(of|in|on|at|by|for|to|from|with|through|about|between|during|into|onto|out|over|under|up|upon|within|without|across|after|along|among|around|before|behind|below|beneath|beside|besides|beyond|despite|down|except|inside|instead|near|off|outside|since|toward|towards|until|via|per)\s*[,.]?\s*$/i;

// Trailing bare copula or modal — predicate left open
const TRAILING_BARE_VERB = /\b(is|are|was|were|am|be|been|being|do|does|did|have|has|had|can|could|will|would|should|may|might|must|shall|need|want|think|know|see|say|mean|get|make|take|keep|run|go|come|work|use|feel|bring|show|tell|build|create|find|give|move|stop|start|help|change|allow|require|prevent|cause|fail|break|lack|drive|block|limit|increase|decrease|reduce|improve|affect|impact|depend|scale|support|enable|integrate)\s*[,.]?\s*$/i;

// Trailing comma — speaker paused mid-list or mid-clause
const TRAILING_COMMA = /,\s*$/;

export function isSemanticallyClosed(text: string): { closed: boolean; reason: string } {
  const t = text.trim();
  if (!t) return { closed: false, reason: 'empty' };

  // Rule 1: ends with terminal punctuation → closed
  if (/[.!?]\s*$/.test(t)) {
    return { closed: true, reason: 'terminal-punctuation' };
  }

  // Rule 2: trailing comma → not closed (mid-list or mid-clause pause)
  if (TRAILING_COMMA.test(t)) {
    return { closed: false, reason: 'trailing-comma' };
  }

  // Rule 3: trailing conjunction or continuation word → not closed
  if (TRAILING_CONJUNCTION.test(t)) {
    return { closed: false, reason: 'trailing-conjunction' };
  }

  // Rule 4: trailing preposition → not closed
  if (TRAILING_PREPOSITION.test(t)) {
    return { closed: false, reason: 'trailing-preposition' };
  }

  // Rule 5: trailing bare verb/modal → predicate left open
  if (TRAILING_BARE_VERB.test(t)) {
    return { closed: false, reason: 'trailing-bare-verb' };
  }

  // Rule 6: find the tail — text after the last terminal punctuation mark.
  // If there is prior sentence-ending content, the tail is a new clause that
  // must itself be complete. Short tails after complete sentences are the main
  // source of mid-sentence commits (e.g. "…risks. There could. Be AI manipulatio").
  const terminalMatch = t.match(/^([\s\S]*[.!?])\s+(.+)$/);
  if (terminalMatch) {
    const tail = terminalMatch[2].trim();
    const tailWords = tail.split(/\s+/).filter(w => w.length > 0);
    // Tail of 1–4 words after a prior sentence = incomplete continuation
    if (tailWords.length <= 4) {
      return { closed: false, reason: 'incomplete-tail-after-sentence' };
    }
    // Tail with its own trailing issue
    if (TRAILING_CONJUNCTION.test(tail) || TRAILING_PREPOSITION.test(tail) || TRAILING_BARE_VERB.test(tail) || TRAILING_COMMA.test(tail)) {
      return { closed: false, reason: 'incomplete-tail-continuation' };
    }
  }

  // Rule 7: word count gate — a standalone segment with fewer than 6 words is
  // likely a fragment, not a complete thought.
  const wordCount = t.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 6) {
    return { closed: false, reason: 'too-few-words' };
  }

  // No red flags found — treat as closed
  return { closed: true, reason: 'complete-inferred' };
}

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
 * Structural-only guard — used server-side (no lens pack available).
 * Rules 1–4 only. Does NOT include semantic closure check.
 */
export function runStructuralGuard(text: string, features: ThoughtFeatures): GuardResult {
  const t = text.trim();
  const closure = isSemanticallyClosed(t);
  if (ORPHAN_TRAILING_TOKEN.test(t)) return { blocked: true, reason: 'GUARD:ORPHAN_TRAILING_TOKEN', is_semantically_closed: closure.closed, closure_reason: closure.reason };
  if (features.has_dangling_end) return { blocked: true, reason: 'GUARD:DANGLING_END', is_semantically_closed: false, closure_reason: 'dangling-end' };
  const withoutInfinitiveBe = t.replace(INFINITIVE_BE, '');
  const hasFinitePredicate =
    features.has_predicate &&
    /\b(is|are|was|were|been|have|has|had|do|does|did|will|would|could|should|can|need|want|think|know|see|say|said|mean|means|get|got|make|makes|take|takes|keep|kept|run|runs|goes|went|come|comes|work|works|use|uses|feel|feels|bring|brings|show|shows|tell|tells|build|built|create|creates|find|found|give|gives|move|moves|stop|stops|start|starts|help|helps|change|changes|allow|allows|require|requires|prevent|prevents|cause|causes|need|needs|fail|fails|break|breaks|lack|lacks|drive|drives|block|blocks|limit|limits|increase|increases|decrease|decreases|reduce|reduces|improve|improves|affect|affects|impact|impacts|depend|depends|scale|scales|support|supports|enable|enables|integrate|integrates|eat|eats|ate)\b/i.test(withoutInfinitiveBe);
  if (!hasFinitePredicate && !CLEAN_IMPERATIVE.test(t)) return { blocked: true, reason: 'GUARD:NO_FINITE_PREDICATE', is_semantically_closed: closure.closed, closure_reason: closure.reason };
  if (features.referential_dependency_score > REFERENTIAL_BLOCK_THRESHOLD) return { blocked: true, reason: 'GUARD:REFERENTIAL_DEPENDENCY', is_semantically_closed: closure.closed, closure_reason: closure.reason };
  return { blocked: false, reason: null, is_semantically_closed: closure.closed, closure_reason: closure.reason };
}

/**
 * Full commit guard — structural + semantic closure.
 * Used by ThoughtStateMachine.commit() (client-side, has the workshop lens pack).
 * A thought must be both structurally sound AND semantically closed to commit.
 */
export function runCommitGuard(text: string, features: ThoughtFeatures): GuardResult {
  const t = text.trim();

  // 1. Orphan trailing token
  if (ORPHAN_TRAILING_TOKEN.test(t)) {
    return { blocked: true, reason: 'GUARD:ORPHAN_TRAILING_TOKEN', is_semantically_closed: false, closure_reason: 'orphan-token' };
  }

  // 2. Dangling conjunction at end
  if (features.has_dangling_end) {
    return { blocked: true, reason: 'GUARD:DANGLING_END', is_semantically_closed: false, closure_reason: 'dangling-end' };
  }

  // 3. No finite predicate
  const withoutInfinitiveBe = t.replace(INFINITIVE_BE, '');
  const hasFinitePredicate =
    features.has_predicate &&
    /\b(is|are|was|were|been|have|has|had|do|does|did|will|would|could|should|can|need|want|think|know|see|say|said|mean|means|get|got|make|makes|take|takes|keep|kept|run|runs|goes|went|come|comes|work|works|use|uses|feel|feels|bring|brings|show|shows|tell|tells|build|built|create|creates|find|found|give|gives|move|moves|stop|stops|start|starts|help|helps|change|changes|allow|allows|require|requires|prevent|prevents|cause|causes|need|needs|fail|fails|break|breaks|lack|lacks|drive|drives|block|blocks|limit|limits|increase|increases|decrease|decreases|reduce|reduces|improve|improves|affect|affects|impact|impacts|depend|depends|scale|scales|support|supports|enable|enables|integrate|integrates|eat|eats|ate)\b/i.test(withoutInfinitiveBe);

  if (!hasFinitePredicate && !CLEAN_IMPERATIVE.test(t)) {
    return { blocked: true, reason: 'GUARD:NO_FINITE_PREDICATE', is_semantically_closed: false, closure_reason: 'no-predicate' };
  }

  // 4. High referential dependency
  if (features.referential_dependency_score > REFERENTIAL_BLOCK_THRESHOLD) {
    return { blocked: true, reason: 'GUARD:REFERENTIAL_DEPENDENCY', is_semantically_closed: false, closure_reason: 'referential' };
  }

  // 5. No business anchor and no signal — structurally complete noise
  const sigStrength = computeSigStrength(features);
  if (features.business_anchor_score < ANCHOR_FLOOR && sigStrength === 0) {
    return { blocked: true, reason: 'GUARD:NO_ANCHOR_NO_SIGNAL', is_semantically_closed: false, closure_reason: 'no-anchor-no-signal' };
  }

  // 6. Semantic closure — the thought must be a complete, human-readable unit.
  // Signal strength and business anchor are NOT indicators of completion.
  // This gate runs last so structural checks (which are cheap) fire first.
  const closure = isSemanticallyClosed(t);
  if (!closure.closed) {
    return {
      blocked: true,
      reason: `GUARD:SEMANTIC_INCOMPLETE`,
      is_semantically_closed: false,
      closure_reason: closure.reason,
    };
  }

  return { blocked: false, reason: null, is_semantically_closed: true, closure_reason: closure.reason };
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
    is_semantically_closed: result.is_semantically_closed,
    closure_reason: result.closure_reason,
    blocked: result.blocked,
    reason: result.reason,
  }));
}

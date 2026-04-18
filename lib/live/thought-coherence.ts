/**
 * Client-side thought coherence gate.
 *
 * Fast heuristic check run before the silence timer commits a buffer.
 * Catches obvious dependent fragments — unresolved pronouns, dangling
 * clauses, no predicate — without a network call.
 *
 * If this returns false, the capture layer extends the hold window and
 * waits for continuation rather than committing.
 */

const BARE_PRONOUN_SUBJECTS = /^(it|this|that|those|these|he|she|they|we)\b/i;

const DANGLING_ENDINGS = /\b(but|and|because|which|to|or|so|if|when|that|for|as)\s*[,.]?\s*$/i;

// Verb-like words — presence of at least one suggests predication
const VERB_PATTERN = /\b(is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|can|need|want|think|know|see|say|said|mean|means|get|got|make|makes|take|takes|keep|kept|run|runs|goes|went|come|comes|work|works|use|uses|feel|feels|bring|brings|show|shows|tell|tells|build|built|create|creates|find|found|give|gives|move|moves|stop|stops|start|starts|help|helps|change|changes|allow|allows|require|requires|prevent|prevents|cause|causes)\b/i;

export type CoherenceResult = {
  coherent: boolean;
  signals: string[];
};

export function isThoughtCoherent(text: string): CoherenceResult {
  const t = text.trim();
  const signals: string[] = [];

  if (BARE_PRONOUN_SUBJECTS.test(t)) {
    signals.push('starts with unresolved pronoun subject');
  }

  if (DANGLING_ENDINGS.test(t)) {
    signals.push('ends with dangling conjunction or incomplete clause');
  }

  if (!VERB_PATTERN.test(t)) {
    signals.push('no identifiable verb — not a complete predication');
  }

  return {
    coherent: signals.length === 0,
    signals,
  };
}

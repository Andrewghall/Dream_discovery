/**
 * Client-side thought coherence gate.
 *
 * Fast heuristic check run before the silence timer commits a buffer.
 * If incoherent, the speechFinal shortcut is suppressed and the full
 * silence window continues — giving the speaker time to complete the thought.
 */

// Unresolved pronoun as subject — thought depends on prior context
const BARE_PRONOUN_SUBJECT = /^(it|this|that|those|these|he|she|they|we)\b/i;

// Dangling clause ending — speaker was building toward something
const DANGLING_ENDING = /\b(but|and|because|which|to|or|so|if|when|that|for|as)\s*[,.]?\s*$/i;

// No predicate — no identifiable verb in the statement
const VERB_PATTERN = /\b(is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|can|need|want|think|know|see|say|said|mean|means|get|got|make|makes|take|takes|keep|kept|run|runs|goes|went|come|comes|work|works|use|uses|feel|feels|bring|brings|show|shows|tell|tells|build|built|create|creates|find|found|give|gives|move|moves|stop|stops|start|starts|help|helps|change|changes|allow|allows|require|requires|prevent|prevents|cause|causes|need|needs)\b/i;

// Imperative with no clear direct object — verb + bare quantifier/pronoun as sole object
// e.g. "Come in with two", "Bring them in", "Do that", "Take three"
const IMPERATIVE_NO_OBJECT = /^(come|go|bring|take|get|put|send|add|remove|use|include|make|do|give|keep|let|show|tell|check|run|try|set|push|pull|move|call|ask|look)\b.{0,40}\b(two|three|four|five|six|seven|eight|nine|ten|one|it|them|those|these|that|this|some)\s*[.,]?\s*$/i;

// External referential dependency — points outside this statement
// e.g. "after those calls", "since that meeting", "like I said"
const EXTERNAL_REFERENCE = /\b(after those|after the|after that|after he|after she|after they|since the|since that|like I said|as I mentioned|as we discussed|following the|during the|on those|about those|about that call|those calls|that meeting|from that|from those|to that|to those|with those|with that)\b/i;

// Bare demonstrative as the primary noun — "that", "those", "these", "them" with no anchor
const UNANCHORED_DEMONSTRATIVE = /\b(that|those|these|them)\b(?!\s+(is|are|was|were|will|would|can|could|should|need|have|has))/i;

export type CoherenceResult = {
  coherent: boolean;
  signals: string[];
};

export function isThoughtCoherent(text: string): CoherenceResult {
  const t = text.trim();
  const signals: string[] = [];

  if (BARE_PRONOUN_SUBJECT.test(t)) {
    signals.push('starts with unresolved pronoun subject');
  }

  if (DANGLING_ENDING.test(t)) {
    signals.push('ends with dangling conjunction or incomplete clause');
  }

  if (!VERB_PATTERN.test(t)) {
    signals.push('no identifiable verb — not a complete predication');
  }

  if (IMPERATIVE_NO_OBJECT.test(t)) {
    signals.push('imperative with no clear direct object');
  }

  if (EXTERNAL_REFERENCE.test(t)) {
    signals.push('references external context without anchor');
  }

  // Only flag unanchored demonstrative if it is the primary subject/object
  // (short statements where "that"/"those" carries the entire meaning)
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 8 && UNANCHORED_DEMONSTRATIVE.test(t) && !BARE_PRONOUN_SUBJECT.test(t)) {
    signals.push('short statement with unanchored demonstrative reference');
  }

  return {
    coherent: signals.length === 0,
    signals,
  };
}

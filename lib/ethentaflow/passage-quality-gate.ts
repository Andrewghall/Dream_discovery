/**
 * Passage quality gate — deterministic pre-ingest check.
 *
 * Evaluates a fully resolved passage for ASR damage and semantic instability
 * BEFORE it is sent to the ingest route.
 *
 * This gate operates at the PASSAGE level, not the sentence level.
 * The existing ThoughtStateMachine guards operate at the clause/token level.
 *
 * The gate may REJECT a passage. It never modifies text.
 *
 * Rejection signals (checked in priority order):
 *   1. Consecutive word repetition        — ASR loop artefact
 *   2. False start pattern                — speaker restated; boundary misplaced
 *   3. Defective sentence ratio ≥ 0.50    — too many broken clauses
 *
 * A sentence is "defective" if it has ANY of:
 *   - dangling preposition / conjunction at end
 *   - prepositional phrase fragment (starts with preposition, < 9 words)
 *   - gerund fragment (starts with verb-ing, no explicit subject nearby)
 *   - < 5 words AND no finite verb
 */

export interface PassageQualityResult {
  pass: boolean;
  /** Human-readable rejection reason, null on pass. */
  reason: string | null;
  /** Diagnostic score 0–1 (higher = better quality). Informational only. */
  score: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// Rough sentence split — splits on .?! + whitespace (not inside words)
function roughSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Finite verb check (subset covering workshop spoken English)
function hasFiniteVerb(s: string): boolean {
  if (/\b(am|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|shall|must|can)\b/i.test(s)) return true;
  if (/\b\w+[''](s|re|ve|ll|d)\b/i.test(s)) return true;
  if (/\b(gonna|gotta|wanna|hafta|tryna)\b/i.test(s)) return true;
  if (/\b(know|think|feel|see|want|need|like|get|keep|make|take|come|go|say|look|try|help|work|find|use|seem|become|happen|start|stop|mean|show|tell|ask|give|hear|talk|build|change|grow|move|allow|provide|suggest|consider|understand|believe|decide|remember|realize|learn|expect|hope|worry|lead|follow|pay|return|send|create|serve|open|bring|lose|offer|appear|plan|require|include|involve|impact|drive|enable|support|reduce|improve|measure|manage|handle|deal|face|shift)\b/i.test(s)) return true;
  return false;
}

// Dangling end: sentence ends on a preposition or coordinating conjunction
const DANGLING_END_RE = /\b(about|of|in|at|by|for|on|with|to|from|into|onto|through|and|but|or|so|because|that|which|who|when|where|if|though|although|since|until|unless|while|as|just|even|also|then)\s*[.?!]?\s*$/i;

function hasDanglingEnd(s: string): boolean {
  return DANGLING_END_RE.test(s.replace(/[.?!]\s*$/, ''));
}

// Prepositional phrase fragment: starts with preposition + short
const PREP_START_RE = /^(at|in|on|by|for|with|about|during|before|after|through|among|between|around|along|across|into|onto|from|towards?|despite|within|without|upon|throughout|over|under|behind|beside|beyond|near|inside|outside|against|toward)\b/i;

// Gerund fragment: starts with -ing word, no explicit subject in first 3 tokens
const GERUND_START_RE = /^[A-Za-z]+ing\b/;
const EXPLICIT_SUBJECT_RE = /^(I|we|you|they|he|she|it|the|a|an|my|your|our|their)\b/i;

function isDefectiveSentence(s: string): boolean {
  const wc = wordCount(s);

  // Short with no finite verb
  if (wc < 5 && !hasFiniteVerb(s)) return true;

  // Dangling preposition / conjunction at end
  if (hasDanglingEnd(s)) return true;

  // Prepositional phrase masquerading as a sentence (short)
  if (PREP_START_RE.test(s) && wc < 9) return true;

  // Gerund fragment with no explicit subject in the first three words
  const firstThree = s.split(/\s+/).slice(0, 3).join(' ');
  if (GERUND_START_RE.test(s) && !EXPLICIT_SUBJECT_RE.test(firstThree)) return true;

  return false;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the passage quality gate on a fully resolved passage.
 *
 * Passages shorter than 10 words are skipped (handled upstream by commit guard).
 * Passages that are a single sentence are skipped (sentence-level guards cover these).
 */
export function checkPassageQuality(text: string): PassageQualityResult {
  const trimmed = text.trim();
  const totalWords = wordCount(trimmed);

  // Too short — leave to existing guards
  if (totalWords < 10) return { pass: true, reason: null, score: 1.0 };

  // ── 1. Consecutive word repetition ─────────────────────────────────────
  // Two or more instances of the same word back-to-back signals an ASR loop.
  const repeatMatches = trimmed.match(/\b(\w{2,})\s+\1\b/gi) ?? [];
  if (repeatMatches.length >= 2) {
    return {
      pass: false,
      reason: `consecutive word repetition — ASR loop: "${repeatMatches[0]}" (${repeatMatches.length} occurrences)`,
      score: 0.1,
    };
  }

  // ── 2. False start pattern ──────────────────────────────────────────────
  // Same short word appears both before and after a sentence boundary.
  // e.g. "I. I think" or "We. We gotta"
  const falseStartMatch = trimmed.match(/\b(\w{1,6})\s*[.!?]\s+\1\b/i);
  if (falseStartMatch) {
    return {
      pass: false,
      reason: `false start pattern: "${falseStartMatch[0]}"`,
      score: 0.2,
    };
  }

  // ── 3. Defective sentence ratio ─────────────────────────────────────────
  const sentences = roughSentences(trimmed);
  const total = sentences.length;

  // Single sentence — sentence-level guards cover this
  if (total < 2) return { pass: true, reason: null, score: 1.0 };

  const defectives = sentences.filter(isDefectiveSentence);
  const defectRatio = defectives.length / total;

  if (defectRatio >= 0.5) {
    return {
      pass: false,
      reason: `excessive broken phrasing — ${defectives.length}/${total} clauses malformed`,
      score: parseFloat((1 - defectRatio).toFixed(2)),
    };
  }

  return {
    pass: true,
    reason: null,
    score: parseFloat((1 - defectRatio * 0.4).toFixed(2)),
  };
}

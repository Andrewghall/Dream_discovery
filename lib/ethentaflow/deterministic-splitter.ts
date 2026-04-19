/**
 * Deterministic semantic unit splitter — v2 path.
 *
 * Segments a fully-resolved passage into meaning units using rules only.
 * No LLM calls. No paraphrasing. No rewriting.
 *
 * A unit is valid if it:
 *   - contains at least one finite verb
 *   - does not start with a reference pronoun (she/he/they/it) that
 *     implies dependence on a previously mentioned entity
 *   - does not end with a dangling preposition or conjunction
 *   - is at least MIN_WORDS words long
 *
 * The splitter may only:
 *   - segment at sentence boundaries
 *   - trim obvious leading joiners (And, But, So, However …)
 *   - discard units that fail the completeness check
 *
 * Returns the original text as a single unit when fewer than 2 valid
 * segments are found — no split is better than a wrong split.
 */

const MIN_WORDS = 6;

// ── Finite verb detection ───────────────────────────────────────────────────
// Covers modal/aux verbs, contractions, and colloquial forms common in
// spoken workshop transcripts (gonna, gotta, etc.).
function hasFiniteVerb(text: string): boolean {
  // Modal and auxiliary verbs
  if (/\b(am|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|shall|must|can)\b/i.test(text)) return true;
  // Contractions: 's, 're, 've, 'll, 'd
  if (/\b\w+[''](s|re|ve|ll|d)\b/i.test(text)) return true;
  // Colloquial: gonna, gotta, wanna, etc.
  if (/\b(gonna|gotta|wanna|hafta|tryna)\b/i.test(text)) return true;
  // Common main verbs covering most workshop speech
  if (/\b(know|think|feel|see|want|need|like|get|keep|make|take|come|go|say|look|try|help|work|find|use|seem|become|happen|start|stop|mean|show|tell|ask|give|hear|talk|read|run|build|change|grow|move|allow|provide|suggest|consider|understand|believe|decide|remember|realize|learn|expect|hope|worry|wonder|lead|hold|follow|pay|return|add|send|increase|create|serve|open|bring|buy|spend|lose|offer|appear|plan|require|include|involve|impact|affect|drive|enable|support|reduce|improve|measure|track|manage|handle|deal|face|focus|shift|move|push|pull|turn|bring|put|set|let|leave|take|give|end|begin|stay|remain|need|tend|fail|succeed|struggle|continue|decide|choose|agree|disagree|respond|react|report|present|describe|explain|define|identify|assess|evaluate|address|resolve|solve|fix|break|build|design|develop|deliver|deploy|release|launch|scale|grow|shrink|cut|raise|lower|increase|decrease)\b/i.test(text)) return true;
  return false;
}

// ── Self-containment check ──────────────────────────────────────────────────
// Reference pronouns at the start of a unit imply the referent was introduced
// in a previous sentence — the unit cannot stand alone.
//
// Exceptions:
//   "It is…" / "It was…" / "It's…" — impersonal "it" is self-contained
//   "They are…" starting a topic sentence is borderline — kept conservative.
const REFERENCE_PRONOUN_RE = /^(she|he|him|her|they|them)\b/i;
// "it" is a reference pronoun UNLESS followed by a linking verb (impersonal)
const REFERENCE_IT_RE      = /^it\s+(?!(?:is|was|'s|were|will|can|could|should|would|may|might|seems?|appears?|looks?|feels?|turns?|comes?|makes?|helps?|takes?|gives?|has|had)\b)/i;

function isReferenceStart(text: string): boolean {
  return REFERENCE_PRONOUN_RE.test(text) || REFERENCE_IT_RE.test(text);
}

// ── Dangling end detection ──────────────────────────────────────────────────
// A unit ending on a preposition or coordinating/subordinating conjunction
// is incomplete — Deepgram sometimes inserts period boundaries at pauses mid-clause.
const DANGLING_END_RE = /\b(about|of|in|at|by|for|on|with|to|from|into|onto|through|and|but|or|so|because|that|which|who|when|where|if|though|although|since|until|unless|while|as|then|also|just|even|still|yet)\s*[.?!]?\s*$/i;

function hasDanglingEnd(text: string): boolean {
  return DANGLING_END_RE.test(text);
}

// ── Leading joiner trimming ─────────────────────────────────────────────────
// Strips sentence-initial connectives that carry no independent meaning.
// The trimmed text is what gets stored — not the original with the joiner.
const LEADING_JOINER_RE = /^(and|but|so|yet|however|therefore|thus|because|although|while|whereas|besides|moreover|furthermore|additionally|also|then|plus|rather|instead|otherwise|hence|consequently|accordingly|that said|as well|even so|mind you|now|anyway|right|well|ok|okay|so yeah|yeah so)\s+/i;

function trimLeadingJoiner(text: string): string {
  return text.replace(LEADING_JOINER_RE, '').trim();
}

// ── Clause boundary normaliser ──────────────────────────────────────────────
// Spoken workshop transcripts rarely have explicit sentence punctuation.
// This pre-pass converts common clause separators into sentence boundaries
// so the sentence tokeniser can find them.
//
// Rules applied (in order):
//   1. Semicolons → period + space
//   2. Em-dashes and double-hyphens → period + space
//   3. Conjunction + new-clause subject → insert period before the conjunction
//      e.g. "…industry and we need tools…" → "…industry. And we need tools…"
//      The subject pattern covers pronouns (I/we/they/he/she) and article openers
//      (the/a/an/our/their/this/that) that reliably introduce new independent clauses.
//      NOT triggered before "and culture" / "and metrics" (no subject after "and").
function normalizeClauseBoundaries(text: string): string {
  return (
    text
      // 1. Semicolons
      .replace(/;\s*/g, '. ')
      // 2. Em-dash and double-hyphen
      .replace(/\s*[—–]\s*/g, '. ')
      .replace(/\s+--\s+/g, '. ')
      // 3. Conjunction + new-clause subject
      //    Insert a sentence boundary before the conjunction when it is followed
      //    by a pronoun or article that introduces a new independent clause.
      .replace(
        /(\w)\s+(and|but|so|because|while|though|although|whereas)\s+(?=(I |we |they |he |she |the |a |an |our |their |this |that ))/gi,
        (_match, prevChar, conj) =>
          `${prevChar}. ${conj.charAt(0).toUpperCase()}${conj.slice(1)} `,
      )
      // 4. Parallel structure markers — each introduces a new independent idea
      //    "and also", "another thing", "on top of that", "at the same time" etc.
      .replace(
        /(\w)\s+(and also|also importantly|another thing is|on top of that|at the same time|equally|similarly|in addition|what's more|beyond that|more importantly|crucially|critically|the other thing|the key thing|the real issue|what I'd say is|what matters is|I would add|I'd also say)\s+/gi,
        (_match, prevChar, marker) =>
          `${prevChar}. ${marker.charAt(0).toUpperCase()}${marker.slice(1)} `,
      )
  );
}

// ── Sentence tokeniser ──────────────────────────────────────────────────────
// Splits on sentence-ending punctuation (. ? !) followed by whitespace +
// an uppercase letter, digit, or opening quote.
function tokenizeSentences(text: string): string[] {
  const parts = text.split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/);
  return parts.map(s => s.trim()).filter(s => s.length > 0);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Unit validation ─────────────────────────────────────────────────────────

export interface DiscardedUnit {
  originalText: string;
  reason: string;
}

function validateUnit(raw: string): { valid: true; text: string } | { valid: false; text: string; reason: string } {
  const text = trimLeadingJoiner(raw);

  if (wordCount(text) < MIN_WORDS)
    return { valid: false, text, reason: `too short (${wordCount(text)} words < ${MIN_WORDS})` };

  if (!hasFiniteVerb(text))
    return { valid: false, text, reason: 'no finite verb detected' };

  if (isReferenceStart(text))
    return { valid: false, text, reason: 'starts with reference pronoun — not self-contained' };

  if (hasDanglingEnd(text))
    return { valid: false, text, reason: 'dangling end — incomplete clause' };

  return { valid: true, text };
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface DeterministicSplitResult {
  /** Valid meaning units extracted from the passage. */
  units: string[];
  /** Units that were discarded and the reason each was rejected. */
  discarded: DiscardedUnit[];
  /** The original unmodified passage passed to the splitter. */
  originalText: string;
}

/**
 * Split a fully-resolved passage into deterministic meaning units.
 *
 * Returns `{ units: [text], discarded: [], originalText: text }` (no split)
 * when fewer than 2 valid units are found — a failed split never drops content.
 */
export function splitDeterministicSemanticUnits(text: string): DeterministicSplitResult {
  // Normalise clause boundaries so the tokeniser finds intra-sentence splits.
  // The original text is preserved in originalText; units are from the normalised form.
  const normalized = normalizeClauseBoundaries(text);
  const sentences = tokenizeSentences(normalized);

  // Single clause — nothing to split
  if (sentences.length <= 1) {
    return { units: [text], discarded: [], originalText: text };
  }

  const valid: string[] = [];
  const discarded: DiscardedUnit[] = [];

  for (const sentence of sentences) {
    const result = validateUnit(sentence);
    if (result.valid) {
      valid.push(result.text);
    } else {
      discarded.push({ originalText: sentence, reason: result.reason });
    }
  }

  // Require at least 2 valid units to return a split.
  // A single surviving unit means too much was discarded — return original.
  if (valid.length <= 1) {
    return { units: [text], discarded, originalText: text };
  }

  return { units: valid, discarded, originalText: text };
}

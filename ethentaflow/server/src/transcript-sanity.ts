// Transcript sanity checker.
//
// Deepgram's Nova-3 + smart_format can normalise filler words ("to", "ate",
// "ten/then") into digits, producing phantom number tokens that the downstream
// LLM then echoes back as if the participant said them.
//
// This module inspects word-level confidence on every final transcript, flags
// numeric tokens below a configurable threshold, and logs a warning.
// The transcript itself is NEVER modified — the flag is advisory only.

import type { DeepgramWord } from './types.js';

// Tokens that look like standalone numbers (integer, decimal, percentage, currency).
const NUMERIC_TOKEN_RE = /^\$?\d+([.,]\d+)?[%$]?$/;

// Words that look like numbers but are common legitimate words — never flagged.
// E.g. "a" as a spoken article can be ASR'd to "1" in edge cases; "I" → "1";
// "for" → "4"; "to" → "2".
// Numeric context matters but these are reliably safe single-digit false positives.
const PHANTOM_NUMBER_SOURCES = ['for', 'to', 'too', 'ate', 'won', 'ten', 'then', 'won'];

// Confidence floor below which a numeric token is treated as suspect.
// Configurable via ASR_NUMBER_CONFIDENCE_THRESHOLD (0–1). Default: 0.6.
const CONFIDENCE_THRESHOLD = (() => {
  const raw = process.env.ASR_NUMBER_CONFIDENCE_THRESHOLD;
  if (raw) {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) return parsed;
  }
  return 0.6;
})();

export interface WordFlag {
  word: string;
  confidence: number;
  start: number;
  end: number;
}

export interface TranscriptSanityResult {
  /** True if at least one numeric token has confidence < CONFIDENCE_THRESHOLD */
  hasLowConfidenceNumber: boolean;
  /** Numeric tokens that triggered the flag, with their confidence scores */
  lowConfidenceNumbers: WordFlag[];
  /** Lowest per-word confidence in this transcript (null if no words) */
  minWordConfidence: number | null;
}

/**
 * Inspect a Deepgram final transcript for low-confidence numeric tokens.
 *
 * Logs per-word confidence to the console for every final (one line, space-separated).
 * Emits a separate warning line for each flagged token.
 *
 * @param words    Word-level data from Deepgram (alt.words)
 * @param transcript  The assembled transcript string (for log context only)
 * @param isFinal  Only log the full word-confidence line for final transcripts
 */
export function checkTranscriptSanity(
  words: DeepgramWord[],
  transcript: string,
  isFinal: boolean,
): TranscriptSanityResult {
  if (!words.length) {
    return { hasLowConfidenceNumber: false, lowConfidenceNumbers: [], minWordConfidence: null };
  }

  const confidences = words.map((w) => w.confidence);
  const minWordConfidence = Math.min(...confidences);

  // ── Log per-word confidence for every final (concise: word:conf pairs) ──
  if (isFinal) {
    const wordLog = words
      .map((w) => {
        const display = w.punctuated_word ?? w.word;
        const conf = w.confidence.toFixed(2);
        // Bold-flag numeric tokens in the log line with a "!" prefix
        return NUMERIC_TOKEN_RE.test((w.punctuated_word ?? w.word).replace(/[.,!?]$/, ''))
          ? `!${display}:${conf}`
          : `${display}:${conf}`;
      })
      .join(' ');
    console.log(`[dg-words] ${wordLog}`);
  }

  // ── Flag numeric tokens below the confidence threshold ───────────────────
  const lowConfidenceNumbers: WordFlag[] = [];
  for (const w of words) {
    const bare = (w.punctuated_word ?? w.word).replace(/[.,!?]$/, '').toLowerCase();
    if (NUMERIC_TOKEN_RE.test(bare) && w.confidence < CONFIDENCE_THRESHOLD) {
      // Convert to number to check if it's outside the 1-5 maturity scale
      const num = parseFloat(bare.replace(/[$%,]/, ''));
      // Flag ALL low-confidence numerics. Outside 1-5 is especially suspicious.
      const outOfScale = !Number.isFinite(num) || num < 1 || num > 5;
      console.warn(
        `[transcript-sanity] ⚠ low-confidence numeric token "${w.punctuated_word ?? w.word}" ` +
          `conf=${w.confidence.toFixed(2)} (threshold=${CONFIDENCE_THRESHOLD})` +
          (outOfScale ? ' — OUTSIDE 1–5 scale, likely ASR artefact' : '') +
          ` | "${transcript.slice(0, 80)}"`,
      );
      lowConfidenceNumbers.push({
        word: w.punctuated_word ?? w.word,
        confidence: w.confidence,
        start: w.start,
        end: w.end,
      });
    }
  }

  return {
    hasLowConfidenceNumber: lowConfidenceNumbers.length > 0,
    lowConfidenceNumbers,
    minWordConfidence,
  };
}

/** Export threshold for use in tests or status endpoints */
export const ASR_CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLD;

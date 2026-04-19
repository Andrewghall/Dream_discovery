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
 *   1. Consecutive word repetition ≥ 3    — ASR loop artefact
 *   2. False start pattern                — speaker restated; boundary misplaced
 *
 * Defective sentence ratio check has been removed — structural quality is now
 * evaluated per-unit by the unit quality gate AFTER semantic splitting.
 * The passage gate only blocks unrecoverable ASR garbage before splitting.
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

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the passage quality gate on a fully resolved passage.
 *
 * Passages shorter than 10 words are skipped (handled upstream by commit guard).
 * Only unrecoverable ASR garbage is rejected here — structural/semantic quality
 * is evaluated per-unit by the unit quality gate AFTER semantic splitting.
 */
export function checkPassageQuality(text: string): PassageQualityResult {
  const trimmed = text.trim();
  const totalWords = wordCount(trimmed);

  // Too short — leave to existing guards
  if (totalWords < 10) return { pass: true, reason: null, score: 1.0 };

  // ── 1. Consecutive word repetition ─────────────────────────────────────
  // Three or more back-to-back instances of the same word = ASR stuck in a loop.
  // Threshold is 3 (not 2) to avoid false positives on natural repetition
  // like "very very" or "really really".
  const repeatMatches = trimmed.match(/\b(\w{2,})\s+\1\b/gi) ?? [];
  if (repeatMatches.length >= 3) {
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

  // Defective sentence ratio check removed.
  // Structural quality is evaluated per-unit by the unit quality gate
  // AFTER semantic splitting — messy passages may contain valid child units.

  return { pass: true, reason: null, score: 1.0 };
}

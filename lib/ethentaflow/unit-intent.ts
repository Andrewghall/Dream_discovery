/**
 * Rule-based intent classification for resolved meaning units.
 *
 * No LLM. No rewriting. Text is never modified.
 *
 * Priority order: question → example → analogy → insight (default)
 */

export type UnitIntent = 'insight' | 'example' | 'analogy' | 'question';

// ── Question ────────────────────────────────────────────────────────────────
// Ends with "?" or opens with an interrogative word.
const QUESTION_START_RE = /^(how|why|what|when|where|who|which|could|can|should|would|do|does|did|is|are|was|were|will|have|has|had|may|might|shall|must)\b/i;

// ── Example ─────────────────────────────────────────────────────────────────
// Explicit narrative or illustrative markers.
const EXAMPLE_RE = /\b(for example|for instance|as an example|to illustrate|i was in\b|i remember\b|i recall\b|i had a\b|i had an\b|i once\b|there was a time|we had a\b|we had an\b|we were in\b|take the case|in one case\b|in a recent\b|i worked with\b|i met with\b|i spoke to\b|i was working\b|we were working\b|in a situation|in that situation|at one point\b|back when\b|last year\b|last month\b|recently\b|the other day\b|i saw\b|we saw\b|i noticed\b|we noticed\b|a client\b|a customer\b|a manager\b|one of my\b|one of our\b|one of the\b)/i;

// ── Analogy ──────────────────────────────────────────────────────────────────
// Comparison or cross-domain reference markers.
const ANALOGY_RE = /\b(it'?s like\b|just like\b|similar to\b|like a \b|like an \b|like when\b|like how\b|as if\b|think of it as\b|is like\b|was like\b|imagine\b|picture\b|in the same way\b|in a similar way\b|analogous\b|the equivalent\b|like in\b|like the\b|reminds me of\b|not unlike\b|comparable to\b)/i;

/**
 * Classify a single resolved meaning unit into one of four intent types.
 * Returns 'insight' when no specific marker is detected.
 */
export function classifyUnitIntent(text: string): UnitIntent {
  const trimmed = text.trim();

  // Question — highest priority
  if (trimmed.endsWith('?')) return 'question';
  if (QUESTION_START_RE.test(trimmed)) return 'question';

  // Example — explicit narrative/illustrative framing
  if (EXAMPLE_RE.test(trimmed)) return 'example';

  // Analogy — comparison framing
  if (ANALOGY_RE.test(trimmed)) return 'analogy';

  // Default
  return 'insight';
}

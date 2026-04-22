/**
 * Shared question set validation.
 * Used by both the prep/questions PUT route and enforcement tests
 * so that any change to validation is caught by the test suite.
 *
 * VALIDATION ARCHITECTURE:
 * - Content checks (FINANCIAL_TERMS, ROLE_SPECIFIC_TERMS, ABSTRACT_LANGUAGE, COMBINED_CONCEPTS)
 *   protect compliance requirements: no financial analysis, no role-specific questioning,
 *   no abstract organisational language. These are the compliance-critical checks.
 *
 * - Starter check (INSTRUCTIONAL_OPENERS) ensures questions are actual questions, not
 *   facilitator instructions or declarative statements. Uses a DENYLIST of non-question
 *   openers rather than an allowlist, so all natural English question forms are valid.
 *   This prevents "Consider the impact of...", "Describe how..." etc. while allowing
 *   "What happens...", "Where do you see...", "How does...", "Across the team...", etc.
 */

export const REQUIRED_QUESTION_PHASES = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as const;

// "cost" and "costs" are everyday operational words — banned terms target pure finance/strategy analysis
const FINANCIAL_TERMS = /\b(roi|ebitda|margin|margins|cash flow|p&l|budget|budgets|funding|investment|investments|invest|revenue|profit|profitability|financial performance|investment discipline|strategy effectiveness|payback|opex|capex)\b/i;
const ROLE_SPECIFIC_TERMS = /\b(board|c-suite|executive committee|shareholder|investor|leadership decisions?|capital allocation|esg|corporate strategy|enterprise strategy)\b/i;
const ABSTRACT_LANGUAGE = /\b(systemic inefficienc|organisational structure|strategic alignment|operational strategy|leadership effectiveness|financial performance)\b/i;
const COMBINED_CONCEPTS = /\b(effective and efficient|efficiency and effectiveness)\b/i;

// Blocks declarative statements, facilitator instructions, and imperative openers.
// These are NOT questions — they're directives, declarations, or meta-commentary.
// Any opener not in this list is accepted as a valid question form.
const INSTRUCTIONAL_OPENERS = /^(consider|imagine|describe|think about|reflect on|tell me|please |let's|we need|the team should|the goal is|focus on|note that|remember that|it is important|in order to|the purpose|now let's|your task is|building on|leveraging|driving|delivering|ensuring|achieving|firstly|secondly|thirdly|you should|they should|participants should|the facilitator)/i;

export function validateFacilitationQuestionText(text: string, lens?: string | null, isSubQuestion?: boolean): string | null {
  const normalizedText = text.trim();
  if (!normalizedText) return 'Question text is empty';
  if (FINANCIAL_TERMS.test(normalizedText)) return 'Question contains forbidden financial or strategy terminology';
  if (ROLE_SPECIFIC_TERMS.test(normalizedText)) return 'Question requires role-specific knowledge';
  if (ABSTRACT_LANGUAGE.test(normalizedText)) return 'Question uses abstract or non-observable language';
  if (COMBINED_CONCEPTS.test(normalizedText)) return 'Question combines multiple abstract concepts';
  if (INSTRUCTIONAL_OPENERS.test(normalizedText)) {
    return 'Question must be a genuine question, not an instruction or declarative statement';
  }

  return null;
}

/**
 * Validates a question set before persistence.
 * Returns null on success, or an error string on failure.
 * Rules:
 *   - Must be a non-null object with a `phases` property
 *   - All three required phases must be present
 *   - Each phase must have at least one question
 *   - Questions must pass content checks (no financial, role, or abstract language)
 *
 * Validation order:
 *   1. Structural checks (all required phases present, each has ≥1 question)
 *   2. Per-question text checks
 * This ensures "missing phase" errors are reported before text-level failures.
 */
export function validateQuestionSet(qs: unknown): string | null {
  if (!qs || typeof qs !== 'object' || Array.isArray(qs)) {
    return 'customQuestions must be a non-null object';
  }
  const obj = qs as Record<string, unknown>;
  if (!obj.phases || typeof obj.phases !== 'object' || Array.isArray(obj.phases)) {
    return 'customQuestions.phases is missing or malformed';
  }
  const phases = obj.phases as Record<string, unknown>;

  // --- Pass 1: structural integrity (phase presence + non-empty) ---
  for (const phase of REQUIRED_QUESTION_PHASES) {
    if (!(phase in phases)) {
      return `Missing required phase: ${phase}`;
    }
    const p = phases[phase];
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      return `Phase ${phase} is malformed`;
    }
    const phaseObj = p as Record<string, unknown>;
    if (!Array.isArray(phaseObj.questions) || phaseObj.questions.length === 0) {
      return `Phase ${phase} has no questions — incomplete question sets cannot be saved`;
    }
  }

  // --- Pass 2: per-question text validation ---
  for (const phase of REQUIRED_QUESTION_PHASES) {
    const phaseObj = (phases[phase] as Record<string, unknown>);
    const questions = phaseObj.questions as unknown[];

    for (const [index, question] of questions.entries()) {
      if (!question || typeof question !== 'object' || Array.isArray(question)) {
        return `Phase ${phase} question ${index + 1} is malformed`;
      }
      const questionObj = question as Record<string, unknown>;
      const lens = typeof questionObj.lens === 'string' ? questionObj.lens : null;
      const text = typeof questionObj.text === 'string' ? questionObj.text : '';
      const validationError = validateFacilitationQuestionText(text, lens, false);
      if (validationError) {
        return `Phase ${phase} question ${index + 1} failed validation: ${validationError}`;
      }

      const subQuestions = Array.isArray(questionObj.subQuestions) ? questionObj.subQuestions : [];
      for (const [subIndex, subQuestion] of subQuestions.entries()) {
        if (!subQuestion || typeof subQuestion !== 'object' || Array.isArray(subQuestion)) {
          return `Phase ${phase} question ${index + 1} sub-question ${subIndex + 1} is malformed`;
        }
        const subQuestionObj = subQuestion as Record<string, unknown>;
        const subLens = typeof subQuestionObj.lens === 'string' ? subQuestionObj.lens : lens;
        const subText = typeof subQuestionObj.text === 'string' ? subQuestionObj.text : '';
        const subValidationError = validateFacilitationQuestionText(subText, subLens, true);
        if (subValidationError) {
          return `Phase ${phase} question ${index + 1} sub-question ${subIndex + 1} failed validation: ${subValidationError}`;
        }
      }
    }
  }

  return null;
}

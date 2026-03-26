/**
 * Shared question set validation.
 * Used by both the prep/questions PUT route and enforcement tests
 * so that any change to validation is caught by the test suite.
 */

export const REQUIRED_QUESTION_PHASES = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as const;

/**
 * Validates a question set before persistence.
 * Returns null on success, or an error string on failure.
 * Rules:
 *   - Must be a non-null object with a `phases` property
 *   - All three required phases must be present
 *   - Each phase must have at least one question
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
  return null;
}

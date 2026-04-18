import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';

export type SemanticGateResult = {
  selfContained: boolean;
  reason: string;
};

/**
 * Server-side semantic gate — runs before domain classification.
 *
 * Evaluates whether a captured statement is a complete, self-contained
 * business thought. Fragments that depend on prior context, unresolved
 * pronouns, or dangling clauses are rejected before they become nodes.
 */
export async function isStatementSelfContained(
  statement: string,
  recentContext: Array<{ speaker: string | null; text: string }>,
): Promise<SemanticGateResult> {
  // Hard-fail open if no API key — do not block commits in dev
  if (!env.OPENAI_API_KEY) {
    return { selfContained: true, reason: 'no API key — gate skipped' };
  }

  const contextBlock = recentContext.length > 0
    ? recentContext.map((u, i) => `${i + 1}. ${u.speaker ?? 'Unknown'}: "${u.text}"`).join('\n')
    : '(no prior context)';

  const prompt = `You are evaluating whether a spoken statement is a complete, self-contained business thought.

A valid thought must:
- stand alone without needing prior conversation
- contain a clear idea, problem, or action
- not rely on unresolved references (this, that, those, he, they, etc.)
- not be a partial clause or continuation
- contain a business-relevant signal: a problem, constraint, cause, or actionable intent

If the statement is self-contained but carries no business-relevant signal — for example, it is social filler, a transition phrase, an affirmation, a greeting, or a generic observation with no operational meaning — return selfContained: false.

Given:
Recent context:
${contextBlock}

Statement:
"${statement}"

Question:
Can this statement stand alone as a meaningful, self-contained business thought with a relevant signal?

Return:
{
  "selfContained": true | false,
  "reason": "short explanation"
}`;

  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const completion = await openAiBreaker.execute(() =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      })
    );

    const raw = completion.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<SemanticGateResult>;

    return {
      selfContained: parsed.selfContained === true,
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'no reason returned',
    };
  } catch (err) {
    // Fail closed — an unknown state must not create a node.
    // The fragment will be held in the pending-merge cache and reconsidered
    // when the next statement from the same speaker arrives.
    console.warn('[SemanticGate] Error — failing closed:', err instanceof Error ? err.message : err);
    return { selfContained: false, reason: 'gate error — failing closed' };
  }
}

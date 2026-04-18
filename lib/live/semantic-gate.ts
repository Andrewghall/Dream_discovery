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

Given:
Recent context:
${contextBlock}

Statement:
"${statement}"

Question:
Can this statement stand alone as a meaningful, self-contained thought?

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
    // Fail open — never block a commit due to gate error
    console.warn('[SemanticGate] Error — failing open:', err instanceof Error ? err.message : err);
    return { selfContained: true, reason: 'gate error — failing open' };
  }
}

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';

/**
 * Extract all distinct meaning units from a spoken workshop passage.
 *
 * Uses GPT-4o-mini to find every separate idea the speaker expressed.
 * Biases heavily toward MORE units — a rich passage of 200 words may
 * contain 6–8 independent meaning units and all of them should be recovered.
 *
 * Falls back to [text] on any error or missing API key.
 */
export async function splitIntoSemanticUnits(text: string): Promise<string[]> {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  // Too short to split — skip LLM call
  if (wordCount < 15) return [text];

  if (!env.OPENAI_API_KEY) return [text];

  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const result = await openAiBreaker.execute(() =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 1600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You extract meaning units from spoken workshop transcripts. These are raw, unedited transcriptions of live speech.

A meaning unit is a single standalone idea: an observation, insight, constraint, recommendation, question, or principle that can be understood independently.

YOUR TASK: Identify and return EVERY distinct idea the speaker expressed.
- If the speaker made 3 separate points, return 3 units.
- If the speaker made 7 separate points, return 7 units.
- Never collapse multiple distinct ideas into one unit.

SPLIT when you see:
- A new claim or observation that adds a different point
- A separate recommendation or principle
- A distinct constraint or problem
- A different insight, even if topically related to the previous one

KEEP TOGETHER (do not split) only when:
- A cause and its direct effect form a single complete thought that neither part can express alone
- A short qualifier that only makes sense attached to its parent sentence

NEVER suppress a unit because it seems obvious, vague, or short.
If it is a distinct idea the speaker voiced, extract it.

Return JSON: {"units": ["<unit1>", ..., "<unitN>"]}
Rules:
- 1 unit if the entire passage is a single continuous thought
- 2–8 units when multiple distinct ideas are present
- Each unit ≥ 6 words
- Preserve the speaker's exact words in every unit
- Strip only leading/trailing disfluencies ("um", "uh", orphan "and"/"so") at split boundaries`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
      })
    );

    const raw = result.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { units?: unknown };

    if (!Array.isArray(parsed.units) || parsed.units.length === 0) {
      console.log('[SemanticSplitter] GPT returned empty/invalid units — no split');
      return [text];
    }

    const raw_units = (parsed.units as unknown[]).map(u => String(u).trim());
    const units = raw_units.filter(u => u.split(/\s+/).filter(Boolean).length >= 6);

    console.log(`[SemanticSplitter] GPT returned ${raw_units.length} unit(s), ${units.length} passed ≥6-word filter`);
    raw_units.forEach((u, i) => {
      const wc = u.split(/\s+/).filter(Boolean).length;
      const pass = wc >= 6;
      console.log(`  [${pass ? '✓' : '✗'}] (${wc}w) "${u.substring(0, 80)}"`);
    });

    if (units.length <= 1) {
      console.log('[SemanticSplitter] ≤1 unit after filter — returning original text');
      return [text];
    }

    return units.slice(0, 8);
  } catch (err) {
    console.error('[SemanticSplitter] Error calling OpenAI:', err instanceof Error ? err.message : String(err));
    return [text];
  }
}

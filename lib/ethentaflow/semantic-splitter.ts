import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';

/**
 * Detect whether a resolved spoken passage contains multiple DISTINCT semantic
 * units. If so, return each unit as a separate string. Otherwise return [text].
 *
 * Splitting rules:
 *   - Split only when each segment is independently valuable as a hemisphere node
 *   - Do NOT split: one thesis + supporting evidence, cause-effect for one observation
 *   - DO split: separate insights, separate constraints, separate recommendations
 *   - Max 4 units; each unit ≥ 15 words
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
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You analyze spoken passages from business discovery workshops.

Determine if the passage contains MULTIPLE DISTINCT complete ideas — each independently valuable as a separate insight, observation, constraint, or recommendation.

SPLIT when the passage makes 2–4 separate, independently meaningful points that address DIFFERENT topics, perspectives, or actionable areas.

DO NOT SPLIT when:
- One main thesis with supporting evidence or elaboration
- A cause-effect chain for a single observation
- A list of examples supporting one claim
- Clarification or continuation of a single point

Return JSON: {"units": ["<unit1>", "<unit2>", ...]}
Rules:
- 1 unit = not split (return the original text unchanged)
- 2–4 units = split (each a complete standalone thought)
- Each unit must be at least 10 words
- Strip trailing disfluencies ("um", "uh", trailing "and") from unit boundaries only
- BIAS TOWARD SPLITTING: if in doubt, split — multiple weak units are better than one lost passage

CRITICAL — DATA INTEGRITY:
You are a SEGMENTER, not a summarizer or paraphraser.
You MUST NOT add, infer, rephrase, or rewrite ANY content.
Copy sentences verbatim from the input — do not substitute synonyms, add connecting words, or infer meaning.
Every non-trivial word in every unit MUST appear in the input text.
If you cannot split without rewriting, return the original text as a single unit.`,
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

    if (!Array.isArray(parsed.units) || parsed.units.length === 0) return [text];

    const rawUnits = (parsed.units as unknown[])
      .map(u => String(u).trim())
      .filter(u => u.split(/\s+/).filter(Boolean).length >= 10);

    // Reject any unit where the LLM introduced words not present in the source.
    // gpt-4o-mini rewrites ASR-fragmented text instead of segmenting it, which
    // produces plausible-sounding but fabricated content. Require ≥70% of the
    // unit's words to appear in the original text; fall back to [text] if any
    // unit fails — it's safer to keep the raw passage than emit hallucinated nodes.
    const sourceWords = new Set(
      text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    );
    const allUnitsGrounded = rawUnits.every(unit => {
      const unitWords = unit.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      if (unitWords.length === 0) return false;
      const overlap = unitWords.filter(w => sourceWords.has(w)).length;
      return overlap / unitWords.length >= 0.70;
    });

    if (!allUnitsGrounded) return [text];

    const units = rawUnits;

    if (units.length <= 1) return [text];

    return units.slice(0, 4);
  } catch {
    return [text];
  }
}

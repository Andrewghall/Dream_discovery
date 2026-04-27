// reaction-generator.ts
// Generates a brief (≤8 word) natural reaction to what the user just said.
// Prepended to the probe question so the exchange feels like conversation,
// not a questionnaire.

import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a warm and perceptive AI having a real conversation with a senior business professional.

The human just said something. Generate ONE brief natural reaction — a statement that shows you genuinely heard them. Then stop. The question comes separately.

Rules:
- Maximum 8 words
- NEVER start with: Great, Interesting, Fascinating, Absolutely, I see, I understand, Okay, Right, Noted, Sure, Indeed, Certainly, Of course, Wow
- Use contractions: That's, It's, You've, They're, There's
- Be specific to what they said — not generic validating filler
- Sound like a sharp colleague reacting, not a therapist validating
- No padding, no fluff
- Do NOT ask a question — statement only

Return ONLY the reaction sentence. No quotes. End with a full stop.`;

// Patterns that indicate a generic/filler reaction — discard these
const FILLER_RE = /^(great|interesting|fascinating|absolutely|i see|i understand|okay|right|noted|sure|indeed|certainly|of course|wow|that('?s| is) (great|interesting|fascinating|good|very|quite))/i;

export class ReactionGenerator {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Generate a brief natural reaction to the user's utterance.
   * Returns null if generation fails or produces filler — caller should
   * omit the reaction and speak the probe directly.
   */
  async generate(userUtterance: string, lastProbe: string | null): Promise<string | null> {
    // Don't bother generating a reaction to very short utterances
    if (userUtterance.trim().split(/\s+/).length < 6) return null;

    try {
      const context = lastProbe
        ? `You asked: "${lastProbe}"\nThey responded: "${userUtterance}"`
        : `They said: "${userUtterance}"`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 25,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: context },
        ],
      });

      const raw = (response.choices[0]?.message?.content ?? '').trim();

      // Strip wrapping quotes if any
      const text = raw.replace(/^["']|["']$/g, '').trim();

      if (!text) return null;

      // Must not be a question
      if (text.includes('?')) return null;

      // Word count guard: 1–9 words
      const wordCount = text.split(/\s+/).length;
      if (wordCount < 2 || wordCount > 9) return null;

      // Discard generic filler
      if (FILLER_RE.test(text)) return null;

      return text;
    } catch {
      // Never surface errors — reaction is optional
      return null;
    }
  }
}

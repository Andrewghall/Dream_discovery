import OpenAI from 'openai';

import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';

function safeIntent(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, 48);
}

export async function deriveIntent(params: {
  text: string;
  recentContext?: Array<{ speaker: string | null; text: string }>;
}): Promise<string | null> {
  const cleaned = (params.text || '').trim();
  if (!cleaned) return null;

  if (!env.OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Build messages array with conversation context
  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  // Add conversation history if provided
  if (params.recentContext && params.recentContext.length > 0) {
    messages.push({
      role: 'system',
      content: 'Here is recent conversation context for reference. Use this to understand the speaker\'s intent in context of the ongoing dialogue.',
    });

    params.recentContext.forEach((msg) => {
      const speaker = msg.speaker || 'Unknown';
      messages.push({
        role: 'user',
        content: `${speaker}: ${msg.text}`,
      });
    });
  }

  // Add current intent detection request
  const prompt = `Label the speaker intent of the following workshop utterance.

Return strict JSON with key:
- intent (string or null)

The intent should be a short label (1-3 words) suitable for coloring in a live UI.

Text:\n${JSON.stringify(cleaned)}`;

  messages.push({ role: 'user', content: prompt });

  const completion = await openAiBreaker.execute(() => openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages,
    response_format: { type: 'json_object' },
  }));

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let obj: unknown = {};
  try {
    obj = JSON.parse(raw) as unknown;
  } catch {
    obj = {};
  }

  const rec: Record<string, unknown> =
    obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};

  return safeIntent(rec.intent);
}

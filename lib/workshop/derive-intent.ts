import OpenAI from 'openai';

import { env } from '@/lib/env';

function safeIntent(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, 48);
}

export async function deriveIntent(params: { text: string }): Promise<string | null> {
  const cleaned = (params.text || '').trim();
  if (!cleaned) return null;

  if (!env.OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const prompt = `Label the speaker intent of the following workshop utterance.

Return strict JSON with key:
- intent (string or null)

The intent should be a short label (1-3 words) suitable for coloring in a live UI.

Text:\n${JSON.stringify(cleaned)}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

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

import OpenAI from 'openai';

import { env } from '@/lib/env';

type DataPointPrimaryType =
  | 'VISIONARY'
  | 'OPPORTUNITY'
  | 'CONSTRAINT'
  | 'RISK'
  | 'ENABLER'
  | 'ACTION'
  | 'QUESTION'
  | 'INSIGHT';

function safePrimaryType(v: string): DataPointPrimaryType {
  const upper = (v || '').toUpperCase();
  const allowed: Record<string, DataPointPrimaryType> = {
    VISIONARY: 'VISIONARY',
    OPPORTUNITY: 'OPPORTUNITY',
    CONSTRAINT: 'CONSTRAINT',
    RISK: 'RISK',
    ENABLER: 'ENABLER',
    ACTION: 'ACTION',
    QUESTION: 'QUESTION',
    INSIGHT: 'INSIGHT',
  };
  return allowed[upper] || 'INSIGHT';
}

export async function classifyDataPoint(params: {
  text: string;
  recentContext?: Array<{ speaker: string | null; text: string }>;
}): Promise<{
  primaryType: DataPointPrimaryType;
  confidence: number | null;
  keywords: string[];
  suggestedArea: string | null;
}> {
  const cleaned = (params.text || '').trim();

  // Fallback for local development / if key missing.
  if (!env.OPENAI_API_KEY) {
    return {
      primaryType: 'INSIGHT',
      confidence: null,
      keywords: [],
      suggestedArea: null,
    };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Build messages array with conversation context
  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  // Add conversation history if provided
  if (params.recentContext && params.recentContext.length > 0) {
    messages.push({
      role: 'system',
      content: 'Here is recent conversation context for reference. Use this to understand pronouns, references, and conversational continuity when classifying the current statement.',
    });

    params.recentContext.forEach((msg) => {
      const speaker = msg.speaker || 'Unknown';
      messages.push({
        role: 'user',
        content: `${speaker}: ${msg.text}`,
      });
    });
  }

  // Add current classification request
  const prompt = `Classify this workshop statement into a primary type and suggest an area.

Primary types: Visionary, Opportunity, Constraint, Risk, Enabler, Action, Question, Insight.

Return strict JSON with keys:
- primaryType (string)
- confidence (number 0-1): how clearly the statement fits the assigned type.
  0.85-1.0 = very clearly fits (explicit language, unmistakable intent)
  0.65-0.84 = fits well (clear from context even if indirect language)
  0.45-0.64 = moderate fit (ambiguous, could be multiple types)
  Below 0.45 = weak fit (very unclear). For typical workshop speech, default to ~0.75 not 0.5.
- keywords (array of 0-8 short strings)
- suggestedArea (string or null)

Text:\n${JSON.stringify(cleaned)}`;

  messages.push({ role: 'user', content: prompt });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages,
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

  const primaryType = safePrimaryType(typeof rec.primaryType === 'string' ? rec.primaryType : '');
  const confidence = typeof rec.confidence === 'number' ? Math.max(0, Math.min(1, rec.confidence)) : null;
  const keywords = Array.isArray(rec.keywords)
    ? rec.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 8)
    : [];
  const suggestedArea = rec.suggestedArea ? String(rec.suggestedArea).trim() : null;

  return { primaryType, confidence, keywords, suggestedArea };
}

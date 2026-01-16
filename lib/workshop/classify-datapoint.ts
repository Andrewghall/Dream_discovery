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

  const prompt = `Classify this workshop statement into a primary type and suggest an area.

Primary types: Visionary, Opportunity, Constraint, Risk, Enabler, Action, Question, Insight.

Return strict JSON with keys:
- primaryType (string)
- confidence (number 0-1 or null)
- keywords (array of 0-8 short strings)
- suggestedArea (string or null)

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

  const primaryType = safePrimaryType(typeof rec.primaryType === 'string' ? rec.primaryType : '');
  const confidence = typeof rec.confidence === 'number' ? Math.max(0, Math.min(1, rec.confidence)) : null;
  const keywords = Array.isArray(rec.keywords)
    ? rec.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 8)
    : [];
  const suggestedArea = rec.suggestedArea ? String(rec.suggestedArea).trim() : null;

  return { primaryType, confidence, keywords, suggestedArea };
}

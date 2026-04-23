import OpenAI from 'openai';
import { SEMANTIC_UNIT_SYSTEM_PROMPT, buildSemanticUnitUserPrompt } from '@/lib/live/semantic-unit-prompt';

// Semantic unit extractor.
// Produces render-safe business meaning units from committed spoken evidence.
// The DataPoint remains the canonical evidence artifact; these units are for
// in-memory interpretation and hemisphere placement only.

export interface MeaningUnit {
  extractedText: string;
  sourceStart: number;
  sourceEnd: number;
  confidence: number;
}

export type DiscardReason =
  | 'rapport'
  | 'filler'
  | 'hesitation'
  | 'meta_commentary'
  | 'incomplete'
  | 'moderator_handoff'
  | 'unresolved_reference';

export interface DiscardedSpan {
  reason: DiscardReason;
  text: string;
}

export interface ExtractionResult {
  units: MeaningUnit[];
  discarded: DiscardedSpan[];
  fallback: boolean;   // true if LLM failed and full passage was returned as-is
}

type RawExtraction = {
  units?: Array<{
    text?: unknown;
    extractedText?: unknown;
    quality?: Record<string, unknown>;
    sourceStart?: unknown;
    sourceEnd?: unknown;
    confidence?: unknown;
  }>;
  discarded?: Array<{ reason?: unknown; text?: unknown }>;
};

function findBestSpan(passage: string, extractedText: string): { start: number; end: number } {
  // Exact match first
  const exact = passage.indexOf(extractedText);
  if (exact !== -1) return { start: exact, end: exact + extractedText.length };

  // Case-insensitive match
  const lower = passage.toLowerCase();
  const targetLower = extractedText.toLowerCase();
  const ci = lower.indexOf(targetLower);
  if (ci !== -1) return { start: ci, end: ci + extractedText.length };

  // Best-effort: find the longest common prefix in passage
  // Fall back to the full passage span
  return { start: 0, end: passage.length };
}

function validateSpan(passage: string, start: number, end: number, extractedText: string): { start: number; end: number } {
  if (
    typeof start === 'number' &&
    typeof end === 'number' &&
    start >= 0 &&
    end > start &&
    end <= passage.length &&
    passage.slice(start, end).toLowerCase() === extractedText.toLowerCase()
  ) {
    return { start, end };
  }
  return findBestSpan(passage, extractedText);
}

export async function extractMeaningUnits(passage: string): Promise<ExtractionResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[MeaningExtractor] OPENAI_API_KEY not set — falling back to full passage for ingest continuity');
    return {
      units: [{ extractedText: passage, sourceStart: 0, sourceEnd: passage.length, confidence: 1.0 }],
      discarded: [],
      fallback: true,
    };
  }

  let raw: RawExtraction;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SEMANTIC_UNIT_SYSTEM_PROMPT },
        { role: 'user', content: buildSemanticUnitUserPrompt(passage) },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? '{}';
    raw = JSON.parse(content) as RawExtraction;
  } catch (err) {
    console.error('[MeaningExtractor] LLM call failed — falling back to full passage:', err);
    return {
      units: [{ extractedText: passage, sourceStart: 0, sourceEnd: passage.length, confidence: 1.0 }],
      discarded: [],
      fallback: true,
    };
  }

  const units: MeaningUnit[] = [];
  if (Array.isArray(raw.units)) {
    for (const u of raw.units) {
      const extractedText =
        typeof u.text === 'string'
          ? u.text.trim()
          : typeof u.extractedText === 'string'
            ? u.extractedText.trim()
            : null;
      if (!extractedText) continue;

      const rawStart = typeof u.sourceStart === 'number' ? u.sourceStart : -1;
      const rawEnd = typeof u.sourceEnd === 'number' ? u.sourceEnd : -1;
      const { start, end } = validateSpan(passage, rawStart, rawEnd, extractedText);

      const quality = u.quality ?? {};
      const passesQualityGate =
        quality.self_contained === true &&
        quality.complete_thought === true &&
        quality.non_fragment === true &&
        quality.non_filler === true &&
        quality.business_meaningful === true &&
        quality.no_external_dependency === true;

      if (!passesQualityGate) continue;

      units.push({
        extractedText,
        sourceStart: start,
        sourceEnd: end,
        confidence: typeof u.confidence === 'number' ? Math.min(1, Math.max(0, u.confidence)) : 0.9,
      });
    }
  }

  const discarded: DiscardedSpan[] = [];
  if (Array.isArray(raw.discarded)) {
    for (const d of raw.discarded) {
      const text = typeof d.text === 'string' ? d.text.trim() : null;
      if (!text) continue;
      const validReasons: DiscardReason[] = ['rapport', 'filler', 'hesitation', 'meta_commentary', 'incomplete', 'moderator_handoff', 'unresolved_reference'];
      const reason = validReasons.includes(d.reason as DiscardReason) ? (d.reason as DiscardReason) : 'filler';
      discarded.push({ reason, text });
    }
  }

  console.log('[MeaningExtractor]', {
    passageLength: passage.length,
    unitsExtracted: units.length,
    discardedCount: discarded.length,
    units: units.map(u => ({ len: u.extractedText.length, conf: u.confidence, text: u.extractedText.substring(0, 60) })),
    discarded: discarded.map(d => ({ reason: d.reason, text: d.text.substring(0, 40) })),
  });

  return { units, discarded, fallback: false };
}

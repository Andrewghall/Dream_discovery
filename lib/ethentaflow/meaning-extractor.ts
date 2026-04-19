import OpenAI from 'openai';

// ══════════════════════════════════════════════════════════════════════════════
// Meaning Extractor
//
// Sits between TSM commit and DataPoint creation.
// Takes a full committed passage and returns 0–N meaning units.
//
// Rules (enforced by prompt + validation):
//   1. Near-verbatim extraction only — no paraphrase, no summarisation.
//   2. Each unit must be a generalisable insight anchored to the speaker's words.
//   3. Discard: rapport, filler, hesitation, meta commentary, incomplete phrases,
//      moderator handoffs.
//   4. If no valid unit exists, return empty array → no DataPoint created.
//   5. Fallback: if extraction fails, return the full passage as a single unit
//      so the pipeline never goes dark.
// ══════════════════════════════════════════════════════════════════════════════

export interface MeaningUnit {
  extractedText: string;
  sourceStart: number;   // char offset into the original passage
  sourceEnd: number;     // char offset into the original passage
  confidence: number;
}

export type DiscardReason =
  | 'rapport'
  | 'filler'
  | 'hesitation'
  | 'meta_commentary'
  | 'incomplete'
  | 'moderator_handoff';

export interface DiscardedSpan {
  reason: DiscardReason;
  text: string;
}

export interface ExtractionResult {
  units: MeaningUnit[];
  discarded: DiscardedSpan[];
  fallback: boolean;   // true if LLM failed and full passage was returned as-is
}

const SYSTEM_PROMPT = `You extract meaning units from verbatim speech transcripts.

A MEANING UNIT is:
- A generalisable insight, observation, or claim about how the world works
- Grounded in the speaker's direct experience or stated knowledge
- Self-contained: a reader with no prior context can understand it
- Expressed in the speaker's actual words — near-verbatim, not rewritten or improved

ALWAYS DISCARD the following (never include in any unit):
- Rapport and social pleasantries ("I love that you're a pilot", "thanks for sharing")
- Filler words and hesitation markers ("um", "uh", "I mean", "you know")
- Meta commentary about the conversation or the speaker's own process
- Incomplete phrases that don't form a coherent, standalone thought
- Moderator handoffs, transitions, and procedural statements
- Personal compliments and non-generalisable asides

EXTRACTION RULES:
1. Near-verbatim. Do NOT paraphrase, summarise, or improve the language.
2. You may lightly stitch adjacent ASR fragments where the boundary is an ASR artifact
   (e.g. "the technology was. Outdated." → "the technology was outdated") but never
   rephrase the substance or add words that were not said.
3. Do not invent wording. Every word in extractedText must appear in the passage.
4. sourceStart and sourceEnd are character offsets into the original passage (0-indexed, exclusive end).
5. If the passage contains no valid meaning unit, return an empty units array.

OUTPUT: valid JSON only, no prose.

{
  "units": [
    {
      "extractedText": "near-verbatim text from passage",
      "sourceStart": 0,
      "sourceEnd": 100,
      "confidence": 0.9
    }
  ],
  "discarded": [
    { "reason": "rapport", "text": "..." }
  ]
}

Valid discard reasons: rapport | filler | hesitation | meta_commentary | incomplete | moderator_handoff`;

type RawExtraction = {
  units?: Array<{ extractedText?: unknown; sourceStart?: unknown; sourceEnd?: unknown; confidence?: unknown }>;
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
    console.warn('[MeaningExtractor] OPENAI_API_KEY not set — falling back to full passage');
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
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract meaning units from this passage:\n\n${passage}`,
        },
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
      const extractedText = typeof u.extractedText === 'string' ? u.extractedText.trim() : null;
      if (!extractedText) continue;

      const rawStart = typeof u.sourceStart === 'number' ? u.sourceStart : -1;
      const rawEnd = typeof u.sourceEnd === 'number' ? u.sourceEnd : -1;
      const { start, end } = validateSpan(passage, rawStart, rawEnd, extractedText);

      units.push({
        extractedText,
        sourceStart: start,
        sourceEnd: end,
        confidence: typeof u.confidence === 'number' ? Math.min(1, Math.max(0, u.confidence)) : 0.8,
      });
    }
  }

  const discarded: DiscardedSpan[] = [];
  if (Array.isArray(raw.discarded)) {
    for (const d of raw.discarded) {
      const text = typeof d.text === 'string' ? d.text.trim() : null;
      if (!text) continue;
      const validReasons: DiscardReason[] = ['rapport', 'filler', 'hesitation', 'meta_commentary', 'incomplete', 'moderator_handoff'];
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

/**
 * lib/evidence/normalisation-agent.ts
 *
 * GPT-4o agent that converts raw extracted file text into a structured
 * NormalisedEvidenceDocument.
 *
 * Input:  RawFileExtraction (plain text from extractor.ts)
 * Output: Partial<NormalisedEvidenceDocument> (everything except id/status/timestamps)
 *
 * The agent:
 *  1. Detects source category automatically
 *  2. Writes a 2–4 sentence plain-English summary
 *  3. Extracts discrete findings (problems, risks, positives)
 *  4. Pulls structured metrics if present
 *  5. Assigns signal direction and confidence
 *  6. Maps to DREAM lenses, actors, and journey stages
 *  7. Selects best verbatim excerpts
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { RawFileExtraction } from './types';
import type {
  NormalisedEvidenceDocument,
  NormalisedEvidenceFinding,
  EvidenceMetric,
  EvidenceSourceCategory,
  SignalDirection,
} from './types';

const MAX_INPUT_CHARS = 40_000; // ~10k tokens — enough for large docs

/** Truncate extraction text to avoid context overflow */
function truncateText(text: string): string {
  if (text.length <= MAX_INPUT_CHARS) return text;
  return (
    text.slice(0, MAX_INPUT_CHARS) +
    `\n\n[... document truncated at ${MAX_INPUT_CHARS} characters — remaining content not shown ...]`
  );
}

const SYSTEM_PROMPT = `You are an expert business analyst working for DREAM, an enterprise discovery platform.

Your task is to analyse an extracted document and produce a structured JSON evidence record.

DREAM uses five lenses: People, Organisation, Customer, Technology, Regulation.
DREAM journey stages: Awareness, Booking, Pre-Journey, Airport Journey, Boarding, In-Flight Experience, Arrival & Baggage, Post-Journey Support, Loyalty & Future Engagement.
(These are airline-specific defaults — adapt if the document is from a different sector.)

Rules:
- Be precise and factual. Do not invent findings not present in the document.
- Keep finding text concise (1–2 sentences max).
- Extract only real metrics with real values — do not estimate.
- If unsure of a value, set confidence lower (below 0.6).
- Signal direction: red = problems/risks, amber = mixed/partial, green = positive/improvement.
- sourceCategory: pick the single best match.
- relevantLenses: only include lenses that are genuinely evidenced.

Output must be valid JSON matching the schema exactly.`;

interface NormalisationAgentOutput {
  sourceCategory: EvidenceSourceCategory;
  summary: string;
  timeframeFrom?: string;
  timeframeTo?: string;
  signalDirection: SignalDirection;
  confidence: number;
  relevantLenses: string[];
  relevantActors: string[];
  relevantJourneyStages: string[];
  findings: NormalisedEvidenceFinding[];
  metrics: EvidenceMetric[];
  excerpts: string[];
}

function buildUserPrompt(fileName: string, extraction: RawFileExtraction): string {
  return `File name: ${fileName}
File type: ${extraction.mimeType}
Extraction method: ${extraction.extractionMethod}
${extraction.pageCount ? `Pages: ${extraction.pageCount}` : ''}
${extraction.slideCount ? `Slides: ${extraction.slideCount}` : ''}
${extraction.rowCount ? `Data rows: ${extraction.rowCount}` : ''}

EXTRACTED CONTENT:
${truncateText(extraction.text)}

---

Produce a JSON object with this exact structure:

{
  "sourceCategory": "<one of: operational_report | performance_metrics | survey_data | customer_feedback | csat | nps | social_media | financial_data | process_documentation | strategic_document | audit_report | training_data | incident_log | other>",
  "summary": "<2–4 sentence plain-English summary of what this document says and its significance>",
  "timeframeFrom": "<e.g. 'Jan 2024' or null>",
  "timeframeTo": "<e.g. 'Dec 2024' or null>",
  "signalDirection": "<red | amber | green | mixed>",
  "confidence": <0.0–1.0>,
  "relevantLenses": ["People", "Organisation", ...],
  "relevantActors": ["Contact Centre Agents", "Management", ...],
  "relevantJourneyStages": ["In-Flight Experience", ...],
  "findings": [
    {
      "text": "<single declarative statement>",
      "type": "<problem | metric | trend | feedback | observation | risk | positive>",
      "signalDirection": "<red | amber | green | mixed>",
      "confidence": <0.0–1.0>,
      "relevantLenses": ["Technology"],
      "relevantJourneyStages": [],
      "sourceExcerpt": "<verbatim quote from document, max 150 chars>",
      "sourcePage": "<'page 3' or 'slide 7' or null>"
    }
  ],
  "metrics": [
    {
      "name": "<metric name>",
      "value": "<value as string>",
      "unit": "<unit or null>",
      "trend": "<improving | declining | stable | unknown>",
      "period": "<time period or null>",
      "benchmark": "<benchmark if stated or null>",
      "isKPI": <true | false>
    }
  ],
  "excerpts": ["<verbatim quote 1>", "<verbatim quote 2>", "<verbatim quote 3>"]
}

Limit findings to the 10 most significant. Limit metrics to 15. Limit excerpts to 5.`;
}

/**
 * Normalise raw file extraction into a structured evidence document.
 * Returns the AI-interpreted fields — caller is responsible for id/timestamps/storage.
 */
export async function normaliseEvidence(
  fileName: string,
  extraction: RawFileExtraction,
): Promise<NormalisationAgentOutput> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(fileName, extraction) },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('No response from normalisation agent');

  let parsed: NormalisationAgentOutput;
  try {
    parsed = JSON.parse(raw) as NormalisationAgentOutput;
  } catch {
    throw new Error(`Normalisation agent returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Add stable IDs to findings
  const findings: NormalisedEvidenceFinding[] = (parsed.findings ?? []).map((f, i) => ({
    id: `f-${i}`,
    text: f.text ?? '',
    type: f.type ?? 'observation',
    signalDirection: f.signalDirection ?? 'mixed',
    confidence: f.confidence ?? 0.5,
    relevantLenses: f.relevantLenses ?? [],
    relevantJourneyStages: f.relevantJourneyStages ?? [],
    sourceExcerpt: f.sourceExcerpt,
    sourcePage: f.sourcePage,
  }));

  return { ...parsed, findings };
}

/**
 * Merge normalisation output into a flat record suitable for DB storage.
 * All array/object fields are stored as JSON in the DB.
 */
export function toDbRecord(
  docId: string,
  workshopId: string,
  fileName: string,
  mimeType: string,
  fileSizeBytes: number,
  storageKey: string,
  output: NormalisationAgentOutput,
): Omit<NormalisedEvidenceDocument, 'createdAt' | 'updatedAt'> {
  return {
    id: docId,
    workshopId,
    originalFileName: fileName,
    mimeType,
    fileSizeBytes,
    storageKey,
    status: 'ready',
    sourceCategory: output.sourceCategory,
    summary: output.summary,
    timeframeFrom: output.timeframeFrom,
    timeframeTo: output.timeframeTo,
    findings: output.findings,
    metrics: output.metrics,
    excerpts: output.excerpts,
    signalDirection: output.signalDirection,
    confidence: output.confidence,
    relevantLenses: output.relevantLenses,
    relevantActors: output.relevantActors,
    relevantJourneyStages: output.relevantJourneyStages,
  };
}

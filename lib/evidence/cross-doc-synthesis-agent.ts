/**
 * lib/evidence/cross-doc-synthesis-agent.ts
 *
 * Cross-document synthesis agent.
 *
 * Analyses ALL ready evidence documents for a workshop and produces:
 *   - Shared themes: findings that appear across 2+ documents
 *   - Outliers:      findings present in only one document
 *   - Contradictions: where documents disagree on the same topic
 *   - Workshop-level narrative summary (2–4 sentences)
 *
 * Output is stored on Workshop.evidenceSynthesis.
 */

import type { NormalisedEvidenceDocument, CrossDocSynthesis } from './types';
import { env } from '@/lib/env';

// ── Agent ──────────────────────────────────────────────────────────────────

/**
 * Run cross-document synthesis over all ready evidence documents.
 * Requires at least 2 documents.
 */
export async function runCrossDocSynthesis(
  docs: NormalisedEvidenceDocument[],
): Promise<CrossDocSynthesis> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const docSummaries = docs.map((d) => ({
    id: d.id,
    name: d.originalFileName,
    summary: d.summary,
    sourceCategory: d.sourceCategory,
    signalDirection: d.signalDirection,
    findings: d.findings.slice(0, 20).map((f) => ({
      id: f.id,
      text: f.text,
      type: f.type,
      signal: f.signalDirection,
      lenses: f.relevantLenses,
    })),
    metrics: d.metrics.slice(0, 10).map((m) => ({
      name: m.name,
      value: m.value,
      trend: m.trend,
    })),
  }));

  const prompt = `You are an expert organisational analyst performing cross-document synthesis.

You have ${docs.length} evidence documents from the same organisation. Analyse them together and identify:

1. **Shared themes** — findings or signals that appear in 2 or more documents (look for overlapping topics, even if expressed differently). Include the IDs and names of the documents.

2. **Outliers** — significant findings that appear in only ONE document and are not corroborated elsewhere. Include why they stand out.

3. **Cross-document contradictions** — where two or more documents give conflicting evidence on the same topic. List the conflicting positions clearly.

4. **Workshop-level summary** — 2–4 sentences summarising what the evidence collectively shows about this organisation.

DOCUMENTS:
${JSON.stringify(docSummaries, null, 2)}

IMPORTANT RULES:
- Only identify themes that are genuinely shared (same topic/signal from multiple sources)
- Be precise about which document IDs each theme appears in
- Outliers must be meaningful findings, not trivial details
- Contradictions must be real disagreements, not just different time periods or scopes
- Use the exact document IDs and names from the input

Respond ONLY with valid JSON matching this exact schema:
{
  "sharedThemes": [
    {
      "theme": "string — short label",
      "appearsInDocIds": ["docId1", "docId2"],
      "appearsInDocNames": ["filename1.pdf", "filename2.xlsx"],
      "signalDirection": "red | amber | green | mixed"
    }
  ],
  "outliers": [
    {
      "finding": "string — the finding",
      "documentId": "string",
      "documentName": "string",
      "note": "string — why this stands out as a single-source signal"
    }
  ],
  "crossDocContradictions": [
    {
      "topic": "string — the topic of disagreement",
      "positions": [
        { "documentId": "string", "documentName": "string", "position": "string" }
      ]
    }
  ],
  "workshopLevelSummary": "string — 2-4 sentence narrative"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = JSON.parse(raw) as Record<string, any>;

  return {
    sharedThemes: Array.isArray(parsed.sharedThemes) ? parsed.sharedThemes : [],
    outliers: Array.isArray(parsed.outliers) ? parsed.outliers : [],
    crossDocContradictions: Array.isArray(parsed.crossDocContradictions)
      ? parsed.crossDocContradictions
      : [],
    workshopLevelSummary:
      typeof parsed.workshopLevelSummary === 'string' ? parsed.workshopLevelSummary : '',
    documentCount: docs.length,
    generatedAt: new Date().toISOString(),
  };
}

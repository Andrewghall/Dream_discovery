/**
 * lib/evidence/cross-validation-agent.ts
 *
 * GPT-4o agent that cross-validates uploaded evidence against workshop discovery findings.
 *
 * Input:
 *   - Discovery signals (themes, constraints, confirmed/new issues from OI engines)
 *   - One or more normalised evidence documents
 *
 * Output:
 *   - CrossValidationResult: corroborated / contradicted / partially_supported /
 *     unsupported / evidence_only / conclusionImpact
 *
 * This is called:
 *   1. After all uploaded documents reach 'ready' status
 *   2. Explicitly when user clicks "Re-validate" in the Evidence tab
 *   3. Automatically when new documents are added to an existing set
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CrossValidationResult, NormalisedEvidenceDocument } from './types';

export interface DiscoverySnapshot {
  /** Top-level themes from discovery analysis */
  themes: string[];
  /** Constraints/barriers surfaced in the workshop */
  constraints: Array<{ title: string; description?: string; severity?: string }>;
  /** Confirmed issues from Discovery Validation engine */
  confirmedIssues: Array<{ issue: string; confidence: string }>;
  /** New issues surfaced in workshop (not in pre-discovery) */
  newIssues: Array<{ issue: string; significance: string }>;
  /** Root causes identified by Root Cause engine */
  rootCauses: Array<{ cause: string; severity: string }>;
  /** V2 synthesised truths (discover.truths) — primary source for V2 workshops */
  truths: Array<{ id?: string; statement: string; confidence?: number; themes?: string[] }>;
  /** Workshop name / client for context */
  workshopName: string;
  clientName: string;
}

const SYSTEM_PROMPT = `You are a senior management consultant conducting an evidence-based cross-validation.

Your task: compare what participants SAID in a discovery workshop against what documents and data SHOW.

Three possible relationships:
- CORROBORATED: the document evidence confirms or strongly supports the discovery finding
- CONTRADICTED: the document evidence directly contradicts the discovery finding
- PARTIALLY_SUPPORTED: the evidence provides some support but with important caveats or nuances

Be analytical and precise. Do not force matches where none exist.
A discovery finding is "unsupported" if no uploaded evidence speaks to it.
An evidence finding is "evidence only" if nothing in the workshop discovery addresses it.

Output valid JSON only.`;

function buildPrompt(discovery: DiscoverySnapshot, docs: NormalisedEvidenceDocument[]): string {
  const allDiscoveryFindings: string[] = [
    ...discovery.truths.map(t => t.statement),
    ...discovery.themes,
    ...discovery.constraints.map(c => `${c.title}${c.description ? ': ' + c.description : ''}`),
    ...discovery.confirmedIssues.map(i => i.issue),
    ...discovery.newIssues.map(i => i.issue),
    ...discovery.rootCauses.map(r => `[Root Cause] ${r.cause} (${r.severity})`),
  ].filter(Boolean);

  const evidenceSummary = docs.map(doc => ({
    id: doc.id,
    name: doc.originalFileName,
    summary: doc.summary,
    findings: doc.findings.map(f => ({
      id: f.id,
      text: f.text,
      type: f.type,
      signal: f.signalDirection,
    })),
    metrics: doc.metrics.map(m => `${m.name}: ${m.value}${m.unit ?? ''}`),
  }));

  return `Workshop: ${discovery.workshopName} — ${discovery.clientName}

DISCOVERY FINDINGS (what participants said):
${allDiscoveryFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

UPLOADED EVIDENCE (what documents show):
${JSON.stringify(evidenceSummary, null, 2)}

---

Produce a JSON object with this exact structure:

{
  "corroborated": [
    {
      "discoveryFinding": "<short label>",
      "evidenceFinding": "<short label>",
      "documentId": "<doc id>",
      "documentName": "<filename>",
      "alignment": "corroborated",
      "note": "<1-2 sentence explanation>",
      "confidence": <0.0–1.0>
    }
  ],
  "contradicted": [ ... same structure, alignment: "contradicted" ],
  "partiallySupported": [ ... same structure, alignment: "partially_supported" ],
  "unsupported": ["<discovery finding that has no evidence coverage>", ...],
  "evidenceOnly": [
    {
      "finding": {
        "id": "<finding id>",
        "text": "<finding text>",
        "type": "<type>",
        "signalDirection": "<direction>",
        "confidence": <0.0–1.0>,
        "relevantLenses": [],
        "relevantJourneyStages": []
      },
      "documentId": "<doc id>",
      "documentName": "<filename>"
    }
  ],
  "conclusionImpact": "<2-4 sentences: what does this cross-validation mean for the overall conclusion? What is strengthened? What is challenged? What gaps remain?>"
}`;
}

/**
 * Run cross-validation against all currently-ready evidence documents.
 */
export async function runCrossValidation(
  discovery: DiscoverySnapshot,
  docs: NormalisedEvidenceDocument[],
): Promise<CrossValidationResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const readyDocs = docs.filter(d => d.status === 'ready');
  if (readyDocs.length === 0) {
    return {
      corroborated: [],
      contradicted: [],
      partiallySupported: [],
      unsupported: [],
      evidenceOnly: [],
      conclusionImpact: 'No evidence documents are ready for cross-validation.',
      generatedAt: new Date().toISOString(),
    };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(discovery, readyDocs) },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('No response from cross-validation agent');

  let parsed: Omit<CrossValidationResult, 'generatedAt'>;
  try {
    parsed = JSON.parse(raw) as Omit<CrossValidationResult, 'generatedAt'>;
  } catch {
    throw new Error(`Cross-validation agent returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  return {
    corroborated: parsed.corroborated ?? [],
    contradicted: parsed.contradicted ?? [],
    partiallySupported: parsed.partiallySupported ?? [],
    unsupported: parsed.unsupported ?? [],
    evidenceOnly: parsed.evidenceOnly ?? [],
    conclusionImpact: parsed.conclusionImpact ?? '',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build a DiscoverySnapshot from OI engine outputs.
 * Used by the evidence API to prepare inputs for cross-validation.
 */
export function buildDiscoverySnapshot(
  workshopName: string,
  clientName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  v2Output: Record<string, any> | null,
): DiscoverySnapshot {
  const discover = v2Output?.discover ?? {};
  const constraints = v2Output?.constraints ?? {};

  return {
    workshopName,
    clientName,
    // V2 truths are the primary discovery signal in newer workshops
    truths: (discover?.truths ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => ({ id: t.id, statement: t.statement, confidence: t.confidence, themes: t.themes }),
    ),
    // V1: themes may be at discoverAnalysis.alignment.themes or discoverAnalysis.themes
    themes: [
      ...(discover?.discoverAnalysis?.alignment?.themes ?? []),
      ...(discover?.discoverAnalysis?.themes ?? []),
    ],
    constraints: constraints?.workshopConstraints ?? [],
    confirmedIssues: discover?.discoveryValidation?.confirmedIssues ?? [],
    newIssues: discover?.discoveryValidation?.newIssues ?? [],
    rootCauses: (discover?.rootCauseIntelligence?.rootCauses ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rc: any) => ({ cause: rc.cause, severity: rc.severity ?? 'unknown' }),
    ),
  };
}

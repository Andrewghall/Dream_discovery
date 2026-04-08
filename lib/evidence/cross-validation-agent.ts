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
  /**
   * Raw participant insights from discovery interviews.
   * This is the most authoritative signal — what individuals actually said.
   * Cross-validation should primarily validate against this.
   */
  participantInsights?: Array<{ text: string; type: string }>;
  /**
   * Live session pad signals — what participants wrote during the workshop.
   * Grouped by phase: discovery (current pain), constraints (barriers), reimagine (vision).
   */
  liveSignals?: Array<{ text: string; phase: string; lens?: string; actor?: string }>;
  /** Workshop name / client for context */
  workshopName: string;
  clientName: string;
}

const SYSTEM_PROMPT = `You are a senior management consultant conducting an evidence-based cross-validation for a business transformation programme.

YOUR TASK: Determine which workshop findings are corroborated, contradicted, or unsupported by the uploaded operational documents and data.

STRICT RELEVANCE RULES — apply these before making any match:
1. A match is only valid if the document evidence and the workshop finding address the SAME OPERATIONAL OR STRATEGIC ISSUE in the same organisational context.
2. Incidental visual observations (physical appearance of premises, vegetation, room condition, building aesthetics) are NEVER valid evidence — discard them entirely regardless of any superficial similarity to workshop themes.
3. The match must be SUBSTANTIVE: the same performance problem, the same process failure, the same cultural pattern — not surface-level keyword overlap.
4. Metrics and data (FCR rates, CSAT scores, attrition numbers, headcount, costs) are high-quality evidence. Anecdotal visual descriptions from images are not.
5. When in doubt, classify as "unsupported" or "evidence only" — do not force weak matches.

PRIORITY ORDER for workshop evidence (most to least authoritative):
1. Raw participant voice — verbatim or near-verbatim quotes from interviews and live session pads
2. Synthesised discovery truths and themes
3. Structural constraints and root causes

Ground your cross-validation in participant testimony first. The core question is: does the empirical data confirm or challenge what the people in this organisation said about their own situation?

WHAT MAKES A STRONG MATCH:
- A participant said "FCR is too low" AND an ops report shows FCR at 61% vs 75% target → CORROBORATED
- Participants said "BPO performance is inconsistent" AND data shows 15% variance across sites → CORROBORATED
- Discovery surfaced "high attrition" AND HR data shows 34% annual attrition → CORROBORATED
- A house image shows a garden → this is NOT evidence of anything operational → DO NOT include

WHAT MAKES A CONTRADICTION:
- Participants said "customers are satisfied" AND CSAT data shows sustained decline → CONTRADICTED

EVIDENCE THRESHOLD RULES — apply before outputting any contradiction:

1. NOISE (suppress entirely — do not output):
   Single document mentions something that contradicts a finding, but no other signal (participant voice, other documents, live pads) corroborates the contradiction. Discard. Do not put it in contradicted[].

2. PERCEPTION GAP (output in perceptionGaps[]):
   A finding is strongly held by participants (appears in multiple participant insights or live pads) BUT documentary evidence directly contradicts it. This is a blind spot in organisational self-perception. High value — always surface.
   Format: "Participants believed [X] but data shows [Y] — [specific document + metric]"

3. CONFIRMED CONTRADICTION (output in contradicted[]):
   2 or more independent documents contradict the same discovery finding. This is a confirmed contradiction, not noise.

4. BLIND SPOT (output in blindSpots[]):
   A significant finding appears in the documentary evidence but was NOT mentioned by any participant in discovery or live sessions. The organisation may be unaware of it. Surface as: "Data reveals [X] — not raised by any participant"

5. INCIDENTAL / IRRELEVANT (discard entirely):
   Visual observations, physical descriptions, domain-irrelevant content. Never output these.

Apply these rules strictly. A weak contradiction from a single document goes to suppressedNoise (just the count — not the content), not to contradicted[].

Output valid JSON only. No commentary outside the JSON.`;

// MIME types that are image formats — these contribute summary + metrics only,
// NOT raw visual findings which are incidental and operationally irrelevant.
const IMAGE_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
]);

function isImageDoc(doc: NormalisedEvidenceDocument): boolean {
  return IMAGE_MIME_TYPES.has(doc.mimeType?.toLowerCase() ?? '');
}

function buildPrompt(discovery: DiscoverySnapshot, docs: NormalisedEvidenceDocument[]): string {
  const lines: string[] = [];

  lines.push(`Workshop: ${discovery.workshopName} — ${discovery.clientName}`);
  lines.push('');

  // ── Section 1: Participant Voice — the primary ground truth ─────────────────
  // What individuals actually said in interviews and on live pads.
  // This is what we are trying to corroborate or challenge with documentary data.

  if (discovery.participantInsights && discovery.participantInsights.length > 0) {
    lines.push('=== WHAT PARTICIPANTS SAID (discovery interviews — primary ground truth) ===');
    const challenges = discovery.participantInsights
      .filter(i => ['CHALLENGE', 'CONSTRAINT', 'FRICTION', 'BARRIER'].includes(i.type.toUpperCase()))
      .slice(0, 25);
    const aspirations = discovery.participantInsights
      .filter(i => ['VISION', 'OPPORTUNITY', 'ENABLER'].includes(i.type.toUpperCase()))
      .slice(0, 10);
    if (challenges.length > 0) {
      lines.push('Problems and constraints named by participants:');
      challenges.forEach(i => lines.push(`  • [${i.type}] ${i.text}`));
    }
    if (aspirations.length > 0) {
      lines.push('Aspirations and enablers named by participants:');
      aspirations.forEach(i => lines.push(`  • [${i.type}] ${i.text}`));
    }
    lines.push('');
  }

  if (discovery.liveSignals && discovery.liveSignals.length > 0) {
    lines.push('=== WHAT PARTICIPANTS WROTE ON WORKSHOP PADS (live session) ===');
    const byPhase: Record<string, typeof discovery.liveSignals> = {};
    for (const s of discovery.liveSignals) {
      (byPhase[s.phase] ??= []).push(s);
    }
    for (const [phase, signals] of Object.entries(byPhase)) {
      lines.push(`${phase.replace(/_/g, ' ')} phase (${signals.length} pads):`);
      signals.slice(0, 20).forEach(s => {
        const ctx = [s.lens, s.actor].filter(Boolean).join(' — ');
        lines.push(`  • ${s.text}${ctx ? ` [${ctx}]` : ''}`);
      });
    }
    lines.push('');
  }

  // ── Section 2: Synthesised discovery findings ───────────────────────────────

  const synthesisedFindings: string[] = [
    ...discovery.truths.map(t => `[Synthesised truth] ${t.statement}`),
    ...discovery.themes.map(t => `[Theme] ${t}`),
    ...discovery.constraints.map(c => `[Constraint] ${c.title}${c.description ? ': ' + c.description : ''}`),
    ...discovery.confirmedIssues.map(i => `[Confirmed issue] ${i.issue}`),
    ...discovery.newIssues.map(i => `[New issue] ${i.issue}`),
    ...discovery.rootCauses.map(r => `[Root cause] ${r.cause} (${r.severity})`),
  ].filter(Boolean);

  if (synthesisedFindings.length > 0) {
    lines.push('=== SYNTHESISED DISCOVERY FINDINGS (from analysis of workshop signals) ===');
    synthesisedFindings.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    lines.push('');
  }

  // ── Section 3: Documentary evidence ─────────────────────────────────────────
  // Images contribute SUMMARY and METRICS only — not raw visual findings.
  // Text/data documents contribute full findings + metrics.

  lines.push('=== UPLOADED DOCUMENTARY EVIDENCE ===');
  lines.push('(Validate only operationally relevant findings against participant testimony above)');
  lines.push('');

  for (const doc of docs) {
    const docIsImage = isImageDoc(doc);
    lines.push(`Document: ${doc.originalFileName} (${doc.sourceCategory ?? 'unknown category'}, signal: ${doc.signalDirection}, confidence: ${Math.round(doc.confidence * 100)}%)`);
    if (docIsImage) {
      lines.push(`  [Image document — only summary-level insight is used; visual descriptions are excluded]`);
    }
    lines.push(`  Summary: ${doc.summary}`);
    if (doc.metrics && doc.metrics.length > 0) {
      lines.push(`  Metrics: ${doc.metrics.map(m => `${m.name}: ${m.value}${m.unit ?? ''}`).join(' | ')}`);
    }
    // For non-image documents, include the structured findings
    if (!docIsImage && doc.findings && doc.findings.length > 0) {
      lines.push(`  Key findings (${doc.findings.length} total, sample):`);
      doc.findings.slice(0, 8).forEach(f => {
        lines.push(`    • [${f.type ?? 'finding'}, ${f.signalDirection ?? 'mixed'}] ${f.text}`);
      });
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`Produce a JSON object with this exact structure:

{
  "corroborated": [
    {
      "discoveryFinding": "<exact participant quote or synthesised finding — be specific>",
      "evidenceFinding": "<specific metric, data point, or finding from the document — be specific>",
      "documentId": "<doc id>",
      "documentName": "<filename>",
      "alignment": "corroborated",
      "note": "<1-2 sentences: HOW the data confirms what participants said — cite specific numbers or patterns>",
      "confidence": <0.0–1.0>
    }
  ],
  "contradicted": [ ... same structure, alignment: "contradicted" — only include if 2+ independent documents contradict the same finding ],
  "partiallySupported": [ ... same structure, alignment: "partially_supported" ],
  "unsupported": ["<specific participant finding or theme that has NO documentary coverage>", ...],
  "evidenceOnly": [
    {
      "finding": {
        "id": "<finding id or empty string>",
        "text": "<the data or finding not addressed in workshop discovery>",
        "type": "data",
        "signalDirection": "<direction>",
        "confidence": <0.0–1.0>,
        "relevantLenses": [],
        "relevantJourneyStages": []
      },
      "documentId": "<doc id>",
      "documentName": "<filename>"
    }
  ],
  "conclusionImpact": "<3-5 sentences: what does this cross-validation tell us about the soundness of the transformation direction? Which participant assumptions are backed by data? Which are challenged? What empirical gaps remain that need addressing before the programme proceeds?>",
  "perceptionGaps": ["string — participants believed X but data shows Y — cite specific document and metric"],
  "blindSpots": ["string — Data reveals [X] — not raised by any participant"],
  "suppressedNoise": <integer — count of single-source contradictions that were suppressed as noise>
}`);

  return lines.join('\n');
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
      perceptionGaps: [],
      blindSpots: [],
      suppressedNoise: 0,
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
    perceptionGaps: parsed.perceptionGaps ?? [],
    blindSpots: parsed.blindSpots ?? [],
    suppressedNoise: parsed.suppressedNoise ?? 0,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Fallback workshop-level discovery data.
 * Used when OI synthesis (v2Output) has not been run yet but the
 * prep/discover phase (discoverAnalysis + themes) has been completed.
 * Also carries raw participant signals that are always included regardless
 * of whether OI synthesis has run.
 */
export interface WorkshopDiscoveryFallback {
  /** workshop.discoverAnalysis JSON */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoverAnalysis?: Record<string, any> | null;
  /** workshop.themes rows */
  themes?: Array<{ themeLabel: string; themeDescription?: string | null }>;
  /** Raw participant insights from discovery interviews — the primary ground truth */
  participantInsights?: Array<{ text: string; type: string }>;
  /** Live session pad signals — discovery, constraints, reimagine phases */
  liveSignals?: Array<{ text: string; phase: string; lens?: string; actor?: string }>;
}

/**
 * Build a DiscoverySnapshot from OI engine outputs (v2Output).
 * When v2Output is absent or empty, falls back to workshop-level
 * discoverAnalysis and themes so cross-validation can run after
 * prep/discover synthesis without requiring full OI synthesis first.
 *
 * Used by the evidence API to prepare inputs for cross-validation.
 */
export function buildDiscoverySnapshot(
  workshopName: string,
  clientName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  v2Output: Record<string, any> | null,
  fallback?: WorkshopDiscoveryFallback,
): DiscoverySnapshot {
  const discover = v2Output?.discover ?? {};
  const constraints = v2Output?.constraints ?? {};

  // V2 truths — primary signal for OI-synthesised workshops
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const truths = (discover?.truths ?? []).map((t: any) => ({
    id: t.id,
    statement: t.statement,
    confidence: t.confidence,
    themes: t.themes,
  }));

  // Themes from v2Output (V1 shape) or from workshop.themes fallback
  const themesFromV2: string[] = [
    ...(discover?.discoverAnalysis?.alignment?.themes ?? []),
    ...(discover?.discoverAnalysis?.themes ?? []),
  ];
  const themesFromFallback: string[] = (fallback?.themes ?? []).map(t =>
    t.themeDescription ? `${t.themeLabel}: ${t.themeDescription}` : t.themeLabel,
  );
  const themes = themesFromV2.length > 0 ? themesFromV2 : themesFromFallback;

  // Constraints — from OI output or fallback discoverAnalysis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constraintsFromV2: DiscoverySnapshot['constraints'] = constraints?.workshopConstraints ?? [];
  const constraintsFromFallback: DiscoverySnapshot['constraints'] = Array.isArray(
    fallback?.discoverAnalysis?.constraints,
  )
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fallback!.discoverAnalysis!.constraints as any[]).map((c: any) => ({
        title: c.title ?? '',
        description: c.description,
        severity: c.severity,
      }))
    : [];
  const resolvedConstraints =
    constraintsFromV2.length > 0 ? constraintsFromV2 : constraintsFromFallback;

  return {
    workshopName,
    clientName,
    truths,
    themes,
    constraints: resolvedConstraints,
    confirmedIssues: discover?.discoveryValidation?.confirmedIssues ?? [],
    newIssues: discover?.discoveryValidation?.newIssues ?? [],
    rootCauses: (discover?.rootCauseIntelligence?.rootCauses ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rc: any) => ({ cause: rc.cause, severity: rc.severity ?? 'unknown' }),
    ),
    // Raw participant voice — always included when present, regardless of OI synthesis state
    participantInsights: fallback?.participantInsights,
    liveSignals: fallback?.liveSignals,
  };
}

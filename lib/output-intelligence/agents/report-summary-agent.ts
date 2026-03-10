/**
 * Report Summary Agent
 *
 * Single GPT-4o call that reads ALL already-generated intelligence and writes
 * the two sections defined by dream_report_agent_guidance.md:
 *   1. Executive Summary — answers the workshop ask
 *   2. Solution Summary — recommends the way forward
 *
 * Does NOT re-run any of the 5 intelligence engines.
 * All evidence is pre-existing; this agent synthesises the narrative layer only.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { WorkshopOutputIntelligence, WorkshopSignals, ReportSummary } from '../types';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

// ── Schema sent to the model ──────────────────────────────────────────────────

const SCHEMA = `{
  "workshopAsk": "string — the precise question the organisation commissioned this workshop to answer",
  "keyInsight": "string — the single most important revelation from the workshop (one sentence, specific, name the organisation)",

  "executiveSummary": {
    "theAsk": "string — one sentence: what was commissioned and why this mattered to the organisation",
    "theAnswer": "string — one sentence: the direct, decisive answer to the ask — a bold claim grounded entirely in the evidence below",

    "whatWeFound": [
      "string — finding 1: specific issue, name the system/team/metric affected",
      "string — finding 2: specific issue with evidence (e.g. 'X% attrition', '8 legacy systems', 'no unified view')",
      "string — finding 3: specific issue",
      "string — finding 4: specific issue",
      "string — finding 5: specific issue",
      "string — finding 6: specific issue — if evidence exists for a 6th, include it; otherwise omit"
    ],

    "lensFindings": [
      { "lens": "string — lens name EXACTLY as listed in WORKSHOP CONTEXT (e.g. 'People', 'Technology'). One entry per lens — EVERY lens, no exceptions.", "finding": "string — what this lens revealed in the workshop, grounded in the SIGNALS BY LENS section. If signals were thin or absent: 'Workshop signals for this lens were limited — [describe what little was captured, or state no pads were recorded for this lens]'" }
    ],

    "whyItMatters": "string — 3-4 sentences: name the direct business cost of these issues (operational, financial, customer, competitive) — no generic consulting language — be specific to this organisation",
    "opportunityOrRisk": "string — 3-4 sentences: name the specific opportunity if addressed, and the specific risk if not — reference the root cause and the evidence",
    "urgency": "string — 1-2 sentences: must name at least one specific item from the intelligence — a regulatory obligation, measured metric (e.g. '34% attrition'), competitive trigger, or named operational crisis — do not write generic urgency without a named trigger",
    "nextStepsPreview": "string — one sentence: the direction the solution takes, bridging to the solution section below"
  },

  "solutionSummary": {
    "direction": "string — one sentence transformation headline — describe where the organisation needs to move FROM and TO",
    "rationale": "string — 3-4 sentences: why this is the right direction — link each element to the root causes identified — no generic language",
    "whatMustChange": [
      { "area": "string — name of the specific area", "currentState": "string — concrete description of today's reality using evidence from the workshop", "requiredChange": "string — specific, actionable change needed" },
      { "area": "string", "currentState": "string", "requiredChange": "string" },
      { "area": "string", "currentState": "string", "requiredChange": "string" },
      { "area": "string", "currentState": "string", "requiredChange": "string" }
    ],
    "startingPoint": "string — 2-3 sentences: what must happen in the first 30-60 days and why this unlocks the rest of the transformation",
    "successIndicators": [
      "string — observable outcome 1: specific and measurable (e.g. 'Advisor handles end-to-end case without switching systems')",
      "string — observable outcome 2",
      "string — observable outcome 3",
      "string — observable outcome 4"
    ]
  },

  "transformationDirection": "string — one-line headline (same as solutionSummary.direction above)",
  "validationPassed": true,
  "validationGaps": []
}`;

// ── Signal dump for context ───────────────────────────────────────────────────

function buildContextDump(
  signals: WorkshopSignals,
  intelligence: WorkshopOutputIntelligence
): string {
  const lines: string[] = [];

  lines.push('=== WORKSHOP CONTEXT ===');
  lines.push(`Client: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Workshop Ask / Objective: ${signals.context.objectives || signals.context.businessContext || 'Not specified'}`);
  lines.push(`Lenses: ${signals.context.lenses.join(', ')}`);

  // ── Discovery Validation ─────────────────────────────────────────────────
  lines.push('\n=== CONFIRMED ISSUES (from discovery vs workshop comparison) ===');
  if (intelligence.discoveryValidation.confirmedIssues.length > 0) {
    for (const ci of intelligence.discoveryValidation.confirmedIssues) {
      lines.push(`• [${ci.confidence}] ${ci.issue}`);
      lines.push(`  Discovery: ${ci.discoverySignal}`);
      lines.push(`  Workshop confirmed: ${ci.workshopEvidence}`);
    }
  } else {
    lines.push('No confirmed issues recorded.');
  }

  if (intelligence.discoveryValidation.newIssues.length > 0) {
    lines.push('\n=== NEW ISSUES (surfaced only in workshop) ===');
    for (const ni of intelligence.discoveryValidation.newIssues) {
      lines.push(`• ${ni.issue}`);
      lines.push(`  Evidence: ${ni.workshopEvidence}`);
      lines.push(`  Significance: ${ni.significance}`);
    }
  }

  lines.push(`\nHypothesis Accuracy: ${intelligence.discoveryValidation.hypothesisAccuracy}%`);
  if (intelligence.discoveryValidation.summary) {
    lines.push(`Discovery Summary: ${intelligence.discoveryValidation.summary}`);
  }

  // ── Root Causes ──────────────────────────────────────────────────────────
  lines.push('\n=== ROOT CAUSES (ranked by severity) ===');
  lines.push(`Systemic Pattern: ${intelligence.rootCause.systemicPattern}`);
  for (const rc of intelligence.rootCause.rootCauses) {
    lines.push(`\n[Rank ${rc.rank}] ${rc.cause} — ${rc.severity} (${rc.category})`);
    if (rc.evidence.length > 0) {
      lines.push(`  Evidence: ${rc.evidence.slice(0, 3).join(' | ')}`);
    }
    if (rc.affectedLenses.length > 0) {
      lines.push(`  Affects: ${rc.affectedLenses.join(', ')}`);
    }
  }

  // ── Future State ──────────────────────────────────────────────────────────
  lines.push('\n=== FUTURE STATE DESIGN ===');
  lines.push(`Target Operating Model: ${intelligence.futureState.targetOperatingModel}`);
  // Include the narrative — this contains specific metrics (e.g. "AHT 30-40%") that
  // the whatWeFound and urgency fields MUST cite verbatim if present.
  if (intelligence.futureState.narrative) {
    lines.push(`\nFuture State Narrative:\n${intelligence.futureState.narrative}`);
  }
  if (intelligence.futureState.redesignPrinciples.length > 0) {
    lines.push(`\nRedesign Principles:\n${intelligence.futureState.redesignPrinciples.map((p) => `• ${p}`).join('\n')}`);
  }
  if (intelligence.futureState.operatingModelChanges.length > 0) {
    lines.push('\nOperating Model Changes:');
    for (const change of intelligence.futureState.operatingModelChanges.slice(0, 5)) {
      lines.push(`• ${change.area}: [Current] ${change.currentState} → [Future] ${change.futureState} (Enabler: ${change.enabler})`);
    }
  }
  if (intelligence.futureState.aiHumanModel.length > 0) {
    lines.push('\nAI / Human Task Recommendations:');
    for (const task of intelligence.futureState.aiHumanModel.slice(0, 6)) {
      lines.push(`• [${task.recommendation}] ${task.task} — ${task.rationale}`);
    }
  }

  // ── Roadmap ───────────────────────────────────────────────────────────────
  lines.push('\n=== EXECUTION ROADMAP ===');
  lines.push(`Critical Path: ${intelligence.roadmap.criticalPath}`);
  for (const phase of intelligence.roadmap.phases) {
    lines.push(`\n${phase.phase} (${phase.timeframe})`);
    if (phase.initiatives.length > 0) {
      for (const init of phase.initiatives.slice(0, 3)) {
        lines.push(`  • ${init.title}: ${init.outcome}`);
      }
    }
  }
  if (intelligence.roadmap.keyRisks.length > 0) {
    lines.push(`\nKey Risks:\n${intelligence.roadmap.keyRisks.map((r) => `• ${r}`).join('\n')}`);
  }

  // ── Strategic Impact ──────────────────────────────────────────────────────
  lines.push('\n=== STRATEGIC IMPACT ===');
  lines.push(`Automation Potential: ${intelligence.strategicImpact.automationPotential.percentage}% — ${intelligence.strategicImpact.automationPotential.description}`);
  lines.push(`Business Case: ${intelligence.strategicImpact.businessCaseSummary}`);
  if (intelligence.strategicImpact.efficiencyGains.length > 0) {
    lines.push('\nEfficiency Gains (cite these verbatim in findings where relevant):');
    for (const eg of intelligence.strategicImpact.efficiencyGains.slice(0, 4)) {
      lines.push(`• ${eg.metric}: ${eg.estimated} (${eg.basis})`);
    }
  }
  if (intelligence.strategicImpact.experienceImprovements.length > 0) {
    lines.push('\nExperience Improvements:');
    for (const ei of intelligence.strategicImpact.experienceImprovements.slice(0, 4)) {
      lines.push(`• ${ei.dimension}: [Current] ${ei.currentState} → [Future] ${ei.futureState} — Impact: ${ei.impact}`);
    }
  }

  // ── Live Workshop Signals — by phase ─────────────────────────────────────
  const allPads = [
    ...signals.liveSession.reimaginePads.map((p) => ({ ...p, phase: 'REIMAGINE' })),
    ...signals.liveSession.constraintPads.map((p) => ({ ...p, phase: 'CONSTRAINTS' })),
    ...signals.liveSession.defineApproachPads.map((p) => ({ ...p, phase: 'DEFINE_APPROACH' })),
  ];
  const totalPads = allPads.length;

  if (totalPads > 0) {
    lines.push(`\n=== LIVE WORKSHOP SIGNALS (${totalPads} pads — by phase) ===`);
    if (signals.liveSession.reimaginePads.length > 0) {
      lines.push(`Reimagine pads (${signals.liveSession.reimaginePads.length}):`);
      for (const p of signals.liveSession.reimaginePads.slice(0, 10)) {
        lines.push(`• ${p.text}`);
      }
    }
    if (signals.liveSession.constraintPads.length > 0) {
      lines.push(`\nConstraint pads (${signals.liveSession.constraintPads.length}):`);
      for (const p of signals.liveSession.constraintPads.slice(0, 10)) {
        lines.push(`• ${p.text}`);
      }
    }
    if (signals.liveSession.defineApproachPads.length > 0) {
      lines.push(`\nDefine Approach pads (${signals.liveSession.defineApproachPads.length}):`);
      for (const p of signals.liveSession.defineApproachPads.slice(0, 10)) {
        lines.push(`• ${p.text}`);
      }
    }
  }

  // ── Live Workshop Signals — by lens (PRIMARY SOURCE for lensFindings) ────
  // Group ALL pads by lens so the model can see exactly what each lens produced.
  // Every lens from context.lenses is included, even those with no pads.
  {
    const lensPadMap = new Map<string, Array<{ text: string; phase: string }>>();

    // Initialise with all known lenses (in order) so none are silently skipped
    for (const lens of signals.context.lenses) {
      lensPadMap.set(lens, []);
    }

    // Assign pads to their lens; unrecognised lenses get their own bucket
    for (const p of allPads) {
      const lens = p.lens ?? 'General';
      if (!lensPadMap.has(lens)) lensPadMap.set(lens, []);
      lensPadMap.get(lens)!.push({ text: p.text, phase: p.phase });
    }

    lines.push('\n=== SIGNALS BY LENS (use this as the primary source for lensFindings) ===');
    for (const [lens, pads] of lensPadMap) {
      if (pads.length === 0) {
        lines.push(`\n${lens} (0 pads — no workshop signals captured for this lens)`);
      } else {
        lines.push(`\n${lens} (${pads.length} pad${pads.length > 1 ? 's' : ''}):`);
        for (const p of pads.slice(0, 12)) {
          lines.push(`  • [${p.phase}] ${p.text}`);
        }
      }
    }
  }

  return lines.join('\n');
}

// ── Validation Pass ───────────────────────────────────────────────────────────
// Separate GPT-4o-mini reviewer that checks the generated output against a
// specificity rubric. Fast (~500 tokens), low temperature for reliable judgement.

async function runValidationPass(
  client: OpenAI,
  summary: ReportSummary,
  lenses: string[]
): Promise<{ passed: boolean; gaps: string[] }> {
  const es = summary.executiveSummary;

  const reviewInput = JSON.stringify({
    whatWeFound: es.whatWeFound,
    lensFindings: es.lensFindings,
    urgency: es.urgency,
    expectedLenses: lenses,
  }, null, 2);

  const validationPrompt = `You are a quality reviewer for executive reports. Review the following generated content against the specificity rubric below. Be strict — generic language is not acceptable.

RUBRIC:
1. whatWeFound items: each MUST name a specific system, team, metric, number, or named process. "Lack of alignment" = FAIL. "8 legacy systems causing 34% longer handling time" = PASS.
2. lensFindings: the generated output MUST contain one entry for EVERY lens in expectedLenses. If any lens is missing, that is a FAIL. Each finding must be grounded in a specific observation (not "limited findings" without any specifics when the data contained signals).
3. urgency: MUST name a specific trigger — a regulation, metric, event, or crisis. "Delay will compound inefficiencies" without naming the trigger = FAIL.

CONTENT TO REVIEW:
${reviewInput}

Return JSON: { "passed": boolean, "gaps": string[] }
- passed: true only if ALL rubric items pass
- gaps: array of specific failure descriptions (empty if passed)
  Format each gap as: "Finding 3 is too generic — names no system or metric" or "Customer lens is missing from lensFindings" or "Urgency cites no specific trigger"`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: validationPrompt }],
    temperature: 0.1,
    max_tokens: 600,
  });

  const raw = response.choices[0]?.message?.content ?? '{"passed":true,"gaps":[]}';
  const result = JSON.parse(raw) as { passed: boolean; gaps: string[] };
  return {
    passed: result.passed === true,
    gaps: Array.isArray(result.gaps) ? result.gaps : [],
  };
}

// ── Agent ────────────────────────────────────────────────────────────────────

export async function runReportSummaryAgent(
  signals: WorkshopSignals,
  intelligence: WorkshopOutputIntelligence,
  onProgress?: (msg: string) => void
): Promise<ReportSummary> {
  onProgress?.('Report Summary: synthesising executive output…');

  const systemPrompt = `You are the DREAM Download Report writer. You receive pre-generated workshop intelligence and write the two client-facing narrative sections. This is a professional deliverable — it must read like a rigorous executive report, not a consulting slide deck.

EXECUTIVE SUMMARY RULES:
• Must directly answer the workshop ask — not describe the workshop process
• whatWeFound: MINIMUM 6 items — each must name a specific system, team, metric, or process observed — no generic phrases like "lack of alignment" without naming what is misaligned
• METRIC CITATION RULE — CRITICAL: Before writing whatWeFound and urgency, scan the entire intelligence for ANY specific percentage, named system, named role, customer tier, or quantified outcome (e.g. "30-40% AHT reduction", "Gold and Platinum tier members", "8 legacy systems", "34% attrition"). Every specific metric or named entity found MUST appear verbatim in at least one finding or the urgency field. Do not paraphrase or generalise a specific number — quote it exactly.
• lensFindings: produce ONE entry for EVERY lens listed under "Lenses:" in WORKSHOP CONTEXT — no exceptions, no omissions. Consult the "SIGNALS BY LENS" section for evidence. If signals for a lens were thin or absent, write the finding as: "Workshop signals for this lens were limited — [describe what little was captured, or state 'no pads were recorded for this lens']". NEVER omit a lens that the workshop ran.
• urgency: MUST name at least one specific item from the intelligence — a named regulation, a measured attrition rate, a specific metric, a named operational crisis, or a competitive event. "Inefficiencies will compound" without a named trigger is not acceptable.
• whyItMatters: must name specific business consequences — operational cost, customer impact, staff impact, competitive exposure — be concrete
• If evidence for a finding does not exist in the provided intelligence, DO NOT include that finding — omit rather than invent

SOLUTION SUMMARY RULES:
• whatMustChange: MINIMUM 4 areas — each currentState must describe the observable reality today using the workshop evidence — not aspirational language about what SHOULD happen
• successIndicators: MINIMUM 4 — each must be an observable outcome a manager could verify — not "improve efficiency" but "case resolved in single interaction without system switching"
• rationale must trace directly to the root causes provided — if a root cause is not relevant to the direction, do not reference it

ABSOLUTE RULES — NO EXCEPTIONS:
• NEVER invent data, metrics, or findings not present in the provided intelligence
• NEVER use generic consulting phrases (e.g. "foster a culture of", "drive alignment", "leverage synergies")
• If evidence is genuinely thin for a section, write "Insufficient evidence from workshop signals" for that field — do not pad
• Output MUST be valid JSON matching the schema exactly — no commentary outside JSON

VALIDATION TEST before completing:
Could a senior executive read executiveSummary and solutionSummary and know: (1) exactly what was asked, (2) the specific answer with evidence, (3) what must change and in what order?
If not, set validationPassed: false and list the specific gaps in validationGaps.`;

  const contextDump = buildContextDump(signals, intelligence);

  const userMessage = `${contextDump}

Based on ALL the above pre-generated intelligence, write the report summary.

Return JSON matching this schema exactly:
${SCHEMA}`;

  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 6000,
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as ReportSummary;
      parsed.generatedAtMs = Date.now();

      // ── Self-critique validation pass ───────────────────────────────────
      // Run a separate, low-temperature reviewer that checks the generated
      // output against a specificity rubric. Separates generation from
      // validation — the generating model always says it passed.
      onProgress?.('Report Summary: validating quality…');
      try {
        const validationResult = await runValidationPass(openai, parsed, signals.context.lenses);
        parsed.validationPassed = validationResult.passed;
        parsed.validationGaps = validationResult.gaps;
      } catch (validationErr) {
        // Non-fatal — if validation fails, keep the generated output as-is
        console.error('[Report Summary] Validation pass failed:', validationErr);
      }

      onProgress?.('Report Summary: complete ✓');
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Report Summary agent failed after 3 attempts');
}

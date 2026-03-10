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
      { "lens": "string — lens name (e.g. People)", "finding": "string — what this lens specifically revealed in the workshop, grounded in evidence" },
      { "lens": "string", "finding": "string" }
    ],

    "whyItMatters": "string — 3-4 sentences: name the direct business cost of these issues (operational, financial, customer, competitive) — no generic consulting language — be specific to this organisation",
    "opportunityOrRisk": "string — 3-4 sentences: name the specific opportunity if addressed, and the specific risk if not — reference the root cause and the evidence",
    "urgency": "string — 1-2 sentences: the operational or market reason why delay compounds the problem — specific to this organisation",
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
  if (intelligence.futureState.redesignPrinciples.length > 0) {
    lines.push(`Redesign Principles:\n${intelligence.futureState.redesignPrinciples.map((p) => `• ${p}`).join('\n')}`);
  }
  if (intelligence.futureState.operatingModelChanges.length > 0) {
    lines.push('\nOperating Model Changes:');
    for (const change of intelligence.futureState.operatingModelChanges.slice(0, 5)) {
      lines.push(`• ${change.area}: [Current] ${change.currentState} → [Future] ${change.futureState} (Enabler: ${change.enabler})`);
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

  // ── Strategic Impact ──────────────────────────────────────────────────────
  lines.push('\n=== STRATEGIC IMPACT ===');
  lines.push(`Automation Potential: ${intelligence.strategicImpact.automationPotential.percentage}% — ${intelligence.strategicImpact.automationPotential.description}`);
  lines.push(`Business Case: ${intelligence.strategicImpact.businessCaseSummary}`);
  if (intelligence.strategicImpact.efficiencyGains.length > 0) {
    lines.push('\nEfficiency Gains:');
    for (const eg of intelligence.strategicImpact.efficiencyGains.slice(0, 4)) {
      lines.push(`• ${eg.metric}: ${eg.estimated} (${eg.basis})`);
    }
  }

  // ── Live Workshop Signals ─────────────────────────────────────────────────
  const totalPads =
    signals.liveSession.reimaginePads.length +
    signals.liveSession.constraintPads.length +
    signals.liveSession.defineApproachPads.length;

  if (totalPads > 0) {
    lines.push(`\n=== LIVE WORKSHOP SIGNALS (${totalPads} pads) ===`);
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

  return lines.join('\n');
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
• lensFindings: one entry per lens used in the workshop — each must describe what that specific lens revealed — if a lens had no substantive findings, omit it entirely (do not make up findings)
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
        max_tokens: 4000,
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as ReportSummary;
      parsed.generatedAtMs = Date.now();
      onProgress?.('Report Summary: complete ✓');
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Report Summary agent failed after 3 attempts');
}

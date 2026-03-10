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
  "keyInsight": "string — the single most important thing the workshop revealed (specific, not generic)",

  "executiveSummary": {
    "theAsk": "string — one sentence: what was commissioned and why",
    "theAnswer": "string — one sentence: the direct answer to the ask (bold claim, grounded in evidence)",
    "whatWeFound": [
      "string — specific finding 1 from this workshop (not generic)",
      "string — specific finding 2",
      "string — specific finding 3",
      "string — specific finding 4"
    ],
    "whyItMatters": "string — 2-3 sentences: business impact, stakes, consequence of inaction — specific to this organisation",
    "opportunityOrRisk": "string — 2-3 sentences: the specific opportunity or risk revealed — named concretely, not abstractly",
    "urgency": "string — one sentence: why this needs to be addressed now (market/competitive/operational reason)"
  },

  "solutionSummary": {
    "direction": "string — one sentence transformation headline (e.g. 'Move from reactive case handling to AI-augmented advisory')",
    "rationale": "string — 2-3 sentences: why this is the right direction, grounded in the root causes identified",
    "whatMustChange": [
      { "area": "string", "currentState": "string — concrete description of today's reality", "requiredChange": "string — specific change needed" },
      { "area": "string", "currentState": "string", "requiredChange": "string" },
      { "area": "string", "currentState": "string", "requiredChange": "string" }
    ],
    "startingPoint": "string — 2-3 sentences: what to do first and the logic of sequencing (why this step unlocks the others)",
    "successIndicators": [
      "string — observable outcome 1 (specific and measurable, not 'improve experience')",
      "string — observable outcome 2",
      "string — observable outcome 3"
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

  const systemPrompt = `You are the DREAM Download Report writer — the final synthesis layer. Your job is to read all pre-generated workshop intelligence and write the two client-facing sections defined by the DREAM report guidance:

1. EXECUTIVE SUMMARY — directly answers the workshop ask with specific, evidenced findings
2. SOLUTION SUMMARY — recommends the way forward grounded in root causes

CRITICAL RULES:
• The Executive Summary MUST answer the workshop ask — not summarise the workshop
• Every finding in whatWeFound must be specific to this organisation and this workshop — NO generic consulting language
• whatMustChange must describe concrete current-state reality, not abstract categories
• successIndicators must be observable outcomes — e.g. "advisor completes end-to-end case without switching systems" not "improve customer experience"
• If signals are thin, state that explicitly rather than padding with generics
• Minimum: 4 items in whatWeFound, 3 items in whatMustChange, 3 items in successIndicators
• Output MUST be valid JSON matching the schema exactly — no commentary outside the JSON

VALIDATION TEST (apply before completing):
If an executive reads only executiveSummary and solutionSummary, will they clearly understand:
- The answer to the workshop objective? ✓
- The specific opportunity or risk revealed? ✓
- The recommended direction forward? ✓
If no, set validationPassed: false and list gaps in validationGaps.`;

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
        max_tokens: 3000,
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

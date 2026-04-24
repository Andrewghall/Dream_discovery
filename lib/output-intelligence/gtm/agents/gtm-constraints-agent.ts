/**
 * GTM Agent 3: Constraints
 *
 * Exposes what stops the business moving from current GTM reality to
 * the target state — blockers by lens, contradictions, dependencies,
 * trade-offs, and failure exposure.
 *
 * Phase 3 of the GTM/ICP output model.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals } from '../../types';
import type { GtmConstraints } from '../types';

const SCHEMA = `{
  "constraintSummary": "2-3 sentences naming the dominant structural pattern blocking GTM improvement. Not a list of issues — a diagnosis of the systemic constraint.",
  "constraintStack": [
    {
      "lens": "Risk/Compliance | Partners | Technology | Operations | Commercial | People",
      "blockers": [
        {
          "title": "Specific constraint name (5-10 words)",
          "description": "What this blocker actually is and why it matters for GTM. Participant voice where available.",
          "severity": "critical | significant | moderate"
        }
      ]
    }
  ],
  "contradictionMap": [
    {
      "target": "What the ideal state requires (e.g. 'Qualify out bad-fit deals early')",
      "reality": "What is actually happening (e.g. 'Sales team accepts any pipeline to hit activity targets')",
      "conflict": "Why these cannot coexist — what must change for the target to become real"
    }
  ],
  "dependencyMap": [
    {
      "name": "Name of the dependency (e.g. 'Partner X for data migration capability')",
      "type": "internal_capability | external_partner | technology | governance | delivery_model",
      "riskMarker": "fragile | unproven | over_reliant | unowned",
      "description": "Why this dependency is a risk to the GTM model"
    }
  ],
  "tradeOffMap": [
    {
      "keep": "What must be kept or protected even though it is imperfect",
      "lose": "What must be stopped, removed, or abandoned — even if currently generating revenue",
      "commercialConsequence": "What is the short-term commercial cost of this trade-off? Be honest."
    }
  ],
  "failureExposure": {
    "buyerTrust": "red | amber | green — current buyer trust level across the pipeline",
    "deliveryConfidence": "red | amber | green — confidence that delivery can support the proposition",
    "commercialViability": "red | amber | green — commercial model's ability to support growth",
    "technologyProof": "red | amber | green — ability to prove technology capability in live deals",
    "partnerDependency": "red | amber | green — risk level from partner dependency",
    "riskPosition": "red | amber | green — overall risk and compliance exposure in deal cycle"
  }
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push('=== GTM CONTEXT ===');
  lines.push(`Client / Organisation: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Business Context: ${signals.context.businessContext || 'Not specified'}`);

  // Constraint pads = the primary source
  if (signals.liveSession.constraintPads.length > 0) {
    lines.push('\n=== CONSTRAINT SIGNALS (participant voice — what blocks the ideal state) ===');
    signals.liveSession.constraintPads.forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.actor ? ` — ${p.actor}` : ''}`);
    });
  }

  // Discovery pads reveal reality constraints
  const discoveryPads = signals.liveSession.discoveryPads ?? [];
  if (discoveryPads.length > 0) {
    lines.push('\n=== REALITY SIGNALS (current state — reveals structural constraints) ===');
    discoveryPads.slice(0, 30).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  // Reimagine reveals what the ideal state is — needed to build the contradiction map
  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== IDEAL STATE SIGNALS (needed to build contradiction map: target vs reality) ===');
    signals.liveSession.reimaginePads.slice(0, 20).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  if (signals.discovery.constraints.length > 0) {
    lines.push('\n=== STRUCTURED CONSTRAINTS (from discovery analysis) ===');
    signals.discovery.constraints.forEach((c) => {
      lines.push(`• ${c.title}${c.description ? ': ' + c.description : ''} [${c.type ?? 'general'}]`);
    });
  }

  if (signals.discovery.tensions.length > 0) {
    lines.push('\n=== TENSIONS (opposing views — reveal contradictions) ===');
    signals.discovery.tensions.forEach((t) => {
      lines.push(`• [${t.severity ?? 'unknown'}] ${t.topic}: ${t.perspectives.join(' | ')}`);
    });
  }

  if (signals.discovery.insights.length > 0) {
    const challenges = signals.discovery.insights.filter(
      (i) => i.type === 'CHALLENGE' || i.type === 'CONSTRAINT'
    );
    if (challenges.length > 0) {
      lines.push('\n=== CHALLENGE SIGNALS ===');
      challenges.slice(0, 20).forEach((i) => lines.push(`• ${i.text}`));
    }
  }

  if (signals.discovery.cohortBreakdown?.length) {
    lines.push('\n=== SIGNALS BY COHORT ===');
    for (const cohort of signals.discovery.cohortBreakdown) {
      lines.push(`\n${cohort.cohortLabel} (n=${cohort.participantCount})`);
      if (cohort.topFrictions.length)
        lines.push(`  Frictions:\n${cohort.topFrictions.map((f) => `    • ${f}`).join('\n')}`);
    }
  }

  if (signals.scratchpad.constraintsContent) {
    lines.push('\n=== SCRATCHPAD CONSTRAINTS NOTES ===');
    lines.push(signals.scratchpad.constraintsContent.slice(0, 2000));
  }

  if (signals.evidenceDocuments?.length) {
    lines.push('\n=== EVIDENCE DOCUMENTS ===');
    for (const doc of signals.evidenceDocuments) {
      lines.push(`\n${doc.fileName} (signal: ${doc.signalDirection})`);
      doc.keyFindings.slice(0, 4).forEach((f) => lines.push(`  • ${f}`));
    }
  }

  return lines.join('\n');
}

export async function runGtmConstraintsAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<GtmConstraints> {
  onProgress?.('GTM Constraints: exposing what blocks the ideal state…');

  const systemPrompt = `You are the DREAM GTM Constraint Engine — exposing what prevents this business from moving to its target GTM state.

YOUR JOB: Name what is structurally blocking the GTM ideal state. This is not a list of problems — it is a force field analysis of what must change for the GTM direction to become real.

CRITICAL RULES:

constraintSummary: One diagnosis. Not a list — the single most important structural truth about what's holding the GTM back.

constraintStack:
- Order lenses from hardest to softest constraint: Risk/Compliance → Partners → Technology → Operations → Commercial → People
- Each lens should have 2-5 specific blockers
- participantVoice where possible — use their words, not consulting language
- Severity: critical = blocks GTM direction entirely without fixing, significant = material but workable, moderate = friction but not a blocker

contradictionMap (4-8 items):
- Each row shows a specific conflict between what the target state requires and what current reality does
- These are the most powerful items in the constraints output — they force explicit choices
- "conflict" explains WHY these cannot coexist — not just what the gap is

dependencyMap (3-8 items):
- Only real dependencies that create actual risk to the GTM model
- riskMarker: fragile = will break under pressure, unproven = assumed capability never tested, over_reliant = single point of failure, unowned = borrowed from partner or third party

tradeOffMap (3-6 items):
- These are the explicit commercial sacrifices required to fix the GTM
- "lose" must be honest — including short-term revenue if that's what the signals show
- "commercialConsequence" must quantify or specifically name the short-term cost

failureExposure:
- red = high risk / failing now, amber = risk exists but manageable, green = solid
- Assess each dimension against the signals honestly

USE ONLY signals provided. Output MUST be valid JSON. No commentary outside JSON.`;

  const userMessage = `${buildSignalDump(signals)}

Return JSON matching this schema exactly:
${SCHEMA}`;

  const apiKey = process.env.OPENAI_API_KEY;
  const openai = apiKey ? new OpenAI({ apiKey }) : null;
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await openAiBreaker.execute(() =>
        openai.chat.completions.create(
          {
            model: 'gpt-4o',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 7000,
          },
          { signal: controller.signal }
        )
      );

      clearTimeout(timeoutId);
      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as GtmConstraints;
      onProgress?.('GTM Constraints: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('GTM Constraints agent failed after 3 attempts');
}

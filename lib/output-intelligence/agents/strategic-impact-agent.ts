/**
 * Engine 5: Strategic Impact Agent
 *
 * Quantifies the transformation impact — automation potential, efficiency gains,
 * experience improvements — to support business case creation.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals, StrategicImpact } from '../types';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const SCHEMA = `{
  "automationPotential": {
    "percentage": <number — derive from evidence, do NOT copy example values>,
    "description": "string — what can be fully automated and how"
  },
  "aiAssistedWork": {
    "percentage": <number — derive from evidence, do NOT copy example values>,
    "description": "string — what can be augmented with AI assistance"
  },
  "humanOnlyWork": {
    "percentage": <number — derive from evidence, do NOT copy example values>,
    "description": "string — what must remain human-led and why"
  },
  "efficiencyGains": [
    {
      "metric": "string — e.g. Average Handling Time, Processing Speed",
      "estimated": "string — e.g. 30-40% reduction",
      "basis": "string — what in the signals supports this estimate"
    }
  ],
  "experienceImprovements": [
    {
      "dimension": "string — e.g. Customer Satisfaction, Employee Experience",
      "currentState": "string — current state implied by signals",
      "futureState": "string — projected future state",
      "impact": "string — how significant this improvement is"
    }
  ],
  "businessCaseSummary": "string — 2-3 paragraph executive summary of the transformation value. Written for a CEO or CFO. Must be compelling and evidence-grounded.",
  "confidenceScore": <number 0-100 — derive from evidence strength, do NOT copy example values>
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push(`=== CONTEXT ===`);
  lines.push(`Client: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Lenses: ${signals.context.lenses.join(', ')}`);
  lines.push(`Business context: ${signals.context.businessContext || 'Not specified'}`);
  lines.push(`Participants engaged: ${signals.discovery.participantCount}`);

  if (signals.liveSession.journey.length > 0) {
    lines.push('\n=== JOURNEY STAGES WITH AI POTENTIAL ===');
    signals.liveSession.journey.forEach((j) => {
      lines.push(`• ${j.stage}${j.aiScore !== undefined ? ` — AI potential: ${j.aiScore}/10` : ''}${j.description ? ': ' + j.description : ''}`);
      if (j.painPoints && j.painPoints.length > 0) {
        lines.push(`  Pain points: ${j.painPoints.join('; ')}`);
      }
    });
  }

  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== REIMAGINE SIGNALS ===');
    signals.liveSession.reimaginePads.slice(0, 30).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  if (signals.discovery.themes.length > 0) {
    lines.push('\n=== KEY THEMES ===');
    signals.discovery.themes.forEach((t) => lines.push(`• ${t}`));
  }

  if (signals.discovery.insights.length > 0) {
    const impactSignals = signals.discovery.insights
      .filter((i) => ['VISION', 'OPPORTUNITY', 'ENABLER'].includes(i.type))
      .slice(0, 20);
    if (impactSignals.length > 0) {
      lines.push('\n=== OPPORTUNITY SIGNALS ===');
      impactSignals.forEach((i) => lines.push(`• [${i.type}] ${i.text}`));
    }
  }

  // NOTE: scratchpad exec summary and summary content intentionally excluded.
  // These are prior LLM outputs — including them creates a summary-of-summary
  // path. This agent must be grounded in raw signals only.

  lines.push('\n=== CONSTRAINTS ===');
  const constraints = [
    ...signals.liveSession.constraintPads.slice(0, 10).map((p) => p.text),
    ...signals.discovery.constraints.slice(0, 8).map((c) => c.title),
  ];
  if (constraints.length > 0) {
    constraints.forEach((c) => lines.push(`• ${c}`));
  } else {
    lines.push('No specific constraints captured.');
  }

  if (signals.discovery.cohortBreakdown?.length) {
    lines.push('\n=== SIGNALS BY PARTICIPANT COHORT ===');
    for (const cohort of signals.discovery.cohortBreakdown) {
      lines.push(`\n${cohort.cohortLabel} (n=${cohort.participantCount}, roles: ${cohort.roles.slice(0, 3).join(', ')})`);
      lines.push(`  Aspiration ratio: ${Math.round(cohort.aspirationRatio * 100)}%`);
      if (cohort.topFrictions.length)
        lines.push(`  Top frictions:\n${cohort.topFrictions.map((f) => `    • ${f}`).join('\n')}`);
      if (cohort.topAspirations.length)
        lines.push(`  Top aspirations:\n${cohort.topAspirations.map((a) => `    • ${a}`).join('\n')}`);
    }
    lines.push('\nQuantify impact at the cohort level where possible — the business case is stronger when it addresses specific role group outcomes, not just organisation-wide averages.');
  }

  if (signals.historicalMemory?.chunks.length) {
    lines.push('\n=== CROSS-WORKSHOP HISTORICAL MEMORY ===');
    lines.push('Relevant findings from past workshops in this organisation:');
    for (const c of signals.historicalMemory.chunks) {
      lines.push(`• [${c.source}, ${c.similarity.toFixed(2)}] ${c.text}`);
    }
    lines.push('(Supporting context only — not from this workshop)');
  }

  // ── Relationship graph: confidence calibration ───────────────────────────
  // Graph coverage and systemic edge count help calibrate confidenceScore.
  // Higher coverage + more SYSTEMIC edges = more evidence, higher valid confidence.
  if (signals.graphIntelligence) {
    const gi = signals.graphIntelligence;
    lines.push('\n=== RELATIONSHIP GRAPH: EVIDENCE CONFIDENCE CALIBRATION ===');
    lines.push(`Graph coverage: ${gi.summary.graphCoverageScore}% of evidence nodes are causally connected.`);
    lines.push(`SYSTEMIC-tier edges: ${gi.summary.systemicEdgeCount} (highest-evidence relationships).`);
    lines.push(`Dominant causal chains: ${gi.summary.totalChains} (CONSTRAINT → ENABLER → VISION pathways).`);
    lines.push(`Compensating behaviours: ${gi.summary.totalCompensatingBehaviours} (workarounds masking live constraints).`);
    if (gi.summary.graphCoverageScore < 30) {
      lines.push('Note: graph coverage is low — evidence is thin. Calibrate confidenceScore conservatively (< 50).');
    } else if (gi.summary.graphCoverageScore >= 70) {
      lines.push('Note: graph coverage is high — strong evidential basis. ConfidenceScore can reflect this.');
    }
    if (gi.dominantCausalChains.length > 0) {
      lines.push('\nStrongest causal chains (use to anchor efficiency gain estimates):');
      gi.dominantCausalChains.slice(0, 3).forEach(c =>
        lines.push(`  • ${c.labels.constraint} → ${c.labels.enabler} → ${c.labels.reimagination} [strength: ${c.chainStrength}]`)
      );
    }
  }

  return lines.join('\n');
}

export async function runStrategicImpactAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<StrategicImpact> {
  onProgress?.('Strategic Impact: quantifying transformation value…');

  const systemPrompt = `You are the DREAM VISION Signal engine — scanning this organisation's ideal future self and quantifying its value. Identify future operating model concepts, new organisational capabilities, AI-enabled decision intelligence, and the measurable impact of transformation. Make the vision concrete through numbers. Every output must be grounded in specific workshop evidence.

Your role is to estimate the business impact of the transformation — to support executive decision-making and business case creation.

Rules:
• automationPotential + aiAssistedWork + humanOnlyWork must sum to 100
• Base percentages on the AI potential signals in the journey stages and reimagine pads
• If AI potential scores are provided, use them to calibrate automation percentage
• efficiencyGains should be specific to the organisation's context, not generic
• experienceImprovements should cover both customer and employee dimensions
• confidenceScore (0-100) reflects how much evidence supports the estimates
• If signals are sparse, lower the confidenceScore and note it
• If you cannot compute meaningful percentages from the evidence, omit automationPotential, aiAssistedWork, and humanOnlyWork entirely (set them to null)
• businessCaseSummary must be compelling — written for a CEO or CFO, not technical
• Output MUST be valid JSON matching the schema — no commentary outside JSON`;

  const userMessage = `${buildSignalDump(signals)}

Return JSON matching this schema exactly:
${SCHEMA}`;

  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100_000);
    try {
      const response = await openAiBreaker.execute(() => openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 3500,
        },
        { signal: controller.signal }
      ));

      clearTimeout(timeoutId);
      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as StrategicImpact;
      onProgress?.('Strategic Impact: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Strategic Impact agent failed after 3 attempts');
}

/**
 * Engine 5: Strategic Impact Agent
 *
 * Quantifies the transformation impact — automation potential, efficiency gains,
 * experience improvements — to support business case creation.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { WorkshopSignals, StrategicImpact } from '../types';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const SCHEMA = `{
  "automationPotential": {
    "percentage": 35,
    "description": "string — what can be fully automated and how"
  },
  "aiAssistedWork": {
    "percentage": 45,
    "description": "string — what can be augmented with AI assistance"
  },
  "humanOnlyWork": {
    "percentage": 20,
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
  "confidenceScore": 70
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

  if (signals.scratchpad.execSummary) {
    lines.push('\n=== EXECUTIVE SUMMARY (PRE-SYNTHESISED) ===');
    lines.push(signals.scratchpad.execSummary);
  }

  if (signals.scratchpad.summaryContent) {
    lines.push('\n=== SUMMARY (PRE-SYNTHESISED) ===');
    lines.push(signals.scratchpad.summaryContent);
  }

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
• businessCaseSummary must be compelling — written for a CEO or CFO, not technical
• Output MUST be valid JSON matching the schema — no commentary outside JSON`;

  const userMessage = `${buildSignalDump(signals)}

Return JSON matching this schema exactly:
${SCHEMA}`;

  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 3500,
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as StrategicImpact;
      onProgress?.('Strategic Impact: complete ✓');
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Strategic Impact agent failed after 3 attempts');
}

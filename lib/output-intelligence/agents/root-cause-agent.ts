/**
 * Engine 2: Root Cause Intelligence Agent
 *
 * Analyses workshop signals to surface systemic root causes — not symptoms.
 * Produces a ranked list of root causes, a friction map by journey stage,
 * and a systemic pattern narrative.
 */

import OpenAI from 'openai';
import type { WorkshopSignals, RootCauseIntelligence } from '../types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCHEMA = `{
  "rootCauses": [
    {
      "rank": 1,
      "cause": "string — the underlying systemic cause (not symptom)",
      "category": "string — e.g. Process, Technology, Culture, Governance, Data",
      "journeyStages": ["string — which journey stages this affects"],
      "affectedLenses": ["string — which lenses surfaced this"],
      "evidence": ["string — specific evidence from signals"],
      "severity": "critical | significant | moderate"
    }
  ],
  "systemicPattern": "string — 1-2 paragraph diagnosis of the deeper structural pattern driving these causes",
  "frictionMap": [
    {
      "stage": "string — journey stage name",
      "frictionLevel": 7,
      "primaryCause": "string — the dominant cause at this stage"
    }
  ]
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push(`=== CONTEXT ===`);
  lines.push(`Client: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Lenses: ${signals.context.lenses.join(', ')}`);
  lines.push(`Business context: ${signals.context.businessContext || 'Not specified'}`);

  lines.push('\n=== TENSIONS ===');
  if (signals.discovery.tensions.length > 0) {
    signals.discovery.tensions.forEach((t) => {
      lines.push(`• [${t.severity ?? 'unknown'}] ${t.topic}: ${t.perspectives.join(' | ')}`);
    });
  } else {
    lines.push('No tensions identified in discovery phase.');
  }

  lines.push('\n=== CONSTRAINTS ===');
  if (signals.discovery.constraints.length > 0) {
    signals.discovery.constraints.forEach((c) => {
      lines.push(`• ${c.title}${c.description ? ': ' + c.description : ''} [${c.type ?? 'general'}]`);
    });
  } else {
    lines.push('No constraints identified.');
  }

  lines.push('\n=== THEMES ===');
  if (signals.discovery.themes.length > 0) {
    signals.discovery.themes.forEach((t) => lines.push(`• ${t}`));
  } else {
    lines.push('No themes identified.');
  }

  if (signals.liveSession.journey.length > 0) {
    lines.push('\n=== JOURNEY STAGES ===');
    signals.liveSession.journey.forEach((j) => {
      lines.push(`• ${j.stage}${j.aiScore !== undefined ? ` (AI potential score: ${j.aiScore})` : ''}${j.description ? ': ' + j.description : ''}`);
      if (j.painPoints && j.painPoints.length > 0) {
        lines.push(`  Pain points: ${j.painPoints.join('; ')}`);
      }
    });
  }

  if (signals.liveSession.constraintPads.length > 0) {
    lines.push('\n=== CONSTRAINT PADS (LIVE WORKSHOP) ===');
    signals.liveSession.constraintPads.slice(0, 25).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== REIMAGINE PADS (WHAT NEEDS TO CHANGE) ===');
    signals.liveSession.reimaginePads.slice(0, 25).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  if (signals.discovery.insights.length > 0) {
    const challenges = signals.discovery.insights
      .filter((i) => i.type === 'CHALLENGE' || i.type === 'CONSTRAINT')
      .slice(0, 20);
    if (challenges.length > 0) {
      lines.push('\n=== KEY CHALLENGES FROM PARTICIPANTS ===');
      challenges.forEach((i) => lines.push(`• ${i.text}`));
    }
  }

  return lines.join('\n');
}

export async function runRootCauseAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<RootCauseIntelligence> {
  onProgress?.('Root Cause Intelligence: analysing systemic causes…');

  const systemPrompt = `You are a senior transformation strategist generating Root Cause Intelligence for a DREAM Workshop.

Your role is to identify SYSTEMIC ROOT CAUSES — not surface symptoms.
Look for patterns across lenses, tensions, constraints, and journey stages that reveal WHY the organisation is experiencing its challenges.

Rules:
• Use ONLY the signals provided — never invent evidence
• Rank root causes by severity and evidence strength
• If evidence is weak, note this in the cause description
• frictionLevel must be 0-10 (10 = maximum friction)
• Generate frictionMap entries for each journey stage provided
• If no journey stages exist, create a generic frictionMap based on lenses
• Output MUST be valid JSON matching the schema — no commentary outside JSON`;

  const userMessage = `${buildSignalDump(signals)}

Return JSON matching this schema exactly:
${SCHEMA}`;

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
        max_tokens: 3000,
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as RootCauseIntelligence;
      onProgress?.('Root Cause Intelligence: complete ✓');
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Root Cause agent failed after 3 attempts');
}

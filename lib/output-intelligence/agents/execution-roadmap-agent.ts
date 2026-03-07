/**
 * Engine 4: Execution Roadmap Agent
 *
 * Converts the future state vision into a phased transformation roadmap
 * with concrete initiatives, capabilities, dependencies, and risks.
 */

import OpenAI from 'openai';
import type { WorkshopSignals, ExecutionRoadmap } from '../types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCHEMA = `{
  "phases": [
    {
      "phase": "Phase 1 — Immediate Enablement",
      "timeframe": "string — e.g. 0-3 months",
      "initiatives": [
        {
          "title": "string — initiative name",
          "description": "string — what this initiative involves",
          "outcome": "string — what success looks like"
        }
      ],
      "capabilities": ["string — capability required"],
      "dependencies": ["string — what must exist before this phase"],
      "constraints": ["string — constraints that affect this phase"]
    },
    {
      "phase": "Phase 2 — Structural Transformation",
      "timeframe": "string — e.g. 3-9 months",
      "initiatives": [],
      "capabilities": [],
      "dependencies": [],
      "constraints": []
    },
    {
      "phase": "Phase 3 — Advanced Automation",
      "timeframe": "string — e.g. 9-18 months",
      "initiatives": [],
      "capabilities": [],
      "dependencies": [],
      "constraints": []
    }
  ],
  "criticalPath": "string — 1-2 sentences describing the most critical sequence of activities",
  "keyRisks": [
    "string — key risk that could derail transformation"
  ]
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push(`=== CONTEXT ===`);
  lines.push(`Client: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Lenses: ${signals.context.lenses.join(', ')}`);
  lines.push(`Business context: ${signals.context.businessContext || 'Not specified'}`);

  if (signals.liveSession.defineApproachPads.length > 0) {
    lines.push('\n=== DEFINE APPROACH SIGNALS (HOW TO GET THERE) ===');
    lines.push('These signals define HOW the organisation wants to get to the future state:');
    signals.liveSession.defineApproachPads.slice(0, 40).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.type ? ` (${p.type})` : ''}`);
    });
  }

  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== REIMAGINE SIGNALS (WHAT TO BUILD) ===');
    signals.liveSession.reimaginePads.slice(0, 25).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  lines.push('\n=== CONSTRAINTS TO PLAN AROUND ===');
  const allConstraints = [
    ...signals.liveSession.constraintPads.slice(0, 15).map((p) => p.text),
    ...signals.discovery.constraints.slice(0, 10).map((c) => c.title),
  ];
  if (allConstraints.length > 0) {
    allConstraints.forEach((c) => lines.push(`• ${c}`));
  } else {
    lines.push('No specific constraints captured.');
  }

  if (signals.discovery.tensions.length > 0) {
    lines.push('\n=== TENSIONS TO RESOLVE ===');
    signals.discovery.tensions.slice(0, 10).forEach((t) => {
      lines.push(`• ${t.topic} (${t.severity ?? 'unknown'}): ${t.perspectives.join(' vs ')}`);
    });
  }

  if (signals.scratchpad.potentialSolution) {
    lines.push('\n=== POTENTIAL SOLUTION (PRE-SYNTHESISED) ===');
    lines.push(signals.scratchpad.potentialSolution);
  }

  return lines.join('\n');
}

export async function runExecutionRoadmapAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<ExecutionRoadmap> {
  onProgress?.('Execution Roadmap: building phased transformation plan…');

  const systemPrompt = `You are a senior transformation strategist generating an Execution Roadmap for a DREAM Workshop.

Your role is to convert the workshop signals into a practical phased transformation roadmap.

Rules:
• All 3 phases MUST be present: "Phase 1 — Immediate Enablement", "Phase 2 — Structural Transformation", "Phase 3 — Advanced Automation"
• Phase 1 should contain quick wins and foundation-setting (0-3 months)
• Phase 2 should contain structural changes requiring planning (3-9 months)
• Phase 3 should contain advanced automation and optimisation (9-18 months)
• Each phase should have 3-5 initiatives minimum
• Initiatives should be specific, not generic
• Base everything on the signals provided — do not invent initiatives not implied by the data
• If signals are sparse, create reasonable initiatives but note low confidence
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
        max_tokens: 4000,
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as ExecutionRoadmap;
      onProgress?.('Execution Roadmap: complete ✓');
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Execution Roadmap agent failed after 3 attempts');
}

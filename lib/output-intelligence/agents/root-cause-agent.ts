/**
 * Engine 2: Root Cause Intelligence Agent
 *
 * Analyses workshop signals to surface systemic root causes — not symptoms.
 * Produces a ranked list of root causes, a friction map by journey stage,
 * and a systemic pattern narrative.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals, RootCauseIntelligence } from '../types';
// OpenAI client constructed lazily inside runRootCauseAgent() — never at module load.

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
    lines.push('\nUse cohort divergence to identify role-specific root causes and where cohorts must move in lockstep for transformation to succeed.');
  }

  if (signals.historicalMemory?.chunks.length) {
    lines.push('\n=== CROSS-WORKSHOP HISTORICAL MEMORY ===');
    lines.push('Relevant findings from past workshops in this organisation:');
    for (const c of signals.historicalMemory.chunks) {
      lines.push(`• [${c.source}, ${c.similarity.toFixed(2)}] ${c.text}`);
    }
    lines.push('(Supporting context only — not from this workshop)');
  }

  // ── Relationship graph: bottlenecks + compensating behaviours ───────────
  // These are deterministic findings from the evidence graph — use them to
  // anchor root cause analysis in structural evidence rather than inference.
  if (signals.graphIntelligence) {
    const gi = signals.graphIntelligence;

    if (gi.bottlenecks.length > 0) {
      lines.push('\n=== RELATIONSHIP GRAPH: STRUCTURAL BOTTLENECKS ===');
      lines.push('Constraints that block or drive the most other areas (deterministic, evidence-backed):');
      for (const b of gi.bottlenecks.slice(0, 5)) {
        lines.push(`• "${b.displayLabel}" — affects ${b.outDegree} areas, evidence tier: ${b.evidenceTier}, score: ${b.compositeScore}`);
      }
      lines.push('These are the highest-leverage root cause candidates — prioritise them in your analysis.');
    }

    if (gi.compensatingBehaviours.length > 0) {
      lines.push('\n=== RELATIONSHIP GRAPH: COMPENSATING BEHAVIOURS (WORKAROUNDS) ===');
      lines.push('Enablers papering over live constraints rather than resolving them:');
      for (const cb of gi.compensatingBehaviours.slice(0, 5)) {
        lines.push(`• "${cb.enablerLabel}" compensates for "${cb.constraintLabel}" — risk: ${cb.riskLevel}, constraint frequency: ${cb.constraintRawFrequency} signals`);
      }
      lines.push('These represent systemic root causes being managed rather than resolved — flag them as structural risk.');
    }

    if (gi.brokenChains.filter(bc => bc.brokenChainType === 'CONSTRAINT_NO_RESPONSE' && bc.severity === 'high').length > 0) {
      lines.push('\n=== RELATIONSHIP GRAPH: UNADDRESSED CONSTRAINTS ===');
      lines.push('High-frequency constraints with no identified organisational response:');
      gi.brokenChains
        .filter(bc => bc.brokenChainType === 'CONSTRAINT_NO_RESPONSE' && bc.severity === 'high')
        .slice(0, 5)
        .forEach(bc => lines.push(`• "${bc.displayLabel}" — ${bc.rawFrequency} mentions, ${bc.evidenceTier} tier — no response pathway detected`));
    }

    if (gi.summary.graphCoverageScore > 0) {
      lines.push(`\n[Graph coverage: ${gi.summary.graphCoverageScore}% of nodes connected. ${gi.summary.systemicEdgeCount} SYSTEMIC-tier edges detected.]`);
    }
  }

  return lines.join('\n');
}

export async function runRootCauseAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<RootCauseIntelligence> {
  onProgress?.('Root Cause Intelligence: analysing systemic causes…');

  const systemPrompt = `You are the DREAM INHIBITION Signal engine — scanning the forces preventing transformation in this organisation. Identify governance barriers, technology fragmentation, decision bottlenecks, cross-team friction, and knowledge silos. Move beyond symptoms to systemic causes. Rank constraints by their power to block transformation. Every output must be grounded in specific workshop evidence.

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

  const apiKey = process.env.OPENAI_API_KEY;
  const openai = apiKey ? new OpenAI({ apiKey }) : null;
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100_000);
    try {
      const response = await openAiBreaker.execute(() => openai.chat.completions.create(
        {
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        },
        { signal: controller.signal }
      ));

      clearTimeout(timeoutId);
      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as RootCauseIntelligence;
      onProgress?.('Root Cause Intelligence: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Root Cause agent failed after 3 attempts');
}

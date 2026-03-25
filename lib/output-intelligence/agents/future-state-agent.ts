/**
 * Engine 3: Future State Design Agent
 *
 * Transforms creative workshop signals into a coherent target operating model.
 * Defines what the organisation should become — AI/human model, operating
 * model changes, and redesign principles.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals, FutureStateDesign } from '../types';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const SCHEMA = `{
  "targetOperatingModel": "string — 2-3 paragraph description of what the organisation becomes. Write with strategic clarity and executive authority.",
  "aiHumanModel": [
    {
      "task": "string — specific task or activity",
      "recommendation": "AI Only | AI Assisted | Human Only",
      "rationale": "string — why this classification makes sense"
    }
  ],
  "operatingModelChanges": [
    {
      "area": "string — organisational area (e.g. Customer Service, Operations, Compliance)",
      "currentState": "string — what exists today",
      "futureState": "string — what it becomes",
      "enabler": "string — what enables the change (AI, process redesign, culture shift etc)"
    }
  ],
  "redesignPrinciples": [
    "string — principle 1",
    "string — principle 2"
  ],
  "narrative": "string — 1 paragraph strategic narrative about the transformation journey and what success looks like"
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push(`=== CONTEXT ===`);
  lines.push(`Client: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Lenses: ${signals.context.lenses.join(', ')}`);
  lines.push(`Business context: ${signals.context.businessContext || 'Not specified'}`);
  lines.push(`Objectives: ${signals.context.objectives || 'Not specified'}`);

  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== REIMAGINE SIGNALS (FUTURE VISION) ===');
    lines.push('These are ideas and visions captured during the workshop reimagine phase:');
    signals.liveSession.reimaginePads.slice(0, 40).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.type ? ` (${p.type})` : ''}`);
    });
  }

  if (signals.liveSession.defineApproachPads.length > 0) {
    lines.push('\n=== DEFINE APPROACH SIGNALS (HOW TO GET THERE) ===');
    signals.liveSession.defineApproachPads.slice(0, 30).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  if (signals.liveSession.journey.length > 0) {
    lines.push('\n=== CURRENT JOURNEY (CONTEXT FOR REDESIGN) ===');
    signals.liveSession.journey.forEach((j) => {
      lines.push(`• ${j.stage}${j.aiScore !== undefined ? ` (AI potential: ${j.aiScore}/10)` : ''}${j.description ? ': ' + j.description : ''}`);
    });
  }

  if (signals.discovery.insights.length > 0) {
    const visions = signals.discovery.insights
      .filter((i) => i.type === 'VISION' || i.type === 'ACTUAL_JOB')
      .slice(0, 20);
    if (visions.length > 0) {
      lines.push('\n=== PARTICIPANT VISIONS ===');
      visions.forEach((i) => lines.push(`• ${i.text}`));
    }
  }

  // NOTE: scratchpad potential solution and exec summary intentionally excluded.
  // These are prior LLM outputs — including them as evidence creates a
  // summary-of-summary path. Ground this agent in raw participant signals only.

  lines.push('\n=== CONSTRAINTS TO ACKNOWLEDGE ===');
  if (signals.liveSession.constraintPads.length > 0) {
    signals.liveSession.constraintPads.slice(0, 15).forEach((p) => {
      lines.push(`• ${p.text}`);
    });
  } else if (signals.discovery.constraints.length > 0) {
    signals.discovery.constraints.slice(0, 10).forEach((c) => {
      lines.push(`• ${c.title}`);
    });
  } else {
    lines.push('No constraints specified.');
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
    lines.push('\nUse cohort aspirations to design a future state that serves each role group — especially where frontline aspirations diverge from leadership vision.');
  }

  if (signals.historicalMemory?.chunks.length) {
    lines.push('\n=== CROSS-WORKSHOP HISTORICAL MEMORY ===');
    lines.push('Relevant findings from past workshops in this organisation:');
    for (const c of signals.historicalMemory.chunks) {
      lines.push(`• [${c.source}, ${c.similarity.toFixed(2)}] ${c.text}`);
    }
    lines.push('(Supporting context only — not from this workshop)');
  }

  // ── Relationship graph: dominant causal chains ───────────────────────────
  // These evidence-backed chains show what constraints → enablers → visions
  // look like in practice. Use them to anchor the target operating model in
  // structural evidence rather than pure aspiration.
  if (signals.graphIntelligence?.dominantCausalChains.length) {
    lines.push('\n=== RELATIONSHIP GRAPH: DOMINANT CAUSAL CHAINS ===');
    lines.push('Evidence-backed pathways from constraints through enablers to visions — these are the proven transformation levers:');
    for (const c of signals.graphIntelligence.dominantCausalChains) {
      lines.push(`• CONSTRAINT: "${c.labels.constraint}" → ENABLER: "${c.labels.enabler}" → VISION: "${c.labels.reimagination}" [chain strength: ${c.chainStrength}/100, weakest link: ${c.weakestLinkTier}]`);
    }
    lines.push('Design the target operating model and AI/human model to activate these chains — especially the strongest-evidenced paths.');
  }

  return lines.join('\n');
}

export async function runFutureStateAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<FutureStateDesign> {
  onProgress?.('Future State Design: generating target operating model…');

  const systemPrompt = `You are the DREAM IMAGINATION Signal engine — scanning what future this organisation believes is possible. Transform workshop creative signals into a coherent target operating model. Identify ambition clusters, desired outcomes, transformation opportunities, and innovation signals. Define what the organisation should become. Every output must be grounded in specific workshop evidence.

Your role is to synthesise the creative signals from the workshop into a coherent, actionable future state.

Rules:
• Build the future state from the reimagine and define approach signals — these are the source of truth
• The AI/human model should be driven by the tasks and activities mentioned in workshop signals
• Never invent AI capabilities not mentioned or implied by the signals
• The aiHumanModel should have 6-10 tasks minimum — be comprehensive
• operatingModelChanges should cover each lens area where signals exist
• redesignPrinciples should be 5-8 bold, memorable principles
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
          temperature: 0.4,
          max_tokens: 4000,
        },
        { signal: controller.signal }
      ));

      clearTimeout(timeoutId);
      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as FutureStateDesign;
      onProgress?.('Future State Design: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Future State agent failed after 3 attempts');
}

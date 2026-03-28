/**
 * Engine 3: Future State Design Agent
 *
 * Transforms creative workshop signals into a high-quality target operating model.
 * Outputs the full PAM-quality structure: title, three houses, direction of travel,
 * primary themes (5), supporting themes (3), vision alignment, and horizon vision.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals, FutureStateDesign } from '../types';
// OpenAI client constructed lazily inside runFutureStateAgent() — never at module load.

const SCHEMA = `{
  "targetOperatingModel": "string — 2-3 paragraph description of what the organisation becomes. Write with strategic clarity and executive authority.",
  "narrative": "string — 1 paragraph strategic narrative about the transformation journey and what success looks like",
  "redesignPrinciples": ["string — 5-8 bold, memorable principles"],
  "aiHumanModel": [
    {
      "task": "string — specific task or activity",
      "recommendation": "AI Only | AI Assisted | Human Only",
      "rationale": "string — why this classification makes sense"
    }
  ],
  "operatingModelChanges": [
    {
      "area": "string — organisational area",
      "currentState": "string — what exists today",
      "futureState": "string — what it becomes",
      "enabler": "string — what enables the change"
    }
  ],
  "title": "string — compelling 8-14 word headline capturing the core transformation vision",
  "description": "string — 2-3 sentences summarising the transformation in plain language for an executive audience",
  "threeHouses": {
    "current":    { "label": "string — 3-5 word label for today's state", "description": "string — 1 sentence describing the pain or limitation" },
    "transition": { "label": "string — 3-5 word label for the transition state", "description": "string — 1 sentence describing what changes first" },
    "future":     { "label": "string — 3-5 word label for the desired future", "description": "string — 1 sentence describing the transformed experience" }
  },
  "directionOfTravel": [
    { "from": "string — current state phrase (max 8 words)", "to": "string — future state phrase (max 8 words)" },
    { "from": "...", "to": "..." },
    { "from": "...", "to": "..." },
    { "from": "...", "to": "..." },
    { "from": "...", "to": "..." }
  ],
  "primaryThemes": [
    {
      "title": "string — theme name (4-8 words)",
      "badge": "very high | high",
      "description": "string — 2-3 sentences grounded in workshop signals",
      "subSections": [
        { "title": "string — sub-section name", "detail": "string — 2-3 sentences with specific evidence from signals" },
        { "title": "string", "detail": "string" }
      ]
    }
  ],
  "supportingThemes": [
    {
      "title": "string — theme name (4-8 words)",
      "badge": "medium",
      "description": "string — 1-2 sentences",
      "subSections": [
        { "title": "string", "detail": "string — 1-2 sentences" }
      ]
    }
  ],
  "visionAlignment": {
    "corePrinciples": ["string — 4-6 short, bold principle statements"],
    "platformPosition": "string — 2-3 sentences describing the strategic market/operational positioning"
  },
  "horizonVision": "string — 2-3 sentences describing what measurable success looks like in 3-5 years"
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

  const systemPrompt = `You are the DREAM IMAGINATION Signal engine — scanning what future this organisation believes is possible. Transform workshop creative signals into a rich, executive-quality reimagined future state output.

Your output must match a high-quality consulting standard. You are producing the "Reimagine" chapter of a strategic workshop report.

CRITICAL OUTPUT RULES:
• title: compelling 8-14 word headline that captures the transformation vision — make it memorable and specific to this client
• description: 2-3 plain-language sentences for an executive audience, no jargon
• threeHouses: three stages of transformation — name each stage with a crisp label and one-sentence description grounded in signals
• directionOfTravel: EXACTLY 5 shifts. Each "from" describes a real current pain (max 8 words), each "to" describes the desired future (max 8 words). Make these specific to the client, not generic
• primaryThemes: EXACTLY 5 themes. First 2-3 get badge "very high", remaining get "high". Each theme has 2-3 subSections. SubSections must be named and detailed — no vague placeholders. Ground each in specific signals.
• supportingThemes: EXACTLY 3 themes, each with badge "medium" and 1-2 subSections
• visionAlignment.corePrinciples: 4-6 bold, memorable statements (max 10 words each)
• visionAlignment.platformPosition: 2-3 sentences on strategic positioning
• horizonVision: 2-3 sentences on what 3-5 year success looks like — use measurable language where signals support it
• aiHumanModel: 6-10 tasks minimum, driven by tasks mentioned in signals
• operatingModelChanges: cover each lens area where signals exist
• redesignPrinciples: 5-8 principles

Every output must be grounded in specific workshop evidence. Never invent AI capabilities not mentioned or implied by the signals.
Output MUST be valid JSON matching the schema exactly — no commentary outside JSON.`;

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
      const response = await openAiBreaker.execute(() => openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.4,
          max_tokens: 6000,
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

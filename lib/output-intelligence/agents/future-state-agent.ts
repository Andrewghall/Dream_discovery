/**
 * Engine 3: Future State Design Agent
 *
 * Transforms creative workshop signals into a rich, actor-grounded reimagined future.
 * Outputs: title, three houses, actor journey (reimaginedJourney), primary themes (5),
 * supporting themes (3), vision alignment, horizon vision, and technical model detail.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals, FutureStateDesign } from '../types';

const SCHEMA = `{
  "targetOperatingModel": "string — 2-3 paragraph description of what the organisation becomes",
  "narrative": "string — 1 paragraph strategic narrative",
  "redesignPrinciples": ["string — 5-8 bold, memorable principles"],
  "aiHumanModel": [
    { "task": "string", "recommendation": "AI Only | AI Assisted | Human Only", "rationale": "string" }
  ],
  "operatingModelChanges": [
    { "area": "string", "currentState": "string", "futureState": "string", "enabler": "string" }
  ],
  "title": "string — compelling 8-14 word headline capturing the core transformation vision",
  "description": "string — 3 sentences: (1) name the transformation, (2) what it means for the people involved, (3) what it unlocks",
  "threeHouses": {
    "current":    { "label": "string — 3-5 word label", "description": "string — 2 sentences: the honest pain" },
    "transition": { "label": "string — 3-5 word label", "description": "string — 2 sentences: what changes first" },
    "future":     { "label": "string — 3-5 word label", "description": "string — 2 sentences: the dream fully realised" }
  },
  "reimaginedJourney": {
    "headline": "string — 6-10 words capturing what the future journey feels like",
    "actorJourneys": [
      {
        "actor": "string — use the exact role/actor names present in the workshop signals",
        "currentReality": "string — 2-3 sentences grounded in DISCOVERY signals: what does this actor experience TODAY? Be specific about pain, friction, frustration.",
        "reimaginedExperience": "string — 3-4 vivid sentences: what does this actor NOW experience in the future state? Paint the scene. What do they feel, see, do differently? Ground it in REIMAGINE signals.",
        "keyEnablers": ["string — specific enabler grounded in the workshop signals"]
      }
    ]
  },
  "directionOfTravel": [
    { "from": "string — current pain phrase (max 8 words)", "to": "string — future state phrase (max 8 words)" },
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
        { "title": "string — specific sub-section name", "detail": "string — 4-5 full sentences: current problem, why it matters, what changes, who benefits, what it feels like when it works" },
        { "title": "string", "detail": "string — 4-5 full sentences" }
      ]
    }
  ],
  "supportingThemes": [
    {
      "title": "string",
      "badge": "medium",
      "description": "string — 1-2 sentences",
      "subSections": [
        { "title": "string", "detail": "string — 3-4 sentences" }
      ]
    }
  ],
  "visionAlignment": {
    "corePrinciples": ["string — 5-6 bold commitment statements, grounded in signals"],
    "platformPosition": "string — 3 sentences: what position does this organisation now occupy, what makes it different, what promise can it now keep"
  },
  "horizonVision": "string — 3 sentences: paint the scene 3-5 years out. What does a customer experience? What does a staff member feel? What does the business measure?"
}`;

// ── Actor grouping helpers ────────────────────────────────────────────────────

/**
 * Extract unique actor names from all pad sources in the signals.
 * Returns the actual role names from this specific workshop — no hardcoded buckets.
 */
function extractActors(signals: WorkshopSignals): string[] {
  const seen = new Set<string>();
  const allPads = [
    ...signals.liveSession.reimaginePads,
    ...(signals.liveSession.discoveryPads ?? []),
    ...signals.liveSession.constraintPads,
    ...signals.liveSession.defineApproachPads,
  ];
  for (const pad of allPads) {
    if (pad.actor && pad.actor.trim()) seen.add(pad.actor.trim());
  }
  // Also include cohort labels as fallback if pads have no actor tags
  if (seen.size === 0 && signals.discovery.cohortBreakdown?.length) {
    for (const cohort of signals.discovery.cohortBreakdown) {
      seen.add(cohort.cohortLabel);
    }
  }
  return Array.from(seen);
}

/**
 * Group pads by the actor name as it appears in the signal data.
 * Falls back to 'Unattributed' for pads with no actor label.
 */
function groupByActor<T extends { text: string; lens?: string; actor?: string }>(
  pads: T[],
  limit: number
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const pad of pads.slice(0, limit)) {
    const group = pad.actor?.trim() || 'Unattributed';
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(pad);
  }
  return map;
}

// ── Signal dump builder ───────────────────────────────────────────────────────

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push(`=== CONTEXT ===`);
  lines.push(`Client: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Lenses: ${signals.context.lenses.join(', ')}`);
  lines.push(`Business context: ${signals.context.businessContext || 'Not specified'}`);
  lines.push(`Objectives: ${signals.context.objectives || 'Not specified'}`);

  // ── REIMAGINE signals — grouped by lens first, then by actor ─────────────
  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== REIMAGINE SIGNALS — WHAT THE FUTURE SHOULD BE ===');
    lines.push('(These are the raw visions, aspirations and "imagine if..." statements from the workshop)');

    // By lens
    const byLens = new Map<string, typeof signals.liveSession.reimaginePads>();
    for (const p of signals.liveSession.reimaginePads.slice(0, 60)) {
      const l = p.lens ?? 'General';
      if (!byLens.has(l)) byLens.set(l, []);
      byLens.get(l)!.push(p);
    }
    for (const [lens, pads] of byLens) {
      lines.push(`\n  [${lens}]`);
      pads.slice(0, 8).forEach((p) =>
        lines.push(`  • ${p.text}${p.actor ? ` — said by ${p.actor}` : ''}`)
      );
    }
  }

  // ── Actor-specific REIMAGINE signals ────────────────────────────────────
  const reimagineByActor = groupByActor(signals.liveSession.reimaginePads, 80);
  if (reimagineByActor.size > 0) {
    lines.push('\n=== REIMAGINE SIGNALS — BY ACTOR PERSPECTIVE ===');
    lines.push('Use these to build the reimaginedJourney section — what each actor wants their future to look like:');
    for (const [group, pads] of reimagineByActor) {
      lines.push(`\n  ${group}:`);
      pads.slice(0, 6).forEach((p) => lines.push(`  • ${p.text}`));
    }
  }

  // ── DISCOVERY signals — current-state pain by actor ─────────────────────
  const discoveryPads = signals.liveSession.discoveryPads ?? [];
  if (discoveryPads.length > 0) {
    lines.push('\n=== DISCOVERY SIGNALS — CURRENT REALITY (THE PAIN THAT MUST CHANGE) ===');
    lines.push('Use these as the "currentReality" anchor for each actor in reimaginedJourney:');
    const discoveryByActor = groupByActor(discoveryPads, 120);
    for (const [group, pads] of discoveryByActor) {
      lines.push(`\n  ${group} — Today's Reality:`);
      pads.slice(0, 5).forEach((p) => lines.push(`  • ${p.text}`));
    }
  } else if (signals.discovery.insights.length > 0) {
    // Fallback: use structured discovery insights
    const frictions = signals.discovery.insights
      .filter((i) => ['CHALLENGE', 'CONSTRAINT', 'FRICTION', 'RISK'].includes(i.type.toUpperCase()))
      .slice(0, 15);
    if (frictions.length > 0) {
      lines.push('\n=== DISCOVERY SIGNALS — CURRENT PAIN (structured insights) ===');
      frictions.forEach((i) => lines.push(`• ${i.text}`));
    }
  }

  // ── Current journey map ──────────────────────────────────────────────────
  if (signals.liveSession.journey.length > 0) {
    lines.push('\n=== CURRENT JOURNEY STAGES ===');
    lines.push('Use these stages to frame the reimaginedJourney — what happens at each stage today vs. what should happen:');
    signals.liveSession.journey.forEach((j) => {
      lines.push(`• ${j.stage}${j.aiScore !== undefined ? ` (AI potential: ${j.aiScore}/10)` : ''}${j.description ? ': ' + j.description : ''}`);
      if (j.painPoints?.length) j.painPoints.forEach((pp) => lines.push(`    ⚠ ${pp}`));
    });
  }

  // ── Define approach signals ──────────────────────────────────────────────
  if (signals.liveSession.defineApproachPads.length > 0) {
    lines.push('\n=== DEFINE APPROACH SIGNALS — HOW TO GET THERE ===');
    signals.liveSession.defineApproachPads.slice(0, 30).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  // ── Participant visions (structured insights table) ──────────────────────
  if (signals.discovery.insights.length > 0) {
    const visions = signals.discovery.insights
      .filter((i) => i.type === 'VISION' || i.type === 'ACTUAL_JOB')
      .slice(0, 20);
    if (visions.length > 0) {
      lines.push('\n=== PARTICIPANT VISIONS (structured insights) ===');
      visions.forEach((i) => lines.push(`• ${i.text}`));
    }
  }

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

  // ── Cohort breakdown ─────────────────────────────────────────────────────
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
    lines.push('\nUse cohort data alongside actor-specific signals to ensure the reimaginedJourney represents each role\'s lived experience, not just leadership aspiration.');
  }

  // ── Historical memory ────────────────────────────────────────────────────
  if (signals.historicalMemory?.chunks.length) {
    lines.push('\n=== CROSS-WORKSHOP HISTORICAL MEMORY ===');
    for (const c of signals.historicalMemory.chunks) {
      lines.push(`• [${c.source}, ${c.similarity.toFixed(2)}] ${c.text}`);
    }
    lines.push('(Supporting context only)');
  }

  // ── Relationship graph causal chains ─────────────────────────────────────
  if (signals.graphIntelligence?.dominantCausalChains.length) {
    lines.push('\n=== RELATIONSHIP GRAPH: DOMINANT CAUSAL CHAINS ===');
    lines.push('Evidence-backed pathways — design the future state to activate these:');
    for (const c of signals.graphIntelligence.dominantCausalChains) {
      lines.push(`• CONSTRAINT: "${c.labels.constraint}" → ENABLER: "${c.labels.enabler}" → VISION: "${c.labels.reimagination}" [strength: ${c.chainStrength}/100]`);
    }
  }

  return lines.join('\n');
}

// ── Agent runner ─────────────────────────────────────────────────────────────

export async function runFutureStateAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<FutureStateDesign> {
  onProgress?.('Future State Design: generating target operating model…');

  const workshopActors = extractActors(signals);
  const actorList = workshopActors.length > 0
    ? workshopActors.map((a) => `"${a}"`).join(', ')
    : 'the roles present in the workshop signals';

  const systemPrompt = `You are the DREAM IMAGINATION Signal engine. You transform workshop signals into a high-quality, executive-standard REIMAGINE output — the vision chapter of a strategic transformation report.

YOUR PRIMARY JOB IS TO SURFACE THE DREAM. Every actor in this workshop has a vision of what their future should look like. Your job is to find those visions in the signals and bring them to life with clarity and emotional resonance.

THE ACTORS IN THIS WORKSHOP ARE: ${actorList}
Use ONLY these actor names in the reimaginedJourney. Do not invent roles or substitute generic archetypes. If a pad is unattributed, assign it to the most contextually relevant actor from the list above.

CRITICAL: THE REIMAGINED JOURNEY IS THE HEART OF THIS OUTPUT.
Build "reimaginedJourney" carefully. For each actor present in the signals:
- Ground "currentReality" in DISCOVERY signals — what is their actual pain today? Be specific, name systems, name processes, name the frustration.
- Build "reimaginedExperience" from REIMAGINE signals — paint their future in vivid, specific language. What do they now feel? What can they do that they couldn't before? What has gone away? Make it feel real.
- "keyEnablers" must be concrete — not "better technology" but specific capabilities grounded in what the workshop discussed.
Include a journey for each actor named above. Order them by signal volume (most signals first).

WRITING QUALITY RULES:
• title: specific to this client. Not generic.
• description: 3 sentences. First names the transformation. Second says what it means for the PEOPLE (staff and customers). Third names what it unlocks for the business.
• threeHouses: each label is crisp (3-5 words). Each description is 2 sentences — honest about today's pain, specific about tomorrow's change.
• directionOfTravel: EXACTLY 5 shifts. "from" = real current pain in plain language. "to" = the vivid alternative. Earned by signals, not invented.
• primaryThemes: EXACTLY 5. Themes 1-2 badge "very high", 3-4 badge "high", 5 badge "high". Each has EXACTLY 2 subSections. Each subSection detail = 4-5 full sentences covering: current problem, why it matters, what changes, who benefits, what it feels like when it works.
• supportingThemes: EXACTLY 3, badge "medium", 1-2 subSections each, 3-4 sentence detail blocks.
• visionAlignment.corePrinciples: 5-6 commitment statements. Not platitudes. Ground them in signals.
• horizonVision: 3 sentences. Name something a customer can now do. Name something a staff member now feels. Name something the business can now measure.

Every field must be grounded in specific workshop evidence. Output MUST be valid JSON matching the schema — no commentary outside JSON.`;

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
          max_tokens: 7000,
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

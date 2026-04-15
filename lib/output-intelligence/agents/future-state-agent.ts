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
    "headline": "string — 6-10 words capturing the essence of the transformation",
    "collectiveTruthToday": "string — 3-4 sentences synthesising the group's shared current reality across all lenses. What is broken, painful, or constrained TODAY? Use the exact language from the session.",
    "collectiveFuture": "string — 3-4 sentences synthesising the group's collective reimagined future. What does the world look like when this is fixed? Use the exact aspirations and terminology from the session.",
    "coreNarrative": "string — 2-3 sentences: the connecting story from truth today to the future state. This is the proposition — what changes, why it matters, what it makes possible.",
    "keyVoices": [
      { "insight": "string — a specific idea, position or insight stated in the session, preserved verbatim", "lens": "string — People | Organisation | Customer | Technology | Regulation | General" }
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
  if (signals.liveSession.isCombinedSession) {
    lines.push(`Session mode: COMBINED — participants did not formally separate Discovery, Reimagine, Constraints or Way Ahead into distinct phases. Everything was discussed as one flowing conversation. Treat all signals as a unified pool: Truth Today and The Dream are both present in the same signals.`);
  }

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

  // ── Verbatim quotes — exact language from the room ───────────────────────
  // Collect raw text from all pads and list them once so GPT has the literal words,
  // acronyms, and company-specific terms to preserve rather than paraphrase.
  {
    const allVerbatim = [
      ...signals.liveSession.reimaginePads,
      ...(signals.liveSession.discoveryPads ?? []),
      ...signals.liveSession.constraintPads,
      ...signals.liveSession.defineApproachPads,
    ].slice(0, 120);
    if (allVerbatim.length > 0) {
      lines.push('\n=== VERBATIM WORKSHOP LANGUAGE (use these exact words, phrases and acronyms) ===');
      lines.push('Every bullet below is an exact quote from the session. Preserve the specific terminology, acronyms, product names, process names, and role names as-is in your output. Do NOT paraphrase or substitute with generic alternatives.');
      allVerbatim.forEach((p) =>
        lines.push(`  "${p.text}"${p.actor ? ` (${p.actor})` : ''}`)
      );
    }
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

YOUR PRIMARY JOB IS TO SURFACE THE DREAM. Every actor in this workshop has a vision of what their future should look like. Your job is to find those visions in the signals and represent them faithfully — in the exact language the participants used.

⚠ VERBATIM LANGUAGE RULE — THIS IS MANDATORY:
The workshop signals contain exact words, phrases, acronyms, system names, process names, and role names from the real session. You MUST carry these through into your output unchanged. Do NOT paraphrase. Do NOT substitute with generic alternatives. If a participant said "Salesforce", write "Salesforce" — not "CRM platform". If they said "SMART triage", write "SMART triage" — not "intelligent routing". If they said "the 48-hour SLA", write "the 48-hour SLA" — not "current turnaround times". The output must read as if the participants wrote it themselves — their words, their ideas, their terminology.

THE ACTORS IN THIS WORKSHOP ARE: ${actorList}
Use ONLY these actor names in the reimaginedJourney. Do not invent roles or substitute generic archetypes. If a pad is unattributed, assign it to the most contextually relevant actor from the list above.

CRITICAL: THE REIMAGINED JOURNEY IS THE HEART OF THIS OUTPUT.
Build "reimaginedJourney" as a collective synthesis — the combined story of what the group said together, not a per-person breakdown.

If the context says "Session mode: COMBINED", the group did not formally separate phases. Discovery (truth today) and Reimagine (the dream) are both woven through the same signals. Extract both from the unified pool — don't force artificial phase boundaries. Some statements will contain both the problem and the aspiration in one breath: capture both.

- "collectiveTruthToday": synthesise the current reality across all signals. What is broken? What is painful? What is constrained today? 3-4 sentences using the exact language from the session.
- "collectiveFuture": synthesise the shared vision. What did the group collectively aspire to? What does the world look like when this works? Use their exact words, ideas, and terminology.
- "coreNarrative": the connecting proposition. What is the transformation story? What changes, why it matters, what it makes possible. This is the thread that runs through everything.
- "keyVoices": 8-12 specific insights or positions from the session — the most important things said, preserved verbatim. Spread across lenses. These are the evidence base for everything else.

WRITING QUALITY RULES:
• title: specific to this client and their actual transformation. Not generic.
• description: 3 sentences. First names the transformation. Second says what it means for the PEOPLE (staff and customers). Third names what it unlocks for the business.
• threeHouses: each label is crisp (3-5 words). Each description is 2 sentences — honest about today's pain using the workshop's own language, specific about tomorrow's change using the workshop's own aspirations.
• directionOfTravel: EXACTLY 5 shifts. "from" = real current pain in the workshop's own words. "to" = the specific alternative they described. Earned by signals, not invented.
• primaryThemes: EXACTLY 5. Themes 1-2 badge "very high", 3-4 badge "high", 5 badge "high". Each has EXACTLY 2 subSections. Each subSection detail = 4-5 full sentences covering: current problem, why it matters, what changes, who benefits, what it feels like when it works. Use workshop-specific language throughout.
• supportingThemes: EXACTLY 3, badge "medium", 1-2 subSections each, 3-4 sentence detail blocks.
• visionAlignment.corePrinciples: 5-6 commitment statements. Not platitudes. Ground them in the specific signals from this workshop.
• horizonVision: 3 sentences. Name something a customer can now do. Name something a staff member now feels. Name something the business can now measure. All grounded in what the workshop actually discussed.

Every field must be grounded in specific workshop evidence using the participants' own language. Output MUST be valid JSON matching the schema — no commentary outside JSON.`;

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

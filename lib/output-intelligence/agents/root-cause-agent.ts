/**
 * Engine 2: Root Cause Intelligence Agent
 *
 * Analyses workshop signals to surface systemic root causes AND the force field
 * of constraining vs driving forces. Preserves participant voice. Maps each
 * constraint to whether the reimagined vision addresses it.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals, RootCauseIntelligence } from '../types';

const SCHEMA = `{
  "forceFieldHeadline": "string — one memorable sentence capturing the essential tension e.g. 'A willing organisation held back by its own infrastructure'",
  "systemicPattern": "string — 1-2 paragraph diagnosis of the deeper structural pattern. Write with authority. Name the pattern, not the symptoms.",
  "workshopConstraints": [
    {
      "title": "string — constraint name (5-10 words, specific)",
      "type": "Structural | Cultural | Technical | Regulatory | Resource | Leadership",
      "severity": "critical | significant | moderate",
      "participantVoice": "string — a representative quote or close paraphrase capturing this constraint in the participant's OWN language. Use their words, not consulting language.",
      "affectedLenses": ["string — lens names"],
      "rootCause": "string — 2-3 sentences on WHY this constraint exists at a systemic level. What created it? What keeps it in place?",
      "resolutionStatus": "Addressed in Vision | Partially Addressed | Requires Enabler | Structural — Hard to Change"
    }
  ],
  "drivingForces": [
    {
      "force": "string — what is working in favour of transformation (specific, not generic)",
      "strength": "strong | moderate | emerging",
      "source": "string — where this comes from e.g. 'Leadership mandate from COO', 'Staff aspiration signals across all cohorts', 'Regulatory deadline creating urgency'"
    }
  ],
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

  lines.push('\n=== CONSTRAINTS (structured discovery) ===');
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

  // ── CONSTRAINTS phase — participant voice preserved ───────────────────────
  if (signals.liveSession.constraintPads.length > 0) {
    lines.push('\n=== CONSTRAINT WORKSHOP SIGNALS (participant voice — use these verbatim in participantVoice field) ===');
    lines.push(`(${signals.liveSession.constraintPads.length} total signals — read all of them, each distinct constraint should become its own workshopConstraint entry)`);
    signals.liveSession.constraintPads.forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.actor ? ` — ${p.actor}` : ''}`);
    });
  }

  // ── DISCOVERY phase signals — current-state pain ─────────────────────────
  const discoveryPads = signals.liveSession.discoveryPads ?? [];
  if (discoveryPads.length > 0) {
    lines.push('\n=== DISCOVERY SIGNALS — CURRENT PAIN BY ACTOR ===');
    discoveryPads.slice(0, 40).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.actor ? ` — ${p.actor}` : ''}`);
    });
  }

  // ── Reimagine signals — driving forces evidence ──────────────────────────
  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== REIMAGINE SIGNALS (use these to assess resolutionStatus AND to identify drivingForces) ===');
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

    const enablers = signals.discovery.insights
      .filter((i) => i.type === 'ENABLER' || i.type === 'OPPORTUNITY' || i.type === 'VISION')
      .slice(0, 10);
    if (enablers.length > 0) {
      lines.push('\n=== ENABLING SIGNALS (driving forces evidence) ===');
      enablers.forEach((i) => lines.push(`• ${i.text}`));
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
    lines.push('\nHigh aspiration ratio = driving force. Low aspiration + high friction = deep constraint.');
  }

  if (signals.historicalMemory?.chunks.length) {
    lines.push('\n=== CROSS-WORKSHOP HISTORICAL MEMORY ===');
    for (const c of signals.historicalMemory.chunks) {
      lines.push(`• [${c.source}, ${c.similarity.toFixed(2)}] ${c.text}`);
    }
    lines.push('(Supporting context only)');
  }

  if (signals.graphIntelligence) {
    const gi = signals.graphIntelligence;

    if (gi.bottlenecks.length > 0) {
      lines.push('\n=== RELATIONSHIP GRAPH: STRUCTURAL BOTTLENECKS ===');
      lines.push('Highest-leverage constraint candidates (evidence-backed):');
      for (const b of gi.bottlenecks.slice(0, 5)) {
        lines.push(`• "${b.displayLabel}" — affects ${b.outDegree} areas, tier: ${b.evidenceTier}, score: ${b.compositeScore}`);
      }
    }

    if (gi.compensatingBehaviours.length > 0) {
      lines.push('\n=== RELATIONSHIP GRAPH: COMPENSATING BEHAVIOURS ===');
      for (const cb of gi.compensatingBehaviours.slice(0, 5)) {
        lines.push(`• "${cb.enablerLabel}" compensates for "${cb.constraintLabel}" — risk: ${cb.riskLevel}`);
      }
    }

    if (gi.brokenChains.filter(bc => bc.brokenChainType === 'CONSTRAINT_NO_RESPONSE' && bc.severity === 'high').length > 0) {
      lines.push('\n=== RELATIONSHIP GRAPH: UNADDRESSED CONSTRAINTS ===');
      gi.brokenChains
        .filter(bc => bc.brokenChainType === 'CONSTRAINT_NO_RESPONSE' && bc.severity === 'high')
        .slice(0, 5)
        .forEach(bc => lines.push(`• "${bc.displayLabel}" — ${bc.rawFrequency} mentions, no response pathway detected`));
    }
  }

  return lines.join('\n');
}

export async function runRootCauseAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<RootCauseIntelligence> {
  onProgress?.('Root Cause Intelligence: analysing systemic causes…');

  const systemPrompt = `You are the DREAM INHIBITION Signal engine — scanning the forces preventing transformation in this organisation.

YOUR JOB IS TO PRODUCE A FORCE FIELD ANALYSIS. There are forces RESTRAINING transformation (constraints) and forces DRIVING it forward. You must identify both sides with equal rigour.

CRITICAL RULES:

forceFieldHeadline: Make it memorable and specific. Capture the essential tension in one sentence. Not "The organisation faces challenges" — something like "A workforce ready to change, trapped by infrastructure that cannot keep up."

workshopConstraints (12-20 items — a 2-hour constraints workshop surfaces many distinct constraints; be thorough and don't collapse distinct issues into one):
- These are what PARTICIPANTS named as constraints in their own words
- participantVoice MUST be a near-verbatim quote or very close paraphrase from the actual signals — do not rewrite into consulting language
- type must be one of: Structural / Cultural / Technical / Regulatory / Resource / Leadership
- resolutionStatus: honestly assess whether the reimagine signals address this constraint. "Addressed in Vision" = clear reimagine signal resolves it. "Requires Enabler" = vision aspires to it but no clear mechanism. "Structural — Hard to Change" = not addressed, likely systemic.

drivingForces (4-6 items):
- The genuine forces working in FAVOUR of transformation
- Ground each in specific signals — aspiration signals, leadership signals, competitive pressure, regulatory deadlines
- Be honest about strength: "emerging" if it's tentative

systemicPattern: Write a diagnosis, not a list. Name the underlying pattern driving ALL the constraints. What is the organisation's fundamental challenge?

rootCauses: 8-12 ranked causes. Go deeper than symptoms. WHY does the constraint exist? Each cause should be distinct — don't merge separate issues.

frictionMap: If journey stages exist, use them. If not, create stages based on the lenses (e.g. "Customer Contact", "Agent Resolution", "Back Office Processing", "Compliance Review").

Use ONLY signals provided. Output MUST be valid JSON. No commentary outside JSON.`;

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
          max_tokens: 8000,
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

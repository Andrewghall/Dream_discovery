/**
 * COM-B Behavioural Interventions Agent
 *
 * Generates a structured set of behavioural interventions grouped by lens,
 * applying the COM-B (Capability / Opportunity / Motivation → Behaviour) framework.
 * Depth is calibrated for a senior executive deliverable — not a template exercise.
 */

import OpenAI from 'openai';
import type { BehaviouralInterventionsOutput, LensInterventions } from './types';

const SYSTEM_PROMPT = `You are a Senior Organisational Development Consultant producing a board-level behavioural change analysis for a major transformation programme. This is a £20,000+ deliverable. Generic output is not acceptable.

COM-B FRAMEWORK:
Every durable behaviour change requires THREE conditions to be simultaneously met:
- CAPABILITY: the person has the psychological and physical skills, knowledge, and self-belief to perform the behaviour
- OPPORTUNITY: the physical environment (systems, tools, processes) and social environment (culture, norms, peer behaviours) enables the behaviour
- MOTIVATION: the person has sufficient automatic drive (habit, emotion) and reflective intent (goals, belief) to choose this behaviour over others

COM-B INTERVENTION TYPES — select the primary mechanism for each:
- Training → builds capability through skill transfer, knowledge, practice
- Environmental Restructuring → redesigns physical/digital/process environment to enable the behaviour
- Incentivisation → creates or realigns reward structures, consequences, recognition
- Enablement → removes specific access or resource barriers blocking the behaviour
- Persuasion → shifts attitudes, beliefs, or social norms through communication and evidence
- Modelling → demonstrates the desired behaviour through visible exemplars or champions

MANDATORY OUTPUT STANDARDS:
1. EVERY lens in the provided lenses list must have a minimum of 2 interventions (aim for 3). Never produce 1 intervention for a lens. If a lens has fewer than 2 distinct issues surfaced, derive additional interventions from cross-cutting root causes that affect that lens.
2. Gap descriptions must be SPECIFIC and grounded in the actual workshop signals provided. Not "lack of skills" — name the exact skill gap identified. Not "process barrier" — name the actual broken process.
3. Capability gap: what specific knowledge, skill, or self-belief is missing and WHY it is missing in this organisation
4. Opportunity gap: name the specific system, process, cultural norm, or structural barrier that prevents the behaviour — reference actual constraints from the workshop where available
5. Motivation gap: name the specific belief, mental model, incentive misalignment, or social norm that must shift — reference perception gaps and participant voice where available
6. Actions must be SPECIFIC executive-level recommendations with mechanism, not vague directives. NOT "Improve training programmes." YES: "Commission a structured FCR capability programme embedded in team leader coaching cycles, with monthly calibration sessions to close the gap between agents' self-assessed competency and measured performance outcomes."
7. evidence_basis: quote or closely paraphrase the specific participant signal, root cause evidence, or documentary finding that grounds this intervention. If empirically_grounded, cite the specific corroborated finding or perception gap.
8. Priority:
   - High: maps to a critical root cause OR corroborated by empirical evidence OR addresses a perception gap (organisation doesn't know it has this problem)
   - Medium: confirmed issue with workshop consensus but not empirically validated
   - Low: emerging signal, aspirational, or secondary effect
9. Perception gaps from evidence cross-validation → ALWAYS High priority motivation interventions. The organisation believes X but data shows Y — this is the most dangerous type of gap.
10. Blind spots from evidence cross-validation → capability or opportunity interventions the organisation has not yet recognised.
11. Do NOT invent issues. Every intervention must trace directly to a signal, constraint, root cause, or evidence finding in the data.
12. Do NOT produce duplicate items across lenses unless the intervention type and mechanism are genuinely different for that lens context.
13. supporting_lenses must reflect genuine systemic interconnection — where fixing this behaviour in lens A requires change in lens B.

The client paid a significant fee for this analysis. Every item must reflect deep synthesis of the workshop data, not pattern-matching against a generic template.

Output valid JSON only.`;

const OUTPUT_SCHEMA = `{
  "behavioural_interventions": [
    {
      "lens": "<exact lens name from the lenses list>",
      "items": [
        {
          "target_behaviour": "<specific observable behaviour to change — written as the behaviour that must shift, one clear sentence naming who does what differently>",
          "capability_gap": "<2-3 sentences: what specific skill/knowledge is missing, why it is missing in this organisation, what evidence supports this>",
          "opportunity_gap": "<2-3 sentences: name the specific system, process, or structural barrier — reference the actual constraint or root cause from the workshop>",
          "motivation_gap": "<2-3 sentences: name the specific belief, mental model, or incentive misalignment — reference participant voice or perception gaps where available>",
          "intervention_type": "<Training | Environmental Restructuring | Incentivisation | Enablement | Persuasion | Modelling>",
          "action": "<2-3 sentence specific intervention: what exactly should be done, how it should be structured, what behaviour change outcome it targets>",
          "evidence_basis": "<the specific participant quote, root cause, corroborated finding, or perception gap that grounds this intervention>",
          "supporting_lenses": ["<other lenses this intervention genuinely affects>"],
          "empirically_grounded": "<true | false>",
          "priority": "<High | Medium | Low>"
        }
      ]
    }
  ]
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUserPrompt(
  workshopName: string,
  lenses: string[],
  outputIntelligence: Record<string, unknown>,
  evidenceValidation?: {
    perceptionGaps?: string[];
    blindSpots?: string[];
    corroborated?: string[];
    contradicted?: string[];
    conclusionImpact?: string;
  }
): string {
  const lines: string[] = [];

  lines.push(`=== WORKSHOP: ${workshopName} ===`);
  lines.push(`LENSES (you MUST produce minimum 2 interventions for EACH of these): ${lenses.join(', ')}`);
  lines.push('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootCause = (outputIntelligence.rootCause ?? {}) as Record<string, any>;

  // Force field headline — frames the essential tension
  if (rootCause.forceFieldHeadline) {
    lines.push(`=== ESSENTIAL TENSION ===`);
    lines.push(rootCause.forceFieldHeadline);
    lines.push('');
  }

  if (rootCause.systemicPattern) {
    lines.push(`=== SYSTEMIC PATTERN ===`);
    lines.push(rootCause.systemicPattern);
    lines.push('');
  }

  // Root causes — full detail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootCauses: any[] = Array.isArray(rootCause.rootCauses) ? rootCause.rootCauses : [];
  if (rootCauses.length > 0) {
    lines.push('=== ROOT CAUSES (ranked by severity — use these as the primary basis for interventions) ===');
    rootCauses.forEach((rc, i) => {
      lines.push(`${i + 1}. [${rc.severity ?? 'unknown'}] ${rc.cause}`);
      lines.push(`   Category: ${rc.category ?? 'unknown'}`);
      if (Array.isArray(rc.affectedLenses) && rc.affectedLenses.length > 0) {
        lines.push(`   Affected lenses: ${rc.affectedLenses.join(', ')}`);
      }
      if (Array.isArray(rc.evidence) && rc.evidence.length > 0) {
        lines.push(`   Evidence: ${rc.evidence.slice(0, 3).join(' | ')}`);
      }
    });
    lines.push('');
  }

  // Workshop constraints — with participant voice
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workshopConstraints: any[] = Array.isArray(rootCause.workshopConstraints)
    ? rootCause.workshopConstraints
    : [];
  if (workshopConstraints.length > 0) {
    lines.push('=== WORKSHOP CONSTRAINTS (participant voice — use these to ground gap descriptions) ===');
    workshopConstraints.forEach((c) => {
      lines.push(`• [${c.type ?? 'unknown'} / ${c.severity ?? 'unknown'}] ${c.title}`);
      if (c.participantVoice) lines.push(`  Participant said: "${c.participantVoice}"`);
      if (c.rootCause) lines.push(`  Root cause: ${c.rootCause}`);
      if (c.resolutionStatus) lines.push(`  Resolution status: ${c.resolutionStatus}`);
      if (Array.isArray(c.affectedLenses) && c.affectedLenses.length > 0) {
        lines.push(`  Affected lenses: ${c.affectedLenses.join(', ')}`);
      }
    });
    lines.push('');
  }

  // Driving forces — inform motivation interventions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drivingForces: any[] = Array.isArray(rootCause.drivingForces) ? rootCause.drivingForces : [];
  if (drivingForces.length > 0) {
    lines.push('=== DRIVING FORCES (leverage these in persuasion and modelling interventions) ===');
    drivingForces.forEach((f) => {
      lines.push(`• [${f.strength ?? 'unknown'}] ${f.force}`);
      if (f.source) lines.push(`  Source: ${f.source}`);
    });
    lines.push('');
  }

  // Friction map — where the pain is highest in the journey
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frictionMap: any[] = Array.isArray(rootCause.frictionMap) ? rootCause.frictionMap : [];
  if (frictionMap.length > 0) {
    lines.push('=== FRICTION MAP (journey stages — use to anchor interventions to specific moments) ===');
    frictionMap.forEach((f) => {
      lines.push(`• ${f.stage}: friction level ${f.frictionLevel}/10 — ${f.primaryCause ?? ''}`);
    });
    lines.push('');
  }

  // Discovery validation — confirmed issues with workshop evidence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoveryValidation = (outputIntelligence.discoveryValidation ?? {}) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confirmedIssues: any[] = Array.isArray(discoveryValidation.confirmedIssues)
    ? discoveryValidation.confirmedIssues
    : [];
  if (confirmedIssues.length > 0) {
    lines.push('=== CONFIRMED ISSUES (discovery hypothesis validated by workshop) ===');
    confirmedIssues.forEach((issue) => {
      const confidence = issue.confidence ? ` [${issue.confidence} confidence]` : '';
      lines.push(`• ${issue.issue ?? issue.description ?? issue}${confidence}`);
      if (issue.workshopEvidence) lines.push(`  Evidence: ${issue.workshopEvidence}`);
    });
    lines.push('');
  }

  // New issues from workshop
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newIssues: any[] = Array.isArray(discoveryValidation.newIssues)
    ? discoveryValidation.newIssues
    : [];
  if (newIssues.length > 0) {
    lines.push('=== NEW ISSUES (surfaced only in workshop — not in pre-discovery hypothesis) ===');
    newIssues.forEach((issue) => {
      lines.push(`• ${issue.issue ?? issue}`);
      if (issue.workshopEvidence) lines.push(`  Evidence: ${issue.workshopEvidence}`);
      if (issue.significance) lines.push(`  Why it matters: ${issue.significance}`);
    });
    lines.push('');
  }

  // Future state — direction of travel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const futureState = (outputIntelligence.futureState ?? {}) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directionOfTravel: any[] = Array.isArray(futureState.directionOfTravel)
    ? futureState.directionOfTravel
    : [];
  if (directionOfTravel.length > 0) {
    lines.push('=== FUTURE STATE — DIRECTION OF TRAVEL (desired behaviour destination) ===');
    directionOfTravel.forEach((d) => {
      if (d.from && d.to) {
        lines.push(`• FROM: ${d.from}`);
        lines.push(`  TO:   ${d.to}`);
        if (d.lens) lines.push(`  Lens: ${d.lens}`);
      }
    });
    lines.push('');
  }

  // Future state primary themes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryThemes: any[] = Array.isArray(futureState.primaryThemes)
    ? futureState.primaryThemes
    : [];
  if (primaryThemes.length > 0) {
    lines.push('=== FUTURE STATE PRIMARY THEMES ===');
    primaryThemes.forEach((t) => {
      const label = typeof t === 'string' ? t : t.theme ?? t.title ?? JSON.stringify(t);
      const detail = typeof t === 'object' && t.detail ? ` — ${t.detail}` : '';
      lines.push(`• ${label}${detail}`);
    });
    lines.push('');
  }

  // Evidence validation — most important signals for COM-B
  if (evidenceValidation) {
    lines.push('=== EVIDENCE CROSS-VALIDATION (these findings come from empirical data, not just participant opinion) ===');

    if (evidenceValidation.corroborated && evidenceValidation.corroborated.length > 0) {
      lines.push('CORROBORATED (workshop signals confirmed by documentary evidence — use as high-confidence grounding):');
      evidenceValidation.corroborated.forEach((c) => lines.push(`  ✓ ${c}`));
    }

    if (evidenceValidation.perceptionGaps && evidenceValidation.perceptionGaps.length > 0) {
      lines.push('');
      lines.push('PERCEPTION GAPS (participants believed X but empirical data shows Y — CRITICAL: these are HIGH PRIORITY motivation interventions):');
      lines.push('The organisation has a false belief that must be actively corrected, not just noted.');
      evidenceValidation.perceptionGaps.forEach((g) => lines.push(`  ⚠ ${g}`));
    }

    if (evidenceValidation.blindSpots && evidenceValidation.blindSpots.length > 0) {
      lines.push('');
      lines.push('BLIND SPOTS (significant issues in empirical data that no participant raised — the organisation is unaware of these):');
      lines.push('These require capability and opportunity interventions because the organisation cannot self-correct what it cannot see.');
      evidenceValidation.blindSpots.forEach((b) => lines.push(`  ● ${b}`));
    }

    if (evidenceValidation.contradicted && evidenceValidation.contradicted.length > 0) {
      lines.push('');
      lines.push('CONTRADICTIONS (2+ independent data sources contradict each other — unresolved tension, address in interventions):');
      evidenceValidation.contradicted.forEach((c) => lines.push(`  ✗ ${c}`));
    }

    if (evidenceValidation.conclusionImpact) {
      lines.push('');
      lines.push(`OVERALL EVIDENCE VERDICT: ${evidenceValidation.conclusionImpact}`);
    }
    lines.push('');
  }

  lines.push('=== INSTRUCTIONS ===');
  lines.push(`Produce 2-4 interventions for EACH of these ${lenses.length} lenses: ${lenses.join(', ')}`);
  lines.push('Every intervention must be grounded in the specific signals, participant voice, or evidence findings above.');
  lines.push('Gap descriptions (2-3 sentences each) must name specific issues from this organisation, not generic patterns.');
  lines.push('Actions must be specific enough that a client could begin executing them next month.');
  lines.push('');
  lines.push('Return ONLY valid JSON matching this schema:');
  lines.push(OUTPUT_SCHEMA);

  return lines.join('\n');
}

export async function generateBehaviouralInterventions(
  workshopName: string,
  lenses: string[],
  outputIntelligence: Record<string, unknown>,
  evidenceValidation?: {
    perceptionGaps?: string[];
    blindSpots?: string[];
    corroborated?: string[];
    contradicted?: string[];
    conclusionImpact?: string;
  }
): Promise<BehaviouralInterventionsOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const openai = new OpenAI({ apiKey });

  const userPrompt = buildUserPrompt(workshopName, lenses, outputIntelligence, evidenceValidation);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    try {
      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          max_tokens: 10000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        },
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);
      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { behavioural_interventions?: LensInterventions[] };

      const interventions: LensInterventions[] = Array.isArray(parsed.behavioural_interventions)
        ? parsed.behavioural_interventions
        : [];

      return {
        behavioural_interventions: interventions,
        generatedAtMs: Date.now(),
        lensesUsed: lenses,
        evidenceGrounded: !!evidenceValidation,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
    }
  }

  throw lastError ?? new Error('Behavioural Interventions agent failed after 3 attempts');
}

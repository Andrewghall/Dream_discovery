/**
 * COM-B Behavioural Interventions Agent
 *
 * Generates a structured set of behavioural interventions grouped by lens,
 * applying the COM-B (Capability / Opportunity / Motivation → Behaviour) framework.
 */

import OpenAI from 'openai';
import type { BehaviouralInterventionsOutput, LensInterventions } from './types';

const SYSTEM_PROMPT = `You are a senior organisational change consultant applying the COM-B behaviour change framework to a business transformation programme.

COM-B: Every behaviour change requires three conditions:
- CAPABILITY: the person has the skills and knowledge to do it
- OPPORTUNITY: the physical and social environment enables it
- MOTIVATION: the person has sufficient desire, belief, or habit to do it

INTERVENTION TYPES (map each action to one primary type):
- Training → addresses capability gaps
- Environmental Restructuring → addresses opportunity gaps (process, systems, environment)
- Incentivisation → addresses motivation gaps (rewards, consequences)
- Enablement → removes opportunity barriers
- Persuasion → shifts attitudes and motivation
- Modelling → demonstrates desired behaviour through examples

YOUR TASK:
Given workshop discovery outputs, generate COM-B behavioural interventions grouped by lens.

RULES:
1. Group ALL interventions by the lenses provided — no fixed role taxonomy
2. Maximum 5 items per lens — group similar insights into single interventions
3. Each item must represent a specific, observable behaviour change
4. Each item must map to ONE primary owning lens
5. supporting_lenses: list other lenses this intervention affects
6. Language must be concise and executive-level
7. empirically_grounded: true ONLY if the intervention maps to a corroborated finding, perception gap, or blind spot from evidence cross-validation
8. Priority:
   - High: directly maps to a critical root cause OR corroborated by evidence
   - Medium: significant root cause or confirmed issue
   - Low: emerging signal or aspirational
9. Perception gaps = motivation interventions (people need to update their mental model)
10. Blind spots = new capability or opportunity interventions (organisation unaware of the problem)
11. Do NOT invent issues not present in the provided data
12. Do NOT duplicate items across lenses unless the intervention type is genuinely different

Output valid JSON only matching the exact schema.`;

const OUTPUT_SCHEMA = `{
  "behavioural_interventions": [
    {
      "lens": "<exact lens name from the lenses list>",
      "items": [
        {
          "target_behaviour": "<specific observable behaviour to change — one sentence>",
          "capability_gap": "<what skills/knowledge are missing>",
          "opportunity_gap": "<what process/system/environment barrier exists>",
          "motivation_gap": "<what belief, incentive, or social norm needs to shift>",
          "intervention_type": "<Training | Environmental Restructuring | Incentivisation | Enablement | Persuasion | Modelling>",
          "action": "<specific intervention — what to do, in executive language, one sentence>",
          "supporting_lenses": ["<other affected lenses>"],
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
    conclusionImpact?: string;
  }
): string {
  const lines: string[] = [];

  lines.push(`=== WORKSHOP: ${workshopName} ===`);
  lines.push(`LENSES: ${lenses.join(', ')}`);

  // Root causes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootCause = (outputIntelligence.rootCause ?? {}) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootCauses: any[] = Array.isArray(rootCause.rootCauses) ? rootCause.rootCauses : [];
  if (rootCauses.length > 0) {
    lines.push('\n=== ROOT CAUSES ===');
    rootCauses.forEach((rc, i) => {
      lines.push(`${i + 1}. [${rc.severity ?? 'unknown'}] ${rc.cause}`);
      lines.push(`   Category: ${rc.category ?? 'unknown'}`);
      if (Array.isArray(rc.affectedLenses) && rc.affectedLenses.length > 0) {
        lines.push(`   Lenses: ${rc.affectedLenses.join(', ')}`);
      }
    });
  }

  // Discovery validation — confirmed issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoveryValidation = (outputIntelligence.discoveryValidation ?? {}) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confirmedIssues: any[] = Array.isArray(discoveryValidation.confirmedIssues)
    ? discoveryValidation.confirmedIssues
    : [];
  if (confirmedIssues.length > 0) {
    lines.push('\n=== CONFIRMED ISSUES ===');
    confirmedIssues.forEach((issue) => {
      const confidence = issue.confidence ? ` (confidence: ${issue.confidence})` : '';
      lines.push(`• ${issue.issue ?? issue.description ?? issue}${confidence}`);
    });
  }

  // Workshop constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workshopConstraints: any[] = Array.isArray(rootCause.workshopConstraints)
    ? rootCause.workshopConstraints
    : [];
  if (workshopConstraints.length > 0) {
    lines.push('\n=== WORKSHOP CONSTRAINTS ===');
    workshopConstraints.forEach((c) => {
      lines.push(`• [${c.type ?? 'unknown'}/${c.severity ?? 'unknown'}] ${c.title}`);
      if (c.participantVoice) lines.push(`  Voice: "${c.participantVoice}"`);
      if (c.resolutionStatus) lines.push(`  Resolution: ${c.resolutionStatus}`);
    });
  }

  // Driving forces
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drivingForces: any[] = Array.isArray(rootCause.drivingForces) ? rootCause.drivingForces : [];
  if (drivingForces.length > 0) {
    lines.push('\n=== DRIVING FORCES ===');
    drivingForces.forEach((f) => {
      lines.push(`• [${f.strength ?? 'unknown'}] ${f.force}`);
    });
  }

  // Future state — direction of travel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const futureState = (outputIntelligence.futureState ?? {}) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directionOfTravel: any[] = Array.isArray(futureState.directionOfTravel)
    ? futureState.directionOfTravel
    : [];
  if (directionOfTravel.length > 0) {
    lines.push('\n=== FUTURE STATE DIRECTION OF TRAVEL ===');
    directionOfTravel.forEach((d) => {
      if (d.from && d.to) {
        lines.push(`• FROM: ${d.from} → TO: ${d.to}`);
      }
    });
  }

  // Future state primary themes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryThemes: any[] = Array.isArray(futureState.primaryThemes)
    ? futureState.primaryThemes
    : [];
  if (primaryThemes.length > 0) {
    lines.push('\n=== FUTURE STATE PRIMARY THEMES ===');
    primaryThemes.forEach((t) => {
      const label = typeof t === 'string' ? t : t.theme ?? t.title ?? JSON.stringify(t);
      lines.push(`• ${label}`);
    });
  }

  // Roadmap phases summary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roadmap = (outputIntelligence.roadmap ?? {}) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phases: any[] = Array.isArray(roadmap.phases) ? roadmap.phases : [];
  if (phases.length > 0) {
    lines.push('\n=== ROADMAP PHASES ===');
    phases.forEach((p) => {
      const name = p.name ?? p.phase ?? `Phase ${p.number ?? '?'}`;
      const timeframe = p.timeframe ?? p.duration ?? '';
      lines.push(`• ${name}${timeframe ? ` (${timeframe})` : ''}`);
    });
  }

  // Evidence validation
  if (evidenceValidation) {
    lines.push('\n=== EVIDENCE CROSS-VALIDATION ===');
    if (evidenceValidation.corroborated && evidenceValidation.corroborated.length > 0) {
      lines.push('Corroborated findings:');
      evidenceValidation.corroborated.forEach((c) => lines.push(`  ✓ ${c}`));
    }
    if (evidenceValidation.perceptionGaps && evidenceValidation.perceptionGaps.length > 0) {
      lines.push('Perception gaps (motivation interventions needed):');
      evidenceValidation.perceptionGaps.forEach((g) => lines.push(`  ! ${g}`));
    }
    if (evidenceValidation.blindSpots && evidenceValidation.blindSpots.length > 0) {
      lines.push('Blind spots (new capability/opportunity interventions needed):');
      evidenceValidation.blindSpots.forEach((b) => lines.push(`  ? ${b}`));
    }
    if (evidenceValidation.conclusionImpact) {
      lines.push(`Conclusion impact: ${evidenceValidation.conclusionImpact}`);
    }
  }

  lines.push('\n=== OUTPUT SCHEMA ===');
  lines.push('Return ONLY valid JSON matching this schema exactly:');
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
    conclusionImpact?: string;
  }
): Promise<BehaviouralInterventionsOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const openai = new OpenAI({ apiKey });

  const userPrompt = buildUserPrompt(workshopName, lenses, outputIntelligence, evidenceValidation);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

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
}

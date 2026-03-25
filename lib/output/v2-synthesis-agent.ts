/**
 * V2 Synthesis Agent — consulting-grade, evidence-anchored output.
 *
 * Every section must be board-ready, grounded in verbatim workshop data,
 * and specific enough that no two workshops could produce the same output.
 *
 * This agent receives raw verbatim node texts (not pre-digested summaries)
 * so GPT-4o can cite actual evidence rather than inventing it.
 */

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Raw Signal Types ────────────────────────────────────────────────────────

export type RawSignals = {
  totalNodes: number;
  participantCount: number;
  nodesByPhase: {
    DISCOVERY: string[];
    REIMAGINE: string[];
    CONSTRAINTS: string[];
    DEFINE_APPROACH: string[];
  };
  domainSummary: Array<{
    domain: string;
    aspirationCount: number;
    constraintCount: number;
    topAspirations: string[];
    topConstraints: string[];
    topEnablers: string[];
  }>;
  topThemes: Array<{ label: string; count: number }>;
  topActors: Array<{ name: string; mentions: number }>;
};

// ── Output Types ────────────────────────────────────────────────────────────

export type ArtifactType = 'heatmap' | 'gantt' | 'bar_chart' | 'matrix' | 'timeline' | 'none';

export type HeatmapData = {
  cells: Array<{ actor: string; stage: string; intensity: number; tooltip: string }>;
  actors: string[];
  stages: string[];
};

export type GanttData = {
  phases: Array<{
    phase: number;
    label: string;
    color: string;
    startWeek: number;
    endWeek: number;
    initiatives: Array<{
      name: string;
      owner: string;
      startWeek: number;
      endWeek: number;
      dependsOn?: string;
    }>;
  }>;
};

export type BarChartData = {
  items: Array<{ label: string; value: number; color?: string }>;
  xLabel: string;
  yLabel: string;
};

export type MatrixData = {
  rows: string[];
  cols: string[];
  cells: Array<{ row: string; col: string; value: string }>;
};

export type TimelineData = {
  events: Array<{ label: string; week: number; description: string; color?: string }>;
};

export type Artifact =
  | { type: 'heatmap'; data: HeatmapData }
  | { type: 'gantt'; data: GanttData }
  | { type: 'bar_chart'; data: BarChartData }
  | { type: 'matrix'; data: MatrixData }
  | { type: 'timeline'; data: TimelineData }
  | { type: 'none'; data: null };

export type V2Truth = {
  statement: string;             // specific, falsifiable observation
  actor: string;
  journeyStage: string;
  lens: string;
  evidenceStrength: 'strong' | 'moderate' | 'weak';
  evidence: string[];            // verbatim or near-verbatim quotes from the data
  whyItMatters: string;          // business cost if left unaddressed (2-3 sentences)
};

export type V2FutureState = {
  title: string;                 // specific transformation headline
  actor: string;
  journeyStage: string;
  lens: string;
  valueUnlocked: string;         // specific and measurable
  whatDisappears: string;        // specific friction that ends
  howWeKnow: string;             // which workshop signals point to this direction
};

export type V2ConstraintCluster = {
  name: string;
  count: number;
  actor: string;
  journeyStage: string;
  lens: string;
  severity: 'critical' | 'high' | 'medium';
  effort: 'high' | 'medium' | 'low';
  items: string[];               // verbatim constraint statements from the data
  whyItBlocks: string;           // why this cluster prevents transformation (2 sentences)
};

export type V2PathStep = {
  horizon: 'now' | 'next' | 'later';
  action: string;                // specific initiative name
  constraintAddressed: string;
  journeyStage: string;
  owner: string;
  expectedImpact: string;        // what specifically changes as a result
};

export type V2Outcome = {
  outcome: string;               // specific and measurable
  baseline: string;              // current state in measurable terms
  target: string;                // specific target
  targetEvidence: string;        // workshop signal that justifies this target
  linkedInsight: string;
  linkedAction: string;
  metric: string;                // the KPI with unit (e.g. "% First Contact Resolution")
  actor: string;
  journeyStage: string;
};

export type V2Output = {
  discover: {
    execSummary: string;
    truths: V2Truth[];
    artifact: Artifact;
    painConcentration: string;
    gaps: string[];
  };
  reimagine: {
    execSummary: string;
    futureStates: V2FutureState[];
    actorJourneyShifts: Array<{ actor: string; from: string; to: string }>;
    artifact: Artifact;
  };
  constraints: {
    execSummary: string;
    clusters: V2ConstraintCluster[];
    totals: { total: number; solvable: number };
    artifact: Artifact;
  };
  pathForward: {
    execSummary: string;
    steps: V2PathStep[];
    artifact: Artifact;
  };
  outcomes: {
    execSummary: string;
    items: V2Outcome[];
    artifact: Artifact;
  };
};

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildV2Prompt(
  workshopName: string,
  industry: string | null,
  actors: string[],
  journeyStages: string[],
  lenses: string[],
  existingSynthesis: Record<string, unknown>,
  rawSignals: RawSignals,
): string {
  const actorList = actors.length > 0 ? actors.join(', ') : 'Customer, Staff, Manager, Partner';
  const stageList = journeyStages.length > 0 ? journeyStages.join(', ') : 'Awareness, Engagement, Commitment, Fulfilment, Support';
  const lensList = lenses.length > 0 ? lenses.join(', ') : 'People, Organisation, Customer, Technology, Regulation';

  const execOverview = safeGet(existingSynthesis, 'execSummary.overview') || '';
  const discoverySummary = safeGet(existingSynthesis, 'discoveryOutput._aiSummary') ||
    safeGet(existingSynthesis, 'discoveryOutput.operationalReality.insight') || '';
  const reimagineSummary = safeGet(existingSynthesis, 'reimagineContent._aiSummary') || '';
  const constraintsSummary = safeGet(existingSynthesis, 'constraintsContent._aiSummary') || '';
  const solutionSummary = safeGet(existingSynthesis, 'potentialSolution._aiSummary') || '';

  const metrics = getArr(existingSynthesis, 'summaryContent.successMetrics')
    .map((m: Record<string, unknown>) => `${m.metric}: baseline ${m.baseline} → target ${m.target}`)
    .join('\n');

  const nextSteps = getArr(existingSynthesis, 'summaryContent.recommendedNextSteps')
    .slice(0, 6)
    .map((s: Record<string, unknown>) => `${s.step || ''} (${s.timeframe || ''}, ${s.owner || ''})`)
    .join('\n');

  // Format verbatim node texts per phase
  const fmt = (texts: string[], max = 30) =>
    texts.slice(0, max).map((t, i) => `  ${i + 1}. "${t.trim()}"`).join('\n') || '  (none captured)';

  // Format domain summary
  const domainBlock = rawSignals.domainSummary
    .filter(d => d.aspirationCount + d.constraintCount > 0)
    .map(d => {
      const lines = [`${d.domain.toUpperCase()} (${d.aspirationCount} aspirations, ${d.constraintCount} constraints):`];
      if (d.topAspirations.length) lines.push(`  Aspirations: ${d.topAspirations.slice(0, 4).map(a => `"${a.trim()}"`).join(' | ')}`);
      if (d.topConstraints.length) lines.push(`  Constraints: ${d.topConstraints.slice(0, 4).map(c => `"${c.trim()}"`).join(' | ')}`);
      if (d.topEnablers.length) lines.push(`  Enablers: ${d.topEnablers.slice(0, 3).map(e => `"${e.trim()}"`).join(' | ')}`);
      return lines.join('\n');
    }).join('\n\n');

  const themeBlock = rawSignals.topThemes.slice(0, 15)
    .map(t => `${t.label} (${t.count} mentions)`)
    .join(', ');

  const actorBlock = rawSignals.topActors.slice(0, 10)
    .map(a => `${a.name} (${a.mentions} mentions)`)
    .join(', ');

  return `You are the DREAM V2 Synthesis Agent for "${workshopName}" (industry: ${industry || 'enterprise'}).

DREAM is a professional consulting methodology used in high-value transformation engagements.
Your output will be presented directly to the client board as part of a professional consulting report.
Every section MUST be board-ready: specific, evidence-grounded, and unique to THIS workshop.

Generic consulting language is UNACCEPTABLE. Do not write:
- "improve efficiency", "enhance customer experience", "leverage technology", "drive transformation"
without a specific object, a specific mechanism, and a specific measurable outcome.

Every truth, constraint, and outcome MUST cite verbatim or near-verbatim evidence from the raw data below.

═══════════════════════════════════════════════
RAW WORKSHOP DATA — ${rawSignals.totalNodes} total signals from ${rawSignals.participantCount || 'multiple'} participants
SAMPLING NOTE: Up to 35 representative signals per phase are shown below. Intensity
values in heatmap cells must be estimated from the relative frequency of themes in
these samples — do not claim exact counts from a dataset you have not seen in full.
═══════════════════════════════════════════════

DISCOVERY PHASE — ${rawSignals.nodesByPhase.DISCOVERY.length} signals shown (current-state observations):
${fmt(rawSignals.nodesByPhase.DISCOVERY)}

REIMAGINE PHASE — ${rawSignals.nodesByPhase.REIMAGINE.length} signals shown (what participants envision):
${fmt(rawSignals.nodesByPhase.REIMAGINE)}

CONSTRAINTS PHASE — ${rawSignals.nodesByPhase.CONSTRAINTS.length} signals shown (what blocks progress):
${fmt(rawSignals.nodesByPhase.CONSTRAINTS)}

DEFINE APPROACH PHASE — ${rawSignals.nodesByPhase.DEFINE_APPROACH.length} signals shown (how to move forward):
${fmt(rawSignals.nodesByPhase.DEFINE_APPROACH)}

DOMAIN BREAKDOWN (by lens):
${domainBlock || '(domain data not available — use phase data above)'}

TOP THEMES (frequency): ${themeBlock || '(not available)'}
TOP ACTORS (mentions): ${actorBlock || '(not available)'}

═══════════════════════════════════════════════
V1 SYNTHESIS CONTEXT (for cross-referencing only — do not copy verbatim)
═══════════════════════════════════════════════
Executive overview: ${execOverview}
Discovery: ${discoverySummary}
Reimagine: ${reimagineSummary}
Constraints: ${constraintsSummary}
Solution direction: ${solutionSummary}
Success metrics from V1: ${metrics || '(not yet defined)'}
Recommended next steps: ${nextSteps || '(see define approach data above)'}

═══════════════════════════════════════════════
KNOWLEDGE PACK — anchor EVERY item to these exact names
═══════════════════════════════════════════════
Actors: ${actorList}
Journey stages: ${stageList}
Lenses: ${lensList}

═══════════════════════════════════════════════
OUTPUT REQUIREMENTS — read every rule before writing
═══════════════════════════════════════════════

DISCOVER SECTION:
- execSummary: 5-6 sentences. Open with scale: "Analysis of ${rawSignals.totalNodes} workshop signals reveals...". Name specific actors, stages, and patterns. State the single most critical finding.
- truths: MINIMUM 8 items. Each truth MUST:
  * statement: A specific, falsifiable observation about THIS organisation. Not "there are challenges" but "Store managers report losing 2-3 hours daily to manual stock reconciliation because the ERP system does not push live inventory to the POS — staff can see last night's closing count, not today's reality."
  * evidence[]: 3-4 DIRECT quotes or close paraphrases from the verbatim data provided above. Do not invent evidence.
  * whyItMatters: 2-3 sentences. What is the business cost if this truth is ignored? Be specific about the cascade effect.
  * evidenceStrength: strong = 5+ signals; moderate = 3-4; weak = 1-2
- artifact type "heatmap": cells = relative intensity of friction/pain for that actor at that stage, scored 1–10 based on the frequency and severity of related signals in the samples provided above (not an exact count — you are seeing representative samples, not the full dataset). tooltip = 1-2 sentences explaining what drives this intensity based on specific signals you observed, e.g. "Multiple Manager signals at Engagement describe approval bottlenecks slowing customer response times."
- painConcentration: 3-4 sentences. WHERE specifically is pain most concentrated? What is the downstream cascade if the highest-intensity intersection is left unresolved?
- gaps: 3-5 specific blind spots. Not "we need more data" but "We have 9 constraint signals about technology at the Fulfilment stage but zero signals from the Regulation lens — compliance risk of the proposed digital changes is unassessed."

REIMAGINE SECTION:
- execSummary: 5-6 sentences. What does the organisation's own reimagine thinking tell us? Ground every sentence in signals from the Reimagine phase data above.
- futureStates: MINIMUM 5 items. Each MUST:
  * title: Specific transformation headline — "Real-time inventory visibility at point of sale across all channels" not "Better inventory management"
  * valueUnlocked: Specific and measurable — "Store managers reclaim 2-3 hours/day currently consumed by manual stock-check calls to head office"
  * whatDisappears: Name the specific friction that ends — "The daily 7am email chain between store managers and the warehouse team reconciling overnight stock discrepancies"
  * howWeKnow: Quote the specific signals from the Reimagine phase that point to this direction
- actorJourneyShifts: One per actor, SPECIFIC from→to — not "inefficient → efficient" but "Spending 40% of shift time on manual workarounds → spending 90% of shift time on customer-facing activity"

CONSTRAINTS SECTION:
- execSummary: 4-5 sentences. What does the constraint landscape tell us? Which clusters are existential (prevent transformation) vs manageable (slow it down)?
- clusters: MINIMUM 5 clusters. Each MUST:
  * items[]: 3-5 VERBATIM or near-verbatim constraint statements from the raw data
  * whyItBlocks: 2 sentences. Why does this specific cluster prevent the transformation described in Reimagine? Be causal, not descriptive.
- totals.solvable = count of clusters with effort "low" or "medium"
- artifact type "bar_chart": cluster name vs count, coloured by severity

PATH FORWARD SECTION:
- execSummary: 4-5 sentences. The transformation in 3 phases. What must happen first, why, and what does completing Phase 1 unlock for Phase 2?
- steps: 3-5 per horizon. Each MUST:
  * action: Specific initiative — "Deploy unified inventory API connecting ERP (SAP) to all 47 POS terminals" not "Improve systems integration"
  * expectedImpact: What specifically changes — "Store managers receive live stock counts on their POS terminal, eliminating the 7am reconciliation call"
  * horizon: "now" (weeks 1-4) | "next" (weeks 5-12) | "later" (weeks 13-52)
- artifact type "gantt": Phase 1 (blue #3b82f6, weeks 1-4), Phase 2 (amber #f59e0b, weeks 5-12), Phase 3 (emerald #10b981, weeks 13-52). Each initiative as a bar with startWeek and endWeek.

OUTCOMES SECTION:
- execSummary: 3-4 sentences. The transformation scorecard. What can be measured in 12 months as proof of success?
- items: MINIMUM 6 items. Each MUST:
  * outcome: Specific and measurable
  * baseline: Current state in numbers or clear factual description drawn from the workshop data
  * target: Specific target with unit (e.g. "85%" not "higher")
  * targetEvidence: The specific workshop signal that justifies this target — quote it
  * metric: The KPI with unit (e.g. "First Contact Resolution Rate (%)", "Average Handle Time (minutes)")

ABSOLUTE RULES:
1. Evidence strings must be direct quotes or close paraphrases of text in the raw data provided. Do not invent evidence.
2. Every metric must have a unit.
3. Actor names must exactly match the Knowledge Pack actors.
4. Journey stage names must exactly match the Knowledge Pack stages.
5. The word "customer" alone is not an actor — use the specific actor names.
6. Return ONLY valid JSON. No preamble, no explanation, no markdown fences.

JSON SCHEMA — return exactly this structure:
{
  "discover": {
    "execSummary": "string",
    "truths": [
      {
        "statement": "string",
        "actor": "string",
        "journeyStage": "string",
        "lens": "string",
        "evidenceStrength": "strong|moderate|weak",
        "evidence": ["string", "string", "string"],
        "whyItMatters": "string"
      }
    ],
    "artifact": {
      "type": "heatmap",
      "data": {
        "cells": [{"actor": "string", "stage": "string", "intensity": 0, "tooltip": "string"}],
        "actors": ["string"],
        "stages": ["string"]
      }
    },
    "painConcentration": "string",
    "gaps": ["string"]
  },
  "reimagine": {
    "execSummary": "string",
    "futureStates": [
      {
        "title": "string",
        "actor": "string",
        "journeyStage": "string",
        "lens": "string",
        "valueUnlocked": "string",
        "whatDisappears": "string",
        "howWeKnow": "string"
      }
    ],
    "actorJourneyShifts": [{"actor": "string", "from": "string", "to": "string"}],
    "artifact": {"type": "none", "data": null}
  },
  "constraints": {
    "execSummary": "string",
    "clusters": [
      {
        "name": "string",
        "count": 0,
        "actor": "string",
        "journeyStage": "string",
        "lens": "string",
        "severity": "critical|high|medium",
        "effort": "high|medium|low",
        "items": ["string", "string", "string"],
        "whyItBlocks": "string"
      }
    ],
    "totals": {"total": 0, "solvable": 0},
    "artifact": {
      "type": "bar_chart",
      "data": {
        "items": [{"label": "string", "value": 0, "color": "string"}],
        "xLabel": "Constraint count",
        "yLabel": "Cluster"
      }
    }
  },
  "pathForward": {
    "execSummary": "string",
    "steps": [
      {
        "horizon": "now|next|later",
        "action": "string",
        "constraintAddressed": "string",
        "journeyStage": "string",
        "owner": "string",
        "expectedImpact": "string"
      }
    ],
    "artifact": {
      "type": "gantt",
      "data": {
        "phases": [
          {
            "phase": 1,
            "label": "Phase 1 — Immediate Enablement",
            "color": "#3b82f6",
            "startWeek": 1,
            "endWeek": 4,
            "initiatives": [{"name": "string", "owner": "string", "startWeek": 1, "endWeek": 4}]
          }
        ]
      }
    }
  },
  "outcomes": {
    "execSummary": "string",
    "items": [
      {
        "outcome": "string",
        "baseline": "string",
        "target": "string",
        "targetEvidence": "string",
        "linkedInsight": "string",
        "linkedAction": "string",
        "metric": "string",
        "actor": "string",
        "journeyStage": "string"
      }
    ],
    "artifact": {
      "type": "bar_chart",
      "data": {
        "items": [{"label": "string", "value": 0, "color": "#3b82f6"}],
        "xLabel": "Target value",
        "yLabel": "Outcome"
      }
    }
  }
}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeGet(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      cur = (cur as Record<string, unknown>)[p];
    } else { return ''; }
  }
  return typeof cur === 'string' ? cur : '';
}

function getArr(obj: Record<string, unknown>, path: string): Record<string, unknown>[] {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      cur = (cur as Record<string, unknown>)[p];
    } else { return []; }
  }
  return Array.isArray(cur) ? (cur as Record<string, unknown>[]) : [];
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function runV2SynthesisAgent(
  workshopName: string,
  industry: string | null,
  blueprint: { actors: string[]; journeyStages: string[]; lenses: string[] },
  existingSynthesis: Record<string, unknown>,
  rawSignals: RawSignals,
): Promise<V2Output | null> {
  const prompt = buildV2Prompt(
    workshopName,
    industry,
    blueprint.actors,
    blueprint.journeyStages,
    blueprint.lenses,
    existingSynthesis,
    rawSignals,
  );

  console.log(`[v2-synthesis] Prompt: ${(prompt.length / 1000).toFixed(1)}KB · ${rawSignals.totalNodes} nodes · ${rawSignals.nodesByPhase.DISCOVERY.length}Disc/${rawSignals.nodesByPhase.REIMAGINE.length}R/${rawSignals.nodesByPhase.CONSTRAINTS.length}C/${rawSignals.nodesByPhase.DEFINE_APPROACH.length}D phase texts`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 12000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    console.error('[v2-synthesis] Empty response from GPT');
    return null;
  }

  console.log(`[v2-synthesis] Response: ${(raw.length / 1000).toFixed(1)}KB · usage: ${JSON.stringify(completion.usage)}`);

  try {
    const parsed = JSON.parse(raw) as V2Output;
    const required = ['discover', 'reimagine', 'constraints', 'pathForward', 'outcomes'];
    const missing = required.filter(k => !parsed[k as keyof V2Output]);
    if (missing.length > 0) {
      console.error(`[v2-synthesis] Missing sections: ${missing.join(', ')}`);
      return null;
    }
    return parsed;
  } catch (e) {
    console.error('[v2-synthesis] JSON parse failed:', e, raw.slice(0, 500));
    return null;
  }
}

// ── Blueprint extractor ─────────────────────────────────────────────────────

export function extractBlueprintKnowledgePack(blueprintJson: unknown): {
  actors: string[];
  journeyStages: string[];
  lenses: string[];
} {
  if (!blueprintJson || typeof blueprintJson !== 'object' || Array.isArray(blueprintJson)) {
    return { actors: [], journeyStages: [], lenses: [] };
  }
  const bp = blueprintJson as Record<string, unknown>;

  const actors = Array.isArray(bp.actorTaxonomy)
    ? (bp.actorTaxonomy as Array<{ label?: string; key?: string }>)
        .map(a => a.label || a.key || '').filter(Boolean)
    : [];

  const journeyStages = Array.isArray(bp.journeyStages)
    ? (bp.journeyStages as Array<{ name?: string }>)
        .map(s => s.name || '').filter(Boolean)
    : [];

  const lenses = Array.isArray(bp.lenses)
    ? (bp.lenses as Array<{ name?: string }>)
        .map(l => l.name || '').filter(Boolean)
    : [];

  return { actors, journeyStages, lenses };
}

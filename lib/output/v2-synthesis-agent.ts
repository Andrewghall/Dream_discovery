/**
 * V2 Synthesis Agent
 *
 * Runs after the existing 8-section synthesis to produce knowledge-pack-anchored
 * V2 output. Every item is anchored to: actor → journey stage → lens.
 *
 * The agent decides which artifact (chart type) best represents each section's data.
 * UI renders whatever artifact type is returned.
 */

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Types ──────────────────────────────────────────────────────────────────

export type ArtifactType = 'heatmap' | 'gantt' | 'matrix' | 'bar_chart' | 'timeline' | 'none';

export type HeatmapData = {
  cells: Array<{ actor: string; stage: string; intensity: number }>;
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
  statement: string;
  actor: string;
  journeyStage: string;
  lens: string;
  evidenceStrength: 'strong' | 'moderate' | 'weak';
  evidence: string[];
};

export type V2FutureState = {
  title: string;
  actor: string;
  journeyStage: string;
  lens: string;
  valueUnlocked: string;
  whatDisappears: string;
};

export type V2ConstraintCluster = {
  name: string;
  count: number;
  actor: string;
  journeyStage: string;
  lens: string;
  severity: 'critical' | 'high' | 'medium';
  effort: 'high' | 'medium' | 'low';
  items: string[];
};

export type V2PathStep = {
  horizon: 'now' | 'next' | 'later';
  action: string;
  constraintAddressed: string;
  journeyStage: string;
  owner: string;
};

export type V2Outcome = {
  outcome: string;
  linkedInsight: string;
  linkedAction: string;
  metric: string;
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

// ── Prompt builder ─────────────────────────────────────────────────────────

function buildV2Prompt(
  workshopName: string,
  industry: string | null,
  actors: string[],
  journeyStages: string[],
  lenses: string[],
  existingSynthesis: Record<string, unknown>,
): string {
  const actorList = actors.length > 0 ? actors.join(', ') : 'Customer, Staff, Manager, Partner';
  const stageList = journeyStages.length > 0 ? journeyStages.join(', ') : 'Awareness, Engagement, Commitment, Fulfilment, Support';
  const lensList = lenses.length > 0 ? lenses.join(', ') : 'People, Organisation, Customer, Technology, Regulation';

  // Summarise existing synthesis for context (avoid massive token count)
  const discoverySummary = safeGet(existingSynthesis, 'discoveryOutput._aiSummary') ||
    safeGet(existingSynthesis, 'discoveryOutput.operationalReality.insight') || '';
  const reimagineSummary = safeGet(existingSynthesis, 'reimagineContent._aiSummary') || '';
  const constraintsSummary = safeGet(existingSynthesis, 'constraintsContent._aiSummary') || '';
  const solutionSummary = safeGet(existingSynthesis, 'potentialSolution._aiSummary') || '';
  const execOverview = safeGet(existingSynthesis, 'execSummary.overview') || '';
  const summaryThesis = safeGet(existingSynthesis, 'summaryContent._aiSummary') || '';

  // Extract next steps for path forward
  const nextSteps = (() => {
    const ns = getArr(existingSynthesis, 'summaryContent.recommendedNextSteps');
    return ns.slice(0, 6).map((s: Record<string, unknown>) =>
      `${s.step || ''} (${s.timeframe || ''}, owner: ${s.owner || ''})`
    ).join('\n');
  })();

  // Extract constraints
  const allConstraints = [
    ...getArr(existingSynthesis, 'constraintsContent.regulatory').map((c: Record<string, unknown>) => `[Regulatory] ${c.title}: ${c.description}`),
    ...getArr(existingSynthesis, 'constraintsContent.technical').map((c: Record<string, unknown>) => `[Technical] ${c.title}: ${c.description}`),
    ...getArr(existingSynthesis, 'constraintsContent.commercial').map((c: Record<string, unknown>) => `[Commercial] ${c.title}: ${c.description}`),
    ...getArr(existingSynthesis, 'constraintsContent.organizational').map((c: Record<string, unknown>) => `[Org] ${c.title}: ${c.description}`),
  ].join('\n');

  // Extract success metrics for outcomes
  const metrics = getArr(existingSynthesis, 'summaryContent.successMetrics')
    .map((m: Record<string, unknown>) => `${m.metric}: baseline ${m.baseline} → target ${m.target}`)
    .join('\n');

  // Extract enablers for path
  const enablers = getArr(existingSynthesis, 'potentialSolution.enablers')
    .slice(0, 6)
    .map((e: Record<string, unknown>) => `${e.title} (${e.domain}, ${e.priority})`)
    .join('\n');

  return `You are the DREAM V2 Synthesis Agent for workshop "${workshopName}" (${industry || 'enterprise'}).

Your job: produce a knowledge-pack-anchored V2 output where EVERY item maps to actor → journey stage → lens.

KNOWLEDGE PACK:
- Actors: ${actorList}
- Journey stages: ${stageList}
- Lenses: ${lensList}

EXISTING SYNTHESIS CONTEXT:
Executive overview: ${execOverview}
Discovery signal: ${discoverySummary}
Reimagine signal: ${reimagineSummary}
Constraints signal: ${constraintsSummary}
Execution signal: ${solutionSummary}
Transformation thesis: ${summaryThesis}

CONSTRAINTS IDENTIFIED:
${allConstraints || 'See constraints signal above.'}

RECOMMENDED NEXT STEPS:
${nextSteps || 'See execution signal above.'}

SUCCESS METRICS:
${metrics || 'To be defined from synthesis context.'}

KEY ENABLERS:
${enablers || 'See execution signal above.'}

OUTPUT RULES:
1. Every truth, future state, constraint cluster, path step, and outcome MUST reference a real actor from the Knowledge Pack, a real journey stage, and a real lens. Use exact names.
2. discover.truths: exactly 5. Each backed by 2-3 evidence strings (real findings from the synthesis, not invented).
3. reimagine.futureStates: 3-5. Each states what VALUE is unlocked and what DISAPPEARS.
4. constraints.clusters: 3-6 clusters. totals.total = sum of all cluster counts. totals.solvable = count of clusters with effort != "high".
5. pathForward.steps: 6-9 steps covering now (0-4 weeks), next (1-3 months), later (3-12 months). Each links to a constraint and a journey stage.
6. outcomes.items: 5-7. Each has a specific metric (e.g. "Reduce call handling time by 30%") linked to a concrete insight and action.
7. For EACH section, choose the artifact type that best visualises the data. Return structured data for that type:
   - discover: usually "heatmap" (actors × journey stages, intensity = pain concentration 0-10)
   - reimagine: usually "timeline" or "none" (the three houses visual handles it)
   - constraints: usually "bar_chart" (cluster name vs count, coloured by severity)
   - pathForward: usually "gantt" (if 3+ phases can be meaningfully timed) else "timeline"
   - outcomes: usually "bar_chart" (outcome label vs target value) or "matrix"
8. All exec summaries: 4-6 lines, specific, include scale (numbers, actors, stages). Board-level language.
9. Use concise, active language. No filler. Every sentence must carry weight.

ARTIFACT DATA FORMATS:
- heatmap: { cells: [{actor, stage, intensity}], actors: [...], stages: [...] }
- gantt: { phases: [{phase, label, color, startWeek, endWeek, initiatives: [{name, owner, startWeek, endWeek, dependsOn?}]}] }
- bar_chart: { items: [{label, value, color}], xLabel, yLabel }
- matrix: { rows, cols, cells: [{row, col, value}] }
- timeline: { events: [{label, week, description, color}] }
- none: null

Colors for gantt phases: Phase 1="#3b82f6" (blue), Phase 2="#f59e0b" (amber), Phase 3="#10b981" (emerald)
Colors for bar_chart severity: critical="#ef4444", high="#f97316", medium="#f59e0b"

Return ONLY valid JSON matching this exact schema:
{
  "discover": {
    "execSummary": "string",
    "truths": [{"statement":"string","actor":"string","journeyStage":"string","lens":"string","evidenceStrength":"strong|moderate|weak","evidence":["string","string"]}],
    "artifact": {"type":"heatmap|gantt|bar_chart|matrix|timeline|none","data":{...}},
    "painConcentration": "string",
    "gaps": ["string"]
  },
  "reimagine": {
    "execSummary": "string",
    "futureStates": [{"title":"string","actor":"string","journeyStage":"string","lens":"string","valueUnlocked":"string","whatDisappears":"string"}],
    "actorJourneyShifts": [{"actor":"string","from":"string","to":"string"}],
    "artifact": {"type":"timeline|none","data":{...}}
  },
  "constraints": {
    "execSummary": "string",
    "clusters": [{"name":"string","count":0,"actor":"string","journeyStage":"string","lens":"string","severity":"critical|high|medium","effort":"high|medium|low","items":["string"]}],
    "totals": {"total":0,"solvable":0},
    "artifact": {"type":"bar_chart","data":{...}}
  },
  "pathForward": {
    "execSummary": "string",
    "steps": [{"horizon":"now|next|later","action":"string","constraintAddressed":"string","journeyStage":"string","owner":"string"}],
    "artifact": {"type":"gantt|timeline","data":{...}}
  },
  "outcomes": {
    "execSummary": "string",
    "items": [{"outcome":"string","linkedInsight":"string","linkedAction":"string","metric":"string","actor":"string","journeyStage":"string"}],
    "artifact": {"type":"bar_chart|matrix","data":{...}}
  }
}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function safeGet(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return '';
    }
  }
  return typeof cur === 'string' ? cur : '';
}

function getArr(obj: Record<string, unknown>, path: string): Record<string, unknown>[] {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return [];
    }
  }
  return Array.isArray(cur) ? (cur as Record<string, unknown>[]) : [];
}

// ── Main export ────────────────────────────────────────────────────────────

export async function runV2SynthesisAgent(
  workshopName: string,
  industry: string | null,
  blueprint: {
    actors: string[];
    journeyStages: string[];
    lenses: string[];
  },
  existingSynthesis: Record<string, unknown>,
): Promise<V2Output | null> {
  const prompt = buildV2Prompt(
    workshopName,
    industry,
    blueprint.actors,
    blueprint.journeyStages,
    blueprint.lenses,
    existingSynthesis,
  );

  console.log(`[v2-synthesis] Prompt length: ${prompt.length} chars`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    console.error('[v2-synthesis] Empty response from GPT');
    return null;
  }

  console.log(`[v2-synthesis] Response: ${(raw.length / 1000).toFixed(1)}KB. Usage: ${JSON.stringify(completion.usage)}`);

  try {
    const parsed = JSON.parse(raw) as V2Output;

    // Validate required sections present
    const required = ['discover', 'reimagine', 'constraints', 'pathForward', 'outcomes'];
    const missing = required.filter(k => !parsed[k as keyof V2Output]);
    if (missing.length > 0) {
      console.error(`[v2-synthesis] Missing sections: ${missing.join(', ')}`);
      return null;
    }

    return parsed;
  } catch (e) {
    console.error('[v2-synthesis] Failed to parse JSON:', e, raw.slice(0, 500));
    return null;
  }
}

// ── Blueprint extractor ────────────────────────────────────────────────────
// Reads the workshop.blueprint JSON field and extracts actor/stage/lens arrays.

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
        .map(a => a.label || a.key || '')
        .filter(Boolean)
    : [];

  const journeyStages = Array.isArray(bp.journeyStages)
    ? (bp.journeyStages as Array<{ name?: string }>)
        .map(s => s.name || '')
        .filter(Boolean)
    : [];

  const lenses = Array.isArray(bp.lenses)
    ? (bp.lenses as Array<{ name?: string }>)
        .map(l => l.name || '')
        .filter(Boolean)
    : [];

  return { actors, journeyStages, lenses };
}

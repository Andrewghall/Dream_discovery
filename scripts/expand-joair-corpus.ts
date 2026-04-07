/**
 * expand-joair-corpus.ts
 *
 * Iterative, stateful, gap-aware corpus expansion for the Jo Air workshop.
 * Expands from ~120 signals to 1000+ across all four phases.
 *
 * Each iteration:
 *   1. Reads current snapshot → analyses phase/lens/actor coverage
 *   2. Identifies the weakest phase × lens combinations
 *   3. Generates a targeted 75-signal batch via GPT-4o-mini
 *   4. Merges into nodesById and upserts to DB
 *   5. Logs progress
 *
 * Run: npx tsx scripts/expand-joair-corpus.ts
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';
const MODEL = 'gpt-4o-mini';
const TARGET_TOTAL = 1000;
const BATCH_SIZE = 75;

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'DISCOVERY' | 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

type PrimaryType = 'INSIGHT' | 'VISIONARY' | 'CONSTRAINT' | 'RISK' | 'ENABLER' | 'ACTION';

interface GeneratedSignal {
  rawText: string;
  phase: Phase;
  lens: string;
  actor: string;
  primaryType?: PrimaryType;
}

interface SnapshotNode {
  rawText: string;
  dialoguePhase: string;
  lens: string;
  speakerId: string;
  createdAtMs: number;
  classification: {
    primaryType: string;
    confidence: number;
    keywords: string[];
    suggestedArea: null;
    updatedAt: string;
  };
  agenticAnalysis: {
    domains: Array<{ domain: string; relevance: number; reasoning: string }>;
    themes: never[];
    actors: never[];
    semanticMeaning: string;
    sentimentTone: string;
    overallConfidence: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKSHOP_CONTEXT = `Jo Air is a major airline transforming its customer contact centre. The end goal is to move from a fragmented, reactive, compliance-driven operation to a proactive, personalised, AI-augmented service that resolves issues faster, empowers agents, cuts failure demand, and delivers consistent outcomes across all channels and BPO sites (Manila, Krakow, Cape Town, Hyderabad). Key context: 8 disconnected legacy systems, 30% escalation rate, Gold/Platinum loyalty tiers, EU261 compensation regulation, GDPR, PCI-DSS, Verint for WFM, Erlang C capacity model, cargo and freight division, inbound and outbound contact, ~2,000 FTE across internal and BPO teams.`;

const LENSES = [
  'Customer Experience',
  'People & Workforce',
  'Operations',
  'Technology',
  'Training & Capability',
  'Regulation & Compliance',
  'Organisation & Leadership',
  'Culture',
] as const;
type Lens = typeof LENSES[number];

const PHASES: Phase[] = ['DISCOVERY', 'REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];

const PHASE_TARGETS: Record<Phase, number> = {
  DISCOVERY: 0.40,
  REIMAGINE: 0.25,
  CONSTRAINTS: 0.20,
  DEFINE_APPROACH: 0.15,
};

const PHASE_QUESTIONS: Record<Phase, string[]> = {
  DISCOVERY: [
    'Current customer contact experience — first-call failure demand, disruption mishandling, Gold/Platinum service gaps, channel switching friction, broken self-service journeys',
    'Agent capability and daily reality — scripting constraints, 30% escalation rate, decision authority gaps, tool inadequacy, the gap between what agents can do vs. what customers need',
    'System and data landscape — 8 disconnected legacy systems, no unified customer record, Verint WFM limitations, data silos between channels and sites, API absence',
    'Workforce and capacity management — Erlang C model breaking under disruption, high agent attrition, WFM tool shortfalls, skills/role mismatches across sites',
    'Compliance and regulatory burden today — manual EU261 claim processing, GDPR complexity blocking AI adoption, PCI-DSS restrictions preventing agents using AI tools',
  ],
  REIMAGINE: [
    'Customer experience during flight disruption events — personalisation, proactive comms, Gold/Platinum treatment, disruption playbooks',
    'Agent empowerment and decision authority — trust-based autonomy, real-time authority matrix, removing supervisor bottleneck',
    'Omnichannel unification and single customer record — seamless channel switching, unified agent desktop, no context loss',
    'AI-augmented operations and predictive demand — AI co-pilot for agents, real-time demand forecasting, intelligent routing',
    'World-class BPO parity — Manila, Krakow, Cape Town, Hyderabad operating as equals with the same tools and authority',
  ],
  CONSTRAINTS: [
    'System fragmentation and data silos — 8 disconnected legacy systems with no unified customer record or API layer',
    'Culture of control and agent disempowerment — 30% escalation rate, rigid scripting, no decision authority, supervisors as bottleneck',
    'Workforce model and capacity planning failures — Erlang C model breakdown during disruptions, high attrition, WFM tool gaps, skills mismatches',
    'Regulatory and compliance blockers — GDPR localisation slowing AI adoption, PCI-DSS restrictions, EU261 fully manual claim processing',
    'BPO structural and contractual barriers — vendor vs. partner mentality, tech exclusion, siloed standards, different training and authority',
  ],
  DEFINE_APPROACH: [
    'Technology integration roadmap — API middleware layer, Verint upgrade, CRM consolidation onto a single platform with real-time data',
    'People and capability programme — career architecture for agents, authority matrix, coaching culture for supervisors, structured upskilling',
    'Operating model redesign — FCR as primary metric replacing AHT, flat hierarchy, decision rights expansion, governance and accountability framework',
    'Compliance automation — EU261 auto-claim processing, GDPR privacy-by-design in the new tech stack, PCI-DSS tokenization enabling AI tools',
    'BPO partnership model — embedded team model replacing vendor contracts, unified performance standards, shared tech stack rollout to all sites',
  ],
};

const PHASE_INSTRUCTIONS: Record<Phase, string> = {
  DISCOVERY: 'These are CURRENT STATE OBSERVATION statements — participants describing what is actually true today. Use language like "Right now...", "The reality is...", "What we actually see is...", "Currently...", "At the moment...". Pure current-state facts, no futures or solutions.',
  REIMAGINE: 'These are aspirational VISION statements — participants imagining the ideal future state. Use language like "In the world we want...", "Imagine if...", "The goal is...", "We should be able to...", "What we\'re aiming for...". Pure future vision, no constraints or implementation plans.',
  CONSTRAINTS: 'These are CONSTRAINT/RISK statements — participants voicing real blockers and frustrations. Use language like "The reality is...", "We\'re held back by...", "The problem is...", "What frustrates me is...", "The blocker here is...". Blockers only — no solutions.',
  DEFINE_APPROACH: 'These are ENABLER/ACTION statements — participants describing concrete solutions and ownership. Use language like "The first step is...", "We need to invest in...", "My team will...", "Within 90 days...", "The plan is...". Concrete path forward only.',
};

const DEFAULT_PRIMARY_TYPE: Record<Phase, PrimaryType> = {
  DISCOVERY: 'INSIGHT',
  REIMAGINE: 'VISIONARY',
  CONSTRAINTS: 'CONSTRAINT',
  DEFINE_APPROACH: 'ENABLER',
};

const SENTIMENT_BY_PHASE: Record<Phase, string> = {
  DISCOVERY: 'concerned',
  REIMAGINE: 'optimistic',
  CONSTRAINTS: 'concerned',
  DEFINE_APPROACH: 'optimistic',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeKey(): string {
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomOffset(): number {
  return Math.floor(Math.random() * 300_000); // up to 5 min spread
}

function buildNode(signal: GeneratedSignal): SnapshotNode {
  const phase = signal.phase;
  const lens = signal.lens;
  const primaryType = signal.primaryType ?? DEFAULT_PRIMARY_TYPE[phase];
  const now = Date.now() - randomOffset();

  return {
    rawText: signal.rawText,
    dialoguePhase: phase,
    lens,
    speakerId: signal.actor,
    createdAtMs: now,
    classification: {
      primaryType,
      confidence: 0.82 + Math.random() * 0.12,
      keywords: [],
      suggestedArea: null,
      updatedAt: new Date(now).toISOString(),
    },
    agenticAnalysis: {
      domains: [{ domain: lens, relevance: 0.92, reasoning: 'from lens field' }],
      themes: [],
      actors: [],
      semanticMeaning: signal.rawText.slice(0, 120),
      sentimentTone: SENTIMENT_BY_PHASE[phase],
      overallConfidence: 0.88,
    },
  };
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

interface Coverage {
  total: number;
  byPhase: Record<Phase, number>;
  byLens: Record<string, number>;
  byActor: Record<string, number>;
  byPhaseLens: Record<string, number>; // "PHASE:Lens"
}

function analyse(nodesById: Record<string, SnapshotNode>): Coverage {
  const coverage: Coverage = {
    total: 0,
    byPhase: { DISCOVERY: 0, REIMAGINE: 0, CONSTRAINTS: 0, DEFINE_APPROACH: 0 },
    byLens: {},
    byActor: {},
    byPhaseLens: {},
  };

  for (const node of Object.values(nodesById)) {
    coverage.total++;
    const phase = node.dialoguePhase as Phase;
    const lens = node.lens ?? 'Unknown';
    const actor = node.speakerId ?? 'Unknown';

    if (PHASES.includes(phase)) coverage.byPhase[phase]++;
    coverage.byLens[lens] = (coverage.byLens[lens] ?? 0) + 1;
    coverage.byActor[actor] = (coverage.byActor[actor] ?? 0) + 1;

    const key = `${phase}:${lens}`;
    coverage.byPhaseLens[key] = (coverage.byPhaseLens[key] ?? 0) + 1;
  }

  return coverage;
}

// ─── Gap Identification ────────────────────────────────────────────────────────

interface Gap {
  phase: Phase;
  lens: Lens;
  current: number;
  priority: number;
}

function identifyGaps(coverage: Coverage, total: number): Gap[] {
  const gaps: Gap[] = [];

  for (const phase of PHASES) {
    const phaseTarget = Math.round(TARGET_TOTAL * PHASE_TARGETS[phase]);
    const phaseShortfall = Math.max(0, phaseTarget - coverage.byPhase[phase]);
    const phaseUrgency = phaseShortfall / phaseTarget;

    for (const lens of LENSES) {
      const key = `${phase}:${lens}`;
      const current = coverage.byPhaseLens[key] ?? 0;
      // Fair share: each phase×lens combo should have ~targetPhase/numLenses
      const lensTarget = phaseTarget / LENSES.length;
      const lensShortfall = Math.max(0, lensTarget - current);
      const lensUrgency = lensShortfall / lensTarget;

      const priority = phaseUrgency * 0.6 + lensUrgency * 0.4;

      gaps.push({ phase, lens, current, priority });
    }
  }

  return gaps.sort((a, b) => b.priority - a.priority);
}

// ─── Batch Generation ─────────────────────────────────────────────────────────

interface BatchAllocation {
  phase: Phase;
  lens: Lens;
  count: number;
  questionTopic: string;
}

function buildAllocations(gaps: Gap[], batchSize: number): BatchAllocation[] {
  // Take top 6 gaps, distribute signals across them
  const topGaps = gaps.slice(0, 6);
  const totalPriority = topGaps.reduce((s, g) => s + g.priority, 0);
  const allocations: BatchAllocation[] = [];
  let assigned = 0;

  for (let i = 0; i < topGaps.length; i++) {
    const gap = topGaps[i];
    const share = i < topGaps.length - 1
      ? Math.max(5, Math.round((gap.priority / totalPriority) * batchSize))
      : batchSize - assigned;

    const questionTopics = PHASE_QUESTIONS[gap.phase];
    const questionTopic = questionTopics[Math.floor(Math.random() * questionTopics.length)];

    allocations.push({ phase: gap.phase, lens: gap.lens, count: share, questionTopic });
    assigned += share;

    if (assigned >= batchSize) break;
  }

  return allocations;
}

async function generateBatch(
  allocations: BatchAllocation[],
  coverage: Coverage,
  attempt = 1,
): Promise<GeneratedSignal[]> {
  const allocationText = allocations
    .map(a => `  - ${a.count} × ${a.phase} | ${a.lens} | topic: "${a.questionTopic}"`)
    .join('\n');

  const phaseInstructions = [...new Set(allocations.map(a => a.phase))]
    .map(p => `${p}: ${PHASE_INSTRUCTIONS[p]}`)
    .join('\n\n');

  const prompt = `You are generating synthetic participant responses for a live workshop facilitation tool.

${WORKSHOP_CONTEXT}

CURRENT SIGNAL DISTRIBUTION (what exists so far — do NOT duplicate these perspectives):
- Total signals: ${coverage.total}
- DISCOVERY: ${coverage.byPhase.DISCOVERY} (target 40%)
- REIMAGINE: ${coverage.byPhase.REIMAGINE} (target 25%)
- CONSTRAINTS: ${coverage.byPhase.CONSTRAINTS} (target 20%)
- DEFINE_APPROACH: ${coverage.byPhase.DEFINE_APPROACH} (target 15%)

GENERATE EXACTLY ${BATCH_SIZE} signals with this distribution:
${allocationText}

PHASE LANGUAGE RULES (MANDATORY — each signal must conform to its phase):
${phaseInstructions}

ACTOR DIVERSITY REQUIRED — distribute across these roles naturally:
Customer / Passenger, Frontline Agent (UK), BPO Agent (Manila), BPO Agent (Krakow), BPO Agent (Cape Town), BPO Agent (Hyderabad), Team Lead / Supervisor, Operations Manager, Head of Contact Centre, IT / Technology Lead, Compliance Officer, HR / L&D Manager, Commercial Manager

QUALITY RULES:
- Each statement is 1–3 sentences, in first-person, as if spoken aloud in a workshop
- Use specific Jo Air context: mention sites (Manila/Krakow/Cape Town/Hyderabad), metrics (FCR, AHT, 30% escalation), systems (Verint, 8 legacy systems), regulations (EU261, GDPR, PCI-DSS), tiers (Gold/Platinum) where natural
- Statements must be VARIED — no two should be the same idea reworded
- Include realistic contradictions between actors where plausible (e.g. leadership narrative vs. frontline reality)
- DISCOVERY signals must describe current reality only — no aspirations, no solutions
- REIMAGINE signals must describe desired future only — no blockers, no implementation plans
- CONSTRAINTS signals must describe blockers only — no solutions
- DEFINE_APPROACH signals must describe concrete actions only — no current-state descriptions

Return ONLY a valid JSON array of exactly ${BATCH_SIZE} objects. No markdown, no explanation.
Each object: { "rawText": "...", "phase": "DISCOVERY|REIMAGINE|CONSTRAINTS|DEFINE_APPROACH", "lens": "<exact lens name from list>", "actor": "<actor role>", "primaryType": "INSIGHT|VISIONARY|CONSTRAINT|RISK|ENABLER|ACTION" }

Valid lens values: ${LENSES.join(', ')}`;

  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    });

    const raw = res.choices[0]?.message?.content ?? '[]';
    const parsed: unknown = JSON.parse(raw);

    let arr: GeneratedSignal[] = [];
    if (Array.isArray(parsed)) {
      arr = parsed as GeneratedSignal[];
    } else if (parsed && typeof parsed === 'object') {
      const vals = Object.values(parsed as Record<string, unknown>);
      const firstArr = vals.find(v => Array.isArray(v));
      if (firstArr) arr = firstArr as GeneratedSignal[];
    }

    // Validate and patch
    const valid = arr
      .filter(s => typeof s.rawText === 'string' && s.rawText.length > 10)
      .map(s => ({
        rawText: s.rawText.trim(),
        phase: (PHASES.includes(s.phase as Phase) ? s.phase : 'DISCOVERY') as Phase,
        lens: LENSES.includes(s.lens as Lens) ? s.lens : (LENSES[Math.floor(Math.random() * LENSES.length)] as string),
        actor: s.actor ?? 'Frontline Agent (UK)',
        primaryType: s.primaryType ?? DEFAULT_PRIMARY_TYPE[s.phase as Phase ?? 'DISCOVERY'],
      }));

    console.log(`  Generated ${valid.length} valid signals from API`);
    return valid;

  } catch (err) {
    if (attempt < 3) {
      console.warn(`  ⚠ Retrying batch (attempt ${attempt + 1})...`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return generateBatch(allocations, coverage, attempt + 1);
    }
    console.error('  ✗ Batch generation failed after retries:', err);
    return [];
  }
}

// ─── Snapshot I/O ─────────────────────────────────────────────────────────────

async function loadSnapshot(): Promise<{ id: string; payload: Record<string, unknown> }> {
  const snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
    where: { workshopId: WORKSHOP_ID },
    orderBy: { createdAt: 'desc' },
    select: { id: true, payload: true },
  });

  if (snapshot) {
    return { id: snapshot.id, payload: (snapshot.payload ?? {}) as Record<string, unknown> };
  }

  // Create a fresh snapshot if none exists
  console.log('  No snapshot found — creating fresh one');
  const fresh = {
    v: 2,
    savedAtMs: Date.now(),
    dialoguePhase: 'DEFINE_APPROACH',
    mainQuestionIndex: 4,
    nodesById: {},
    cogNodes: [],
    stickyPads: [],
    completedByQuestion: [],
    signals: [],
    liveJourney: { stages: [], actors: [], interactions: [] },
    sessionConfidence: {
      overallConfidence: 0.88,
      categorisedRate: 0.92,
      lensCoverageRate: 0.87,
      contradictionCount: 8,
      stabilisedBeliefCount: 14,
    },
    themes: [],
    activeThemeId: null,
    lensCoverage: [],
    agentConversation: [],
    journeyCompletionState: null,
  };

  const created = await (prisma as any).liveWorkshopSnapshot.create({
    data: {
      workshopId: WORKSHOP_ID,
      payload: fresh,
    },
    select: { id: true, payload: true },
  });

  return { id: created.id, payload: created.payload as Record<string, unknown> };
}

async function saveSnapshot(id: string, payload: Record<string, unknown>): Promise<void> {
  payload.savedAtMs = Date.now();
  await (prisma as any).liveWorkshopSnapshot.update({
    where: { id },
    data: { payload },
  });
}

// ─── Progress Logging ─────────────────────────────────────────────────────────

function logProgress(iteration: number, coverage: Coverage, gapsTargeted: BatchAllocation[]): void {
  const pct = (n: number, total: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';
  const phaseStr = PHASES.map(p => `${p} ${pct(coverage.byPhase[p], coverage.total)}`).join(' · ');

  const topLenses = Object.entries(coverage.byLens)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([l, n]) => `${l} ${pct(n, coverage.total)}`)
    .join(' · ');

  const gapStr = gapsTargeted.map(a => `${a.phase}×${a.lens}(${a.count})`).join(', ');

  console.log(`\n── Iteration ${iteration} ─────────────────────────────────────`);
  console.log(`  Total: ${coverage.total} / ${TARGET_TOTAL}`);
  console.log(`  Phase:  ${phaseStr}`);
  console.log(`  Lenses: ${topLenses} ...`);
  console.log(`  Gaps targeted: ${gapStr}`);
  console.log('──────────────────────────────────────────────────────────\n');
}

function logFinal(coverage: Coverage): void {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  CORPUS EXPANSION COMPLETE');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Total signals: ${coverage.total}`);
  console.log('\n  Phase distribution:');
  for (const phase of PHASES) {
    const n = coverage.byPhase[phase];
    const pct = Math.round((n / coverage.total) * 100);
    const target = Math.round(PHASE_TARGETS[phase] * 100);
    const bar = '█'.repeat(Math.round(pct / 2));
    console.log(`    ${phase.padEnd(18)} ${String(n).padStart(4)} (${String(pct).padStart(2)}% / target ${target}%) ${bar}`);
  }
  console.log('\n  Lens distribution:');
  for (const [lens, n] of Object.entries(coverage.byLens).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((n / coverage.total) * 100);
    console.log(`    ${lens.padEnd(26)} ${String(n).padStart(4)} (${pct}%)`);
  }
  console.log('\n  Actor coverage:');
  for (const [actor, n] of Object.entries(coverage.byActor).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${actor.padEnd(32)} ${n}`);
  }
  console.log('══════════════════════════════════════════════════════════\n');
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀 Jo Air corpus expansion starting...');
  console.log(`   Target: ${TARGET_TOTAL} signals | Workshop: ${WORKSHOP_ID}\n`);

  const { id: snapshotId, payload } = await loadSnapshot();

  const nodesById = (payload.nodesById ?? {}) as Record<string, SnapshotNode>;
  console.log(`   Current snapshot: ${snapshotId}`);
  console.log(`   Existing signals: ${Object.keys(nodesById).length}\n`);

  let iteration = 0;

  while (Object.keys(nodesById).length < TARGET_TOTAL) {
    iteration++;
    console.log(`▶ Iteration ${iteration}`);

    const coverage = analyse(nodesById);
    const remaining = TARGET_TOTAL - coverage.total;
    const batchTarget = Math.min(BATCH_SIZE, remaining);

    const gaps = identifyGaps(coverage, coverage.total);
    const allocations = buildAllocations(gaps, batchTarget);

    console.log(`  Generating ${batchTarget} signals...`);
    const batch = await generateBatch(allocations, coverage);

    if (batch.length === 0) {
      console.error('  Empty batch — skipping iteration');
      continue;
    }

    // Merge into nodesById
    for (const signal of batch) {
      const key = nodeKey();
      nodesById[key] = buildNode(signal);
    }

    // Save after each iteration
    payload.nodesById = nodesById;
    await saveSnapshot(snapshotId, payload);

    const updatedCoverage = analyse(nodesById);
    logProgress(iteration, updatedCoverage, allocations);

    // Small pause to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  const finalCoverage = analyse(nodesById);
  logFinal(finalCoverage);

  console.log('✅ Done. Snapshot updated in database.');
  console.log('   Next step: re-run output intelligence for Jo Air to rebuild causal graph.\n');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

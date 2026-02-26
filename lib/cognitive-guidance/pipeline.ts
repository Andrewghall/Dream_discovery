/**
 * Cognitive Guidance Pipeline — Stages 1-5
 *
 * All functions are PURE — no side effects, no LLM calls, no network.
 * Every output traces to source data. Nothing is fabricated.
 */

import type { Domain } from '@/lib/cognition/cognitive-state';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export type CogNodeType =
  | 'VISION'
  | 'BELIEF'
  | 'CONSTRAINT'
  | 'FRICTION'
  | 'ENABLER'
  | 'ACTION'
  | 'QUESTION'
  | 'UNCLASSIFIED';

export type Lens = 'People' | 'Organisation' | 'Technology' | 'Regulation' | 'Customer';

export const ALL_LENSES: Lens[] = ['People', 'Organisation', 'Technology', 'Regulation', 'Customer'];

export type CogNode = {
  id: string;
  rawText: string;
  speakerId: string | null;
  createdAtMs: number;
  nodeType: CogNodeType;
  typeConfidence: number;
  lenses: Array<{
    lens: Lens;
    relevance: number;
    evidence: string;
  }>;
  keywords: string[];
  sourceClassification: {
    primaryType: string;
    confidence: number;
    keywords: string[];
  } | null;
  sourceAgenticAnalysis: {
    domains: Array<{ domain: string; relevance: number; reasoning: string }>;
    themes: Array<{ label: string; category: string; confidence: number; reasoning: string }>;
    actors: Array<{
      name: string;
      role: string;
      interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }>;
    }>;
    semanticMeaning: string;
    sentimentTone: string;
    overallConfidence: number;
  } | null;
};

export type LensCoverage = {
  lens: Lens;
  nodeCount: number;
  avgConfidence: number;
  typeBreakdown: Partial<Record<CogNodeType, number>>;
  hasConstraints: boolean;
  hasEnablers: boolean;
  gapScore: number;
};

export type SignalType =
  | 'repeated_theme'
  | 'missing_dimension'
  | 'contradiction'
  | 'high_freq_constraint'
  | 'unanswered_question'
  | 'weak_enabler'
  | 'risk_cluster';

// ── DREAM Workshop Phases ────────────────────────────────
// SYNTHESIS: Collective viewpoint from individual AI discovery interviews.
//            Pre-populated from stored reports — no live audio needed.
// REIMAGINE: Pure business vision, goals, actors. NO constraints, NO technology.
// CONSTRAINTS: Right-to-left across lenses — Regulation → Customer → Technology → Organisation → People.
// DEFINE_APPROACH: Left-to-right solution design — People → Organisation → Technology → Customer → Regulation.
export type DialoguePhase = 'SYNTHESIS' | 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

export const ALL_PHASES: DialoguePhase[] = ['SYNTHESIS', 'REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];

export const PHASE_LABELS: Record<DialoguePhase, string> = {
  SYNTHESIS: 'Synthesis of Discovery',
  REIMAGINE: 'Reimagine',
  CONSTRAINTS: 'Constraints',
  DEFINE_APPROACH: 'Define Approach',
};

// Which signal types are valid in each phase
const PHASE_ALLOWED_SIGNALS: Record<DialoguePhase, Set<SignalType>> = {
  SYNTHESIS: new Set([
    'repeated_theme',        // common themes across participants
    'missing_dimension',     // gaps in coverage from interviews
    'contradiction',         // divergent views between participants
  ]),
  REIMAGINE: new Set([
    'repeated_theme',        // themes are always relevant
    'missing_dimension',     // but only People, Customer, Organisation lenses
    'unanswered_question',   // questions should always be tracked
    'contradiction',         // belief tension is phase-agnostic
  ]),
  CONSTRAINTS: new Set([
    'repeated_theme',
    'missing_dimension',
    'contradiction',
    'high_freq_constraint',
    'unanswered_question',
    'weak_enabler',
    'risk_cluster',
  ]),
  DEFINE_APPROACH: new Set([
    'repeated_theme',
    'missing_dimension',
    'contradiction',
    'unanswered_question',
    'weak_enabler',
  ]),
};

// In REIMAGINE, only these lenses should trigger missing_dimension signals
// (Technology and Regulation are irrelevant in the visionary phase)
const REIMAGINE_LENSES: Set<Lens> = new Set(['People', 'Customer', 'Organisation']);

export type Signal = {
  id: string;
  type: SignalType;
  description: string;
  strength: number;
  nodeIds: string[];
  lenses: Lens[];
};

export type StickyPadType =
  | 'CLARIFICATION'
  | 'GAP_PROBE'
  | 'CONTRADICTION_PROBE'
  | 'RISK_PROBE'
  | 'ENABLER_PROBE'
  | 'CUSTOMER_IMPACT'
  | 'OWNERSHIP_ACTION';

export type StickyPadSource = 'seed' | 'prep' | 'agent' | 'signal';
export type CoverageState = 'active' | 'covered' | 'queued';

export type StickyPad = {
  id: string;
  type: StickyPadType;
  prompt: string;
  signalStrength: number;
  provenance: {
    triggerType: SignalType;
    sourceNodeIds: string[];
    description: string;
  };
  createdAtMs: number;
  status: 'active' | 'snoozed' | 'dismissed';
  snoozedUntilMs: number | null;

  // Question-driven fields
  source: StickyPadSource;               // Where this pad came from
  questionId: string | null;              // Links to FacilitationQuestion.id (from prep)
  grounding: string | null;               // Why this question matters (from FacilitationQuestion.purpose)
  coveragePercent: number;                // 0-100: how well the team is covering this question
  coverageState: CoverageState;           // Lifecycle: queued → active → covered
  lens: string | null;                    // Lens name for colouring (People, Organisation, etc.)
  mainQuestionIndex: number | null;       // Which main question this sub-pad belongs to
  journeyGapId: string | null;           // Links to a JourneyGap.id for gap-driven coverage tracking
  padLabel: string | null;               // Display label e.g. "Journey Mapping" or "Journey: Registration"
};

export type JourneyPhase =
  | 'AWARENESS'
  | 'CONSIDERATION'
  | 'DECISION'
  | 'PURCHASE'
  | 'ONBOARDING'
  | 'USAGE'
  | 'SUPPORT'
  | 'RETENTION_EXIT';

export const ALL_JOURNEY_PHASES: JourneyPhase[] = [
  'AWARENESS', 'CONSIDERATION', 'DECISION', 'PURCHASE',
  'ONBOARDING', 'USAGE', 'SUPPORT', 'RETENTION_EXIT',
];

export type ActorJourneyEntry = {
  actorName: string;
  phase: JourneyPhase;
  nodeIds: string[];
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'concerned' | 'critical';
  summary: string;
};

export type ActorJourney = {
  actorName: string;
  role: string;
  mentionCount: number;
  phases: Partial<Record<JourneyPhase, ActorJourneyEntry>>;
  gapPhases: JourneyPhase[];
};

export type SessionConfidence = {
  overallConfidence: number;
  categorisedRate: number;
  lensCoverageRate: number;
  contradictionCount: number;
  stabilisedBeliefCount: number;
};

// ── Live Journey Map Types ────────────────────────────────

export type AiAgencyLevel = 'human' | 'assisted' | 'autonomous';

export type JourneyConstraintFlag = {
  id: string;
  type: 'regulatory' | 'technical' | 'organisational' | 'people' | 'customer' | 'budget';
  label: string;
  severity: 'blocking' | 'significant' | 'manageable';
  sourceNodeIds: string[];
  addedBy: 'ai' | 'facilitator';
};

export type LiveJourneyInteraction = {
  id: string;
  actor: string;
  stage: string;
  action: string;
  context: string;
  sentiment: 'positive' | 'neutral' | 'concerned' | 'critical';
  businessIntensity: number;   // 0-1: effort/resource from business side
  customerIntensity: number;   // 0-1: friction/delight from customer side
  aiAgencyNow: AiAgencyLevel;
  aiAgencyFuture: AiAgencyLevel;
  isPainPoint: boolean;
  isMomentOfTruth: boolean;
  sourceNodeIds: string[];
  addedBy: 'ai' | 'facilitator';
  createdAtMs: number;
  // Constraint overlay fields
  constraintFlags?: JourneyConstraintFlag[];
  idealBusinessIntensity?: number | null;   // Snapshot from Reimagine phase
  idealCustomerIntensity?: number | null;   // Snapshot from Reimagine phase
  phaseAdded?: DialoguePhase;               // Which phase this was added in
};

export type LiveJourneyActor = {
  name: string;
  role: string;
  mentionCount: number;
};

export type LiveJourneyData = {
  stages: string[];
  actors: LiveJourneyActor[];
  interactions: LiveJourneyInteraction[];
};

// Default stages per DREAM phase
export const DEFAULT_JOURNEY_STAGES: Record<DialoguePhase, string[]> = {
  SYNTHESIS: ['Discovery', 'Engagement', 'Commitment', 'Fulfilment', 'Support', 'Growth'],
  REIMAGINE: ['Discovery', 'Engagement', 'Commitment', 'Fulfilment', 'Support', 'Growth'],
  CONSTRAINTS: ['Discovery', 'Engagement', 'Commitment', 'Fulfilment', 'Support', 'Growth'],
  DEFINE_APPROACH: ['Discovery', 'Engagement', 'Commitment', 'Fulfilment', 'Support', 'Growth'],
};

// ══════════════════════════════════════════════════════════
// STAGE 1 — DETERMINISTIC CATEGORISATION
// ══════════════════════════════════════════════════════════

const PRIMARY_TYPE_TO_COG: Record<string, CogNodeType> = {
  VISIONARY: 'VISION',
  OPPORTUNITY: 'VISION',
  INSIGHT: 'BELIEF',
  CONSTRAINT: 'CONSTRAINT',
  RISK: 'FRICTION',
  ENABLER: 'ENABLER',
  ACTION: 'ACTION',
  QUESTION: 'QUESTION',
};

const CONFIDENCE_THRESHOLD = 0.4;

/**
 * Stage 1: Create initial CogNode from a datapoint.created event.
 * Starts as UNCLASSIFIED until classification arrives.
 */
export function createInitialNode(
  dataPointId: string,
  rawText: string,
  speakerId: string | null,
  createdAtMs: number,
): CogNode {
  return {
    id: dataPointId,
    rawText,
    speakerId,
    createdAtMs,
    nodeType: 'UNCLASSIFIED',
    typeConfidence: 0,
    lenses: [],
    keywords: [],
    sourceClassification: null,
    sourceAgenticAnalysis: null,
  };
}

/**
 * Stage 1: Recategorise when classification.updated arrives.
 * Returns updated node (immutable — creates new object).
 */
export function categoriseNode(
  node: CogNode,
  classification: { primaryType: string; confidence: number; keywords: string[] },
): CogNode {
  const mapped = PRIMARY_TYPE_TO_COG[classification.primaryType] || 'UNCLASSIFIED';
  const confident = classification.confidence >= CONFIDENCE_THRESHOLD;

  return {
    ...node,
    nodeType: confident ? mapped : 'UNCLASSIFIED',
    typeConfidence: classification.confidence,
    keywords: classification.keywords || [],
    sourceClassification: classification,
  };
}

// ══════════════════════════════════════════════════════════
// STAGE 2 — LENS APPLICATION
// ══════════════════════════════════════════════════════════

const DOMAIN_TO_LENS: Record<string, Lens> = {
  People: 'People',
  Operations: 'Organisation',
  Customer: 'Customer',
  Technology: 'Technology',
  Regulation: 'Regulation',
};

/** Reverse map: lens name → CaptureAPI domain name (for hemisphere positioning) */
export const LENS_TO_DOMAIN: Record<string, string> = {
  People: 'People',
  Organisation: 'Operations',
  Customer: 'Customer',
  Technology: 'Technology',
  Regulation: 'Regulation',
};

const LENS_RELEVANCE_THRESHOLD = 0.3;

/** Keyword patterns per lens — used as fallback when CaptureAPI under-classifies */
const KEYWORD_LENS_MAP: [Lens, RegExp][] = [
  ['Customer', /\b(customer|client|user|consumer|buyer|shopper|subscriber|member|patient|end.?user)\b/i],
  ['Technology', /\b(technolog|AI|machine.?learning|system|platform|software|digital|automat|data|cloud|infra|app|algorithm|API)\b/i],
  ['Regulation', /\b(regulat|complian|legal|GDPR|FCA|licen[cs]|governance|audit|polic[iy]|legislat|mandate|standard)\b/i],
  ['Organisation', /\b(organi[sz]ation|department|team|structure|process|workflow|operat|management|staff|employ|HR|budget|resource)\b/i],
  ['People', /\b(people|person|human|culture|skill|training|talent|recruit|wellbeing|engagement|stakeholder|leader)\b/i],
];

/**
 * Keyword-based lens inference — supplements CaptureAPI when it returns weak
 * or missing domain classifications. Returns lenses at 0.3-0.5 relevance.
 */
export function inferKeywordLenses(text: string): Array<{ lens: Lens; relevance: number; evidence: string }> {
  const results: Array<{ lens: Lens; relevance: number; evidence: string }> = [];
  for (const [lens, pattern] of KEYWORD_LENS_MAP) {
    const matches = text.match(new RegExp(pattern, 'gi'));
    if (matches && matches.length > 0) {
      results.push({
        lens,
        relevance: Math.min(0.5, 0.3 + matches.length * 0.05),
        evidence: `Keyword: ${[...new Set(matches)].slice(0, 3).join(', ')}`,
      });
    }
  }
  return results;
}

/**
 * Stage 2: Apply lens mapping when agentic.analyzed arrives.
 * Maps CaptureAPI domains to lenses (≥0.3 relevance with evidence).
 * Falls back to keyword inference when CaptureAPI gives ≤1 lens.
 */
export function applyLensMapping(
  node: CogNode,
  agenticAnalysis: CogNode['sourceAgenticAnalysis'],
): CogNode {
  if (!agenticAnalysis) return node;

  const apiLenses = agenticAnalysis.domains
    .filter(d => d.relevance >= LENS_RELEVANCE_THRESHOLD && d.reasoning)
    .map(d => ({
      lens: DOMAIN_TO_LENS[d.domain] || d.domain as Lens,
      relevance: d.relevance,
      evidence: d.reasoning,
    }))
    .filter(l => ALL_LENSES.includes(l.lens));

  // Keyword fallback: if CaptureAPI gave ≤1 lens, supplement from text
  let lenses = apiLenses;
  if (apiLenses.length <= 1 && node.rawText.length >= 20) {
    const kwLenses = inferKeywordLenses(node.rawText);
    const existing = new Set(apiLenses.map(l => l.lens));
    const extra = kwLenses.filter(kw => !existing.has(kw.lens));
    lenses = [...apiLenses, ...extra];
  }

  return {
    ...node,
    lenses,
    sourceAgenticAnalysis: agenticAnalysis,
  };
}

// ══════════════════════════════════════════════════════════
// STAGE 3 — GAP & SIGNAL DETECTION
// ══════════════════════════════════════════════════════════

/**
 * Calculate lens coverage from all nodes.
 */
export function calculateLensCoverage(nodes: CogNode[]): Map<Lens, LensCoverage> {
  const coverage = new Map<Lens, LensCoverage>();

  for (const lens of ALL_LENSES) {
    const lensNodes = nodes.filter(n => n.lenses.some(l => l.lens === lens));
    const typeBreakdown: Partial<Record<CogNodeType, number>> = {};
    let totalConf = 0;

    for (const n of lensNodes) {
      typeBreakdown[n.nodeType] = (typeBreakdown[n.nodeType] || 0) + 1;
      totalConf += n.typeConfidence;
    }

    const constraintCount = (typeBreakdown['CONSTRAINT'] || 0) + (typeBreakdown['FRICTION'] || 0);
    const enablerCount = (typeBreakdown['ENABLER'] || 0) + (typeBreakdown['ACTION'] || 0);
    const gapScore = constraintCount > 0
      ? 1.0 - Math.min(1.0, enablerCount / constraintCount)
      : 0;

    coverage.set(lens, {
      lens,
      nodeCount: lensNodes.length,
      avgConfidence: lensNodes.length > 0 ? totalConf / lensNodes.length : 0,
      typeBreakdown,
      hasConstraints: constraintCount > 0,
      hasEnablers: enablerCount > 0,
      gapScore,
    });
  }

  return coverage;
}

/**
 * Extract content words for keyword overlap (Jaccard similarity).
 */
export function contentWords(text: string): Set<string> {
  const STOP = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
    'than', 'too', 'very', 'just', 'also', 'now', 'then', 'here', 'there',
    'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'this',
    'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'us',
    'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
    'their', 'about', 'up', 'out', 'if', 'because', 'while', 'although',
  ]);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  return new Set(words.filter(w => w.length > 2 && !STOP.has(w)));
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Stage 3: Detect structural signals from all nodes.
 * Pure counting and keyword overlap — no semantic inference.
 */
export function detectSignals(
  nodes: CogNode[],
  contradictions: Array<{ id: string; beliefA: string; beliefB: string; resolved: boolean }>,
  nowMs: number,
): Signal[] {
  const signals: Signal[] = [];
  const totalNodes = nodes.length;
  if (totalNodes < 3) return signals;

  // --- Repeated themes: ≥3 nodes sharing ≥2 keywords ---
  const keywordCounts = new Map<string, string[]>();
  for (const n of nodes) {
    for (const kw of n.keywords) {
      const lower = kw.toLowerCase();
      const list = keywordCounts.get(lower) || [];
      list.push(n.id);
      keywordCounts.set(lower, list);
    }
  }
  for (const [keyword, nodeIds] of keywordCounts) {
    if (nodeIds.length >= 3) {
      signals.push({
        id: `repeated_theme:${keyword}`,
        type: 'repeated_theme',
        description: `'${keyword}' mentioned in ${nodeIds.length} contributions`,
        strength: Math.min(1.0, nodeIds.length / totalNodes),
        nodeIds: [...new Set(nodeIds)],
        lenses: getLensesForNodes(nodes, [...new Set(nodeIds)]),
      });
    }
  }

  // --- Missing dimension: lens with 0 nodes after ≥10 total ---
  if (totalNodes >= 10) {
    for (const lens of ALL_LENSES) {
      const lensNodes = nodes.filter(n => n.lenses.some(l => l.lens === lens));
      if (lensNodes.length === 0) {
        signals.push({
          id: `missing_dimension:${lens}`,
          type: 'missing_dimension',
          description: `No contributions in the ${lens} dimension`,
          strength: 1.0,
          nodeIds: [],
          lenses: [lens],
        });
      }
    }
  }

  // --- Contradictions ---
  for (const c of contradictions) {
    if (!c.resolved) {
      signals.push({
        id: `contradiction:${c.id}`,
        type: 'contradiction',
        description: `Unresolved tension between beliefs`,
        strength: 0.8,
        nodeIds: [],
        lenses: [],
      });
    }
  }

  // --- High-frequency constraints per lens ---
  for (const lens of ALL_LENSES) {
    const constraintNodes = nodes.filter(
      n => (n.nodeType === 'CONSTRAINT' || n.nodeType === 'FRICTION') &&
        n.lenses.some(l => l.lens === lens)
    );
    if (constraintNodes.length >= 4) {
      signals.push({
        id: `high_freq_constraint:${lens}`,
        type: 'high_freq_constraint',
        description: `${constraintNodes.length} constraints in ${lens}`,
        strength: Math.min(1.0, constraintNodes.length / 10),
        nodeIds: constraintNodes.map(n => n.id),
        lenses: [lens],
      });
    }
  }

  // --- Unanswered questions (skip very short fragments) ---
  const questionNodes = nodes.filter(n => n.nodeType === 'QUESTION' && n.rawText.length >= 30);
  const enablerActionNodes = nodes.filter(n => n.nodeType === 'ENABLER' || n.nodeType === 'ACTION');
  for (const q of questionNodes) {
    const qWords = contentWords(q.rawText);
    const answered = enablerActionNodes.some(ea => {
      if (ea.createdAtMs <= q.createdAtMs) return false;
      return jaccardSimilarity(qWords, contentWords(ea.rawText)) > 0.2;
    });
    if (!answered) {
      const ageMs = nowMs - q.createdAtMs;
      if (ageMs > 30_000) {
        // Use keywords or lenses for a clean description instead of raw speech
        const kwSummary = q.keywords.length > 0
          ? q.keywords.slice(0, 3).join(', ')
          : q.lenses.length > 0
            ? q.lenses.map(l => l.lens).join(', ')
            : 'general topic';
        signals.push({
          id: `unanswered_question:${q.id}`,
          type: 'unanswered_question',
          description: `Unanswered question about ${kwSummary}`,
          strength: Math.min(1.0, ageMs / 300_000),
          nodeIds: [q.id],
          lenses: q.lenses.map(l => l.lens),
        });
      }
    }
  }

  // --- Weak enabler coverage per lens ---
  for (const lens of ALL_LENSES) {
    const lensConstraints = nodes.filter(
      n => (n.nodeType === 'CONSTRAINT' || n.nodeType === 'FRICTION') &&
        n.lenses.some(l => l.lens === lens)
    );
    const lensEnablers = nodes.filter(
      n => (n.nodeType === 'ENABLER' || n.nodeType === 'ACTION') &&
        n.lenses.some(l => l.lens === lens)
    );
    if (lensConstraints.length >= 3 && lensEnablers.length <= 1) {
      signals.push({
        id: `weak_enabler:${lens}`,
        type: 'weak_enabler',
        description: `${lens}: ${lensConstraints.length} constraints vs ${lensEnablers.length} enablers`,
        strength: (lensConstraints.length - lensEnablers.length) / lensConstraints.length,
        nodeIds: [...lensConstraints, ...lensEnablers].map(n => n.id),
        lenses: [lens],
      });
    }
  }

  // --- Risk clusters: ≥3 FRICTION/CONSTRAINT in same lens within 120s ---
  for (const lens of ALL_LENSES) {
    const riskNodes = nodes
      .filter(n => (n.nodeType === 'CONSTRAINT' || n.nodeType === 'FRICTION') &&
        n.lenses.some(l => l.lens === lens))
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    for (let i = 0; i < riskNodes.length; i++) {
      const cluster = riskNodes.filter(
        n => n.createdAtMs >= riskNodes[i].createdAtMs &&
          n.createdAtMs <= riskNodes[i].createdAtMs + 120_000
      );
      if (cluster.length >= 3) {
        const clusterId = `risk_cluster:${lens}:${riskNodes[i].id}`;
        if (!signals.some(s => s.id === clusterId)) {
          signals.push({
            id: clusterId,
            type: 'risk_cluster',
            description: `${cluster.length} risks in ${lens} within 2 minutes`,
            strength: Math.min(1.0, cluster.length / 5),
            nodeIds: cluster.map(n => n.id),
            lenses: [lens],
          });
        }
        break; // one cluster per lens is enough
      }
    }
  }

  return signals;
}

function getLensesForNodes(allNodes: CogNode[], nodeIds: string[]): Lens[] {
  const lensSet = new Set<Lens>();
  for (const id of nodeIds) {
    const node = allNodes.find(n => n.id === id);
    if (node) {
      for (const l of node.lenses) lensSet.add(l.lens);
    }
  }
  return [...lensSet];
}

// ══════════════════════════════════════════════════════════
// STAGE 4 — STICKY PAD GENERATION
// ══════════════════════════════════════════════════════════

const MAX_ACTIVE_PADS = 8;

/**
 * Stage 4: Generate facilitation sticky pads from detected signals.
 * Template-based string interpolation only — no LLM, no fabrication.
 *
 * Phase-aware: only generates pads appropriate for the current DREAM phase.
 * - REIMAGINE: vision, goals, actors only. No constraints/technology/regulation.
 * - CONSTRAINTS: all constraint/risk signals unlocked.
 * - DEFINE_APPROACH: enablers, actions, ownership.
 */
export function generateStickyPads(
  signals: Signal[],
  existingPads: StickyPad[],
  nowMs: number,
  phase: DialoguePhase = 'REIMAGINE',
): StickyPad[] {
  const allowedSignals = PHASE_ALLOWED_SIGNALS[phase];

  const pads = existingPads
    .filter(p => p.status !== 'dismissed')
    .filter(p => p.status !== 'snoozed' || (p.snoozedUntilMs && p.snoozedUntilMs <= nowMs))
    .map(p => p.status === 'snoozed' && p.snoozedUntilMs && p.snoozedUntilMs <= nowMs
      ? { ...p, status: 'active' as const, snoozedUntilMs: null }
      : p
    );

  for (const signal of signals) {
    if (signal.strength < 0.2) continue;

    // Phase gate: skip signals not appropriate for current phase
    if (!allowedSignals.has(signal.type)) continue;

    // In REIMAGINE, missing_dimension only fires for People/Customer/Organisation
    if (phase === 'REIMAGINE' && signal.type === 'missing_dimension') {
      const signalLensesInPhase = signal.lenses.filter(l => REIMAGINE_LENSES.has(l));
      if (signalLensesInPhase.length === 0) continue;
    }

    const padId = `pad:${signal.type}:${signal.lenses[0] || 'general'}`;
    const existing = pads.find(p => p.id === padId);

    if (existing) {
      // Update strength
      existing.signalStrength = signal.strength;
      existing.provenance.sourceNodeIds = signal.nodeIds;
      continue;
    }

    const prompt = buildPromptFromSignal(signal);
    if (!prompt) continue;

    pads.push({
      id: padId,
      type: signalToPadType(signal.type),
      prompt,
      signalStrength: signal.strength,
      provenance: {
        triggerType: signal.type,
        sourceNodeIds: signal.nodeIds,
        description: signal.description,
      },
      createdAtMs: nowMs,
      status: 'active',
      snoozedUntilMs: null,
      // Question-driven defaults for signal-generated pads
      source: 'signal',
      questionId: null,
      grounding: null,
      coveragePercent: 0,
      coverageState: 'active',
      lens: signal.lenses[0] || null,
      mainQuestionIndex: null,
      journeyGapId: null,
      padLabel: null,
    });
  }

  // Retire weak pads
  const active = pads
    .filter(p => p.status === 'active')
    .sort((a, b) => b.signalStrength - a.signalStrength);

  // Cap at MAX_ACTIVE_PADS
  if (active.length > MAX_ACTIVE_PADS) {
    for (let i = MAX_ACTIVE_PADS; i < active.length; i++) {
      active[i].status = 'dismissed';
    }
  }

  return pads.filter(p => p.status !== 'dismissed');
}

function signalToPadType(type: SignalType): StickyPadType {
  switch (type) {
    case 'repeated_theme': return 'CLARIFICATION';
    case 'missing_dimension': return 'GAP_PROBE';
    case 'contradiction': return 'CONTRADICTION_PROBE';
    case 'high_freq_constraint': return 'RISK_PROBE';
    case 'unanswered_question': return 'CLARIFICATION';
    case 'weak_enabler': return 'ENABLER_PROBE';
    case 'risk_cluster': return 'RISK_PROBE';
    default: return 'CLARIFICATION';
  }
}

function buildPromptFromSignal(signal: Signal): string {
  const lens = signal.lenses[0] || 'this area';

  switch (signal.type) {
    case 'repeated_theme': {
      const keyword = signal.id.split(':')[1] || 'this topic';
      return `'${keyword}' has appeared ${signal.nodeIds.length} times across ${signal.lenses.join(', ') || 'multiple areas'}. Is this a core theme worth exploring further?`;
    }
    case 'missing_dimension':
      return `No contributions yet in the ${lens} dimension. Should we explore how ${lens} factors into this?`;
    case 'contradiction':
      return `Two beliefs appear in tension. Can we clarify which direction holds?`;
    case 'high_freq_constraint':
      return `${signal.nodeIds.length} constraints identified in ${lens}. Are these blockers or conditions to manage?`;
    case 'unanswered_question': {
      const qText = signal.description.replace('Question unanswered: ', '');
      return `${qText} — raised without a clear response. Worth revisiting?`;
    }
    case 'weak_enabler':
      return `${signal.description}. What needs to change to unlock this?`;
    case 'risk_cluster':
      return `${signal.nodeIds.length} risks clustered in ${lens} within the last 2 minutes. Is there a systemic issue here?`;
    default:
      return signal.description;
  }
}

// ══════════════════════════════════════════════════════════
// STAGE 4B — QUESTION COVERAGE CALCULATION
// ══════════════════════════════════════════════════════════

/**
 * Calculate how well the conversation has covered a specific facilitation question.
 * Uses keyword overlap between the question prompt and accumulated beliefs,
 * plus lens matching. Returns 0-100 percentage.
 *
 * ~5 relevant beliefs = ~40%, ~10 = ~80%, ~15+ = 100%
 */
export function calculateQuestionCoverage(
  pad: StickyPad,
  nodes: CogNode[],
): number {
  if (nodes.length === 0) return 0;

  const questionWords = contentWords(pad.prompt);
  if (questionWords.size === 0) return 0;

  // Also extract keywords from grounding if available
  const groundingWords = pad.grounding ? contentWords(pad.grounding) : new Set<string>();
  const combinedWords = new Set([...questionWords, ...groundingWords]);

  let relevantScore = 0;

  for (const node of nodes) {
    if (node.nodeType === 'UNCLASSIFIED') continue;

    const nodeWords = contentWords(node.rawText);

    // Check keyword overlap between question and belief
    const similarity = jaccardSimilarity(combinedWords, nodeWords);
    if (similarity > 0.12) {
      relevantScore += 1;
    }

    // Bonus for lens match — if the question mentions a lens and the node is tagged with it
    for (const nodeLens of node.lenses) {
      if (pad.prompt.toLowerCase().includes(nodeLens.lens.toLowerCase())) {
        relevantScore += 0.3;
        break;
      }
    }

    // Bonus for keyword match from the question
    for (const kw of node.keywords) {
      if (questionWords.has(kw.toLowerCase())) {
        relevantScore += 0.2;
        break;
      }
    }
  }

  // Normalize: ~5 relevant = 40%, ~10 = 80%, ~15+ = 100%
  return Math.min(100, Math.round((relevantScore / 12.5) * 100));
}

// ══════════════════════════════════════════════════════════
// STAGE 5 — ACTOR JOURNEY CONSTRUCTION
// ══════════════════════════════════════════════════════════

const PHASE_KEYWORDS: Record<JourneyPhase, string[]> = {
  AWARENESS: ['awareness', 'discover', 'learn', 'hear', 'first impression', 'introduce', 'know about', 'find out'],
  CONSIDERATION: ['compare', 'evaluate', 'consider', 'research', 'explore', 'options', 'alternative', 'assess', 'review'],
  DECISION: ['decide', 'choose', 'commit', 'approve', 'sign off', 'select', 'go with', 'agreement'],
  PURCHASE: ['buy', 'purchase', 'invest', 'procure', 'contract', 'order', 'payment', 'price'],
  ONBOARDING: ['onboard', 'setup', 'implement', 'deploy', 'configure', 'migrate', 'install', 'provision', 'training'],
  USAGE: ['use', 'adopt', 'operate', 'daily', 'workflow', 'experience', 'feature', 'routine', 'interact'],
  SUPPORT: ['support', 'help', 'issue', 'ticket', 'escalate', 'troubleshoot', 'problem', 'fix', 'assist'],
  RETENTION_EXIT: ['retain', 'renew', 'churn', 'exit', 'cancel', 'expand', 'upsell', 'loyalty', 'leave', 'stay'],
};

const PHASE_MATCH_THRESHOLD = 2;

/**
 * Stage 5: Build actor journeys from nodes with actor data.
 * Keyword-driven mapping only — no inferred phases.
 */
export function updateActorJourneys(nodes: CogNode[]): Map<string, ActorJourney> {
  const journeys = new Map<string, ActorJourney>();

  // Collect all actors from agentic analysis
  for (const node of nodes) {
    if (!node.sourceAgenticAnalysis?.actors) continue;
    for (const actor of node.sourceAgenticAnalysis.actors) {
      if (!actor.name || actor.name.length < 2) continue;

      const key = actor.name.toLowerCase();
      if (!journeys.has(key)) {
        journeys.set(key, {
          actorName: actor.name,
          role: actor.role || 'Unknown',
          mentionCount: 0,
          phases: {},
          gapPhases: [],
        });
      }

      const journey = journeys.get(key)!;
      journey.mentionCount++;

      // Try to map this node to a journey phase
      const text = (node.rawText + ' ' + (node.sourceAgenticAnalysis?.semanticMeaning || '')).toLowerCase();
      for (const phase of ALL_JOURNEY_PHASES) {
        const keywords = PHASE_KEYWORDS[phase];
        const matches = keywords.filter(kw => text.includes(kw));
        if (matches.length >= PHASE_MATCH_THRESHOLD) {
          const existing = journey.phases[phase];
          if (!existing || node.typeConfidence > existing.confidence) {
            journey.phases[phase] = {
              actorName: actor.name,
              phase,
              nodeIds: existing ? [...existing.nodeIds, node.id] : [node.id],
              confidence: Math.min(node.typeConfidence, node.sourceAgenticAnalysis?.overallConfidence || 0),
              sentiment: mapSentiment(node.sourceAgenticAnalysis?.sentimentTone || 'neutral'),
              summary: node.rawText.slice(0, 120),
            };
          } else if (existing) {
            if (!existing.nodeIds.includes(node.id)) {
              existing.nodeIds.push(node.id);
            }
          }
        }
      }
    }
  }

  // Calculate gap phases
  for (const journey of journeys.values()) {
    journey.gapPhases = ALL_JOURNEY_PHASES.filter(p => !journey.phases[p]);
  }

  return journeys;
}

function mapSentiment(tone: string): 'positive' | 'neutral' | 'concerned' | 'critical' {
  if (tone === 'positive') return 'positive';
  if (tone === 'concerned') return 'concerned';
  if (tone === 'critical') return 'critical';
  return 'neutral';
}

// ══════════════════════════════════════════════════════════
// STAGE 5B — LIVE JOURNEY MAP CONSTRUCTION
// ══════════════════════════════════════════════════════════

const JOURNEY_STAGE_KEYWORDS: Record<string, string[]> = {
  Discovery:   ['discover', 'find', 'learn', 'awareness', 'search', 'browse', 'hear about', 'first time', 'initial'],
  Engagement:  ['engage', 'interact', 'visit', 'explore', 'consider', 'evaluate', 'contact', 'try', 'demo'],
  Commitment:  ['commit', 'decide', 'purchase', 'buy', 'sign', 'agree', 'choose', 'select', 'approve', 'order'],
  Fulfilment:  ['deliver', 'receive', 'onboard', 'setup', 'implement', 'fulfil', 'install', 'provision', 'configure'],
  Support:     ['support', 'help', 'assist', 'resolve', 'fix', 'service', 'maintain', 'issue', 'problem', 'ticket'],
  Growth:      ['retain', 'loyalty', 'expand', 'recommend', 'renew', 'grow', 'upsell', 'refer', 'advocate'],
};

function inferStage(text: string, stages: string[]): string | null {
  const lower = text.toLowerCase();
  let bestStage: string | null = null;
  let bestCount = 0;

  for (const stage of stages) {
    const keywords = JOURNEY_STAGE_KEYWORDS[stage];
    if (!keywords) continue;
    const count = keywords.filter(kw => lower.includes(kw)).length;
    if (count > bestCount) {
      bestCount = count;
      bestStage = stage;
    }
  }

  return bestCount >= 1 ? bestStage : null;
}

function inferIntensityFromSentiment(sentiment: string): { biz: number; cust: number } {
  switch (sentiment) {
    case 'positive': return { biz: 0.3, cust: 0.2 };
    case 'neutral': return { biz: 0.5, cust: 0.5 };
    case 'concerned': return { biz: 0.6, cust: 0.7 };
    case 'critical': return { biz: 0.8, cust: 0.9 };
    default: return { biz: 0.5, cust: 0.5 };
  }
}

/**
 * Stage 5B: Build live journey map from nodes with actor data.
 * Progressive — merges with existing data, preserves facilitator edits.
 */
export function buildLiveJourney(
  nodes: CogNode[],
  existingData: LiveJourneyData,
  defaultStages: string[],
): LiveJourneyData {
  const stages = existingData.stages.length > 0 ? existingData.stages : defaultStages;
  const actorsMap = new Map<string, LiveJourneyActor>();
  const existingInteractionIds = new Set(existingData.interactions.map(i => i.id));

  // Preserve existing actors
  for (const a of existingData.actors) {
    actorsMap.set(a.name.toLowerCase(), { ...a });
  }

  const newInteractions: LiveJourneyInteraction[] = [];

  for (const node of nodes) {
    if (!node.sourceAgenticAnalysis?.actors) continue;

    for (const actor of node.sourceAgenticAnalysis.actors) {
      if (!actor.name || actor.name.length < 2) continue;

      const actorKey = actor.name.toLowerCase();
      if (!actorsMap.has(actorKey)) {
        actorsMap.set(actorKey, {
          name: actor.name,
          role: actor.role || 'Participant',
          mentionCount: 1,
        });
      } else {
        actorsMap.get(actorKey)!.mentionCount++;
      }

      // Process each interaction the actor has
      for (const interaction of actor.interactions) {
        const text = `${interaction.action} ${interaction.context}`;
        const stage = inferStage(text, stages);
        if (!stage) continue;

        const interactionId = `ai:${node.id}:${actorKey}:${stage}:${interaction.action.slice(0, 20)}`;
        if (existingInteractionIds.has(interactionId)) continue;

        const intensity = inferIntensityFromSentiment(interaction.sentiment);

        newInteractions.push({
          id: interactionId,
          actor: actor.name,
          stage,
          action: interaction.action,
          context: interaction.context || '',
          sentiment: mapSentiment(interaction.sentiment),
          businessIntensity: intensity.biz,
          customerIntensity: intensity.cust,
          aiAgencyNow: 'human',
          aiAgencyFuture: 'assisted',
          isPainPoint: interaction.sentiment === 'critical',
          isMomentOfTruth: false,
          sourceNodeIds: [node.id],
          addedBy: 'ai',
          createdAtMs: node.createdAtMs,
        });
      }
    }
  }

  return {
    stages,
    actors: Array.from(actorsMap.values()),
    interactions: [...existingData.interactions, ...newInteractions],
  };
}

// ══════════════════════════════════════════════════════════
// SESSION CONFIDENCE
// ══════════════════════════════════════════════════════════

export function calculateSessionConfidence(
  nodes: CogNode[],
  lensCoverage: Map<Lens, LensCoverage>,
  contradictions: Array<{ resolved: boolean }>,
  stabilisedCount: number,
): SessionConfidence {
  const total = nodes.length;
  if (total === 0) {
    return {
      overallConfidence: 0,
      categorisedRate: 0,
      lensCoverageRate: 0,
      contradictionCount: 0,
      stabilisedBeliefCount: 0,
    };
  }

  const categorised = nodes.filter(n => n.nodeType !== 'UNCLASSIFIED').length;
  const lensesWithNodes = [...lensCoverage.values()].filter(lc => lc.nodeCount >= 3).length;
  const totalConf = nodes.reduce((sum, n) => sum + n.typeConfidence, 0);

  return {
    overallConfidence: totalConf / total,
    categorisedRate: categorised / total,
    lensCoverageRate: lensesWithNodes / ALL_LENSES.length,
    contradictionCount: contradictions.filter(c => !c.resolved).length,
    stabilisedBeliefCount: stabilisedCount,
  };
}

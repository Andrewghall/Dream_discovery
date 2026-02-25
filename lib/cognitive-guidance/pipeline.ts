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

// ── DREAM Dialogue Phases ────────────────────────────────
// REIMAGINE: Pure business vision, goals, actors. NO constraints, NO technology.
// CONSTRAINTS: Constraints, risks, regulation, technology barriers.
// DEFINE_APPROACH: Actions, enablers, solutions, ownership.
export type DialoguePhase = 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

// Which signal types are valid in each phase
const PHASE_ALLOWED_SIGNALS: Record<DialoguePhase, Set<SignalType>> = {
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

const LENS_RELEVANCE_THRESHOLD = 0.3;

/**
 * Stage 2: Apply lens mapping when agentic.analyzed arrives.
 * Only maps lenses with relevance ≥ 0.3 AND with reasoning evidence.
 */
export function applyLensMapping(
  node: CogNode,
  agenticAnalysis: CogNode['sourceAgenticAnalysis'],
): CogNode {
  if (!agenticAnalysis) return node;

  const lenses = agenticAnalysis.domains
    .filter(d => d.relevance >= LENS_RELEVANCE_THRESHOLD && d.reasoning)
    .map(d => ({
      lens: DOMAIN_TO_LENS[d.domain] || d.domain as Lens,
      relevance: d.relevance,
      evidence: d.reasoning,
    }))
    .filter(l => ALL_LENSES.includes(l.lens));

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
function contentWords(text: string): Set<string> {
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

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
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

  // --- Unanswered questions ---
  const questionNodes = nodes.filter(n => n.nodeType === 'QUESTION');
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
        signals.push({
          id: `unanswered_question:${q.id}`,
          type: 'unanswered_question',
          description: `Question unanswered: "${q.rawText.slice(0, 60)}..."`,
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

/**
 * DREAM Hemisphere Relationship Engine — Edge Builder
 *
 * Deterministic, LLM-free construction of a RelationshipGraph from scored
 * EvidenceCluster objects. Every edge is justified by at least one of:
 *   1. A shared confirmed participant appearing in both clusters
 *   2. IDF-weighted token Jaccard similarity ≥ rule-specific threshold
 *   3. Phase sequencing (CONSTRAINTS/DISCOVERY → DEFINE_APPROACH)
 *   4. Sentiment polarity divergence within overlapping topic space
 *
 * Similarity metric: IDF-weighted Jaccard (not raw set Jaccard).
 * Tokens that appear in many clusters (generic workshop vocabulary: "quality",
 * "management", "experience") receive low IDF weight and contribute little to
 * the similarity score. Cluster-specific tokens ("automation", "bpo", "crm",
 * "coaching") receive high IDF weight and drive edge formation. This prevents
 * generic token overlap from creating spurious edges between topically unrelated
 * clusters when signals are full-prose workshop utterances.
 *
 * Edge type rules (in priority order for deduplication):
 *   responds_to     — IDF-Jaccard ≥ 0.08 AND shared confirmed participant cross-phase
 *   compensates_for — IDF-Jaccard ≥ 0.10, ENABLER positive → CONSTRAINT negative
 *   blocks          — IDF-Jaccard ≥ 0.15 AND target has contradicting signals
 *   drives          — IDF-Jaccard ≥ 0.12, CONSTRAINT → ENABLER (content required)
 *   enables         — IDF-Jaccard ≥ 0.12, ENABLER → REIMAGINATION (content-inferred)
 *   constrains      — IDF-Jaccard ≥ 0.10, CONSTRAINT → REIMAGINATION
 *   depends_on      — IDF-Jaccard ≥ 0.10 AND shared participant, REIMAGINATION → ENABLER
 *                     (participant-confirmed: same person connects vision to enabler)
 *   contradicts     — shared participant + IDF-Jaccard ≥ 0.10 + opposing sentiment, same layer
 *
 * enables vs depends_on: enables fires on content overlap alone (inferred relationship).
 * depends_on fires only when shared participants ALSO confirm the vision-enabler link
 * (explicit human acknowledgment that the vision requires this enabler). Both can coexist
 * for the same pair when supported by content + participant evidence.
 *
 * Note: multiple edge types between the same (A, B) pair are allowed when
 * they represent different semantic claims. Only duplicate (from, to, type)
 * triplets are suppressed.
 */

import type { EvidenceCluster, RawSignal } from './evidence-clustering';
import type { EvidenceScore } from './evidence-scoring';
import type {
  NodeLayer,
  RelationshipType,
  EdgeCreationRule,
  EdgeTier,
  RelationshipNode,
  RelationshipEdge,
  RelationshipGraph,
} from './relationship-graph';
import { scoreEdge } from './edge-scoring';

// ── Token normalisation (mirrors build-hemisphere-graph.ts) ──────────────────

const STOPWORDS = new Set([
  // Basic function words
  'a','an','and','are','as','at','be','but','by','for','from','has','have',
  'i','if','in','into','is','it','its','me','my','no','not','of','on','or',
  'our','so','that','the','their','then','there','these','they','this','to',
  'too','up','us','was','we','were','what','when','where','which','who','why',
  'will','with','you','your',
  // Modal / auxiliary verbs
  'can','could','did','does','doing','done','had','let','may','might','must',
  'shall','should','used','would',
  // Determiners / pronouns / quantifiers
  'all','any','both','each','every','few','many','most','much','one','other',
  'others','same','several','some','those',
  // Adverbs and connectives
  'about','across','after','again','against','along','although','among',
  'around','because','before','below','between','beyond','during','even',
  'however','including','instead','just','never','now','often','once','only',
  'perhaps','quite','rather','regardless','since','still','than','though',
  'through','unless','until','whether','while','without','yet','also',
  'already','always',
  // High-frequency generic verbs (not domain-specific)
  'ask','asked','back','bring','came','come','find','found','gave','get',
  'gets','give','gives','go','goes','going','gone','got','help','helps',
  'keep','knew','know','knows','like','look','looks','made','make','makes',
  'mean','means','need','needs','open','put','run','said','saw','say','says',
  'seem','seems','see','set','show','shows','start','take','takes','tell',
  'told','try','turn','use','uses','using','want','wants','went','work','works',
]);

function words(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOPWORDS.has(w));
}

function tokenSet(text: string): Set<string> {
  return new Set(words(text));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) { if (b.has(x)) inter++; }
  const uni = a.size + b.size - inter;
  return uni <= 0 ? 0 : inter / uni;
}

/**
 * Compute IDF weights for all tokens across all clusters.
 * IDF(t) = ln(N / (df(t) + 1)) + 1
 * Tokens that appear in many clusters (generic workshop vocabulary) receive
 * low weight. Cluster-specific tokens receive high weight.
 */
function computeIdfWeights(tokenCache: Map<string, Set<string>>): Map<string, number> {
  const N = tokenCache.size;
  if (N === 0) return new Map();

  // Count document frequency: how many clusters contain each token
  const df = new Map<string, number>();
  for (const tokens of tokenCache.values()) {
    for (const t of tokens) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  // IDF: ln(N / (df + 1)) + 1  — smooth variant, always ≥ 1
  const idf = new Map<string, number>();
  for (const [t, freq] of df) {
    idf.set(t, Math.log(N / (freq + 1)) + 1);
  }
  return idf;
}

/**
 * IDF-weighted Jaccard similarity between two token sets.
 * Each token's contribution is weighted by its IDF score —
 * tokens that appear in many clusters contribute less to similarity.
 */
function weightedJaccard(
  a: Set<string>,
  b: Set<string>,
  idf: Map<string, number>,
): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  let unionWeight = 0;

  for (const t of a) {
    const w = idf.get(t) ?? 1;
    if (b.has(t)) intersection += w;
    unionWeight += w;
  }
  for (const t of b) {
    if (!a.has(t)) unionWeight += idf.get(t) ?? 1;
  }

  return unionWeight <= 0 ? 0 : intersection / unionWeight;
}

/** Build a single token bag from all signal texts in a cluster */
function clusterTokens(cluster: EvidenceCluster): Set<string> {
  const tokens = new Set<string>();
  for (const s of cluster.signals) {
    for (const t of tokenSet(s.rawText)) tokens.add(t);
  }
  return tokens;
}

// ── Layer classification ──────────────────────────────────────────────────────

const CONSTRAINT_TYPES = new Set([
  'CONSTRAINT', 'CHALLENGE', 'FRICTION', 'RISK', 'QUESTION',
  // ACTUAL_JOB is discovery-phase "what I do now" — a current-state constraint, not a vision
  'ACTUAL_JOB',
]);
const ENABLER_TYPES = new Set([
  'ENABLER', 'ACTION', 'INSIGHT', 'WHAT_WORKS',
]);
const VISION_TYPES = new Set([
  'VISION', 'BELIEF', 'VISIONARY', 'OPPORTUNITY',
]);

// Phase → layer vote mapping
// DISCOVERY is intentionally absent: ambiguous, only type+sentiment votes there
const PHASE_LAYER: Record<string, NodeLayer> = {
  CONSTRAINTS: 'CONSTRAINT',
  DEFINE_APPROACH: 'ENABLER',
  REIMAGINE: 'REIMAGINATION',
  REIMAGINATION: 'REIMAGINATION',
};

export function classifyNodeLayer(
  cluster: EvidenceCluster,
): { layer: NodeLayer; scores: { constraint: number; enabler: number; reimagination: number } } {
  const n = cluster.signals.length;
  if (n === 0) return { layer: 'ENABLER', scores: { constraint: 0, enabler: 1, reimagination: 0 } };

  let constraintType = 0, enablerType = 0, visionType = 0;
  let constraintPhase = 0, enablerPhase = 0, visionPhase = 0;
  let negSentiment = 0, posSentiment = 0;

  for (const s of cluster.signals) {
    const t = (s.primaryType ?? '').toUpperCase().replace(/[^A-Z_]/g, '');
    const p = (s.phase ?? '').toUpperCase().replace(/[^A-Z_]/g, '');

    if (CONSTRAINT_TYPES.has(t)) constraintType++;
    else if (ENABLER_TYPES.has(t)) enablerType++;
    else if (VISION_TYPES.has(t)) visionType++;

    const phaseLayer = PHASE_LAYER[p];
    if (phaseLayer === 'CONSTRAINT') constraintPhase++;
    else if (phaseLayer === 'ENABLER') enablerPhase++;
    else if (phaseLayer === 'REIMAGINATION') visionPhase++;

    if (s.sentiment === 'concerned' || s.sentiment === 'critical') negSentiment++;
    else if (s.sentiment === 'positive') posSentiment++;
  }

  // Weights: type 50%, phase 35%, sentiment 15%
  const constraintScore =
    (constraintType / n) * 0.50 +
    (constraintPhase / n) * 0.35 +
    (negSentiment / n)   * 0.15;
  const enablerScore =
    (enablerType  / n) * 0.50 +
    (enablerPhase / n) * 0.35;
  const visionScore =
    (visionType  / n) * 0.50 +
    (visionPhase / n) * 0.35 +
    (posSentiment / n) * 0.15;

  const scores = { constraint: constraintScore, enabler: enablerScore, reimagination: visionScore };

  const max = Math.max(constraintScore, enablerScore, visionScore);
  let layer: NodeLayer;
  if (max === 0) {
    layer = 'ENABLER'; // default when no signals have type/phase
  } else if (constraintScore >= enablerScore && constraintScore >= visionScore) {
    layer = 'CONSTRAINT';
  } else if (visionScore >= enablerScore) {
    layer = 'REIMAGINATION';
  } else {
    layer = 'ENABLER';
  }

  // Sentiment override: if a cluster would be ENABLER but ≥ 60 % of its signals are
  // negative (concerned/critical), it is expressing organisational concern or risk —
  // not an enabling capability.  Override to CONSTRAINT.
  // Corrects "automation_concerns"-style clusters that carry INSIGHT/ACTION primary types
  // but are semantically negative risk signals, not positive enablers.
  if (layer === 'ENABLER' && n > 0 && negSentiment / n >= 0.6) {
    layer = 'CONSTRAINT';
  }

  return { layer, scores };
}

// ── Dominant sentiment ────────────────────────────────────────────────────────

function dominantSentiment(
  signals: RawSignal[],
): 'positive' | 'neutral' | 'concerned' | 'critical' {
  const counts: Record<string, number> = { positive: 0, neutral: 0, concerned: 0, critical: 0 };
  for (const s of signals) {
    const key = s.sentiment ?? 'neutral';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (top?.[0] ?? 'neutral') as 'positive' | 'neutral' | 'concerned' | 'critical';
}

// ── Node builder ─────────────────────────────────────────────────────────────

export function buildNode(
  cluster: EvidenceCluster,
  score: EvidenceScore,
): RelationshipNode {
  const { layer, scores } = classifyNodeLayer(cluster);
  return {
    nodeId:                   cluster.clusterKey,
    displayLabel:             cluster.displayLabel,
    layer,
    layerScores:              scores,
    rawFrequency:             cluster.rawFrequency,
    distinctParticipants:     cluster.distinctParticipants,
    participantRoles:         [...cluster.participantRoles],
    lensSpread:               [...cluster.lensSpread],
    phaseSpread:              [...cluster.phaseSpread],
    sourceStreams:             [...cluster.sourceStreams],
    allSignalIds:             cluster.signals.map((s) => s.id),
    contradictingSignalCount: cluster.contradictingSignals.length,
    compositeScore:           score.compositeScore,
    evidenceTier:             score.tier,
    isContested:              score.isContested,
  };
}

// ── Edge ID ───────────────────────────────────────────────────────────────────

function makeEdgeId(from: string, type: RelationshipType, to: string): string {
  return `${from}__${type}__${to}`;
}

// ── Sentiment helpers ─────────────────────────────────────────────────────────

const POSITIVE_SENTIMENT = new Set(['positive']);
const NEGATIVE_SENTIMENT = new Set(['concerned', 'critical']);

function isPositive(s: RawSignal): boolean {
  return POSITIVE_SENTIMENT.has(s.sentiment ?? '');
}
function isNegative(s: RawSignal): boolean {
  return NEGATIVE_SENTIMENT.has(s.sentiment ?? '');
}

// ── Rationale templates ───────────────────────────────────────────────────────

function buildRationale(
  type: RelationshipType,
  from: RelationshipNode,
  to: RelationshipNode,
  sharedCount: number,
  jaccardSim: number,
): string {
  const shared = sharedCount > 0 ? `${sharedCount} shared participant(s)` : null;
  const sim = jaccardSim > 0 ? `keyword overlap ${(jaccardSim * 100).toFixed(0)}%` : null;
  const basis = [shared, sim].filter(Boolean).join(' and ');

  switch (type) {
    case 'responds_to':
      return `${sharedCount} participant(s) raised "${from.displayLabel}" as a constraint and contributed to "${to.displayLabel}" during the define-approach phase, indicating a direct designed response.`;
    case 'compensates_for':
      return `"${from.displayLabel}" (enabler, ${from.rawFrequency} signals) shares ${sim} with "${to.displayLabel}" (constraint, ${to.rawFrequency} signals). The enabler compensates for the constraint without fully resolving it.`;
    case 'drives':
      return `"${from.displayLabel}" (constraint) motivates the need for "${to.displayLabel}" (enabler) — ${basis}.`;
    case 'enables':
      return `"${from.displayLabel}" (enabler) makes "${to.displayLabel}" (vision) achievable — ${basis}.`;
    case 'constrains':
      return `"${from.displayLabel}" (constraint) limits achievement of "${to.displayLabel}" (vision) — ${basis}.`;
    case 'depends_on':
      return `"${from.displayLabel}" (vision) requires "${to.displayLabel}" (enabler) to be realised — ${basis}.`;
    case 'blocks':
      return `"${from.displayLabel}" (constraint) actively prevents "${to.displayLabel}" (enabler) from working — keyword overlap ${(jaccardSim * 100).toFixed(0)}%, contradicting signals present.`;
    case 'contradicts':
      return `${sharedCount} participant(s) hold opposing views on the same topic within "${from.displayLabel}" vs "${to.displayLabel}" in the ${from.layer} layer.`;
  }
}

// ── Phase overlap helpers ─────────────────────────────────────────────────────

const CONSTRAINT_PHASES = new Set(['CONSTRAINTS', 'DISCOVERY', 'CONSTRAINT']);
const APPROACH_PHASES   = new Set(['DEFINE_APPROACH', 'DEFINEAPPROACH']);

function isCrossPhase(sigA: RawSignal, sigB: RawSignal): boolean {
  const pA = (sigA.phase ?? '').toUpperCase().replace(/[^A-Z_]/g, '');
  const pB = (sigB.phase ?? '').toUpperCase().replace(/[^A-Z_]/g, '');
  return (
    (CONSTRAINT_PHASES.has(pA) && APPROACH_PHASES.has(pB)) ||
    (APPROACH_PHASES.has(pA) && CONSTRAINT_PHASES.has(pB))
  );
}

// ── Core edge rules ───────────────────────────────────────────────────────────

/**
 * Rule: responds_to  (ENABLER → CONSTRAINT)
 * Fires when:
 *   (a) a confirmed participant has signals in both clusters spanning different phases
 *       (constraint/discovery ↔ define_approach), AND
 *   (b) the two clusters have topical overlap (Jaccard ≥ 0.08).
 *
 * Topical gating prevents a multi-topic participant from linking unrelated clusters
 * (e.g. someone who attended both a regulation session and a technology session for
 * unrelated reasons). Participant continuity boosts the edge but cannot create it
 * without topic evidence.
 */
function tryRespondsTo(
  enablerNode: RelationshipNode,
  constraintNode: RelationshipNode,
  enablerCluster: EvidenceCluster,
  constraintCluster: EvidenceCluster,
  enablerTokens: Set<string>,
  constraintTokens: Set<string>,
  signalIndex: Map<string, RawSignal>,
  idf: Map<string, number>,
): RelationshipEdge | null {
  // Topical gate first — cheap check before iterating signals
  const sim = weightedJaccard(enablerTokens, constraintTokens, idf);
  if (sim < 0.08) return null;

  const sharedIds = enablerCluster.distinctParticipantIds.size > 0
    ? [...enablerCluster.distinctParticipantIds].filter((id) =>
        constraintCluster.distinctParticipantIds.has(id),
      )
    : [];

  if (sharedIds.length === 0) return null;

  // For each shared participant, find cross-phase signal pairs
  const fromSigIds: string[] = [];
  const toSigIds: string[]   = [];
  for (const pid of sharedIds) {
    const eSigs = enablerCluster.signals.filter(
      (s) => s.speakerId === pid && s.isConfirmedParticipant,
    );
    const cSigs = constraintCluster.signals.filter(
      (s) => s.speakerId === pid && s.isConfirmedParticipant,
    );
    // Require cross-phase evidence
    const hasCrossPhase = eSigs.some((es) => cSigs.some((cs) => isCrossPhase(es, cs)));
    if (hasCrossPhase) {
      for (const s of eSigs) fromSigIds.push(s.id);
      for (const s of cSigs)  toSigIds.push(s.id);
    }
  }

  if (fromSigIds.length === 0) return null;

  const participantsWithCrossPhase = [...new Set(
    fromSigIds
      .map((id) => signalIndex.get(id)?.speakerId)
      .filter((x): x is string => Boolean(x)),
  )];

  return buildEdgeRecord({
    fromNode:  enablerNode,
    toNode:    constraintNode,
    type:      'responds_to',
    fromSigs:  fromSigIds,
    toSigs:    toSigIds,
    sharedPtcp: participantsWithCrossPhase,
    rules:     ['RESPONDS_TO_SHARED_PARTICIPANT_CROSS_PHASE'],
    jaccardSim: sim,
    signalIndex,
  });
}

/**
 * Rule: compensates_for  (ENABLER → CONSTRAINT)
 * Fires when IDF-Jaccard similarity ≥ 0.10 and the enabler has positive signals
 * where the constraint has negative ones.
 */
function tryCompensatesFor(
  enablerNode: RelationshipNode,
  constraintNode: RelationshipNode,
  enablerCluster: EvidenceCluster,
  constraintCluster: EvidenceCluster,
  enablerTokens: Set<string>,
  constraintTokens: Set<string>,
  signalIndex: Map<string, RawSignal>,
  idf: Map<string, number>,
): RelationshipEdge | null {
  const sim = weightedJaccard(enablerTokens, constraintTokens, idf);
  if (sim < 0.10) return null;

  const posEnablerSigs = enablerCluster.signals.filter(isPositive);
  const negConstraintSigs = constraintCluster.signals.filter(isNegative);
  if (posEnablerSigs.length === 0 || negConstraintSigs.length === 0) return null;

  const sharedIds = [...enablerCluster.distinctParticipantIds].filter((id) =>
    constraintCluster.distinctParticipantIds.has(id),
  );

  return buildEdgeRecord({
    fromNode:   enablerNode,
    toNode:     constraintNode,
    type:       'compensates_for',
    fromSigs:   posEnablerSigs.map((s) => s.id),
    toSigs:     negConstraintSigs.map((s) => s.id),
    sharedPtcp: sharedIds,
    rules:      ['COMPENSATES_FOR_JACCARD_SENTIMENT'],
    jaccardSim: sim,
    signalIndex,
  });
}

/**
 * Rule: blocks  (CONSTRAINT → ENABLER)
 * Fires when Jaccard ≥ 0.15 AND the enabler cluster has contradicting signals.
 * This indicates the constraint is actively preventing the enabler from working.
 */
function tryBlocks(
  constraintNode: RelationshipNode,
  enablerNode: RelationshipNode,
  constraintCluster: EvidenceCluster,
  enablerCluster: EvidenceCluster,
  constraintTokens: Set<string>,
  enablerTokens: Set<string>,
  signalIndex: Map<string, RawSignal>,
  idf: Map<string, number>,
): RelationshipEdge | null {
  if (enablerCluster.contradictingSignals.length === 0) return null;
  const sim = weightedJaccard(constraintTokens, enablerTokens, idf);
  if (sim < 0.15) return null;

  const sharedIds = [...constraintCluster.distinctParticipantIds].filter((id) =>
    enablerCluster.distinctParticipantIds.has(id),
  );

  return buildEdgeRecord({
    fromNode:   constraintNode,
    toNode:     enablerNode,
    type:       'blocks',
    fromSigs:   constraintCluster.signals.map((s) => s.id),
    toSigs:     enablerCluster.contradictingSignals.map((s) => s.id),
    sharedPtcp: sharedIds,
    rules:      ['BLOCKS_JACCARD_PLUS_CONTRADICTION'],
    jaccardSim: sim,
    signalIndex,
  });
}

/**
 * Rule: drives  (CONSTRAINT → ENABLER)
 * Fires when IDF-Jaccard ≥ 0.12 (keyword overlap required — participant alone is insufficient).
 * Indicates the constraint is what motivated the enabler to be developed.
 * Suppressed in favour of 'blocks' when blocks is already present for same pair.
 */
function tryDrives(
  constraintNode: RelationshipNode,
  enablerNode: RelationshipNode,
  constraintCluster: EvidenceCluster,
  enablerCluster: EvidenceCluster,
  constraintTokens: Set<string>,
  enablerTokens: Set<string>,
  signalIndex: Map<string, RawSignal>,
  idf: Map<string, number>,
): RelationshipEdge | null {
  const sim = weightedJaccard(constraintTokens, enablerTokens, idf);
  if (sim < 0.12) return null;
  const sharedIds = [...constraintCluster.distinctParticipantIds].filter((id) =>
    enablerCluster.distinctParticipantIds.has(id),
  );

  const rules: EdgeCreationRule[] = [];
  if (sim >= 0.12) rules.push('DRIVES_JACCARD');
  if (sharedIds.length > 0) rules.push('DRIVES_SHARED_PARTICIPANT');

  // Use the overlapping tokens to find the most relevant supporting signals
  const overlapTokens = new Set([...constraintTokens].filter((t) => enablerTokens.has(t)));
  const fromSigs = constraintCluster.signals
    .filter((s) => [...tokenSet(s.rawText)].some((t) => overlapTokens.has(t)))
    .map((s) => s.id);
  const toSigs = enablerCluster.signals
    .filter((s) => [...tokenSet(s.rawText)].some((t) => overlapTokens.has(t)))
    .map((s) => s.id);

  return buildEdgeRecord({
    fromNode:   constraintNode,
    toNode:     enablerNode,
    type:       'drives',
    fromSigs:   fromSigs.length > 0 ? fromSigs : constraintCluster.signals.map((s) => s.id),
    toSigs:     toSigs.length > 0 ? toSigs : enablerCluster.signals.map((s) => s.id),
    sharedPtcp: sharedIds,
    rules,
    jaccardSim: sim,
    signalIndex,
  });
}

/**
 * Rule: enables  (ENABLER → REIMAGINATION)
 * Fires when IDF-Jaccard ≥ 0.12 (keyword overlap required — raised to reduce noise).
 */
function tryEnables(
  enablerNode: RelationshipNode,
  visionNode: RelationshipNode,
  enablerCluster: EvidenceCluster,
  visionCluster: EvidenceCluster,
  enablerTokens: Set<string>,
  visionTokens: Set<string>,
  signalIndex: Map<string, RawSignal>,
  idf: Map<string, number>,
): RelationshipEdge | null {
  const sim = weightedJaccard(enablerTokens, visionTokens, idf);
  if (sim < 0.12) return null;
  const sharedIds = [...enablerCluster.distinctParticipantIds].filter((id) =>
    visionCluster.distinctParticipantIds.has(id),
  );

  const rules: EdgeCreationRule[] = [];
  if (sim >= 0.12) rules.push('ENABLES_JACCARD');
  if (sharedIds.length > 0) rules.push('ENABLES_SHARED_PARTICIPANT');

  const overlapTokens = new Set([...enablerTokens].filter((t) => visionTokens.has(t)));
  const fromSigs = enablerCluster.signals
    .filter((s) => [...tokenSet(s.rawText)].some((t) => overlapTokens.has(t)))
    .map((s) => s.id);

  return buildEdgeRecord({
    fromNode:   enablerNode,
    toNode:     visionNode,
    type:       'enables',
    fromSigs:   fromSigs.length > 0 ? fromSigs : enablerCluster.signals.map((s) => s.id),
    toSigs:     visionCluster.signals.map((s) => s.id),
    sharedPtcp: sharedIds,
    rules,
    jaccardSim: sim,
    signalIndex,
  });
}

/**
 * Rule: constrains  (CONSTRAINT → REIMAGINATION)
 * Fires when IDF-Jaccard ≥ 0.10 (keyword overlap required — participant alone is insufficient).
 */
function tryConstrains(
  constraintNode: RelationshipNode,
  visionNode: RelationshipNode,
  constraintCluster: EvidenceCluster,
  visionCluster: EvidenceCluster,
  constraintTokens: Set<string>,
  visionTokens: Set<string>,
  signalIndex: Map<string, RawSignal>,
  idf: Map<string, number>,
): RelationshipEdge | null {
  const sim = weightedJaccard(constraintTokens, visionTokens, idf);
  if (sim < 0.10) return null;
  const sharedIds = [...constraintCluster.distinctParticipantIds].filter((id) =>
    visionCluster.distinctParticipantIds.has(id),
  );

  const rules: EdgeCreationRule[] = [];
  if (sim >= 0.10) rules.push('CONSTRAINS_JACCARD');
  if (sharedIds.length > 0) rules.push('CONSTRAINS_SHARED_PARTICIPANT');

  return buildEdgeRecord({
    fromNode:   constraintNode,
    toNode:     visionNode,
    type:       'constrains',
    fromSigs:   constraintCluster.signals.map((s) => s.id),
    toSigs:     visionCluster.signals.map((s) => s.id),
    sharedPtcp: sharedIds,
    rules,
    jaccardSim: sim,
    signalIndex,
  });
}

/**
 * Rule: depends_on  (REIMAGINATION → ENABLER)
 * Fires when BOTH:
 *   (a) Jaccard ≥ 0.10 (topical overlap between vision and enabler), AND
 *   (b) at least one confirmed participant appears in both clusters
 *       (human acknowledgment that this vision depends on this enabler).
 *
 * This makes depends_on genuinely distinct from enables:
 *   enables(E→V)    fires on content overlap alone — inferred relationship
 *   depends_on(V→E) fires only when participants also confirm the vision-enabler link
 *
 * Both can coexist for the same (V,E) pair when supported by content + participant
 * evidence. No post-hoc suppression — the two directions are complementary claims.
 */
function tryDependsOn(
  visionNode: RelationshipNode,
  enablerNode: RelationshipNode,
  visionCluster: EvidenceCluster,
  enablerCluster: EvidenceCluster,
  visionTokens: Set<string>,
  enablerTokens: Set<string>,
  signalIndex: Map<string, RawSignal>,
  idf: Map<string, number>,
): RelationshipEdge | null {
  const sim = weightedJaccard(visionTokens, enablerTokens, idf);
  if (sim < 0.10) return null;
  const sharedIds = [...visionCluster.distinctParticipantIds].filter((id) =>
    enablerCluster.distinctParticipantIds.has(id),
  );
  // Participant continuity is required — this is what distinguishes depends_on from enables
  if (sharedIds.length === 0) return null;

  const rules: EdgeCreationRule[] = [];
  if (sim >= 0.10) rules.push('DEPENDS_ON_JACCARD');
  if (sharedIds.length > 0) rules.push('DEPENDS_ON_SHARED_PARTICIPANT');

  return buildEdgeRecord({
    fromNode:   visionNode,
    toNode:     enablerNode,
    type:       'depends_on',
    fromSigs:   visionCluster.signals.map((s) => s.id),
    toSigs:     enablerCluster.signals.map((s) => s.id),
    sharedPtcp: sharedIds,
    rules,
    jaccardSim: sim,
    signalIndex,
  });
}

/**
 * Rule: contradicts  (any → any, any layer)
 * Fires when clusters share a confirmed participant, have opposing sentiment,
 * AND have topical overlap (IDF-Jaccard ≥ 0.10 — prevents unrelated clusters from
 * being flagged as contradictions just because a participant spoke to both).
 *
 * Layer restriction removed: cross-layer contradictions (ENABLER ↔ CONSTRAINT) are
 * semantically valid when the sentiment override reclassifies a negative "concern"
 * cluster as CONSTRAINT. The three conditions above are sufficient to prevent spurious
 * cross-layer contradictions. from = the more positive cluster (conventional direction).
 */
function tryContradicts(
  nodeA: RelationshipNode,
  nodeB: RelationshipNode,
  clusterA: EvidenceCluster,
  clusterB: EvidenceCluster,
  tokensA: Set<string>,
  tokensB: Set<string>,
  signalIndex: Map<string, RawSignal>,
  idf: Map<string, number>,
): RelationshipEdge | null {
  const sharedIds = [...clusterA.distinctParticipantIds].filter((id) =>
    clusterB.distinctParticipantIds.has(id),
  );
  if (sharedIds.length === 0) return null;

  // Require topical overlap — prevents unrelated-topic clusters from being flagged
  const sim = weightedJaccard(tokensA, tokensB, idf);
  if (sim < 0.10) return null;

  // Require opposing dominant sentiments
  const aDom = dominantSentiment(clusterA.signals);
  const bDom = dominantSentiment(clusterB.signals);
  const aPos = POSITIVE_SENTIMENT.has(aDom);
  const aNeg = NEGATIVE_SENTIMENT.has(aDom);
  const bPos = POSITIVE_SENTIMENT.has(bDom);
  const bNeg = NEGATIVE_SENTIMENT.has(bDom);
  if (!((aPos && bNeg) || (aNeg && bPos))) return null;

  // from = more positive cluster (conventional direction: positive contradicts negative)
  const [fromNode, toNode, fromCluster, toCluster] = aPos
    ? [nodeA, nodeB, clusterA, clusterB]
    : [nodeB, nodeA, clusterB, clusterA];

  return buildEdgeRecord({
    fromNode,
    toNode,
    type:       'contradicts',
    fromSigs:   fromCluster.signals.filter(isPositive).map((s) => s.id),
    toSigs:     toCluster.signals.filter(isNegative).map((s) => s.id),
    sharedPtcp: sharedIds,
    rules:      ['CONTRADICTS_SHARED_PARTICIPANT_SENTIMENT'],
    jaccardSim: sim,
    signalIndex,
  });
}

// ── Edge record factory ───────────────────────────────────────────────────────

// All edge types require Jaccard evidence — the tier cap applies universally.
// responds_to now requires Jaccard ≥ 0.08 at creation time, so no exemption needed.

function buildEdgeRecord(params: {
  fromNode:   RelationshipNode;
  toNode:     RelationshipNode;
  type:       RelationshipType;
  fromSigs:   string[];
  toSigs:     string[];
  sharedPtcp: string[];
  rules:      EdgeCreationRule[];
  jaccardSim: number;
  signalIndex: Map<string, RawSignal>;
}): RelationshipEdge {
  const { fromNode, toNode, type, fromSigs, toSigs, sharedPtcp, rules, jaccardSim, signalIndex } = params;

  const edgeId = makeEdgeId(fromNode.nodeId, type, toNode.nodeId);
  const { score, tier } = scoreEdge({
    fromSignalIds:           fromSigs,
    toSignalIds:             toSigs,
    sharedParticipantIds:    sharedPtcp,
    signalIndex,
    jaccardSim,
    requiresSemanticOverlap: true,
  });

  const rationale = buildRationale(type, fromNode, toNode, sharedPtcp.length, jaccardSim);

  return {
    edgeId,
    fromNodeId:           fromNode.nodeId,
    toNodeId:             toNode.nodeId,
    relationshipType:     type,
    fromSignalIds:        [...new Set(fromSigs)],
    toSignalIds:          [...new Set(toSigs)],
    sharedParticipantIds: [...new Set(sharedPtcp)],
    score,
    tier,
    rules,
    rationale,
  };
}

// ── Signal index ──────────────────────────────────────────────────────────────

export function buildSignalIndex(clusters: EvidenceCluster[]): Map<string, RawSignal> {
  const index = new Map<string, RawSignal>();
  for (const cluster of clusters) {
    for (const signal of cluster.signals) {
      index.set(signal.id, signal);
    }
  }
  return index;
}

// ── Main graph builder ────────────────────────────────────────────────────────

/**
 * Build a RelationshipGraph from scored evidence clusters.
 *
 * IMPORTANT: The graph is built from a single clustering invocation.
 * Signal IDs must be stable across the same run — do not mix clusters
 * from different buildEvidenceClusters() calls.
 *
 * @param clusters Scored clusters from scoreAllClusters()
 * @param workshopId For metadata/storage
 */
export function buildRelationshipGraph(
  clusters: Array<{ cluster: EvidenceCluster; score: EvidenceScore }>,
  workshopId: string,
): RelationshipGraph {
  // Exclude _unthemed (gap analysis only)
  const active = clusters.filter((c) => c.cluster.clusterKey !== '_unthemed');

  // ── Build nodes ────────────────────────────────────────────────────────
  const nodes: RelationshipNode[] = active.map(({ cluster, score }) =>
    buildNode(cluster, score),
  );

  const nodeByKey = new Map(nodes.map((n) => [n.nodeId, n]));
  const clusterByKey = new Map(active.map(({ cluster }) => [cluster.clusterKey, cluster]));
  const signalIndex = buildSignalIndex(active.map((c) => c.cluster));

  // Pre-compute token bags for all clusters
  const tokenCache = new Map(
    active.map(({ cluster }) => [cluster.clusterKey, clusterTokens(cluster)]),
  );

  // IDF weights: down-weight generic tokens that appear across many clusters
  const idfWeights = computeIdfWeights(tokenCache);

  // Partition nodes by layer
  const constraintNodes  = nodes.filter((n) => n.layer === 'CONSTRAINT');
  const enablerNodes     = nodes.filter((n) => n.layer === 'ENABLER');
  const visionNodes      = nodes.filter((n) => n.layer === 'REIMAGINATION');

  // ── Collect edges ──────────────────────────────────────────────────────
  const edgeMap = new Map<string, RelationshipEdge>(); // keyed by edgeId

  function addEdge(e: RelationshipEdge | null): void {
    if (!e) return;
    edgeMap.set(e.edgeId, e);
  }

  // responds_to: ENABLER → CONSTRAINT (participant + topical evidence — do first)
  for (const enablerNode of enablerNodes) {
    for (const constraintNode of constraintNodes) {
      const ec = clusterByKey.get(enablerNode.nodeId)!;
      const cc = clusterByKey.get(constraintNode.nodeId)!;
      const eTok = tokenCache.get(enablerNode.nodeId)!;
      const cTok = tokenCache.get(constraintNode.nodeId)!;
      addEdge(tryRespondsTo(enablerNode, constraintNode, ec, cc, eTok, cTok, signalIndex, idfWeights));
    }
  }

  // compensates_for: ENABLER → CONSTRAINT
  for (const enablerNode of enablerNodes) {
    for (const constraintNode of constraintNodes) {
      const ec = clusterByKey.get(enablerNode.nodeId)!;
      const cc = clusterByKey.get(constraintNode.nodeId)!;
      const eTok = tokenCache.get(enablerNode.nodeId)!;
      const cTok = tokenCache.get(constraintNode.nodeId)!;
      addEdge(tryCompensatesFor(enablerNode, constraintNode, ec, cc, eTok, cTok, signalIndex, idfWeights));
    }
  }

  // blocks: CONSTRAINT → ENABLER (before drives — suppresses drives if both fire)
  for (const constraintNode of constraintNodes) {
    for (const enablerNode of enablerNodes) {
      const cc = clusterByKey.get(constraintNode.nodeId)!;
      const ec = clusterByKey.get(enablerNode.nodeId)!;
      const cTok = tokenCache.get(constraintNode.nodeId)!;
      const eTok = tokenCache.get(enablerNode.nodeId)!;
      addEdge(tryBlocks(constraintNode, enablerNode, cc, ec, cTok, eTok, signalIndex, idfWeights));
    }
  }

  // drives: CONSTRAINT → ENABLER (skip if blocks already exists for same pair)
  for (const constraintNode of constraintNodes) {
    for (const enablerNode of enablerNodes) {
      const blocksId = makeEdgeId(constraintNode.nodeId, 'blocks', enablerNode.nodeId);
      if (edgeMap.has(blocksId)) continue; // blocks supersedes drives
      const cc = clusterByKey.get(constraintNode.nodeId)!;
      const ec = clusterByKey.get(enablerNode.nodeId)!;
      const cTok = tokenCache.get(constraintNode.nodeId)!;
      const eTok = tokenCache.get(enablerNode.nodeId)!;
      addEdge(tryDrives(constraintNode, enablerNode, cc, ec, cTok, eTok, signalIndex, idfWeights));
    }
  }

  // enables: ENABLER → REIMAGINATION
  for (const enablerNode of enablerNodes) {
    for (const visionNode of visionNodes) {
      const ec = clusterByKey.get(enablerNode.nodeId)!;
      const vc = clusterByKey.get(visionNode.nodeId)!;
      const eTok = tokenCache.get(enablerNode.nodeId)!;
      const vTok = tokenCache.get(visionNode.nodeId)!;
      addEdge(tryEnables(enablerNode, visionNode, ec, vc, eTok, vTok, signalIndex, idfWeights));
    }
  }

  // constrains: CONSTRAINT → REIMAGINATION
  for (const constraintNode of constraintNodes) {
    for (const visionNode of visionNodes) {
      const cc = clusterByKey.get(constraintNode.nodeId)!;
      const vc = clusterByKey.get(visionNode.nodeId)!;
      const cTok = tokenCache.get(constraintNode.nodeId)!;
      const vTok = tokenCache.get(visionNode.nodeId)!;
      addEdge(tryConstrains(constraintNode, visionNode, cc, vc, cTok, vTok, signalIndex, idfWeights));
    }
  }

  // depends_on: REIMAGINATION → ENABLER
  for (const visionNode of visionNodes) {
    for (const enablerNode of enablerNodes) {
      const vc = clusterByKey.get(visionNode.nodeId)!;
      const ec = clusterByKey.get(enablerNode.nodeId)!;
      const vTok = tokenCache.get(visionNode.nodeId)!;
      const eTok = tokenCache.get(enablerNode.nodeId)!;
      addEdge(tryDependsOn(visionNode, enablerNode, vc, ec, vTok, eTok, signalIndex, idfWeights));
    }
  }

  // contradicts: all pairs (iterate once: i < j to avoid A→B and B→A)
  // Layer restriction removed — cross-layer contradictions are valid when participant +
  // topical + sentiment conditions are met (see tryContradicts docstring).
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nA = nodes[i];
      const nB = nodes[j];
      const cA = clusterByKey.get(nA.nodeId)!;
      const cB = clusterByKey.get(nB.nodeId)!;
      const tA = tokenCache.get(nA.nodeId)!;
      const tB = tokenCache.get(nB.nodeId)!;
      addEdge(tryContradicts(nA, nB, cA, cB, tA, tB, signalIndex, idfWeights));
    }
  }

  const edges = [...edgeMap.values()];

  // ── Metadata ───────────────────────────────────────────────────────────
  const layerCounts: Record<NodeLayer, number> = { CONSTRAINT: 0, ENABLER: 0, REIMAGINATION: 0 };
  for (const n of nodes) layerCounts[n.layer]++;

  const edgeTypeCounts: Partial<Record<RelationshipType, number>> = {};
  for (const e of edges) {
    edgeTypeCounts[e.relationshipType] = (edgeTypeCounts[e.relationshipType] ?? 0) + 1;
  }

  return {
    workshopId,
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    layerCounts,
    edgeTypeCounts,
    builtAtMs: Date.now(),
  };
}

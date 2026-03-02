/**
 * Hemisphere Diagnostic — Deterministic Compute Engine
 *
 * Pure functions that transform HemisphereNode[] + HemisphereEdge[]
 * into a HemisphereDiagnostic. No LLM calls — entirely computed
 * from node types, severity, sources, and edge topology.
 */

import type {
  HemisphereNode,
  HemisphereEdge,
  HemisphereDiagnostic,
  SentimentIndex,
  DomainSentimentScore,
  SentimentLabel,
  BiasDetection,
  ActorContribution,
  LayerSentiment,
  ActorLanguageIntensity,
  BalanceSafeguard,
  SafeguardFlag,
  MultiLensAnalysis,
  LensScore,
  NodeType,
  HemisphereLayer,
} from '@/lib/types/hemisphere-diagnostic';

// ── Constants ────────────────────────────────────────────────

/** Node types that contribute to creative/positive sentiment */
const CREATIVE_TYPES: NodeType[] = ['VISION', 'BELIEF', 'ENABLER'];

/** Node types that contribute to constraint/defensive sentiment */
const CONSTRAINT_TYPES: NodeType[] = ['CONSTRAINT', 'FRICTION'];

/** Node types that indicate challenge intensity */
const CHALLENGE_TYPES: NodeType[] = ['CHALLENGE', 'FRICTION'];

/** Default severity for nodes missing the field */
const DEFAULT_SEVERITY = 0.5;

/** Threshold for dominant voice detection */
const DOMINANT_VOICE_THRESHOLD = 0.4;

/** Gini coefficient thresholds for bias level */
const GINI_LOW_THRESHOLD = 0.3;
const GINI_MODERATE_THRESHOLD = 0.5;

/** Balance safeguard thresholds */
const EXCESS_IMAGINATION_H1_THRESHOLD = 0.6;
const EXCESS_IMAGINATION_H3_THRESHOLD = 0.15;
const EXCESS_CONSTRAINT_H3_THRESHOLD = 0.5;
const EXCESS_CONSTRAINT_H1_THRESHOLD = 0.1;
const LOW_MOBILISATION_ENABLER_THRESHOLD = 0.1;
const MISSING_DOMAIN_MIN_TOTAL_NODES = 10;

// ── Actor Group Normalisation ────────────────────────────────

/**
 * Compute per-actor normalisation weights.
 *
 * Equalises each actor's influence regardless of how many data
 * points they contributed. An actor who contributed 50 entries
 * gets a lower per-entry weight than one who contributed 10,
 * so that every voice carries equal analytical weight.
 *
 * Formula per actor: weight = (1 / numActors) / (actorEntries / totalEntries)
 * Then scaled so that sum(count * weight) = totalEntries.
 *
 * @returns Map from actor name to per-entry weight multiplier
 */
function computeActorNormWeights(nodes: HemisphereNode[]): Map<string, number> {
  const actorCounts = new Map<string, number>();
  let totalEntries = 0;

  for (const node of nodes) {
    for (const src of node.sources) {
      const name = src.participantName || 'Unknown';
      actorCounts.set(name, (actorCounts.get(name) || 0) + 1);
      totalEntries++;
    }
  }

  if (totalEntries === 0 || actorCounts.size === 0) return new Map();

  const numActors = actorCounts.size;
  const equalShare = 1 / numActors;
  const weights = new Map<string, number>();

  for (const [actor, count] of actorCounts) {
    const rawShare = count / totalEntries;
    weights.set(actor, equalShare / rawShare);
  }

  // Scale so that sum(count * weight) preserves totalEntries
  let weightedSum = 0;
  for (const [actor, count] of actorCounts) {
    weightedSum += count * (weights.get(actor) || 1);
  }
  const scale = totalEntries / weightedSum;
  for (const [actor, w] of weights) {
    weights.set(actor, w * scale);
  }

  return weights;
}

/**
 * Compute the actor-normalised weight of a single node.
 * Returns the average normalisation weight across all
 * of this node's sources.
 */
function normalisedNodeWeight(
  node: HemisphereNode,
  actorWeights: Map<string, number>,
): number {
  if (node.sources.length === 0) return 1;
  let sum = 0;
  for (const src of node.sources) {
    sum += actorWeights.get(src.participantName || 'Unknown') || 1;
  }
  return sum / node.sources.length;
}

// ── Main Entry Point ─────────────────────────────────────────

/**
 * Compute a full diagnostic from hemisphere graph data.
 *
 * @param nodes — Hemisphere nodes (from session or snapshot)
 * @param edges — Hemisphere edges
 * @param workshopId — Workshop identifier
 * @param snapshotId — Snapshot ID (null for Discovery baseline)
 * @param dimensions — Workshop dimensions (lenses) for multi-lens analysis
 */
export function computeDiagnostic(
  nodes: HemisphereNode[],
  edges: HemisphereEdge[],
  workshopId: string,
  snapshotId: string | null,
  dimensions: string[],
): HemisphereDiagnostic {
  const sentimentIndex = computeSentimentIndex(nodes, edges);
  const biasDetection = computeBiasDetection(nodes);
  const balanceSafeguard = computeBalanceSafeguard(nodes, sentimentIndex, biasDetection, dimensions);
  const multiLens = computeMultiLens(nodes, edges, dimensions);

  return {
    workshopId,
    generatedAt: new Date().toISOString(),
    snapshotId,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    sentimentIndex,
    biasDetection,
    balanceSafeguard,
    multiLens,
  };
}

// ── 1. Sentiment Index ───────────────────────────────────────

function computeSentimentIndex(
  nodes: HemisphereNode[],
  edges: HemisphereEdge[],
): SentimentIndex {
  // Actor normalisation weights (equalises voice across participants)
  const actorWeights = computeActorNormWeights(nodes);

  // Group nodes by their primary domain (first phaseTag)
  const domainMap = new Map<string, HemisphereNode[]>();
  for (const node of nodes) {
    const domain = node.phaseTags[0] || 'General';
    const group = domainMap.get(domain) || [];
    group.push(node);
    domainMap.set(domain, group);
  }

  // Build edge adjacency for cross-domain analysis
  const nodeIdToDomain = new Map<string, string>();
  for (const node of nodes) {
    nodeIdToDomain.set(node.id, node.phaseTags[0] || 'General');
  }

  const domains: DomainSentimentScore[] = [];

  for (const [domain, domainNodes] of domainMap.entries()) {
    const total = domainNodes.length;
    if (total === 0) continue;

    const creativeNodes = domainNodes.filter((n) => CREATIVE_TYPES.includes(n.type));
    const constraintNodes = domainNodes.filter((n) => CONSTRAINT_TYPES.includes(n.type));
    const challengeNodes = domainNodes.filter((n) => CHALLENGE_TYPES.includes(n.type));

    // Actor-normalised density: weight each node by its sources' normalisation
    const totalWeighted = domainNodes.reduce((s, n) => s + normalisedNodeWeight(n, actorWeights), 0);
    const creativeWeighted = creativeNodes.reduce((s, n) => s + normalisedNodeWeight(n, actorWeights), 0);
    const constraintWeighted = constraintNodes.reduce((s, n) => s + normalisedNodeWeight(n, actorWeights), 0);

    const creativeDensity = totalWeighted > 0
      ? (creativeWeighted / totalWeighted) * 100
      : (creativeNodes.length / total) * 100;
    const constraintDensity = totalWeighted > 0
      ? (constraintWeighted / totalWeighted) * 100
      : (constraintNodes.length / total) * 100;

    // Redesign energy: count cross-domain edges from ENABLER nodes in this domain
    const enablerIds = new Set(
      domainNodes.filter((n) => n.type === 'ENABLER').map((n) => n.id),
    );
    let crossDomainEdgeCount = 0;
    for (const edge of edges) {
      const srcDomain = nodeIdToDomain.get(edge.source);
      const tgtDomain = nodeIdToDomain.get(edge.target);
      if (
        (enablerIds.has(edge.source) && tgtDomain && tgtDomain !== domain) ||
        (enablerIds.has(edge.target) && srcDomain && srcDomain !== domain)
      ) {
        crossDomainEdgeCount++;
      }
    }
    // Normalise: cap at 1.0 based on enabler count
    const redesignEnergy = enablerIds.size > 0
      ? Math.min(1, crossDomainEdgeCount / (enablerIds.size * 3))
      : 0;

    // Challenge intensity: average severity of CHALLENGE + FRICTION nodes
    const challengeIntensity = challengeNodes.length > 0
      ? challengeNodes.reduce((sum, n) => sum + (n.severity ?? DEFAULT_SEVERITY), 0) / challengeNodes.length
      : 0;

    // Risk weight: constraint severity x frequency weight (normalised 0-1)
    const riskWeight = constraintNodes.length > 0
      ? constraintNodes.reduce((sum, n) => {
          const sev = n.severity ?? DEFAULT_SEVERITY;
          const freqWeight = Math.min(1, n.weight / 10); // weight capped at 10
          return sum + sev * freqWeight;
        }, 0) / constraintNodes.length
      : 0;

    // Dominant type: most frequent type in this domain
    const typeCounts = new Map<NodeType, number>();
    for (const n of domainNodes) {
      typeCounts.set(n.type, (typeCounts.get(n.type) || 0) + 1);
    }
    let dominantType: NodeType = 'VISION';
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }

    // Sentiment label from creative/constraint ratio
    const sentimentLabel = deriveSentimentLabel(creativeDensity, constraintDensity);

    domains.push({
      domain,
      creativeDensity: round2(creativeDensity),
      constraintDensity: round2(constraintDensity),
      redesignEnergy: round2(redesignEnergy),
      challengeIntensity: round2(challengeIntensity),
      riskWeight: round2(riskWeight),
      nodeCount: total,
      dominantType,
      sentimentLabel,
    });
  }

  // Sort: constraint-heavy domains first (bottom), creative at top
  domains.sort((a, b) => a.creativeDensity - b.creativeDensity);

  // Overall scores (actor-normalised)
  const allCreativeNodes = nodes.filter((n) => CREATIVE_TYPES.includes(n.type));
  const allConstraintNodes = nodes.filter((n) => CONSTRAINT_TYPES.includes(n.type));
  const totalWeightedAll = nodes.reduce((s, n) => s + normalisedNodeWeight(n, actorWeights), 0) || 1;
  const creativeWeightedAll = allCreativeNodes.reduce((s, n) => s + normalisedNodeWeight(n, actorWeights), 0);
  const constraintWeightedAll = allConstraintNodes.reduce((s, n) => s + normalisedNodeWeight(n, actorWeights), 0);
  const overallCreative = round2((creativeWeightedAll / totalWeightedAll) * 100);
  const overallConstraint = round2((constraintWeightedAll / totalWeightedAll) * 100);

  const balanceLabel = deriveBalanceLabel(overallCreative, overallConstraint, domains);

  return {
    domains,
    overallCreative,
    overallConstraint,
    balanceLabel,
  };
}

function deriveSentimentLabel(creative: number, constraint: number): SentimentLabel {
  if (creative >= 60 && constraint < 20) return 'innovation-led';
  if (constraint >= 50) return 'constraint-heavy';
  if (constraint >= 30 && creative < 40) return 'risk-aware';
  if (creative >= 40 && creative < 60) return 'vision-rich';
  return 'balanced';
}

function deriveBalanceLabel(
  creative: number,
  constraint: number,
  domains: DomainSentimentScore[],
): SentimentIndex['balanceLabel'] {
  // Check for fragmentation: high variance across domains
  if (domains.length >= 3) {
    const creativities = domains.map((d) => d.creativeDensity);
    const variance = computeVariance(creativities);
    if (variance > 600) return 'fragmented'; // High spread
  }

  if (creative >= 55 && constraint < 15) return 'innovation-dominated';
  if (constraint >= 45 && creative < 15) return 'risk-dominated';
  if (creative >= 40 && constraint >= 25) return 'aligned';
  if (creative >= 50) return 'expansive';
  if (constraint >= 35) return 'defensive';
  return 'aligned';
}

// ── 2. Bias Detection ────────────────────────────────────────

function computeBiasDetection(nodes: HemisphereNode[]): BiasDetection {
  // Build contribution per actor from node sources
  const actorCounts = new Map<string, number>();
  let totalSourceEntries = 0;

  for (const node of nodes) {
    for (const src of node.sources) {
      const name = src.participantName || 'Unknown';
      actorCounts.set(name, (actorCounts.get(name) || 0) + 1);
      totalSourceEntries++;
    }
  }

  // Compute actor-normalised shares (equal voice per participant)
  const numActors = actorCounts.size;
  const equalVoiceShare = numActors > 0 ? 1 / numActors : 0;

  const contributionBalance: ActorContribution[] = [];
  for (const [actor, count] of actorCounts.entries()) {
    contributionBalance.push({
      actor,
      share: round2(totalSourceEntries > 0 ? count / totalSourceEntries : 0),
      normalisedShare: round2(equalVoiceShare),
      mentionCount: count,
    });
  }
  // Sort descending by share
  contributionBalance.sort((a, b) => b.share - a.share);

  // Gini coefficient
  const shares = contributionBalance.map((c) => c.share);
  const giniCoefficient = round2(computeGini(shares));

  // Dominant voice
  const dominantVoice = contributionBalance.length > 0 && contributionBalance[0].share > DOMINANT_VOICE_THRESHOLD
    ? { name: contributionBalance[0].actor, share: round2(contributionBalance[0].share) }
    : null;

  // Sentiment by layer
  const layerGroups = new Map<HemisphereLayer, HemisphereNode[]>();
  for (const node of nodes) {
    const group = layerGroups.get(node.layer) || [];
    group.push(node);
    layerGroups.set(node.layer, group);
  }

  const sentimentByLayer: LayerSentiment[] = [];
  for (const layer of ['H1', 'H2', 'H3', 'H4'] as HemisphereLayer[]) {
    const layerNodes = layerGroups.get(layer) || [];
    const total = layerNodes.length || 1;
    const positive = layerNodes.filter((n) => CREATIVE_TYPES.includes(n.type)).length;
    const concerned = layerNodes.filter((n) => CHALLENGE_TYPES.includes(n.type)).length;
    const critical = layerNodes.filter((n) => n.type === 'CONSTRAINT').length;

    sentimentByLayer.push({
      layer,
      positive: round2((positive / total) * 100),
      concerned: round2((concerned / total) * 100),
      critical: round2((critical / total) * 100),
    });
  }

  // Language intensity per actor
  const actorNodes = new Map<string, HemisphereNode[]>();
  for (const node of nodes) {
    for (const src of node.sources) {
      const name = src.participantName || 'Unknown';
      const group = actorNodes.get(name) || [];
      group.push(node);
      actorNodes.set(name, group);
    }
  }

  const languageIntensity: ActorLanguageIntensity[] = [];
  for (const [actor, actorNodeList] of actorNodes.entries()) {
    const avgSeverity = actorNodeList.reduce(
      (sum, n) => sum + (n.severity ?? DEFAULT_SEVERITY),
      0,
    ) / (actorNodeList.length || 1);

    languageIntensity.push({
      actor,
      avgSeverity: round2(avgSeverity),
      nodeCount: actorNodeList.length,
    });
  }
  languageIntensity.sort((a, b) => b.avgSeverity - a.avgSeverity);

  // Overall bias level
  const overallBiasLevel: BiasDetection['overallBiasLevel'] =
    giniCoefficient >= GINI_MODERATE_THRESHOLD || dominantVoice !== null
      ? 'significant'
      : giniCoefficient >= GINI_LOW_THRESHOLD
        ? 'moderate'
        : 'low';

  return {
    contributionBalance,
    giniCoefficient,
    dominantVoice,
    sentimentByLayer,
    languageIntensity,
    overallBiasLevel,
  };
}

// ── 3. Balance Safeguard ─────────────────────────────────────

function computeBalanceSafeguard(
  nodes: HemisphereNode[],
  sentiment: SentimentIndex,
  bias: BiasDetection,
  dimensions: string[],
): BalanceSafeguard {
  const flags: SafeguardFlag[] = [];
  const totalNodes = nodes.length;

  // Layer distribution
  const h1Nodes = nodes.filter((n) => n.layer === 'H1');
  const h3Nodes = nodes.filter((n) => n.layer === 'H3');
  const h1Ratio = totalNodes > 0 ? h1Nodes.length / totalNodes : 0;
  const h3ConstraintRatio = totalNodes > 0
    ? h3Nodes.filter((n) => CONSTRAINT_TYPES.includes(n.type)).length / totalNodes
    : 0;
  const h3Ratio = totalNodes > 0 ? h3Nodes.length / totalNodes : 0;

  // Excess imagination: H1 > 60% AND H3 constraints < 15%
  if (h1Ratio > EXCESS_IMAGINATION_H1_THRESHOLD && h3ConstraintRatio < EXCESS_IMAGINATION_H3_THRESHOLD) {
    flags.push({
      type: 'excess_imagination',
      severity: 'warning',
      message: `Vision-heavy thinking (${round2(h1Ratio * 100)}% in H1) without sufficient constraint realism (${round2(h3ConstraintRatio * 100)}% constraints).`,
      metric: round2(h1Ratio * 100),
      threshold: EXCESS_IMAGINATION_H1_THRESHOLD * 100,
    });
  }

  // Excess constraint: H3 constraints > 50% AND H1 < 10%
  if (h3Ratio > EXCESS_CONSTRAINT_H3_THRESHOLD && h1Ratio < EXCESS_CONSTRAINT_H1_THRESHOLD) {
    flags.push({
      type: 'excess_constraint',
      severity: 'critical',
      message: `Constraint-dominated thinking (${round2(h3Ratio * 100)}% in H3) with minimal visionary input (${round2(h1Ratio * 100)}% in H1).`,
      metric: round2(h3Ratio * 100),
      threshold: EXCESS_CONSTRAINT_H3_THRESHOLD * 100,
    });
  }

  // Low mobilisation: ENABLER < 10% despite high VISION count
  const enablerCount = nodes.filter((n) => n.type === 'ENABLER').length;
  const visionCount = nodes.filter((n) => n.type === 'VISION').length;
  const enablerRatio = totalNodes > 0 ? enablerCount / totalNodes : 0;
  if (enablerRatio < LOW_MOBILISATION_ENABLER_THRESHOLD && visionCount >= 5) {
    flags.push({
      type: 'low_mobilisation',
      severity: 'warning',
      message: `Low enabler presence (${round2(enablerRatio * 100)}%) despite ${visionCount} vision nodes. Ideas may lack pathways to action.`,
      metric: round2(enablerRatio * 100),
      threshold: LOW_MOBILISATION_ENABLER_THRESHOLD * 100,
    });
  }

  // Missing domain: any dimension with 0 nodes after 10+ total
  if (totalNodes >= MISSING_DOMAIN_MIN_TOTAL_NODES) {
    const activeDomains = new Set(nodes.flatMap((n) => n.phaseTags));
    for (const dim of dimensions) {
      if (!activeDomains.has(dim)) {
        flags.push({
          type: 'missing_domain',
          severity: 'info',
          message: `No data captured for the "${dim}" dimension across ${totalNodes} nodes.`,
          metric: 0,
          threshold: 1,
        });
      }
    }
  }

  // Single voice dominance
  if (bias.dominantVoice) {
    flags.push({
      type: 'single_voice_dominance',
      severity: 'warning',
      message: `${bias.dominantVoice.name} accounts for ${round2(bias.dominantVoice.share * 100)}% of all contributions. Other perspectives may be under-represented.`,
      metric: round2(bias.dominantVoice.share * 100),
      threshold: DOMINANT_VOICE_THRESHOLD * 100,
    });
  }

  // Layer imbalance: if any layer has 0 nodes when total >= 10
  if (totalNodes >= MISSING_DOMAIN_MIN_TOTAL_NODES) {
    for (const layer of ['H1', 'H2', 'H3'] as HemisphereLayer[]) {
      const layerCount = nodes.filter((n) => n.layer === layer).length;
      if (layerCount === 0) {
        flags.push({
          type: 'layer_imbalance',
          severity: 'warning',
          message: `No nodes in ${layer} layer. The analysis may be missing ${layer === 'H1' ? 'visionary' : layer === 'H2' ? 'challenge/friction' : 'constraint/enabler'} perspectives.`,
          metric: 0,
          threshold: 1,
        });
      }
    }
  }

  // Composite balance score: 100 = perfectly balanced, deduct for each flag
  const flagPenalties: Record<string, number> = {
    critical: 25,
    warning: 12,
    info: 5,
  };
  const totalPenalty = flags.reduce((sum, f) => sum + (flagPenalties[f.severity] || 0), 0);
  const overallBalance = Math.max(0, Math.min(100, 100 - totalPenalty));

  // Build diagnosis string
  const diagnosis = buildDiagnosis(sentiment, bias, flags);

  return {
    flags,
    overallBalance,
    diagnosis,
  };
}

function buildDiagnosis(
  sentiment: SentimentIndex,
  bias: BiasDetection,
  flags: SafeguardFlag[],
): string {
  const parts: string[] = [];

  // Balance assessment
  switch (sentiment.balanceLabel) {
    case 'expansive':
      parts.push('The organisational thinking is expansive and vision-oriented');
      break;
    case 'defensive':
      parts.push('The organisation is in a defensive posture, heavily focused on constraints and risks');
      break;
    case 'fragmented':
      parts.push('Significant fragmentation exists across domains with inconsistent thinking patterns');
      break;
    case 'aligned':
      parts.push('The organisation shows healthy alignment between creative vision and practical constraints');
      break;
    case 'risk-dominated':
      parts.push('Risk and constraint thinking dominates, potentially suppressing innovation');
      break;
    case 'innovation-dominated':
      parts.push('Innovation thinking dominates with insufficient attention to implementation constraints');
      break;
  }

  // Bias note
  if (bias.overallBiasLevel === 'significant') {
    parts.push('with significant contribution imbalance across participants');
  } else if (bias.overallBiasLevel === 'moderate') {
    parts.push('with moderate voice imbalance worth monitoring');
  }

  // Critical flags
  const criticalFlags = flags.filter((f) => f.severity === 'critical');
  if (criticalFlags.length > 0) {
    parts.push(`— ${criticalFlags.length} critical imbalance${criticalFlags.length > 1 ? 's' : ''} detected`);
  }

  return parts.join(', ') + '.';
}

// ── 4. Multi-Lens Analysis ───────────────────────────────────

function computeMultiLens(
  nodes: HemisphereNode[],
  edges: HemisphereEdge[],
  dimensions: string[],
): MultiLensAnalysis {
  const lenses: LensScore[] = [];

  // Build edge adjacency for density calculation
  const edgesByNode = new Map<string, HemisphereEdge[]>();
  for (const edge of edges) {
    const srcEdges = edgesByNode.get(edge.source) || [];
    srcEdges.push(edge);
    edgesByNode.set(edge.source, srcEdges);
    const tgtEdges = edgesByNode.get(edge.target) || [];
    tgtEdges.push(edge);
    edgesByNode.set(edge.target, tgtEdges);
  }

  for (const dim of dimensions) {
    // Nodes tagged with this dimension
    const dimNodes = nodes.filter((n) => n.phaseTags.includes(dim));

    if (dimNodes.length === 0) {
      lenses.push({
        lens: dim,
        score: 0,
        evidence: [],
        concern: 'No data captured for this dimension.',
      });
      continue;
    }

    // Score components (each 0-25, total 0-100)
    // 1. Coverage: how many nodes vs total (max 25 at 30%+)
    const coverageRatio = Math.min(1, dimNodes.length / (nodes.length * 0.3));
    const coverageScore = coverageRatio * 25;

    // 2. Type diversity: how many distinct types represented (max 25 at 5+ types)
    const typeSet = new Set(dimNodes.map((n) => n.type));
    const diversityScore = Math.min(25, (typeSet.size / 5) * 25);

    // 3. Severity engagement: average severity indicates depth of analysis (max 25)
    const avgSeverity = dimNodes.reduce(
      (sum, n) => sum + (n.severity ?? DEFAULT_SEVERITY),
      0,
    ) / dimNodes.length;
    const severityScore = avgSeverity * 25;

    // 4. Connectivity: edge density for dimension nodes (max 25)
    const dimNodeIds = new Set(dimNodes.map((n) => n.id));
    let edgeCount = 0;
    for (const node of dimNodes) {
      const nodeEdges = edgesByNode.get(node.id) || [];
      edgeCount += nodeEdges.length;
    }
    const maxPossibleEdges = dimNodes.length * 3; // reasonable cap
    const connectivityScore = Math.min(25, (edgeCount / Math.max(1, maxPossibleEdges)) * 25);

    const score = round2(coverageScore + diversityScore + severityScore + connectivityScore);

    // Evidence: top 3 node labels by weight
    const topNodes = [...dimNodes]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);
    const evidence = topNodes.map((n) => `${n.type}: ${n.label}`);

    // Concern: identify primary issue
    const constraintCount = dimNodes.filter((n) => CONSTRAINT_TYPES.includes(n.type)).length;
    const challengeCount = dimNodes.filter((n) => CHALLENGE_TYPES.includes(n.type)).length;
    const concern =
      constraintCount > dimNodes.length * 0.5
        ? `Heavily constrained — ${constraintCount} of ${dimNodes.length} nodes are constraints or friction points.`
        : challengeCount > dimNodes.length * 0.4
          ? `Challenge-heavy — ${challengeCount} challenges surfaced requiring attention.`
          : typeSet.size <= 2
            ? `Limited perspective — only ${typeSet.size} node type(s) represented.`
            : null;

    lenses.push({ lens: dim, score, evidence, concern });
  }

  return { lenses };
}

// ── Utility Functions ────────────────────────────────────────

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compute Gini coefficient from an array of shares (0-1 each) */
function computeGini(shares: number[]): number {
  const n = shares.length;
  if (n <= 1) return 0;

  const sorted = [...shares].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;

  let sumDiffs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiffs += Math.abs(sorted[i] - sorted[j]);
    }
  }

  return sumDiffs / (2 * n * n * mean);
}

/** Compute variance of a number array */
function computeVariance(values: number[]): number {
  const n = values.length;
  if (n <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
}

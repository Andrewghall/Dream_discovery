/**
 * DREAM Hemisphere Relationship Engine — Graph Intelligence
 *
 * Extracts causal reasoning from a RelationshipGraph:
 *   - Dominant causal chains (constraint → enabler → vision)
 *   - Bottlenecks (constraints blocking many paths)
 *   - Compensating behaviours (workarounds masking live constraints)
 *   - Broken chains (nodes with no credible connection)
 *   - Contradiction paths (opposing signals on same topic)
 *
 * All outputs are deterministic — no LLM involved.
 */

import type {
  RelationshipGraph,
  RelationshipNode,
  RelationshipEdge,
  RelationshipType,
  NodeLayer,
  EdgeTier,
  CausalChain,
  Bottleneck,
  CompensatingBehaviour,
  BrokenChain,
  ContradictionPath,
  GraphIntelligence,
} from './relationship-graph';

// ── Adjacency index ───────────────────────────────────────────────────────────

function buildAdjacencyIndex(edges: RelationshipEdge[]): {
  byFromNode: Map<string, RelationshipEdge[]>;
  byToNode:   Map<string, RelationshipEdge[]>;
} {
  const byFromNode = new Map<string, RelationshipEdge[]>();
  const byToNode   = new Map<string, RelationshipEdge[]>();

  for (const edge of edges) {
    const from = byFromNode.get(edge.fromNodeId) ?? [];
    from.push(edge);
    byFromNode.set(edge.fromNodeId, from);

    const to = byToNode.get(edge.toNodeId) ?? [];
    to.push(edge);
    byToNode.set(edge.toNodeId, to);
  }
  return { byFromNode, byToNode };
}

function nodeById(nodes: RelationshipNode[]): Map<string, RelationshipNode> {
  return new Map(nodes.map((n) => [n.nodeId, n]));
}

// ── Tier ordering ─────────────────────────────────────────────────────────────

const TIER_ORDER: Record<EdgeTier, number> = {
  WEAK: 0, EMERGING: 1, REINFORCED: 2, SYSTEMIC: 3,
};

function weakestTier(a: EdgeTier, b: EdgeTier): EdgeTier {
  return TIER_ORDER[a] <= TIER_ORDER[b] ? a : b;
}

// ── Causal chains ─────────────────────────────────────────────────────────────

const CONSTRAINT_TO_ENABLER_TYPES = new Set<RelationshipType>([
  'drives', 'responds_to', 'compensates_for', 'blocks',
]);
const ENABLER_TO_REIMAG_TYPES = new Set<RelationshipType>([
  'enables',
]);

/**
 * Find the top-5 dominant causal chains: CONSTRAINT → ENABLER → REIMAGINATION.
 *
 * Chain strength = geometric mean of the two edge scores, 0–100.
 * Only chains where both edges have score > 0 are included.
 */
export function extractDominantCausalChains(graph: RelationshipGraph): CausalChain[] {
  const nodes     = nodeById(graph.nodes);
  const adj       = buildAdjacencyIndex(graph.edges);
  const chains: CausalChain[] = [];

  for (const constraintNode of graph.nodes.filter((n) => n.layer === 'CONSTRAINT')) {
    const outgoing = adj.byFromNode.get(constraintNode.nodeId) ?? [];
    const toEnablers = outgoing.filter(
      (e) =>
        CONSTRAINT_TO_ENABLER_TYPES.has(e.relationshipType) &&
        nodes.get(e.toNodeId)?.layer === 'ENABLER',
    );

    for (const cToE of toEnablers) {
      const enablerNode = nodes.get(cToE.toNodeId);
      if (!enablerNode) continue;

      const enablerOutgoing = adj.byFromNode.get(enablerNode.nodeId) ?? [];
      const toVisions = enablerOutgoing.filter(
        (e) =>
          ENABLER_TO_REIMAG_TYPES.has(e.relationshipType) &&
          nodes.get(e.toNodeId)?.layer === 'REIMAGINATION',
      );

      for (const eToR of toVisions) {
        const visionNode = nodes.get(eToR.toNodeId);
        if (!visionNode) continue;

        // Geometric mean of the two edge scores
        const chainStrength = Math.round(Math.sqrt(cToE.score * eToR.score));

        chains.push({
          constraintNodeId:          constraintNode.nodeId,
          enablerNodeId:             enablerNode.nodeId,
          reimaginationNodeId:       visionNode.nodeId,
          constraintToEnablerEdgeId: cToE.edgeId,
          enablerToReimagEdgeId:     eToR.edgeId,
          chainStrength,
          weakestLinkTier: weakestTier(cToE.tier, eToR.tier),
          labels: {
            constraint:    constraintNode.displayLabel,
            enabler:       enablerNode.displayLabel,
            reimagination: visionNode.displayLabel,
          },
        });
      }
    }
  }

  return chains
    .sort((a, b) => b.chainStrength - a.chainStrength)
    .slice(0, 5);
}

// ── Bottlenecks ───────────────────────────────────────────────────────────────

const BOTTLENECK_EDGE_TYPES = new Set<RelationshipType>([
  'constrains', 'blocks', 'drives',
]);

/**
 * Find constraint nodes that are bottlenecks: outbound degree ≥ 3 across
 * constrains/blocks/drives relationship types.
 * A bottleneck constraint is impeding or motivating many other nodes.
 */
export function findBottlenecks(graph: RelationshipGraph): Bottleneck[] {
  const adj      = buildAdjacencyIndex(graph.edges);
  const nodes    = nodeById(graph.nodes);
  const result: Bottleneck[] = [];

  for (const node of graph.nodes.filter((n) => n.layer === 'CONSTRAINT')) {
    const outgoing = adj.byFromNode.get(node.nodeId) ?? [];
    const bottleneckEdges = outgoing.filter((e) => BOTTLENECK_EDGE_TYPES.has(e.relationshipType));

    if (bottleneckEdges.length >= 3) {
      result.push({
        nodeId:          node.nodeId,
        displayLabel:    node.displayLabel,
        layer:           node.layer,
        outDegree:       bottleneckEdges.length,
        affectedNodeIds: [...new Set(bottleneckEdges.map((e) => e.toNodeId))],
        edgeIds:         bottleneckEdges.map((e) => e.edgeId),
        compositeScore:  node.compositeScore,
        evidenceTier:    node.evidenceTier,
      });
    }
  }

  return result.sort(
    (a, b) => b.outDegree - a.outDegree || b.compositeScore - a.compositeScore,
  );
}

// ── Compensating behaviours ───────────────────────────────────────────────────

/**
 * Find enablers that compensate_for a constraint that is still "live"
 * (rawFrequency ≥ 5 signals).
 *
 * This is a risk signal: the organisation is papering over a live constraint
 * without resolving it.
 */
export function findCompensatingBehaviours(
  graph: RelationshipGraph,
): CompensatingBehaviour[] {
  const nodes = nodeById(graph.nodes);
  const RISK_ORDER: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };

  const result: CompensatingBehaviour[] = graph.edges
    .filter((e) => e.relationshipType === 'compensates_for')
    .map((edge) => {
      const enablerNode    = nodes.get(edge.fromNodeId)!;
      const constraintNode = nodes.get(edge.toNodeId)!;

      const constraintIsLive = constraintNode.rawFrequency >= 5;
      const riskLevel: 'high' | 'medium' | 'low' = constraintIsLive
        ? constraintNode.compositeScore >= 60 ? 'high' : 'medium'
        : 'low';

      return {
        enablerNodeId:           enablerNode.nodeId,
        enablerLabel:            enablerNode.displayLabel,
        constraintNodeId:        constraintNode.nodeId,
        constraintLabel:         constraintNode.displayLabel,
        edgeId:                  edge.edgeId,
        constraintIsLive,
        constraintRawFrequency:  constraintNode.rawFrequency,
        riskLevel,
      };
    });

  return result.sort(
    (a, b) =>
      RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] ||
      b.constraintRawFrequency - a.constraintRawFrequency,
  );
}

// ── Broken chains ─────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<'high' | 'medium' | 'low', number> = {
  high: 0, medium: 1, low: 2,
};

/**
 * Find nodes with no credible causal connections:
 *   (a) CONSTRAINT with no responds_to or drives outgoing edge
 *   (b) REIMAGINATION with no enables or depends_on incoming edge
 *   (c) ENABLER with no enables outgoing edge to a REIMAGINATION node
 */
export function findBrokenChains(graph: RelationshipGraph): BrokenChain[] {
  const adj   = buildAdjacencyIndex(graph.edges);
  const nodes = nodeById(graph.nodes);
  const result: BrokenChain[] = [];

  const RESPONSE_TYPES      = new Set<RelationshipType>(['responds_to', 'drives']);
  const VISION_SUPPORT_TYPES = new Set<RelationshipType>(['enables', 'depends_on']);

  // (a) Unaddressed constraints
  for (const node of graph.nodes.filter((n) => n.layer === 'CONSTRAINT')) {
    const outgoing = adj.byFromNode.get(node.nodeId) ?? [];
    const hasResponse = outgoing.some((e) => RESPONSE_TYPES.has(e.relationshipType));
    if (!hasResponse) {
      result.push({
        nodeId:          node.nodeId,
        displayLabel:    node.displayLabel,
        layer:           node.layer,
        brokenChainType: 'CONSTRAINT_NO_RESPONSE',
        severity:        node.compositeScore >= 50 ? 'high' : node.compositeScore >= 25 ? 'medium' : 'low',
        rawFrequency:    node.rawFrequency,
        evidenceTier:    node.evidenceTier,
      });
    }
  }

  // (b) Unsupported visions
  for (const node of graph.nodes.filter((n) => n.layer === 'REIMAGINATION')) {
    const incoming = adj.byToNode.get(node.nodeId) ?? [];
    const hasSupport = incoming.some((e) => VISION_SUPPORT_TYPES.has(e.relationshipType));
    if (!hasSupport) {
      result.push({
        nodeId:          node.nodeId,
        displayLabel:    node.displayLabel,
        layer:           node.layer,
        brokenChainType: 'REIMAGINATION_UNSUPPORTED',
        severity:        node.compositeScore >= 50 ? 'high' : 'medium',
        rawFrequency:    node.rawFrequency,
        evidenceTier:    node.evidenceTier,
      });
    }
  }

  // (c) Enablers leading nowhere
  for (const node of graph.nodes.filter((n) => n.layer === 'ENABLER')) {
    const outgoing = adj.byFromNode.get(node.nodeId) ?? [];
    const hasVisionEdge = outgoing.some(
      (e) =>
        e.relationshipType === 'enables' &&
        nodes.get(e.toNodeId)?.layer === 'REIMAGINATION',
    );
    if (!hasVisionEdge) {
      result.push({
        nodeId:          node.nodeId,
        displayLabel:    node.displayLabel,
        layer:           node.layer,
        brokenChainType: 'ENABLER_LEADS_NOWHERE',
        severity:        'low',
        rawFrequency:    node.rawFrequency,
        evidenceTier:    node.evidenceTier,
      });
    }
  }

  return result.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.rawFrequency - a.rawFrequency,
  );
}

// ── Contradiction paths ───────────────────────────────────────────────────────

/**
 * Return all contradicts edges as ContradictionPath objects, sorted by score.
 */
export function findContradictionPaths(graph: RelationshipGraph): ContradictionPath[] {
  const nodes = nodeById(graph.nodes);

  return graph.edges
    .filter((e) => e.relationshipType === 'contradicts')
    .map((edge) => {
      const nodeA = nodes.get(edge.fromNodeId);
      const nodeB = nodes.get(edge.toNodeId);
      return {
        edgeId:               edge.edgeId,
        nodeAId:              edge.fromNodeId,
        nodeBId:              edge.toNodeId,
        nodeALabel:           nodeA?.displayLabel ?? edge.fromNodeId,
        nodeBLabel:           nodeB?.displayLabel ?? edge.toNodeId,
        layer:                (nodeA?.layer ?? 'CONSTRAINT') as NodeLayer,
        sharedParticipantIds: edge.sharedParticipantIds,
        fromSignalIds:        edge.fromSignalIds,
        toSignalIds:          edge.toSignalIds,
        edgeScore:            edge.score,
      };
    })
    .sort((a, b) => b.edgeScore - a.edgeScore);
}

// ── Coverage score ────────────────────────────────────────────────────────────

function computeGraphCoverageScore(graph: RelationshipGraph): number {
  if (graph.nodeCount === 0) return 0;
  const connectedIds = new Set([
    ...graph.edges.map((e) => e.fromNodeId),
    ...graph.edges.map((e) => e.toNodeId),
  ]);
  const isolated = graph.nodes.filter((n) => !connectedIds.has(n.nodeId)).length;
  return Math.round(((graph.nodeCount - isolated) / graph.nodeCount) * 100);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run all graph intelligence analyses and return the full GraphIntelligence object.
 */
export function computeGraphIntelligence(graph: RelationshipGraph): GraphIntelligence {
  const dominantCausalChains    = extractDominantCausalChains(graph);
  const bottlenecks             = findBottlenecks(graph);
  const compensatingBehaviours  = findCompensatingBehaviours(graph);
  const brokenChains            = findBrokenChains(graph);
  const contradictionPaths      = findContradictionPaths(graph);

  const systemicEdgeCount       = graph.edges.filter((e) => e.tier === 'SYSTEMIC').length;
  const graphCoverageScore      = computeGraphCoverageScore(graph);

  return {
    dominantCausalChains,
    bottlenecks,
    compensatingBehaviours,
    brokenChains,
    contradictionPaths,
    summary: {
      totalChains:                 dominantCausalChains.length,
      totalBottlenecks:            bottlenecks.length,
      totalCompensatingBehaviours: compensatingBehaviours.length,
      totalBrokenChains:           brokenChains.length,
      totalContradictions:         contradictionPaths.length,
      systemicEdgeCount,
      graphCoverageScore,
    },
  };
}

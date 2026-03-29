/**
 * Transformation Logic Engine — Deterministic, graph-derived
 *
 * Builds the TransformationLogicMap from GraphIntelligence without any LLM call.
 * Every node, edge, and annotation is traceable to real graph data.
 *
 * Node classification:
 *   isCoalescent  — appears as a bottleneck (many outgoing causal edges)
 *   isOrphan      — appears in brokenChains (no credible response pathway)
 *   inValidChain  — part of a dominant constraint→enabler→reimagination chain
 *   isCompensating — enabler that works around a live constraint without fixing it
 *
 * Edge types carried from RelationshipGraph:
 *   drives / enables / constrains / compensates_for / responds_to / contradicts / blocks / depends_on
 */

import type { GraphIntelligence } from '@/lib/output/relationship-graph';
import type { TLMNode, TLMEdge, TransformationLogicMap } from '@/lib/output-intelligence/types';

// ── Node builder ──────────────────────────────────────────────────────────────

function ensureNode(
  map: Map<string, TLMNode>,
  nodeId: string,
  displayLabel: string,
  layer: TLMNode['layer'],
): TLMNode {
  if (!map.has(nodeId)) {
    map.set(nodeId, {
      nodeId,
      displayLabel,
      layer,
      isCoalescent: false,
      isOrphan: false,
      orphanType: undefined,
      inValidChain: false,
      isCompensating: false,
      compositeScore: 20,   // default minimum — overwritten by bottleneck data
      rawFrequency: 1,
      connectionDegree: 0,
      quotes: [],
    });
  }
  return map.get(nodeId)!;
}

// ── Interpretation summary ────────────────────────────────────────────────────

function buildInterpretationSummary(
  nodes: TLMNode[],
  edges: TLMEdge[],
  gi: GraphIntelligence,
  coverageScore: number,
): string {
  const constraintCount = nodes.filter(n => n.layer === 'CONSTRAINT').length;
  const orphanConstraints = nodes.filter(n => n.isOrphan && n.layer === 'CONSTRAINT').length;
  const coalCount = nodes.filter(n => n.isCoalescent).length;
  const chainCount = gi.dominantCausalChains.length;

  const parts: string[] = [];

  if (chainCount === 0 && constraintCount > 0) {
    parts.push(
      `The graph contains ${constraintCount} identified constraint${constraintCount !== 1 ? 's' : ''} but no complete transformation chains — indicating the organisation has identified its problems but has not yet connected them to an execution pathway.`,
    );
  } else if (coverageScore < 40) {
    parts.push(
      `Only ${coverageScore}% of constraints are connected to a credible transformation path, suggesting significant execution risk — the majority of identified problems are unaddressed by the current vision and enabler set.`,
    );
  } else if (coverageScore >= 70) {
    parts.push(
      `${coverageScore}% of constraints feed into at least one complete transformation chain, indicating strong logical coherence between the organisation's problems and its planned responses.`,
    );
  } else {
    parts.push(
      `${coverageScore}% of constraints are part of a valid transformation chain, with ${orphanConstraints} known problem${orphanConstraints !== 1 ? 's' : ''} currently lacking a response pathway.`,
    );
  }

  if (coalCount > 0) {
    const topCoal = gi.bottlenecks.sort((a, b) => b.outDegree - a.outDegree)[0];
    parts.push(
      `The map highlights ${coalCount} high-density convergence point${coalCount !== 1 ? 's' : ''} where multiple pressures meet — "${topCoal.displayLabel}" is the most connected node and likely the highest-leverage intervention point.`,
    );
  }

  if (gi.brokenChains.length > 0) {
    const types = {
      CONSTRAINT_NO_RESPONSE: gi.brokenChains.filter(b => b.brokenChainType === 'CONSTRAINT_NO_RESPONSE').length,
      REIMAGINATION_UNSUPPORTED: gi.brokenChains.filter(b => b.brokenChainType === 'REIMAGINATION_UNSUPPORTED').length,
      ENABLER_LEADS_NOWHERE: gi.brokenChains.filter(b => b.brokenChainType === 'ENABLER_LEADS_NOWHERE').length,
    };
    const orphanParts: string[] = [];
    if (types.CONSTRAINT_NO_RESPONSE > 0)
      orphanParts.push(`${types.CONSTRAINT_NO_RESPONSE} constraint${types.CONSTRAINT_NO_RESPONSE !== 1 ? 's' : ''} with no planned response`);
    if (types.REIMAGINATION_UNSUPPORTED > 0)
      orphanParts.push(`${types.REIMAGINATION_UNSUPPORTED} aspiration${types.REIMAGINATION_UNSUPPORTED !== 1 ? 's' : ''} unsupported by enablers`);
    if (types.ENABLER_LEADS_NOWHERE > 0)
      orphanParts.push(`${types.ENABLER_LEADS_NOWHERE} enabler${types.ENABLER_LEADS_NOWHERE !== 1 ? 's' : ''} disconnected from any vision`);
    parts.push(`Watch points include ${orphanParts.join(', ')}.`);
  }

  return parts.join(' ');
}

// ── Main engine ───────────────────────────────────────────────────────────────

// ── Evidence helper ───────────────────────────────────────────────────────────

function buildEdgeEvidence(
  fromNodeId: string,
  toNodeId: string,
  clusterQuotes: GraphIntelligence['clusterQuotes'],
  mentionCountOverride?: number,
): TLMEdge['evidence'] {
  const fromQ = clusterQuotes[fromNodeId] ?? [];
  const toQ   = clusterQuotes[toNodeId]   ?? [];
  // Merge quotes, deduplicate by text
  const seen   = new Set<string>();
  const quotes: typeof fromQ = [];
  for (const q of [...fromQ, ...toQ]) {
    if (!seen.has(q.text)) { seen.add(q.text); quotes.push(q); }
  }
  const actorCount = new Set(
    quotes.map(q => q.participantRole).filter((r): r is string => Boolean(r)),
  ).size;
  return {
    mentionCount: mentionCountOverride ?? quotes.length,
    actorCount,
    quotes: quotes.slice(0, 4),
  };
}

export function buildTransformationLogicMap(graphIntelligence: GraphIntelligence): TransformationLogicMap {
  const nodeMap = new Map<string, TLMNode>();
  const edgeList: TLMEdge[] = [];
  const seenEdgeIds = new Set<string>();

  function addEdge(edge: TLMEdge) {
    if (!seenEdgeIds.has(edge.edgeId)) {
      seenEdgeIds.add(edge.edgeId);
      edgeList.push(edge);
    }
  }

  // ── 1. Dominant causal chains — constraint → enabler → reimagination ────────
  for (const chain of graphIntelligence.dominantCausalChains) {
    const cn = ensureNode(nodeMap, chain.constraintNodeId, chain.labels.constraint, 'CONSTRAINT');
    const en = ensureNode(nodeMap, chain.enablerNodeId, chain.labels.enabler, 'ENABLER');
    const rn = ensureNode(nodeMap, chain.reimaginationNodeId, chain.labels.reimagination, 'REIMAGINATION');

    cn.inValidChain = true;
    en.inValidChain = true;
    rn.inValidChain = true;

    // Boost scores for chain members
    const strength = chain.chainStrength > 1 ? chain.chainStrength : chain.chainStrength * 100;
    cn.compositeScore = Math.max(cn.compositeScore, Math.round(strength * 0.9));
    en.compositeScore = Math.max(en.compositeScore, Math.round(strength));
    rn.compositeScore = Math.max(rn.compositeScore, Math.round(strength * 0.85));

    addEdge({
      edgeId: chain.constraintToEnablerEdgeId,
      fromNodeId: chain.constraintNodeId,
      toNodeId: chain.enablerNodeId,
      relationshipType: 'drives',
      score: Math.round(strength),
      tier: chain.weakestLinkTier,
      isChainEdge: true,
      rationale: `${chain.labels.constraint} motivates ${chain.labels.enabler}`,
      evidence: buildEdgeEvidence(chain.constraintNodeId, chain.enablerNodeId, graphIntelligence.clusterQuotes),
    });

    addEdge({
      edgeId: chain.enablerToReimagEdgeId,
      fromNodeId: chain.enablerNodeId,
      toNodeId: chain.reimaginationNodeId,
      relationshipType: 'enables',
      score: Math.round(strength),
      tier: chain.weakestLinkTier,
      isChainEdge: true,
      rationale: `${chain.labels.enabler} makes ${chain.labels.reimagination} achievable`,
      evidence: buildEdgeEvidence(chain.enablerNodeId, chain.reimaginationNodeId, graphIntelligence.clusterQuotes),
    });
  }

  // ── 2. Bottlenecks — coalescence points ─────────────────────────────────────
  for (const b of graphIntelligence.bottlenecks) {
    const node = ensureNode(nodeMap, b.nodeId, b.displayLabel, b.layer as TLMNode['layer']);
    node.isCoalescent = true;
    // Bottleneck composite score wins
    node.compositeScore = Math.max(node.compositeScore, b.compositeScore);
    node.connectionDegree = Math.max(node.connectionDegree, b.outDegree);
  }

  // ── 3. Broken chains — orphan nodes ─────────────────────────────────────────
  for (const bc of graphIntelligence.brokenChains) {
    const node = ensureNode(nodeMap, bc.nodeId, bc.displayLabel, bc.layer as TLMNode['layer']);
    node.isOrphan = true;
    node.orphanType = bc.brokenChainType;
    node.rawFrequency = bc.rawFrequency;
    // Orphan score reflects how prominent the ignored problem is
    node.compositeScore = Math.max(node.compositeScore, Math.min(80, bc.rawFrequency * 8));
  }

  // ── 4. Compensating behaviours ───────────────────────────────────────────────
  for (const cb of graphIntelligence.compensatingBehaviours) {
    const en = ensureNode(nodeMap, cb.enablerNodeId, cb.enablerLabel, 'ENABLER');
    const cn = ensureNode(nodeMap, cb.constraintNodeId, cb.constraintLabel, 'CONSTRAINT');
    en.isCompensating = true;

    const score = cb.riskLevel === 'high' ? 72 : cb.riskLevel === 'medium' ? 48 : 28;
    const tier: TLMEdge['tier'] = cb.riskLevel === 'high' ? 'REINFORCED' : 'EMERGING';

    addEdge({
      edgeId: cb.edgeId,
      fromNodeId: cb.enablerNodeId,
      toNodeId: cb.constraintNodeId,
      relationshipType: 'compensates_for',
      score,
      tier,
      isChainEdge: false,
      rationale: `"${cb.enablerLabel}" works around "${cb.constraintLabel}" — constraint remains live (${cb.constraintRawFrequency} mentions)`,
      evidence: buildEdgeEvidence(
        cb.enablerNodeId,
        cb.constraintNodeId,
        graphIntelligence.clusterQuotes,
        cb.constraintRawFrequency,
      ),
    });
  }

  // ── 5. Contradiction paths ───────────────────────────────────────────────────
  for (const cp of graphIntelligence.contradictionPaths) {
    ensureNode(nodeMap, cp.nodeAId, cp.nodeALabel, cp.layer as TLMNode['layer']);
    ensureNode(nodeMap, cp.nodeBId, cp.nodeBLabel, cp.layer as TLMNode['layer']);

    addEdge({
      edgeId: cp.edgeId,
      fromNodeId: cp.nodeAId,
      toNodeId: cp.nodeBId,
      relationshipType: 'contradicts',
      score: cp.edgeScore,
      tier: 'EMERGING',
      isChainEdge: false,
      rationale: 'Opposing participant views on related concerns',
      evidence: buildEdgeEvidence(
        cp.nodeAId,
        cp.nodeBId,
        graphIntelligence.clusterQuotes,
        cp.fromSignalIds.length + cp.toSignalIds.length,
      ),
    });
  }

  // ── 5b. Raw graph edges between TLM nodes ────────────────────────────────────
  // After all pattern-based edges are added, sweep ALL raw relationship edges
  // and include any that connect two nodes already in the TLM node map AND
  // have real multi-utterance evidence (fromSignalIds + toSignalIds >= 2).
  // This surfaces partial, sideways, and weak connections that don't belong to
  // a dominant chain, compensating behaviour, or contradiction — no semantics.
  if (graphIntelligence.rawGraph) {
    for (const re of graphIntelligence.rawGraph.edges) {
      if (!nodeMap.has(re.fromNodeId) || !nodeMap.has(re.toNodeId)) continue;
      const mentionCount = re.fromSignalIds.length + re.toSignalIds.length;
      if (mentionCount < 2) continue; // must have multiple real utterances
      // Determine actor coverage from shared participants
      const actorCount = re.sharedParticipantIds.length;
      // Build quotes for this specific edge from both node clusters
      const fromQ = graphIntelligence.clusterQuotes[re.fromNodeId] ?? [];
      const toQ   = graphIntelligence.clusterQuotes[re.toNodeId]   ?? [];
      const seenText = new Set<string>();
      const quotes: TLMEdge['evidence'] extends undefined ? never : NonNullable<TLMEdge['evidence']>['quotes'] = [];
      for (const q of [...fromQ, ...toQ]) {
        if (!seenText.has(q.text)) { seenText.add(q.text); quotes.push(q); }
      }
      addEdge({
        edgeId: re.edgeId,
        fromNodeId: re.fromNodeId,
        toNodeId:   re.toNodeId,
        relationshipType: re.relationshipType as TLMEdge['relationshipType'],
        score: re.score,
        tier:  re.tier,
        isChainEdge: false,
        rationale: re.rationale,
        evidence: {
          mentionCount,
          actorCount,
          quotes: quotes.slice(0, 4),
        },
      });
    }
  }

  // ── 6. Update connection degrees from edge list ──────────────────────────────
  for (const edge of edgeList) {
    const from = nodeMap.get(edge.fromNodeId);
    const to   = nodeMap.get(edge.toNodeId);
    if (from) from.connectionDegree++;
    if (to)   to.connectionDegree++;
  }

  // ── 7. Attach quotes from clusterQuotes ─────────────────────────────────────
  for (const [nodeId, quotes] of Object.entries(graphIntelligence.clusterQuotes)) {
    const node = nodeMap.get(nodeId);
    if (node) node.quotes = quotes.slice(0, 3);
  }

  // ── 8. Compute analytics ─────────────────────────────────────────────────────
  const nodes = [...nodeMap.values()];
  const constraintNodes = nodes.filter(n => n.layer === 'CONSTRAINT');
  const chainConstraints = constraintNodes.filter(n => n.inValidChain).length;
  const coverageScore = constraintNodes.length > 0
    ? Math.round((chainConstraints / constraintNodes.length) * 100)
    : 0;

  const strongestChains = graphIntelligence.dominantCausalChains
    .slice()
    .sort((a, b) => {
      const sa = a.chainStrength > 1 ? a.chainStrength : a.chainStrength * 100;
      const sb = b.chainStrength > 1 ? b.chainStrength : b.chainStrength * 100;
      return sb - sa;
    })
    .slice(0, 5)
    .map((c, i) => ({
      chainId: `chain_${i}`,
      constraintLabel: c.labels.constraint,
      enablerLabel: c.labels.enabler,
      reimaginationLabel: c.labels.reimagination,
      chainStrength: c.chainStrength > 1 ? c.chainStrength : Math.round(c.chainStrength * 100),
    }));

  const orphanSummary = {
    constraintOrphans: graphIntelligence.brokenChains.filter(b => b.brokenChainType === 'CONSTRAINT_NO_RESPONSE').length,
    enablerOrphans:    graphIntelligence.brokenChains.filter(b => b.brokenChainType === 'ENABLER_LEADS_NOWHERE').length,
    visionOrphans:     graphIntelligence.brokenChains.filter(b => b.brokenChainType === 'REIMAGINATION_UNSUPPORTED').length,
    topOrphanLabels:   graphIntelligence.brokenChains.slice(0, 5).map(b => b.displayLabel),
  };

  const coalescencePoints = graphIntelligence.bottlenecks
    .slice()
    .sort((a, b) => b.outDegree - a.outDegree)
    .map(b => ({
      nodeId: b.nodeId,
      label: b.displayLabel,
      layer: b.layer,
      outDegree: b.outDegree,
      affectedCount: b.affectedNodeIds.length,
      compositeScore: b.compositeScore,
    }));

  const interpretationSummary = buildInterpretationSummary(nodes, edgeList, graphIntelligence, coverageScore);

  return {
    nodes,
    edges: edgeList,
    coalescencePoints,
    orphanSummary,
    strongestChains,
    coverageScore,
    interpretationSummary,
  };
}

/**
 * DREAM Hemisphere Relationship Engine — Data Model
 *
 * Models the workshop evidence graph where:
 *   Nodes = scored evidence clusters classified into three causal layers
 *   Edges = deterministic, evidence-backed relationships between clusters
 *
 * Node layers:
 *   CONSTRAINT     — what holds the organisation back (pain, friction, limitation)
 *   ENABLER        — what can or does help (capabilities, responses, workarounds)
 *   REIMAGINATION  — what the organisation wants to become (visions, futures)
 *
 * Edge types (explicit causal semantics):
 *   drives          CONSTRAINT → ENABLER: constraint motivates the enabler
 *   constrains      CONSTRAINT → REIMAGINATION: constraint limits the vision
 *   enables         ENABLER → REIMAGINATION: enabler makes vision achievable
 *   compensates_for ENABLER → CONSTRAINT: enabler is a workaround, not a fix
 *   blocks          CONSTRAINT → ENABLER: constraint prevents the enabler working
 *   depends_on      REIMAGINATION → ENABLER: vision requires this enabler
 *   contradicts     any → any (same layer): opposing views on same topic
 *   responds_to     ENABLER → CONSTRAINT: designed, direct response to constraint
 *
 * All edges are deterministic and explainable — no GPT inference.
 * Every edge carries the signal IDs and participant IDs that justify it.
 */

import type { EvidenceScore, EvidenceTier } from './evidence-scoring';

// ── Layers ────────────────────────────────────────────────────────────────────

export type NodeLayer =
  | 'CONSTRAINT'    // Pain, friction, limitation — impedes progress
  | 'ENABLER'       // Capability, response, workaround — drives progress
  | 'REIMAGINATION'; // Vision, aspiration — desired future state

// ── Relationship types ────────────────────────────────────────────────────────

export type RelationshipType =
  | 'drives'           // CONSTRAINT → ENABLER: constraint motivates the enabler
  | 'constrains'       // CONSTRAINT → REIMAGINATION: constraint limits vision
  | 'enables'          // ENABLER → REIMAGINATION: enabler unlocks vision
  | 'compensates_for'  // ENABLER → CONSTRAINT: workaround for a live constraint
  | 'blocks'           // CONSTRAINT → ENABLER: active blocker (stronger than constrains)
  | 'depends_on'       // REIMAGINATION → ENABLER: vision requires this enabler
  | 'contradicts'      // same-layer, same-participants, opposing sentiment
  | 'responds_to';     // ENABLER → CONSTRAINT: designed, direct response

// ── Edge tiers ────────────────────────────────────────────────────────────────

export type EdgeTier =
  | 'WEAK'       // < 25: thin evidence
  | 'EMERGING'   // 25–44: 2+ participants, credible
  | 'REINFORCED' // 45–64: multi-participant, multi-lens or multi-phase
  | 'SYSTEMIC';  // ≥ 65: broad, deep, cross-source

// ── Edge creation rules ───────────────────────────────────────────────────────

export type EdgeCreationRule =
  | 'RESPONDS_TO_SHARED_PARTICIPANT_CROSS_PHASE'
  | 'COMPENSATES_FOR_JACCARD_SENTIMENT'
  | 'DRIVES_SHARED_PARTICIPANT'
  | 'DRIVES_JACCARD'
  | 'ENABLES_SHARED_PARTICIPANT'
  | 'ENABLES_JACCARD'
  | 'CONSTRAINS_SHARED_PARTICIPANT'
  | 'CONSTRAINS_JACCARD'
  | 'DEPENDS_ON_SHARED_PARTICIPANT'
  | 'DEPENDS_ON_JACCARD'
  | 'BLOCKS_JACCARD_PLUS_CONTRADICTION'
  | 'CONTRADICTS_SHARED_PARTICIPANT_SENTIMENT';

// ── Nodes ─────────────────────────────────────────────────────────────────────

export interface RelationshipNode {
  /** Matches EvidenceCluster.clusterKey */
  nodeId: string;
  displayLabel: string;
  layer: NodeLayer;
  /** How strongly signals point to this layer (0–1, three scores sum ≤ 1) */
  layerScores: { constraint: number; enabler: number; reimagination: number };

  /** From EvidenceCluster */
  rawFrequency: number;
  distinctParticipants: number;
  participantRoles: string[];      // serialised form of Set<string>
  lensSpread: string[];
  phaseSpread: string[];
  sourceStreams: string[];
  allSignalIds: string[];
  contradictingSignalCount: number;

  /** From EvidenceScore */
  compositeScore: number;
  evidenceTier: EvidenceTier;
  isContested: boolean;
}

// ── Edges ─────────────────────────────────────────────────────────────────────

export interface RelationshipEdge {
  /** Deterministic: `${fromNodeId}__${relationshipType}__${toNodeId}` */
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationshipType: RelationshipType;

  /**
   * Signal IDs from each cluster that directly justify this edge.
   * fromSignalIds = signals from the FROM cluster
   * toSignalIds   = signals from the TO cluster
   * These are the verbatim evidence records behind the relationship.
   */
  fromSignalIds: string[];
  toSignalIds: string[];

  /** Confirmed participant IDs who appear in BOTH clusters */
  sharedParticipantIds: string[];

  /** Scoring */
  score: number;          // 0–100 composite
  tier: EdgeTier;

  /** Which deterministic rules fired to create this edge */
  rules: EdgeCreationRule[];

  /** Human-readable, template-filled explanation — no GPT */
  rationale: string;
}

// ── Graph ─────────────────────────────────────────────────────────────────────

export interface RelationshipGraph {
  workshopId: string;
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  nodeCount: number;
  edgeCount: number;
  layerCounts: Record<NodeLayer, number>;
  edgeTypeCounts: Partial<Record<RelationshipType, number>>;
  builtAtMs: number;
}

// ── Intelligence outputs ──────────────────────────────────────────────────────

/** A full CONSTRAINT → ENABLER → REIMAGINATION path with combined strength */
export interface CausalChain {
  constraintNodeId: string;
  enablerNodeId: string;
  reimaginationNodeId: string;
  /** Edge from constraint to enabler (drives|responds_to|compensates_for|blocks) */
  constraintToEnablerEdgeId: string;
  /** Edge from enabler to reimagination (enables) */
  enablerToReimagEdgeId: string;
  /** Geometric mean of the two edge scores, 0–100 */
  chainStrength: number;
  weakestLinkTier: EdgeTier;
  labels: { constraint: string; enabler: string; reimagination: string };
}

/** A constraint node acting as a hub — many other nodes depend on or are blocked by it */
export interface Bottleneck {
  nodeId: string;
  displayLabel: string;
  layer: NodeLayer;
  /** Number of outgoing constrains/blocks/drives edges */
  outDegree: number;
  affectedNodeIds: string[];
  edgeIds: string[];
  compositeScore: number;
  evidenceTier: EvidenceTier;
}

/** An enabler that repeatedly works around a constraint but never resolves it */
export interface CompensatingBehaviour {
  enablerNodeId: string;
  enablerLabel: string;
  constraintNodeId: string;
  constraintLabel: string;
  edgeId: string;
  /** True if constraint still has high raw frequency (≥ 5 mentions) */
  constraintIsLive: boolean;
  constraintRawFrequency: number;
  riskLevel: 'high' | 'medium' | 'low';
}

/** A node with no credible causal connection */
export interface BrokenChain {
  nodeId: string;
  displayLabel: string;
  layer: NodeLayer;
  brokenChainType:
    | 'CONSTRAINT_NO_RESPONSE'       // constraint with no responds_to or drives edge
    | 'REIMAGINATION_UNSUPPORTED'    // vision with no enables or depends_on edge
    | 'ENABLER_LEADS_NOWHERE';       // enabler with no enables edge to a vision
  severity: 'high' | 'medium' | 'low';
  rawFrequency: number;
  evidenceTier: EvidenceTier;
}

export interface ContradictionPath {
  edgeId: string;
  nodeAId: string;
  nodeBId: string;
  nodeALabel: string;
  nodeBLabel: string;
  layer: NodeLayer;
  sharedParticipantIds: string[];
  fromSignalIds: string[];
  toSignalIds: string[];
  edgeScore: number;
}

export interface GraphIntelligence {
  dominantCausalChains: CausalChain[];
  bottlenecks: Bottleneck[];
  compensatingBehaviours: CompensatingBehaviour[];
  brokenChains: BrokenChain[];
  contradictionPaths: ContradictionPath[];
  summary: {
    totalChains: number;
    totalBottlenecks: number;
    totalCompensatingBehaviours: number;
    totalBrokenChains: number;
    totalContradictions: number;
    systemicEdgeCount: number;
    graphCoverageScore: number;
  };
  /**
   * Verbatim signal quotes per cluster, keyed by nodeId (= clusterKey).
   * Up to 3 quotes per cluster, populated by buildWorkshopGraphIntelligence.
   * Used by causal-synthesis-agent to add evidenceQuotes to CausalFindings.
   */
  clusterQuotes: Record<string, Array<{ text: string; participantRole: string | null; lens: string | null }>>;
  /**
   * Full raw relationship graph — included so the TLM engine can surface
   * ALL evidence-backed edges between cluster nodes, not just those that
   * belong to chains, bottlenecks, or other extracted patterns.
   */
  rawGraph?: RelationshipGraph;
}

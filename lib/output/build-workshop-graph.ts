/**
 * DREAM Relationship Engine — Workshop Graph Adapter
 *
 * Converts raw workshop data (snapshot nodes + discovery insights + participant list)
 * into a scored RelationshipGraph and GraphIntelligence object.
 *
 * Called from signal-aggregator.ts to populate WorkshopSignals.graphIntelligence.
 * All operations are deterministic and synchronous — no LLM calls.
 */

import {
  buildEvidenceClusters,
  snapshotNodesToSignals,
  insightsToSignals,
  type SnapshotNodeRaw,
} from './evidence-clustering';
import { scoreAllClusters } from './evidence-scoring';
import { buildRelationshipGraph } from './edge-builder';
import { computeGraphIntelligence } from './graph-intelligence';
import type { GraphIntelligence } from './relationship-graph';

// ── Input shape ───────────────────────────────────────────────────────────────

export interface WorkshopGraphInput {
  workshopId: string;
  /**
   * Raw snapshot nodes from the latest LiveWorkshopSnapshot payload.nodesById.
   * When agenticAnalysis.themes is populated (real hemisphere-processed workshops),
   * fine-grained topic clusters are used. When absent (seeded/older workshops),
   * a coarser lens+primaryType label is synthesised as the clustering basis.
   */
  nodesById: Record<string, Omit<SnapshotNodeRaw, 'id'>>;
  /** ConversationInsight records from the discovery phase */
  insights: Array<{
    id: string;
    text: string;
    insightType: string;
    category?: string | null;
    participantId?: string | null;
  }>;
  /** Workshop participants for confirmed participant and role resolution */
  participants: Array<{ id: string; role: string | null }>;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build GraphIntelligence from raw workshop data.
 *
 * Steps:
 * 1. Build participant role map and confirmed ID set
 * 2. Convert snapshot nodes → RawSignal[] (live stream, theme-labelled)
 * 3. Convert discovery insights → RawSignal[] (discovery stream)
 * 4. Cluster → score → graph → intelligence
 *
 * Returns an empty-but-valid GraphIntelligence when insufficient data is
 * available (e.g. no themes extracted yet, or workshop has no live nodes).
 */
export function buildWorkshopGraphIntelligence(
  input: WorkshopGraphInput,
): GraphIntelligence {
  const { workshopId, nodesById, insights, participants } = input;

  // ── Participant maps ─────────────────────────────────────────────────────
  const confirmedParticipantIds = new Set<string>();
  const participantRoleMap = new Map<string, string>();
  for (const p of participants) {
    confirmedParticipantIds.add(p.id);
    if (p.role) participantRoleMap.set(p.id, p.role);
  }

  // ── Convert raw nodes → RawSignal[] ─────────────────────────────────────
  const nodeList: SnapshotNodeRaw[] = Object.entries(nodesById).map(
    ([id, n]) => ({ id, ...n }),
  );
  const rawLiveSignals = snapshotNodesToSignals(
    nodeList,
    confirmedParticipantIds,
    participantRoleMap,
  );

  // Theme-label enrichment fallback:
  // Real workshops processed by the hemisphere brain have fine-grained
  // agenticAnalysis.themes. Older or seeded workshops may have none.
  // When themes are absent, synthesise a coarser label from lens + primaryType
  // so the graph builder always has a clustering basis.
  const liveSignals = rawLiveSignals.map((s) => {
    if (s.themeLabels.length > 0) return s;
    const synth: string[] = [];
    if (s.lens && s.primaryType) synth.push(`${s.lens}_${s.primaryType}`);
    else if (s.lens) synth.push(s.lens);
    else if (s.primaryType) synth.push(s.primaryType);
    return synth.length > 0 ? { ...s, themeLabels: synth } : s;
  });

  // ── Convert discovery insights → RawSignal[] ────────────────────────────
  // Insights from the discovery phase carry insightType + category.
  // Use those as fallback theme labels when the insight has no theme.
  const rawDiscoverySignals = insightsToSignals(insights, participantRoleMap);
  const discoverySignals = rawDiscoverySignals.map((s) => {
    if (s.themeLabels.length > 0) return s;
    const synth: string[] = [];
    // category (lens area) + primaryType gives a meaningful cluster key
    if (s.lens && s.primaryType) synth.push(`${s.lens}_${s.primaryType}`);
    else if (s.primaryType) synth.push(s.primaryType);
    return synth.length > 0 ? { ...s, themeLabels: synth } : s;
  });

  const allSignals = [...liveSignals, ...discoverySignals];
  if (allSignals.length === 0) return emptyGraphIntelligence();

  // ── Build clusters → score → graph → intelligence ────────────────────────
  const clusters = buildEvidenceClusters(allSignals);

  const totalRoles = participantRoleMap.size > 0
    ? new Set(participantRoleMap.values()).size
    : 1;

  const scored = scoreAllClusters(clusters, totalRoles);
  if (scored.length === 0) return emptyGraphIntelligence();

  const graph = buildRelationshipGraph(scored, workshopId);
  return computeGraphIntelligence(graph);
}

// ── Empty fallback ────────────────────────────────────────────────────────────

function emptyGraphIntelligence(): GraphIntelligence {
  return {
    dominantCausalChains: [],
    bottlenecks: [],
    compensatingBehaviours: [],
    brokenChains: [],
    contradictionPaths: [],
    summary: {
      totalChains: 0,
      totalBottlenecks: 0,
      totalCompensatingBehaviours: 0,
      totalBrokenChains: 0,
      totalContradictions: 0,
      systemicEdgeCount: 0,
      graphCoverageScore: 0,
    },
  };
}

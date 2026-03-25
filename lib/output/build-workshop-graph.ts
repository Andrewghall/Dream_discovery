/**
 * DREAM Relationship Engine — Workshop Graph Adapter
 *
 * Converts raw workshop data (snapshot nodes + discovery insights + participant list)
 * into a scored RelationshipGraph and GraphIntelligence object.
 *
 * Called from signal-aggregator.ts to populate WorkshopSignals.graphIntelligence.
 *
 * Pipeline:
 *   1. Convert raw nodes → RawSignal[] (live stream)
 *   2. Convert discovery insights → RawSignal[] (discovery stream)
 *   3. Enrich both with canonical topic labels (topic-extraction.ts)
 *      • Deterministic corpus-frequency extraction (always runs)
 *      • Optional LLM consolidation of near-synonym labels (when API key present)
 *   4. buildEvidenceClusters → scoreAllClusters → buildRelationshipGraph
 *   5. computeGraphIntelligence → returned GraphIntelligence
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
import {
  enrichSignalsWithTopics,
  refineTopicsWithLLM,
  applyLabelMergeMap,
} from './topic-extraction';

// ── Input shape ───────────────────────────────────────────────────────────────

export interface WorkshopGraphInput {
  workshopId: string;
  /**
   * Raw snapshot nodes from the latest LiveWorkshopSnapshot payload.nodesById.
   * When agenticAnalysis.themes is populated (hemisphere-processed nodes),
   * those fine-grained topic labels are used as-is.
   * When absent, canonical topics are extracted via topic-extraction.ts.
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
  /**
   * Client context for LLM topic refinement (optional — improves label quality).
   */
  clientContext?: { clientName?: string; industry?: string };
  /**
   * Set false to skip LLM topic consolidation (e.g. in tests or offline runs).
   * Defaults to true (LLM runs when OPENAI_API_KEY is present).
   */
  refineClusters?: boolean;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build GraphIntelligence from raw workshop data.
 *
 * Async — supports optional LLM topic consolidation before clustering.
 * Gracefully returns empty-but-valid GraphIntelligence when insufficient data.
 */
export async function buildWorkshopGraphIntelligence(
  input: WorkshopGraphInput,
): Promise<GraphIntelligence> {
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
  const liveSignals = snapshotNodesToSignals(
    nodeList,
    confirmedParticipantIds,
    participantRoleMap,
  );

  // ── Convert discovery insights → RawSignal[] ────────────────────────────
  const discoverySignals = insightsToSignals(insights, participantRoleMap);

  const allRawSignals = [...liveSignals, ...discoverySignals];
  if (allRawSignals.length === 0) return emptyGraphIntelligence();

  // ── Phase 1: Deterministic topic extraction ──────────────────────────────
  // Adds themeLabels to signals that have none (both live nodes that lack
  // agenticAnalysis.themes AND discovery insights which never carry themes).
  // Signals that already have themeLabels are left unchanged.
  const enriched = enrichSignalsWithTopics(allRawSignals);

  // ── Phase 2: Optional LLM topic consolidation ────────────────────────────
  // One GPT-4o-mini call merges near-synonym cluster labels that deterministic
  // Jaccard merging missed (e.g. "system" vs "fragmentation").
  // Skipped when refineClusters=false, or when OpenAI key is absent.
  let finalSignals = enriched;
  if (input.refineClusters !== false) {
    try {
      const llmMerges = await refineTopicsWithLLM(enriched, input.clientContext ?? {});
      finalSignals = applyLabelMergeMap(enriched, llmMerges);
    } catch {
      // LLM refinement failure is non-fatal — continue with deterministic labels
    }
  }

  // ── Build clusters → score → graph → intelligence ────────────────────────
  const clusters = buildEvidenceClusters(finalSignals);

  const totalRoles = participantRoleMap.size > 0
    ? new Set(participantRoleMap.values()).size
    : 1;

  const scored = scoreAllClusters(clusters, totalRoles);
  if (scored.length === 0) return emptyGraphIntelligence();

  // ── Generic-label guard ──────────────────────────────────────────────────
  // Clusters consolidated by LLM refinement to a single generic word ("data",
  // "system", "quality", etc.) are excluded from graph edge generation.
  // They remain in `scored` for quote/evidence access via clusterQuotes, but
  // do not become nodes that can anchor spurious causal chains.
  // This preserves the calibrated IDF thresholds — no threshold changes needed.
  const GENERIC_SINGLE_WORD_LABELS = new Set([
    'data', 'system', 'process', 'issue', 'issues', 'quality', 'service',
    'change', 'work', 'risk', 'team', 'time', 'management', 'support',
    'information', 'communication', 'performance', 'results', 'people',
  ]);

  const graphClusters = scored.filter(({ cluster }) => {
    const label = cluster.displayLabel.toLowerCase().trim();
    const wordCount = label.split(/\s+/).length;
    return !(wordCount === 1 && GENERIC_SINGLE_WORD_LABELS.has(label));
  });

  const graph = buildRelationshipGraph(graphClusters, workshopId);
  const intelligence = computeGraphIntelligence(graph);

  // Build cluster quote index from ALL scored clusters (including generic-label ones)
  // so they remain accessible for evidence retrieval even when excluded from the graph.
  const clusterQuotes: GraphIntelligence['clusterQuotes'] = {};
  for (const { cluster } of scored) {
    if (cluster.bestQuotes.length > 0) {
      clusterQuotes[cluster.clusterKey] = cluster.bestQuotes.slice(0, 3);
    }
  }
  return { ...intelligence, clusterQuotes };
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
    clusterQuotes: {},
  };
}

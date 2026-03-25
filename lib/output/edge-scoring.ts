/**
 * DREAM Hemisphere Relationship Engine — Edge Scoring
 *
 * Scores a RelationshipEdge based on the quality and breadth of its
 * supporting evidence signals. The formula mirrors the evidence-scoring
 * composite approach but is tuned for cross-cluster relationships.
 *
 * Composite score weights (sum to 100):
 *   Shared participants   30 — confirmed speakers appearing in both clusters
 *   Total signals         25 — raw signal volume justifying the edge
 *   Role diversity        15 — distinct participant roles in supporting signals
 *   Lens spread           15 — cross-lens representation
 *   Phase spread          10 — cross-phase representation
 *   Source spread          5 — discovery / live / historical
 *   Contradiction penalty −20 — signals that contradict the edge direction
 *
 * EdgeTier thresholds:
 *   WEAK       < 25
 *   EMERGING   25–44
 *   REINFORCED 45–64
 *   SYSTEMIC   ≥ 65
 */

import type { RawSignal } from './evidence-clustering';
import type { EdgeTier } from './relationship-graph';

// ── Tier assignment ───────────────────────────────────────────────────────────

export function assignEdgeTier(score: number): EdgeTier {
  if (score >= 65) return 'SYSTEMIC';
  if (score >= 45) return 'REINFORCED';
  if (score >= 25) return 'EMERGING';
  return 'WEAK';
}

// ── Edge scoring ──────────────────────────────────────────────────────────────

export interface EdgeScoreInput {
  fromSignalIds: string[];
  toSignalIds: string[];
  sharedParticipantIds: string[];
  signalIndex: Map<string, RawSignal>;
}

export interface EdgeScoreResult {
  score: number;
  tier: EdgeTier;
  // Component breakdown (0–1 each)
  components: {
    sharedParticipantScore: number;
    signalSupportScore: number;
    roleDiversityScore: number;
    lensSpreadScore: number;
    phaseSpreadScore: number;
    sourceSpreadScore: number;
    contradictionPenalty: number;
  };
}

const POSITIVE_POLE = new Set(['positive']);
const NEGATIVE_POLE = new Set(['concerned', 'critical']);

/**
 * Score an edge from its supporting signal IDs.
 *
 * The signal index must contain all signals referenced by fromSignalIds
 * and toSignalIds. Missing signal IDs are silently skipped.
 */
export function scoreEdge(input: EdgeScoreInput): { score: number; tier: EdgeTier } {
  const { fromSignalIds, toSignalIds, sharedParticipantIds, signalIndex } = input;

  const allSigIds = [...new Set([...fromSignalIds, ...toSignalIds])];
  const signals = allSigIds
    .map((id) => signalIndex.get(id))
    .filter((s): s is RawSignal => s !== undefined);

  const confirmedSignals = signals.filter((s) => s.isConfirmedParticipant);
  const totalSignals = signals.length;

  // ── Component scores (0–1) ──────────────────────────────────────────────

  // 1. Shared participants (cap at 5 for full score)
  const sharedParticipantScore = Math.min(sharedParticipantIds.length / 5, 1.0);

  // 2. Signal volume (cap at 20 for full score)
  const signalSupportScore = Math.min(totalSignals / 20, 1.0);

  // 3. Role diversity (distinct roles across supporting signals / 5, capped)
  const roles = new Set(
    confirmedSignals.map((s) => s.participantRole).filter((r): r is string => Boolean(r)),
  );
  const roleDiversityScore = Math.min(roles.size / 5, 1.0);

  // 4. Lens spread (distinct lenses / 3, capped)
  const lenses = new Set(signals.map((s) => s.lens).filter((l): l is string => Boolean(l)));
  const lensSpreadScore = Math.min(lenses.size / 3, 1.0);

  // 5. Phase spread (distinct phases / 3, capped — max meaningful is 3 for cross-phase)
  const phases = new Set(signals.map((s) => s.phase).filter((p): p is string => Boolean(p)));
  const phaseSpreadScore = Math.min(phases.size / 3, 1.0);

  // 6. Source spread (discovery / live / historical, / 2, capped)
  const sources = new Set(signals.map((s) => s.sourceStream));
  const sourceSpreadScore = Math.min(sources.size / 2, 1.0);

  // 7. Contradiction penalty: from-signals that oppose the edge direction
  // (i.e., from-signals with NEGATIVE sentiment in an enabler→reimagination edge,
  //  or from-signals with POSITIVE sentiment in a constraint→reimagination edge)
  // We use a simpler proxy: fraction of from-signals with internally contradicting sentiment
  const fromSignals = fromSignalIds
    .map((id) => signalIndex.get(id))
    .filter((s): s is RawSignal => s !== undefined);

  const fromPositive = fromSignals.filter((s) => POSITIVE_POLE.has(s.sentiment ?? '')).length;
  const fromNegative = fromSignals.filter((s) => NEGATIVE_POLE.has(s.sentiment ?? '')).length;
  const fromTotal = fromSignals.length;

  // Mixed sentiment in from-signals = uncertain edge — apply partial contradiction penalty
  let contradictionPenalty = 0;
  if (fromTotal > 0) {
    const minPole = Math.min(fromPositive, fromNegative);
    contradictionPenalty = minPole / fromTotal;
  }

  // ── Composite (0–100) ──────────────────────────────────────────────────
  const raw =
    sharedParticipantScore * 30 +
    signalSupportScore     * 25 +
    roleDiversityScore     * 15 +
    lensSpreadScore        * 15 +
    phaseSpreadScore       * 10 +
    sourceSpreadScore      *  5 -
    contradictionPenalty   * 20;

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const tier  = assignEdgeTier(score);

  return { score, tier };
}

/**
 * Score all edges in a graph in bulk.
 * Returns a map from edgeId → { score, tier }.
 */
export function scoreAllEdges(
  edges: Array<{
    edgeId: string;
    fromSignalIds: string[];
    toSignalIds: string[];
    sharedParticipantIds: string[];
  }>,
  signalIndex: Map<string, RawSignal>,
): Map<string, { score: number; tier: EdgeTier }> {
  const results = new Map<string, { score: number; tier: EdgeTier }>();
  for (const edge of edges) {
    results.set(
      edge.edgeId,
      scoreEdge({
        fromSignalIds:        edge.fromSignalIds,
        toSignalIds:          edge.toSignalIds,
        sharedParticipantIds: edge.sharedParticipantIds,
        signalIndex,
      }),
    );
  }
  return results;
}

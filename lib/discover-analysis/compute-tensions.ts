/**
 * Deterministic Tension Ranking
 *
 * Replaces GPT-decided tension ordering with a deterministic formula:
 *
 *   TensionIndex = SeverityWeight x DivergenceVariance x CrossActorSpread
 *
 * - SeverityWeight: critical=3, significant=2, moderate=1
 * - DivergenceVariance: statistical variance of viewpoint sentiment values
 *   (positive=1, mixed=0.5, neutral=0, negative=-1)
 * - CrossActorSpread: count of affected actors (min 1)
 *
 * The GPT agent still generates the qualitative content (viewpoints,
 * evidence quotes, topic descriptions), but the ranking is overridden
 * by this deterministic formula.
 */

import type { TensionEntry, TensionSurfaceData } from '@/lib/types/discover-analysis';

// ── Constants ────────────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 3,
  significant: 2,
  moderate: 1,
};

const SENTIMENT_NUMERIC: Record<string, number> = {
  positive: 1,
  mixed: 0.5,
  neutral: 0,
  negative: -1,
};

// ── Core Formula ─────────────────────────────────────────────

/**
 * Compute the deterministic tension index for a single tension.
 *
 * TensionIndex = SeverityWeight x DivergenceVariance x CrossActorSpread
 */
function computeSingleTensionIndex(tension: TensionEntry): number {
  const severityWeight = SEVERITY_WEIGHTS[tension.severity] ?? 1;

  // Divergence variance: how spread the viewpoint sentiments are
  const sentimentValues = tension.viewpoints.map(
    (v) => SENTIMENT_NUMERIC[v.sentiment] ?? 0,
  );
  const divergenceVariance =
    sentimentValues.length >= 2 ? computeVariance(sentimentValues) : 0;

  // Cross-actor spread: number of affected actors (min 1)
  const crossActorSpread = Math.max(1, tension.affectedActors.length);

  return round2(severityWeight * divergenceVariance * crossActorSpread);
}

// ── Public API ───────────────────────────────────────────────

/**
 * Re-rank tensions deterministically using the TensionIndex formula.
 *
 * Takes GPT-generated tensions (with qualitative viewpoints) and
 * overrides the ranking with a deterministic score. Also derives
 * severity from the computed index if the score suggests a different
 * classification than GPT provided.
 *
 * @param tensions - GPT-generated tensions from the analysis agent
 * @returns Tensions re-ranked by deterministic TensionIndex, highest first
 */
export function rankTensionsDeterministic(
  tensions: TensionSurfaceData,
): TensionSurfaceData {
  if (!tensions.tensions || tensions.tensions.length === 0) {
    return tensions;
  }

  // Score each tension
  const scored = tensions.tensions.map((t) => ({
    ...t,
    tensionIndex: computeSingleTensionIndex(t),
  }));

  // Sort by tensionIndex descending (highest tension first)
  scored.sort((a, b) => b.tensionIndex - a.tensionIndex);

  // Re-assign ranks (1-based)
  const ranked = scored.map((t, i) => ({
    ...t,
    rank: i + 1,
  }));

  return { tensions: ranked };
}

/**
 * Score a single tension entry with the deterministic formula.
 * Used when constructing tensions from non-GPT sources.
 */
export function scoreTensionEntry(tension: TensionEntry): TensionEntry {
  return {
    ...tension,
    tensionIndex: computeSingleTensionIndex(tension),
  };
}

// ── Utility ──────────────────────────────────────────────────

function computeVariance(values: number[]): number {
  const n = values.length;
  if (n <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

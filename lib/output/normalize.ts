/**
 * Output Normalization Pipeline
 *
 * Pure deterministic utility functions for the output dashboard.
 * No side effects, no LLM calls, no network. All functions take data in
 * and return data out.
 *
 * Implements the 7-step quality control pipeline from the design doc:
 * 1. Apply actor group normalization
 * 2. Apply theme density normalization
 * 3. Compute sentiment indices
 * 4. Compute divergence variance
 * 5. Compute tension index
 * 6. Compute cognitive shift delta
 * 7. Validate participation balance
 */

import type {
  AlignmentHeatmapData,
  AlignmentCell,
  ConfidenceIndexData,
  ConstraintMapData,
  TensionSurfaceData,
} from '@/lib/types/discover-analysis';
import type {
  HemisphereDiagnostic,
} from '@/lib/types/hemisphere-diagnostic';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type {
  NormalizationResult,
  ComputedConfidenceScore,
  ConstraintImpactEntry,
  CognitiveShiftDelta,
  ActorAlignmentEntry,
  QualityControlResult,
} from '@/lib/types/output-dashboard';

// Re-export the deterministic tension ranker for convenience
export { rankTensionsDeterministic } from '@/lib/discover-analysis/compute-tensions';

// ── Constants ─────────────────────────────────────────────────

const PARTICIPATION_IMBALANCE_THRESHOLD = 0.3;

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 3,
  significant: 2,
  moderate: 1,
};

// ── 1. Actor Group Normalization ──────────────────────────────

/**
 * Normalize alignment scores by actor utterance count.
 * Equalizes influence so prolific speakers do not dominate.
 */
export function normalizeActorGroups(
  alignment: AlignmentHeatmapData,
): AlignmentHeatmapData {
  if (!alignment.cells.length) return alignment;

  // Compute total utterances per actor
  const actorTotals = new Map<string, number>();
  for (const cell of alignment.cells) {
    actorTotals.set(
      cell.actor,
      (actorTotals.get(cell.actor) || 0) + cell.utteranceCount,
    );
  }

  // Find the median utterance count for scaling
  const totals = [...actorTotals.values()];
  totals.sort((a, b) => a - b);
  const median = totals[Math.floor(totals.length / 2)] || 1;

  // Scale each cell's alignment score by the actor's normalization factor
  const normalizedCells: AlignmentCell[] = alignment.cells.map((cell) => {
    const actorTotal = actorTotals.get(cell.actor) || 1;
    const factor = median / actorTotal;
    return {
      ...cell,
      alignmentScore: clamp(cell.alignmentScore * factor, -1, 1),
    };
  });

  return {
    ...alignment,
    cells: normalizedCells,
  };
}

// ── 2. Theme Density Normalization ────────────────────────────

/**
 * Re-sort themes by density (mentions / total) rather than raw count.
 * Prevents high-volume themes from drowning out meaningful smaller ones.
 */
export function normalizeThemeDensity(
  alignment: AlignmentHeatmapData,
): AlignmentHeatmapData {
  if (!alignment.themes.length) return alignment;

  // Compute density for each theme: utterances / total utterances
  const totalUtterances = alignment.cells.reduce((sum, c) => sum + c.utteranceCount, 0) || 1;

  const themeDensity = new Map<string, number>();
  for (const theme of alignment.themes) {
    const themeUtterances = alignment.cells
      .filter((c) => c.theme === theme)
      .reduce((sum, c) => sum + c.utteranceCount, 0);
    themeDensity.set(theme, themeUtterances / totalUtterances);
  }

  // Sort themes by density descending
  const sortedThemes = [...alignment.themes].sort((a, b) => {
    return (themeDensity.get(b) || 0) - (themeDensity.get(a) || 0);
  });

  return {
    ...alignment,
    themes: sortedThemes,
  };
}

// ── 3. Participation Imbalance ────────────────────────────────

/**
 * Check for participation imbalance across actor groups.
 * Flags if any actor contributes >30% more than the median.
 */
export function computeParticipationImbalance(
  actorCounts: Map<string, number>,
): NormalizationResult {
  const entries = [...actorCounts.entries()];
  const total = entries.reduce((s, [, c]) => s + c, 0);

  if (entries.length <= 1 || total === 0) {
    return {
      participationImbalance: 0,
      imbalanceWarning: null,
      actorGroupSizes: Object.fromEntries(entries),
      totalParticipants: total,
    };
  }

  const counts = entries.map(([, c]) => c);
  counts.sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)] || 1;

  // Imbalance = max deviation from median / median
  const maxDeviation = Math.max(...counts.map((c) => Math.abs(c - median)));
  const imbalance = maxDeviation / median;

  let warning: string | null = null;
  if (imbalance > PARTICIPATION_IMBALANCE_THRESHOLD) {
    const dominant = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    warning = `Participation imbalance detected: "${dominant[0]}" contributed ${dominant[1]} of ${total} data points (${Math.round((dominant[1] / total) * 100)}%). Scores have been normalized but interpret with caution.`;
  }

  return {
    participationImbalance: round2(imbalance),
    imbalanceWarning: warning,
    actorGroupSizes: Object.fromEntries(entries),
    totalParticipants: total,
  };
}

// ── 4. Confidence Score ───────────────────────────────────────

/**
 * Compute the design-doc confidence formula:
 * (Certain - Hedged) / Total, adjusted for actor distribution imbalance.
 */
export function computeConfidenceScore(
  confidence: ConfidenceIndexData,
  actorCounts: Map<string, number>,
): ComputedConfidenceScore {
  const { certain, hedging, uncertain } = confidence.overall;
  const total = certain + hedging + uncertain;

  if (total === 0) {
    return { raw: 0, adjusted: 0, totalStatements: 0 };
  }

  const raw = round2((certain - hedging) / total);

  // Adjustment: if participation is imbalanced, dampen confidence
  const imbalance = computeParticipationImbalance(actorCounts);
  const dampingFactor = imbalance.participationImbalance > PARTICIPATION_IMBALANCE_THRESHOLD
    ? 1 - (imbalance.participationImbalance - PARTICIPATION_IMBALANCE_THRESHOLD)
    : 1;
  const adjusted = round2(raw * clamp(dampingFactor, 0.5, 1));

  return { raw, adjusted, totalStatements: total };
}

// ── 5. Constraint Impact Score ────────────────────────────────

/**
 * Compute Constraint Impact Score:
 * DependencyCount x ActorSpread x Severity
 *
 * Structural blockers are ranked above operational irritations.
 */
export function computeConstraintImpactScores(
  constraints: ConstraintMapData,
  actors: string[],
): ConstraintImpactEntry[] {
  if (!constraints.constraints.length) return [];

  return constraints.constraints
    .map((c) => {
      const dependencyCount = c.dependsOn.length + c.blocks.length;

      // Actor spread: how many unique actors are connected via relationships
      const relatedNodeIds = new Set([...c.dependsOn, ...c.blocks]);
      const relatedConstraints = constraints.constraints.filter(
        (other) => relatedNodeIds.has(other.id),
      );
      const involvedDomains = new Set([c.domain, ...relatedConstraints.map((r) => r.domain)]);
      const actorSpread = Math.max(1, involvedDomains.size);

      const severityNum = SEVERITY_WEIGHTS[c.severity] || 1;

      // A constraint is structural if it blocks others or has dependencies
      const isStructural = c.blocks.length > 0 || dependencyCount >= 2;

      const impactScore = round2(
        Math.max(1, dependencyCount) * actorSpread * severityNum,
      );

      return {
        id: c.id,
        description: c.description,
        domain: c.domain,
        dependencyCount,
        actorSpread,
        severity: severityNum,
        impactScore,
        isStructural,
      };
    })
    // Structural first, then by impact score descending
    .sort((a, b) => {
      if (a.isStructural !== b.isStructural) return a.isStructural ? -1 : 1;
      return b.impactScore - a.impactScore;
    });
}

// ── 6. Cognitive Shift Delta ──────────────────────────────────

/**
 * Compute the cognitive shift between before and after diagnostics.
 * Returns normalized indices, not raw dot counts.
 */
export function computeCognitiveShiftDelta(
  diagBefore: HemisphereDiagnostic,
  diagAfter: HemisphereDiagnostic,
): CognitiveShiftDelta {
  const creativeDelta = round2(
    diagAfter.sentimentIndex.overallCreative - diagBefore.sentimentIndex.overallCreative,
  );
  const constraintDelta = round2(
    diagAfter.sentimentIndex.overallConstraint - diagBefore.sentimentIndex.overallConstraint,
  );
  const balanceDelta = round2(
    diagAfter.balanceSafeguard.overallBalance - diagBefore.balanceSafeguard.overallBalance,
  );

  // Categorize domain movements
  const domainsMoreCreative: string[] = [];
  const domainsMoreConstrained: string[] = [];
  const domainsStable: string[] = [];

  const afterDomains = new Map(
    diagAfter.sentimentIndex.domains.map((d) => [d.domain, d]),
  );

  for (const beforeDomain of diagBefore.sentimentIndex.domains) {
    const afterDomain = afterDomains.get(beforeDomain.domain);
    if (!afterDomain) {
      domainsStable.push(beforeDomain.domain);
      continue;
    }

    const cDelta = afterDomain.creativeDensity - beforeDomain.creativeDensity;
    if (cDelta > 5) {
      domainsMoreCreative.push(beforeDomain.domain);
    } else if (cDelta < -5) {
      domainsMoreConstrained.push(beforeDomain.domain);
    } else {
      domainsStable.push(beforeDomain.domain);
    }
  }

  // Build shift description
  const parts: string[] = [];
  if (creativeDelta > 0) {
    parts.push(`Creative energy increased by ${creativeDelta}pp`);
  } else if (creativeDelta < 0) {
    parts.push(`Creative energy decreased by ${Math.abs(creativeDelta)}pp`);
  }
  if (domainsMoreCreative.length > 0) {
    parts.push(`${domainsMoreCreative.join(', ')} moved toward innovation`);
  }
  if (domainsMoreConstrained.length > 0) {
    parts.push(`${domainsMoreConstrained.join(', ')} became more constrained`);
  }
  if (domainsStable.length > 0 && domainsMoreCreative.length === 0 && domainsMoreConstrained.length === 0) {
    parts.push('All domains remained stable');
  }

  return {
    creativeDelta,
    constraintDelta,
    balanceDelta,
    domainsMoreCreative,
    domainsMoreConstrained,
    domainsStable,
    shiftDescription: parts.join('. ') + '.',
  };
}

// ── 7. Actor Alignment Matrix ─────────────────────────────────

/**
 * Compute the Actor Alignment Matrix for Section 3.
 * Per actor: sentiment index, friction areas, desired future state,
 * capability gap, sample size, divergence variance.
 */
export function computeActorAlignmentMatrix(
  alignment: AlignmentHeatmapData,
  tensions: TensionSurfaceData,
  journeyData: LiveJourneyData | null,
): ActorAlignmentEntry[] {
  if (!alignment.actors.length) return [];

  return alignment.actors.map((actor) => {
    // Get all cells for this actor
    const actorCells = alignment.cells.filter((c) => c.actor === actor);
    const sampleSize = actorCells.reduce((s, c) => s + c.utteranceCount, 0);

    // Sentiment index: weighted average of alignment scores
    const totalWeight = actorCells.reduce((s, c) => s + c.utteranceCount, 0) || 1;
    const sentimentIndex = round2(
      actorCells.reduce((s, c) => s + c.alignmentScore * c.utteranceCount, 0) / totalWeight,
    );

    // Divergence variance: variance of alignment scores (not volume)
    const scores = actorCells.map((c) => c.alignmentScore);
    const divergenceVariance = computeVariance(scores);

    // Friction areas: themes where this actor has negative alignment
    const frictionAreas = actorCells
      .filter((c) => c.alignmentScore < -0.2)
      .map((c) => c.theme);

    // From tensions: topics where this actor appears in affectedActors
    const tensionFriction = tensions.tensions
      .filter((t) => t.affectedActors.some((a) => a.toLowerCase() === actor.toLowerCase()))
      .map((t) => t.topic);

    const allFriction = [...new Set([...frictionAreas, ...tensionFriction])];

    // Desired future state and capability gap from journey data
    let desiredFutureState = 'Not specified';
    let capabilityGap = 'Not assessed';

    if (journeyData) {
      const actorInteractions = journeyData.interactions.filter(
        (i) => i.actor?.toLowerCase() === actor.toLowerCase(),
      );

      // Future state: look for interactions with future AI agency != human
      const futureInteractions = actorInteractions.filter(
        (i) => i.aiAgencyFuture && i.aiAgencyFuture !== 'human',
      );
      if (futureInteractions.length > 0) {
        desiredFutureState = `${futureInteractions.length} touchpoints targeted for AI augmentation`;
      }

      // Capability gap: contrast current vs future
      const painCount = actorInteractions.filter((i) => i.isPainPoint).length;
      if (painCount > 0) {
        capabilityGap = `${painCount} pain point${painCount > 1 ? 's' : ''} identified across journey`;
      }
    }

    return {
      actor,
      sentimentIndex,
      frictionAreas: allFriction,
      desiredFutureState,
      capabilityGap,
      sampleSize,
      divergenceVariance,
    };
  });
}

// ── Quality Control Pipeline ──────────────────────────────────

/**
 * Run the full 7-step quality control pipeline.
 * Returns warnings and a ready flag.
 */
export function runQualityControl(
  alignment: AlignmentHeatmapData | null,
  tensions: TensionSurfaceData | null,
  constraints: ConstraintMapData | null,
  confidence: ConfidenceIndexData | null,
  diagBefore: HemisphereDiagnostic | null,
  diagAfter: HemisphereDiagnostic | null,
): QualityControlResult {
  const warnings: string[] = [];

  // Step 1: Actor group normalization check
  if (alignment && alignment.actors.length > 0) {
    const actorCounts = new Map<string, number>();
    for (const cell of alignment.cells) {
      actorCounts.set(cell.actor, (actorCounts.get(cell.actor) || 0) + cell.utteranceCount);
    }
    const result = computeParticipationImbalance(actorCounts);
    if (result.imbalanceWarning) {
      warnings.push(result.imbalanceWarning);
    }
  }

  // Step 2: Theme density check
  if (alignment && alignment.themes.length > 0) {
    const totalUtterances = alignment.cells.reduce((s, c) => s + c.utteranceCount, 0);
    const themeCounts = new Map<string, number>();
    for (const cell of alignment.cells) {
      themeCounts.set(cell.theme, (themeCounts.get(cell.theme) || 0) + cell.utteranceCount);
    }
    for (const [theme, count] of themeCounts) {
      if (count / totalUtterances > 0.5) {
        warnings.push(`Theme "${theme}" dominates with ${Math.round((count / totalUtterances) * 100)}% of utterances. Consider whether this distorts other themes.`);
      }
    }
  }

  // Step 3: Sentiment indices check
  if (diagAfter) {
    const si = diagAfter.sentimentIndex;
    if (si.overallCreative + si.overallConstraint < 10) {
      warnings.push('Very low sentiment signal detected. Results may not be representative.');
    }
  }

  // Step 4: Divergence variance check
  if (tensions && tensions.tensions.length > 0) {
    const zeroVarianceTensions = tensions.tensions.filter((t) => t.tensionIndex === 0);
    if (zeroVarianceTensions.length === tensions.tensions.length) {
      warnings.push('All tensions have zero divergence. This may indicate insufficient actor diversity.');
    }
  }

  // Step 5: Tension index already computed in TensionEntry.tensionIndex

  // Step 6: Cognitive shift delta check
  if (diagBefore && diagAfter) {
    const shift = Math.abs(
      diagAfter.sentimentIndex.overallCreative - diagBefore.sentimentIndex.overallCreative,
    );
    if (shift < 3) {
      warnings.push('Minimal cognitive shift detected between before and after states.');
    }
  }

  // Step 7: Participation balance
  if (diagAfter && diagAfter.biasDetection.dominantVoice) {
    const dv = diagAfter.biasDetection.dominantVoice;
    warnings.push(
      `Dominant voice detected: "${dv.name}" with ${Math.round(dv.share * 100)}% share. Results may be skewed.`,
    );
  }

  return {
    warnings,
    ready: warnings.length <= 2, // Allow minor warnings, block if too many
  };
}

// ── Utility ───────────────────────────────────────────────────

function computeVariance(values: number[]): number {
  const n = values.length;
  if (n <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return round2(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

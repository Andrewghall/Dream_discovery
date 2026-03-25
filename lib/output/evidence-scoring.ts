/**
 * DREAM Evidence Scoring
 *
 * Deterministic scoring and tier assignment for EvidenceCluster objects.
 * No LLM calls. Pure functions.
 *
 * Tiers (ascending confidence):
 *   WEAK          — thin signal, minimal spread
 *   EMERGING      — beginning to appear across participants/lenses
 *   REINFORCED    — credible pattern, multi-actor, multi-lens
 *   ESTABLISHED   — strong organisational signal
 *   ORGANISATIONAL— board-grade finding: broad, deep, corroborated
 *
 * Flags (orthogonal to tier):
 *   ANECDOTAL  — only 1–2 confirmed participants, low frequency
 *   CONTESTED  — significant contradicting signal present
 */

import type { EvidenceCluster } from './evidence-clustering';

// ── Types ────────────────────────────────────────────────────────────────────

export type EvidenceTier =
  | 'WEAK'
  | 'EMERGING'
  | 'REINFORCED'
  | 'ESTABLISHED'
  | 'ORGANISATIONAL';

export interface EvidenceScore {
  // Raw components (0–1 each)
  frequencyScore: number;        // rawFrequency normalised, capped
  participantScore: number;      // distinctParticipants / maxParticipants
  roleDiversityScore: number;    // distinct roles / total expected roles
  lensReinforcementScore: number;// lensSpread / total blueprint lenses
  phaseReinforcementScore: number;// phaseSpread / total phases (max 4)
  sourceReinforcementScore: number; // distinct source streams / 3
  contradictionPenalty: number;  // contradictingSignals / totalSignals

  // Composite (0–100)
  compositeScore: number;

  // Dominant-speaker ratio: fraction of signals from single speaker
  dominantSpeakerRatio: number;

  // Hard gate flags
  tier: EvidenceTier;
  isAnecdotal: boolean;
  isContested: boolean;

  // Evidence counts for display
  rawFrequency: number;
  distinctParticipants: number;
  lensCount: number;
  phaseCount: number;
  sourceStreamCount: number;
  contradictionCount: number;
}

export interface ScoringConfig {
  /** Max expected participants (used to normalise participantScore). Default 20. */
  maxParticipants?: number;
  /** Total lenses in blueprint (used to normalise lensScore). Default 5. */
  totalLenses?: number;
  /** Hard minimum distinct participants for REINFORCED tier. Default 3. */
  minParticipantsForReinforced?: number;
  /** Hard minimum distinct participants for ORGANISATIONAL tier. Default 5. */
  minParticipantsForOrganisational?: number;
  /** Dominant-speaker ratio above which REINFORCED requires cross-source. Default 0.7. */
  dominantSpeakerThreshold?: number;
  /** Contradiction ratio above which cluster becomes CONTESTED. Default 0.25. */
  contestedThreshold?: number;
  /** Composite score floor for each tier. */
  tierThresholds?: {
    EMERGING: number;       // default 20
    REINFORCED: number;     // default 40
    ESTABLISHED: number;    // default 60
    ORGANISATIONAL: number; // default 78
  };
}

const DEFAULTS: Required<ScoringConfig> = {
  maxParticipants: 20,
  totalLenses: 5,
  minParticipantsForReinforced: 3,
  minParticipantsForOrganisational: 5,
  dominantSpeakerThreshold: 0.70,
  contestedThreshold: 0.25,
  tierThresholds: {
    EMERGING: 20,
    REINFORCED: 40,
    ESTABLISHED: 60,
    ORGANISATIONAL: 78,
  },
};

// ── Composite formula ────────────────────────────────────────────────────────

/**
 * Composite score weights (must sum to 100):
 *   Frequency        20  — raw mentions, capped at 20 for full score
 *   Participant spread 30 — distinct confirmed participants
 *   Role diversity   15  — distinct participant roles
 *   Lens spread      15  — cross-lens presence
 *   Phase spread     10  — cross-phase presence
 *   Source spread    10  — cross-stream (discovery/live/historical)
 *   Contradiction    -20 — penalty for contradicted evidence
 */
function computeComposite(components: Omit<EvidenceScore,
  'compositeScore' | 'dominantSpeakerRatio' | 'tier' | 'isAnecdotal' | 'isContested' |
  'rawFrequency' | 'distinctParticipants' | 'lensCount' | 'phaseCount' |
  'sourceStreamCount' | 'contradictionCount'
>): number {
  const raw =
    components.frequencyScore        * 20 +
    components.participantScore       * 30 +
    components.roleDiversityScore     * 15 +
    components.lensReinforcementScore * 15 +
    components.phaseReinforcementScore * 10 +
    components.sourceReinforcementScore * 10 -
    components.contradictionPenalty   * 20;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ── Dominant-speaker ratio ───────────────────────────────────────────────────

function computeDominantSpeakerRatio(cluster: EvidenceCluster): number {
  if (cluster.signals.length === 0) return 0;
  const countBySpeaker = new Map<string, number>();
  for (const s of cluster.signals) {
    if (s.speakerId) {
      countBySpeaker.set(s.speakerId, (countBySpeaker.get(s.speakerId) ?? 0) + 1);
    }
  }
  if (countBySpeaker.size === 0) return 0;
  const maxCount = Math.max(...countBySpeaker.values());
  return maxCount / cluster.signals.length;
}

// ── Tier assignment ──────────────────────────────────────────────────────────

function assignTier(
  compositeScore: number,
  distinctParticipants: number,
  lensCount: number,
  dominantSpeakerRatio: number,
  sourceStreamCount: number,
  cfg: Required<ScoringConfig>,
): EvidenceTier {
  const { tierThresholds, minParticipantsForReinforced, minParticipantsForOrganisational,
          dominantSpeakerThreshold } = cfg;

  // ORGANISATIONAL: top composite AND broad spread
  if (
    compositeScore >= tierThresholds.ORGANISATIONAL &&
    distinctParticipants >= minParticipantsForOrganisational &&
    lensCount >= 2
  ) return 'ORGANISATIONAL';

  // ESTABLISHED: strong composite AND multi-participant
  if (
    compositeScore >= tierThresholds.ESTABLISHED &&
    distinctParticipants >= minParticipantsForReinforced + 1 &&
    lensCount >= 2
  ) return 'ESTABLISHED';

  // REINFORCED: meets hard gates — multi-participant, some lens spread
  // PLUS: if dominant-speaker ratio is high, must have cross-source reinforcement
  const dominantSpeakerBlocked =
    dominantSpeakerRatio >= dominantSpeakerThreshold && sourceStreamCount < 2;

  if (
    compositeScore >= tierThresholds.REINFORCED &&
    distinctParticipants >= minParticipantsForReinforced &&
    !dominantSpeakerBlocked
  ) return 'REINFORCED';

  // EMERGING: some composite score and at least 2 distinct participants
  if (compositeScore >= tierThresholds.EMERGING && distinctParticipants >= 2) return 'EMERGING';

  // WEAK: everything else
  return 'WEAK';
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Score a single EvidenceCluster and assign its tier.
 *
 * @param cluster      Pre-built evidence cluster
 * @param totalRoles   Total distinct participant roles in this workshop
 * @param config       Optional overrides for thresholds and normalisation
 */
export function scoreCluster(
  cluster: EvidenceCluster,
  totalRoles: number,
  config?: ScoringConfig,
): EvidenceScore {
  const cfg: Required<ScoringConfig> = {
    ...DEFAULTS,
    ...config,
    tierThresholds: { ...DEFAULTS.tierThresholds, ...config?.tierThresholds },
  };

  const freq = cluster.rawFrequency;
  const dp = cluster.distinctParticipants;
  const lc = cluster.lensSpread.size;
  const pc = cluster.phaseSpread.size;
  const sc = cluster.sourceStreams.size;
  const cc = cluster.contradictingSignals.length;

  // Component scores (0–1)
  const frequencyScore        = Math.min(freq / 20, 1.0);
  const participantScore      = Math.min(dp / cfg.maxParticipants, 1.0);
  const roleDiversityScore    = totalRoles > 0 ? Math.min(cluster.participantRoles.size / totalRoles, 1.0) : 0;
  const lensReinforcementScore = Math.min(lc / cfg.totalLenses, 1.0);
  const phaseReinforcementScore = Math.min(pc / 4, 1.0);
  const sourceReinforcementScore = Math.min(sc / 3, 1.0);
  const contradictionPenalty  = freq > 0 ? Math.min(cc / freq, 1.0) : 0;

  const compositeScore = computeComposite({
    frequencyScore,
    participantScore,
    roleDiversityScore,
    lensReinforcementScore,
    phaseReinforcementScore,
    sourceReinforcementScore,
    contradictionPenalty,
  });

  const dominantSpeakerRatio = computeDominantSpeakerRatio(cluster);

  const tier = assignTier(compositeScore, dp, lc, dominantSpeakerRatio, sc, cfg);

  // Flags
  const isAnecdotal = dp <= 1 || (dp === 2 && freq <= 3);
  const isContested = cc > 0 && (cc / Math.max(freq, 1)) >= cfg.contestedThreshold;

  return {
    frequencyScore,
    participantScore,
    roleDiversityScore,
    lensReinforcementScore,
    phaseReinforcementScore,
    sourceReinforcementScore,
    contradictionPenalty,
    compositeScore,
    dominantSpeakerRatio,
    tier,
    isAnecdotal,
    isContested,
    rawFrequency: freq,
    distinctParticipants: dp,
    lensCount: lc,
    phaseCount: pc,
    sourceStreamCount: sc,
    contradictionCount: cc,
  };
}

/**
 * Score all clusters in a workshop.
 *
 * Returns clusters paired with their scores, sorted by compositeScore desc.
 * The `_unthemed` cluster is excluded from tier assignment (kept for gap analysis).
 */
export function scoreAllClusters(
  clusters: EvidenceCluster[],
  totalRoles: number,
  config?: ScoringConfig,
): Array<{ cluster: EvidenceCluster; score: EvidenceScore }> {
  return clusters
    .filter(c => c.clusterKey !== '_unthemed')
    .map(c => ({ cluster: c, score: scoreCluster(c, totalRoles, config) }))
    .sort((a, b) => b.score.compositeScore - a.score.compositeScore);
}

// ── Hard gate exports ────────────────────────────────────────────────────────

/**
 * Returns true if the cluster can be reported as an organisational finding.
 *
 * Hard gates (ANY failure → false):
 * 1. Tier must be ESTABLISHED or ORGANISATIONAL
 * 2. distinctParticipants >= minParticipantsForReinforced (default 3)
 * 3. Not ANECDOTAL
 * 4. Not CONTESTED unless caller opts in
 */
export function passesOrganisationalGate(
  score: EvidenceScore,
  allowContested = false,
  config?: ScoringConfig,
): boolean {
  const minP = config?.minParticipantsForReinforced ?? DEFAULTS.minParticipantsForReinforced;
  if (score.tier !== 'ESTABLISHED' && score.tier !== 'ORGANISATIONAL') return false;
  if (score.distinctParticipants < minP) return false;
  if (score.isAnecdotal) return false;
  if (!allowContested && score.isContested) return false;
  return true;
}

/**
 * Returns true if the cluster can be reported as a reinforced finding.
 *
 * Hard gates:
 * 1. Tier must be REINFORCED, ESTABLISHED, or ORGANISATIONAL
 * 2. distinctParticipants >= 3
 * 3. Not ANECDOTAL
 * 4. If dominant-speaker ratio >= threshold, must have sourceStreamCount >= 2
 */
export function passesReinforcedGate(
  score: EvidenceScore,
  config?: ScoringConfig,
): boolean {
  const minP = config?.minParticipantsForReinforced ?? DEFAULTS.minParticipantsForReinforced;
  const domThresh = config?.dominantSpeakerThreshold ?? DEFAULTS.dominantSpeakerThreshold;

  const ELIGIBLE_TIERS: EvidenceTier[] = ['REINFORCED', 'ESTABLISHED', 'ORGANISATIONAL'];
  if (!ELIGIBLE_TIERS.includes(score.tier)) return false;
  if (score.distinctParticipants < minP) return false;
  if (score.isAnecdotal) return false;
  // Dominant-speaker hard gate
  if (score.dominantSpeakerRatio >= domThresh && score.sourceStreamCount < 2) return false;
  return true;
}

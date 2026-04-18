/**
 * Domain Scoring Engine — EthentaFlow Phase 2
 *
 * Architectural principle: domain attribution is a causal problem, not a keyword
 * problem. Primary domain = where intervention lives, not where symptoms appear.
 *
 * "Customer satisfaction is dropping because the onboarding process is broken"
 * → Process primary (intervention lives there), Customer demoted by impact surface penalty
 *
 * Scoring dimensions per domain:
 *   ontology_match     — term density (root vocabulary breadth)
 *   causal_driver      — causal markers pointing INTO this domain (cause ownership)
 *   action_target      — action verbs targeting this domain (intervention ownership)
 *   problem_location   — problem/constraint signals co-occurring with domain terms
 *   cluster_continuity — speaker's recency-weighted domain history
 *   impact_surface_penalty — domain appears only as a symptom receiver, not a cause owner
 *
 * Weights deliberately favour causal ownership over surface mention.
 */

import type { DomainResult, DomainScoreBreakdown, LensPack, ThoughtFeatures } from './types';

const W = {
  ontology_match: 0.28,
  causal_driver: 0.25,
  action_target: 0.20,
  problem_location: 0.17,
  cluster_continuity: 0.10,
  impact_surface_penalty: 0.22, // subtracted — must be > action_target weight to demote symptom-only domains
};

// Minimum score for a domain to be considered relevant
const PRIMARY_THRESHOLD = 0.12;
// Gap between primary and secondary for high confidence
const HIGH_CONFIDENCE_GAP = 0.18;
// Max secondary domain score allowed to call it secondary (must be meaningfully present)
const SECONDARY_FLOOR = 0.08;

export interface DomainCluster {
  weights: Record<string, number>; // domain_id → recency-weighted score (0–1)
}

export function createDomainCluster(): DomainCluster {
  return { weights: {} };
}

export function updateDomainCluster(cluster: DomainCluster, primaryDomainId: string | null): DomainCluster {
  // Decay all existing weights
  const decayed: Record<string, number> = {};
  for (const [id, w] of Object.entries(cluster.weights)) {
    const d = w * 0.80;
    if (d > 0.01) decayed[id] = d;
  }
  // Boost the committed domain
  if (primaryDomainId) {
    decayed[primaryDomainId] = Math.min((decayed[primaryDomainId] ?? 0) + 0.35, 1.0);
  }
  return { weights: decayed };
}

export function scoreDomains(
  features: ThoughtFeatures,
  lensPack: LensPack,
  cluster: DomainCluster,
): DomainResult {
  const text_lower = features.has_business_object ? 'dummy' : ''; // features already extracted
  void text_lower; // unused — we work from pre-extracted features

  const domain_scores: Record<string, number> = {};
  const score_breakdown: Record<string, DomainScoreBreakdown> = {};
  const evidence: Record<string, string[]> = {};

  const total_domain_hits_all = Object.values(features.domain_term_hits).reduce((a, b) => a + b, 0);

  for (const domain of lensPack.domains) {
    const hits = features.domain_term_hits[domain.id] ?? 0;
    const ev: string[] = [];

    // ── ontology_match ───────────────────────────────────────────────────────
    // Normalise against the domain's vocabulary size so large domains don't
    // win by sheer vocabulary breadth.
    const vocab_size = domain.synonyms.length + domain.ontology_terms.length + domain.business_objects.length;
    const ontology_match = vocab_size > 0 ? Math.min(hits / Math.sqrt(vocab_size) * 2.5, 1.0) : 0;
    if (hits > 0) ev.push(`${hits} ontology hits`);

    // ── causal_driver ────────────────────────────────────────────────────────
    // Only counts if the text contains a causal signal (because, due to, stems from, etc.)
    // AND this domain has causal marker vocabulary present.
    let causal_driver = 0;
    if (features.causal_signal_score > 0) {
      // We rely on domain_term_hits already counting causal_markers — extract share
      const causal_vocab = domain.causal_markers.length;
      if (causal_vocab > 0 && hits > 0) {
        // Estimate: assume 30% of hits are causal markers (conservative)
        const causal_hit_estimate = hits * 0.3;
        causal_driver = Math.min(causal_hit_estimate / Math.sqrt(causal_vocab) * 2.0, 1.0);
        causal_driver *= features.causal_signal_score; // scale by actual causal signal strength
        if (causal_driver > 0.1) ev.push(`causal driver (${causal_driver.toFixed(2)})`);
      }
    }

    // ── action_target ────────────────────────────────────────────────────────
    // Action verbs in the text that target this domain's intervention vocabulary.
    let action_target = 0;
    if (features.action_signal_score > 0 && hits > 0) {
      const action_vocab = domain.action_targets.length;
      if (action_vocab > 0) {
        action_target = Math.min(hits * 0.25 / Math.sqrt(action_vocab) * 2.0, 1.0);
        action_target *= features.action_signal_score;
        if (action_target > 0.1) ev.push(`action target (${action_target.toFixed(2)})`);
      }
    }

    // ── problem_location ─────────────────────────────────────────────────────
    // Problem / constraint signals co-occurring with this domain's terms.
    // This weights domains where a problem is being reported.
    const problem_signal = Math.max(
      features.problem_signal_score,
      features.constraint_signal_score,
    );
    const problem_location = ontology_match * problem_signal;
    if (problem_location > 0.1) ev.push(`problem signal (${problem_signal.toFixed(2)})`);

    // ── cluster_continuity ───────────────────────────────────────────────────
    const cluster_continuity = cluster.weights[domain.id] ?? 0;
    if (cluster_continuity > 0.1) ev.push(`cluster continuity (${cluster_continuity.toFixed(2)})`);

    // ── impact_surface_penalty ───────────────────────────────────────────────
    // Penalise domains that appear only via their impact surfaces (symptom receivers).
    // Impact surfaces are downstream effects — they do not indicate causal ownership.
    // A domain scores a penalty when:
    //   - it has a non-zero hit count (mentioned), BUT
    //   - the hits are predominantly from impact_surfaces vocabulary, not ontology/causal terms
    //   - AND another domain has stronger causal/action signals
    let impact_surface_penalty = 0;
    if (hits > 0 && total_domain_hits_all > 0) {
      const share = hits / total_domain_hits_all;
      // If this domain's share is dominated by impact surface terms relative to
      // its ontology contribution, apply a penalty
      const impact_surface_density = domain.impact_surfaces.length > 0
        ? Math.min(domain.impact_surfaces.length / (vocab_size + 1), 0.4)
        : 0;
      // Scale penalty: high when low ontology match but moderate hit count (surface mention)
      const symptom_ratio = ontology_match < 0.3 && share > 0.1 ? (0.3 - ontology_match) * impact_surface_density * 3.0 : 0;
      impact_surface_penalty = Math.min(symptom_ratio, 0.8);
      if (impact_surface_penalty > 0.15) ev.push(`impact surface penalty (${impact_surface_penalty.toFixed(2)})`);
    }

    // ── final score ──────────────────────────────────────────────────────────
    const raw =
      W.ontology_match * ontology_match +
      W.causal_driver * causal_driver +
      W.action_target * action_target +
      W.problem_location * problem_location +
      W.cluster_continuity * cluster_continuity -
      W.impact_surface_penalty * impact_surface_penalty;

    const final = Math.max(0, Math.min(raw, 1.0));

    domain_scores[domain.id] = final;
    score_breakdown[domain.id] = {
      problem_location,
      causal_driver,
      action_target,
      ontology_match,
      cluster_continuity,
      impact_surface_penalty,
      final,
    };
    evidence[domain.id] = ev;
  }

  // ── Pick primary and secondary ───────────────────────────────────────────
  const sorted = Object.entries(domain_scores)
    .filter(([, s]) => s >= PRIMARY_THRESHOLD)
    .sort(([, a], [, b]) => b - a);

  const primary_domain = sorted[0]?.[0] ?? null;
  const second = sorted[1];
  const secondary_domain = second && second[1] >= SECONDARY_FLOOR ? second[0] : null;

  // ── Confidence ─────────────────────────────────────────────────────────
  let confidence = 0;
  if (primary_domain) {
    const primaryScore = domain_scores[primary_domain] ?? 0;
    const secondaryScore = secondary_domain ? (domain_scores[secondary_domain] ?? 0) : 0;
    const gap = primaryScore - secondaryScore;
    if (gap >= HIGH_CONFIDENCE_GAP) {
      confidence = 0.85 + (primaryScore * 0.15);
    } else if (gap >= 0.08) {
      confidence = 0.60 + (gap / HIGH_CONFIDENCE_GAP) * 0.25;
    } else {
      confidence = 0.35 + (primaryScore * 0.25); // tied — low confidence
    }
    confidence = Math.min(confidence, 1.0);
  }

  // ── Decision path trace ──────────────────────────────────────────────────
  let decision_path = 'no domain signal';
  if (primary_domain) {
    const bd = score_breakdown[primary_domain];
    const signals: string[] = [];
    if (bd) {
      if (bd.ontology_match > 0.2) signals.push(`ontology(${bd.ontology_match.toFixed(2)})`);
      if (bd.causal_driver > 0.1) signals.push(`causal(${bd.causal_driver.toFixed(2)})`);
      if (bd.action_target > 0.1) signals.push(`action(${bd.action_target.toFixed(2)})`);
      if (bd.problem_location > 0.1) signals.push(`problem(${bd.problem_location.toFixed(2)})`);
      if (bd.cluster_continuity > 0.1) signals.push(`cluster(${bd.cluster_continuity.toFixed(2)})`);
      if (bd.impact_surface_penalty > 0.15) signals.push(`-surface(${bd.impact_surface_penalty.toFixed(2)})`);
    }
    decision_path = `${primary_domain}[${signals.join(',')}] conf=${confidence.toFixed(2)}`;
    if (secondary_domain) decision_path += ` | secondary=${secondary_domain}`;
  }

  return {
    primary_domain,
    secondary_domain,
    domain_scores,
    score_breakdown,
    confidence,
    evidence,
    decision_path,
  };
}

/**
 * Map a domain_id from the lens pack to the LiveDomain values used by
 * the rest of the platform (hemisphere, agentic analysis, etc.)
 *
 * Kept separate from the scorer so the scorer stays platform-agnostic.
 */
export function domainIdToLiveDomain(domainId: string | null): string {
  if (!domainId) return 'General';
  const map: Record<string, string> = {
    people: 'People',
    process: 'Process',
    technology: 'Technology',
    organisation: 'Organisation',
    customer: 'Customer',
    commercial: 'Commercial',
    compliance: 'Compliance',
  };
  return map[domainId] ?? 'General';
}

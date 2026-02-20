/**
 * Lens Projector — Projects cognitive state into the 7 output lenses
 *
 * Each lens is a LIVE projection of the cognitive state. As beliefs
 * form and stabilise, the lenses update automatically. By the time
 * the session ends, the report is already written.
 *
 * Lenses:
 * 1. Discovery — All stabilised beliefs organised by domain
 * 2. Reimagine — Aspirations and opportunities (visionary/opportunity beliefs)
 * 3. Constraints — Constraints and risks with contradiction context
 * 4. PotentialSolution — Enablers and actions
 * 5. CustomerJourney — Actor network and interactions
 * 6. Commercial — Business-value beliefs (commercial relevance)
 * 7. Summary — Cross-domain high-confidence beliefs
 */

import type { CognitiveState, Belief, Domain, TrackedActor, ActiveContradiction } from './cognitive-state';
import { ALL_DOMAINS } from './cognitive-state';

// ══════════════════════════════════════════════════════════════
// LENS OUTPUT TYPES
// ══════════════════════════════════════════════════════════════

export type LensBeliefItem = {
  beliefId: string;
  label: string;
  confidence: number;
  evidenceCount: number;
  stabilised: boolean;
  domains: Array<{ domain: Domain; relevance: number }>;
};

export type DomainGroup = {
  domain: Domain;
  beliefs: LensBeliefItem[];
};

export type DiscoveryLens = {
  type: 'discovery';
  domainGroups: DomainGroup[];
  totalBeliefs: number;
  stabilisedCount: number;
};

export type ReimageLens = {
  type: 'reimagine';
  aspirations: LensBeliefItem[];
  opportunities: LensBeliefItem[];
};

export type ConstraintsLens = {
  type: 'constraints';
  constraints: LensBeliefItem[];
  risks: LensBeliefItem[];
  activeContradictions: Array<{
    id: string;
    beliefA: string;
    beliefB: string;
    resolved: boolean;
    resolution: string | null;
  }>;
};

export type PotentialSolutionLens = {
  type: 'potentialSolution';
  enablers: LensBeliefItem[];
  actions: LensBeliefItem[];
};

export type CustomerJourneyLens = {
  type: 'customerJourney';
  actors: Array<{
    name: string;
    role: string;
    mentionCount: number;
    interactions: Array<{
      withActor: string;
      action: string;
      sentiment: string;
      context: string;
    }>;
  }>;
};

export type CommercialLens = {
  type: 'commercial';
  businessBeliefs: LensBeliefItem[];
};

export type SummaryLens = {
  type: 'summary';
  topBeliefs: LensBeliefItem[];
  domainCoverage: Array<{ domain: Domain; beliefCount: number; avgConfidence: number }>;
  sessionStats: {
    totalUtterances: number;
    totalBeliefs: number;
    stabilisedBeliefs: number;
    activeContradictions: number;
    resolvedContradictions: number;
    dominantDomain: Domain | null;
    overallSentiment: string;
  };
};

export type AllLenses = {
  discovery: DiscoveryLens;
  reimagine: ReimageLens;
  constraints: ConstraintsLens;
  potentialSolution: PotentialSolutionLens;
  customerJourney: CustomerJourneyLens;
  commercial: CommercialLens;
  summary: SummaryLens;
};

// ══════════════════════════════════════════════════════════════
// PROJECTION FUNCTIONS
// ══════════════════════════════════════════════════════════════

function toBeliefItem(belief: Belief): LensBeliefItem {
  return {
    beliefId: belief.id,
    label: belief.label,
    confidence: belief.confidence,
    evidenceCount: belief.evidenceCount,
    stabilised: belief.stabilised,
    domains: belief.domains,
  };
}

function beliefsOfCategory(state: CognitiveState, ...categories: string[]): Belief[] {
  return Array.from(state.beliefs.values())
    .filter(b => categories.includes(b.category))
    .sort((a, b) => b.confidence - a.confidence);
}

function beliefsForDomain(state: CognitiveState, domain: Domain): Belief[] {
  return Array.from(state.beliefs.values())
    .filter(b => b.domains.some(d => d.domain === domain && d.relevance >= 0.3))
    .sort((a, b) => b.confidence - a.confidence);
}

// ── Discovery ───────────────────────────────────────────────

function projectDiscovery(state: CognitiveState): DiscoveryLens {
  const allBeliefs = Array.from(state.beliefs.values());
  const domainGroups: DomainGroup[] = ALL_DOMAINS.map(domain => ({
    domain,
    beliefs: beliefsForDomain(state, domain).map(toBeliefItem),
  })).filter(g => g.beliefs.length > 0);

  return {
    type: 'discovery',
    domainGroups,
    totalBeliefs: allBeliefs.length,
    stabilisedCount: allBeliefs.filter(b => b.stabilised).length,
  };
}

// ── Reimagine ───────────────────────────────────────────────

function projectReimagine(state: CognitiveState): ReimageLens {
  return {
    type: 'reimagine',
    aspirations: beliefsOfCategory(state, 'aspiration').map(toBeliefItem),
    opportunities: beliefsOfCategory(state, 'opportunity').map(toBeliefItem),
  };
}

// ── Constraints ─────────────────────────────────────────────

function projectConstraints(state: CognitiveState): ConstraintsLens {
  const activeContradictions = Array.from(state.contradictions.values()).map(c => {
    const beliefA = state.beliefs.get(c.beliefAId);
    const beliefB = state.beliefs.get(c.beliefBId);
    return {
      id: c.id,
      beliefA: beliefA?.label || 'Unknown',
      beliefB: beliefB?.label || 'Unknown',
      resolved: !!c.resolvedAtMs,
      resolution: c.resolution,
    };
  });

  return {
    type: 'constraints',
    constraints: beliefsOfCategory(state, 'constraint').map(toBeliefItem),
    risks: beliefsOfCategory(state, 'risk').map(toBeliefItem),
    activeContradictions,
  };
}

// ── Potential Solution ──────────────────────────────────────

function projectPotentialSolution(state: CognitiveState): PotentialSolutionLens {
  return {
    type: 'potentialSolution',
    enablers: beliefsOfCategory(state, 'enabler').map(toBeliefItem),
    actions: beliefsOfCategory(state, 'action').map(toBeliefItem),
  };
}

// ── Customer Journey ────────────────────────────────────────

function projectCustomerJourney(state: CognitiveState): CustomerJourneyLens {
  const actors = Array.from(state.actors.values())
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 20)
    .map(a => ({
      name: a.name,
      role: a.role,
      mentionCount: a.mentionCount,
      interactions: a.interactions.slice(-10).map(i => ({
        withActor: i.withActor,
        action: i.action,
        sentiment: i.sentiment,
        context: i.context,
      })),
    }));

  return {
    type: 'customerJourney',
    actors,
  };
}

// ── Commercial ──────────────────────────────────────────────

function projectCommercial(state: CognitiveState): CommercialLens {
  // Commercial beliefs: opportunities, actions, and enablers with
  // relevance to Customer or Operations domains
  const businessBeliefs = Array.from(state.beliefs.values())
    .filter(b => {
      const isCommercialCategory = ['opportunity', 'action', 'enabler'].includes(b.category);
      const hasBusinessDomain = b.domains.some(
        d => (d.domain === 'Customer' || d.domain === 'Operations') && d.relevance >= 0.4
      );
      return isCommercialCategory && hasBusinessDomain;
    })
    .sort((a, b) => b.confidence - a.confidence)
    .map(toBeliefItem);

  return {
    type: 'commercial',
    businessBeliefs,
  };
}

// ── Summary ─────────────────────────────────────────────────

function projectSummary(state: CognitiveState): SummaryLens {
  const allBeliefs = Array.from(state.beliefs.values());
  const topBeliefs = allBeliefs
    .filter(b => b.confidence >= 0.4 || b.stabilised)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15)
    .map(toBeliefItem);

  // Domain coverage
  const domainCoverage = ALL_DOMAINS.map(domain => {
    const domainBeliefs = beliefsForDomain(state, domain);
    const avgConfidence = domainBeliefs.length > 0
      ? domainBeliefs.reduce((sum, b) => sum + b.confidence, 0) / domainBeliefs.length
      : 0;
    return { domain, beliefCount: domainBeliefs.length, avgConfidence };
  }).filter(d => d.beliefCount > 0);

  // Find dominant domain
  const dominantDomain = domainCoverage.length > 0
    ? domainCoverage.sort((a, b) => b.beliefCount - a.beliefCount)[0].domain
    : null;

  const activeContradictions = Array.from(state.contradictions.values()).filter(c => !c.resolvedAtMs);
  const resolvedContradictions = Array.from(state.contradictions.values()).filter(c => !!c.resolvedAtMs);

  return {
    type: 'summary',
    topBeliefs,
    domainCoverage,
    sessionStats: {
      totalUtterances: state.processedUtteranceCount,
      totalBeliefs: allBeliefs.length,
      stabilisedBeliefs: allBeliefs.filter(b => b.stabilised).length,
      activeContradictions: activeContradictions.length,
      resolvedContradictions: resolvedContradictions.length,
      dominantDomain,
      overallSentiment: state.momentum.currentSentiment,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// MAIN PROJECTOR — Projects all lenses from cognitive state
// ══════════════════════════════════════════════════════════════

export function projectAllLenses(state: CognitiveState): AllLenses {
  return {
    discovery: projectDiscovery(state),
    reimagine: projectReimagine(state),
    constraints: projectConstraints(state),
    potentialSolution: projectPotentialSolution(state),
    customerJourney: projectCustomerJourney(state),
    commercial: projectCommercial(state),
    summary: projectSummary(state),
  };
}

/**
 * Project a single lens (for targeted updates).
 */
export function projectLens(state: CognitiveState, lens: keyof AllLenses): AllLenses[keyof AllLenses] {
  switch (lens) {
    case 'discovery': return projectDiscovery(state);
    case 'reimagine': return projectReimagine(state);
    case 'constraints': return projectConstraints(state);
    case 'potentialSolution': return projectPotentialSolution(state);
    case 'customerJourney': return projectCustomerJourney(state);
    case 'commercial': return projectCommercial(state);
    case 'summary': return projectSummary(state);
  }
}

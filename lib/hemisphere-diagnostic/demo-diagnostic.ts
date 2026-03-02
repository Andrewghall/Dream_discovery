/**
 * Demo diagnostic data for the retail-cx-workshop.
 *
 * Provides instant-loading HemisphereDiagnostic constants so the
 * "Psyche Diagnostic" tab works out-of-the-box on the retail demo
 * without requiring the API to build a graph from real DB sessions.
 *
 * Pattern: same as DEMO_DISCOVER_ANALYSIS in the Discovery page.
 */

import type {
  HemisphereDiagnostic,
  DiagnosticDelta,
} from '@/lib/types/hemisphere-diagnostic';

// ──────────────────────────────────────────────────────────────
// "Before" — Discovery baseline
// ──────────────────────────────────────────────────────────────

export const DEMO_DIAGNOSTIC_BEFORE: HemisphereDiagnostic = {
  workshopId: 'retail-cx-workshop',
  generatedAt: '2025-11-15T10:30:00Z',
  snapshotId: null,
  nodeCount: 312,
  edgeCount: 487,

  sentimentIndex: {
    domains: [
      {
        domain: 'People',
        creativeDensity: 42,
        constraintDensity: 31,
        redesignEnergy: 6,
        challengeIntensity: 0.45,
        riskWeight: 0.28,
        nodeCount: 67,
        dominantType: 'BELIEF',
        sentimentLabel: 'balanced',
      },
      {
        domain: 'Operations',
        creativeDensity: 28,
        constraintDensity: 48,
        redesignEnergy: 3,
        challengeIntensity: 0.62,
        riskWeight: 0.51,
        nodeCount: 74,
        dominantType: 'CONSTRAINT',
        sentimentLabel: 'constraint-heavy',
      },
      {
        domain: 'Customer',
        creativeDensity: 61,
        constraintDensity: 18,
        redesignEnergy: 9,
        challengeIntensity: 0.33,
        riskWeight: 0.15,
        nodeCount: 82,
        dominantType: 'VISION',
        sentimentLabel: 'innovation-led',
      },
      {
        domain: 'Technology',
        creativeDensity: 35,
        constraintDensity: 44,
        redesignEnergy: 7,
        challengeIntensity: 0.58,
        riskWeight: 0.46,
        nodeCount: 58,
        dominantType: 'CHALLENGE',
        sentimentLabel: 'risk-aware',
      },
      {
        domain: 'Regulation',
        creativeDensity: 12,
        constraintDensity: 65,
        redesignEnergy: 1,
        challengeIntensity: 0.71,
        riskWeight: 0.63,
        nodeCount: 31,
        dominantType: 'CONSTRAINT',
        sentimentLabel: 'constraint-heavy',
      },
    ],
    overallCreative: 38,
    overallConstraint: 39,
    balanceLabel: 'fragmented',
  },

  biasDetection: {
    contributionBalance: [
      { actor: 'Sarah Chen', share: 0.14, normalisedShare: 0.08, mentionCount: 44 },
      { actor: 'James Wright', share: 0.12, normalisedShare: 0.08, mentionCount: 37 },
      { actor: 'Maria Lopez', share: 0.11, normalisedShare: 0.08, mentionCount: 34 },
      { actor: 'Andrew Thornton', share: 0.08, normalisedShare: 0.08, mentionCount: 25 },
      { actor: 'Natasha Ivanova', share: 0.09, normalisedShare: 0.08, mentionCount: 28 },
      { actor: 'David Kim', share: 0.07, normalisedShare: 0.08, mentionCount: 22 },
      { actor: 'Emma Taylor', share: 0.06, normalisedShare: 0.08, mentionCount: 19 },
      { actor: 'Tom Richards', share: 0.05, normalisedShare: 0.08, mentionCount: 16 },
      { actor: 'Lisa Patel', share: 0.04, normalisedShare: 0.08, mentionCount: 12 },
      { actor: 'Ryan O\'Brien', share: 0.06, normalisedShare: 0.08, mentionCount: 19 },
      { actor: 'Amy Zhang', share: 0.05, normalisedShare: 0.08, mentionCount: 16 },
      { actor: 'Others', share: 0.13, normalisedShare: 0.08, mentionCount: 40 },
    ],
    giniCoefficient: 0.31,
    dominantVoice: null,
    sentimentByLayer: [
      { layer: 'H1', positive: 72, concerned: 18, critical: 10 },
      { layer: 'H2', positive: 35, concerned: 45, critical: 20 },
      { layer: 'H3', positive: 22, concerned: 38, critical: 40 },
      { layer: 'H4', positive: 50, concerned: 30, critical: 20 },
    ],
    languageIntensity: [
      { actor: 'Sarah Chen', avgSeverity: 0.42, nodeCount: 44 },
      { actor: 'James Wright', avgSeverity: 0.55, nodeCount: 37 },
      { actor: 'Maria Lopez', avgSeverity: 0.48, nodeCount: 34 },
      { actor: 'Andrew Thornton', avgSeverity: 0.61, nodeCount: 25 },
      { actor: 'Lisa Patel', avgSeverity: 0.68, nodeCount: 12 },
      { actor: 'Ryan O\'Brien', avgSeverity: 0.52, nodeCount: 19 },
    ],
    overallBiasLevel: 'low',
  },

  balanceSafeguard: {
    flags: [
      {
        type: 'excess_constraint',
        severity: 'warning',
        message: 'Operations and Regulation domains are heavily constraint-weighted, limiting creative exploration of future possibilities.',
        metric: 0.48,
        threshold: 0.45,
      },
      {
        type: 'low_mobilisation',
        severity: 'info',
        message: 'Only 8% of nodes are ENABLER type — strong vision exists but enabling mechanisms are underdeveloped.',
        metric: 0.08,
        threshold: 0.10,
      },
    ],
    overallBalance: 54,
    diagnosis: 'Fragmented psyche — strong customer vision coexists with operational constraint anxiety. Enabling mechanisms are underdeveloped relative to the ambition level.',
  },

  multiLens: {
    lenses: [
      { lens: 'People', score: 62, evidence: ['Skills gap in digital literacy cited by 14 participants', 'Strong belief in team culture as differentiator'], concern: 'Workforce readiness for AI-assisted workflows' },
      { lens: 'Operations', score: 41, evidence: ['Legacy POS integration blocking omnichannel', '3 critical process bottlenecks identified'], concern: 'Operational debt constraining transformation speed' },
      { lens: 'Customer', score: 78, evidence: ['Clear personalisation vision from leadership', 'Customer journey pain points well-documented'], concern: null },
      { lens: 'Technology', score: 49, evidence: ['Data platform fragmentation across 7 systems', 'AI readiness assessed at early stage'], concern: 'Technology stack coherence needed before AI adoption' },
      { lens: 'Regulation', score: 34, evidence: ['GDPR constraints on personalisation data', 'Compliance costs cited as innovation blocker'], concern: 'Regulatory burden disproportionately limiting customer domain innovation' },
    ],
  },
};

// ──────────────────────────────────────────────────────────────
// "After" — Live session snapshot
// ──────────────────────────────────────────────────────────────

export const DEMO_DIAGNOSTIC_AFTER: HemisphereDiagnostic = {
  workshopId: 'retail-cx-workshop',
  generatedAt: '2025-12-02T14:45:00Z',
  snapshotId: 'live-snapshot-retail-001',
  nodeCount: 1019,
  edgeCount: 1847,

  sentimentIndex: {
    domains: [
      {
        domain: 'People',
        creativeDensity: 51,
        constraintDensity: 25,
        redesignEnergy: 11,
        challengeIntensity: 0.38,
        riskWeight: 0.22,
        nodeCount: 218,
        dominantType: 'VISION',
        sentimentLabel: 'innovation-led',
      },
      {
        domain: 'Operations',
        creativeDensity: 39,
        constraintDensity: 38,
        redesignEnergy: 8,
        challengeIntensity: 0.51,
        riskWeight: 0.41,
        nodeCount: 231,
        dominantType: 'CHALLENGE',
        sentimentLabel: 'balanced',
      },
      {
        domain: 'Customer',
        creativeDensity: 68,
        constraintDensity: 14,
        redesignEnergy: 14,
        challengeIntensity: 0.27,
        riskWeight: 0.11,
        nodeCount: 264,
        dominantType: 'VISION',
        sentimentLabel: 'vision-rich',
      },
      {
        domain: 'Technology',
        creativeDensity: 47,
        constraintDensity: 33,
        redesignEnergy: 12,
        challengeIntensity: 0.44,
        riskWeight: 0.35,
        nodeCount: 189,
        dominantType: 'ENABLER',
        sentimentLabel: 'balanced',
      },
      {
        domain: 'Regulation',
        creativeDensity: 19,
        constraintDensity: 55,
        redesignEnergy: 3,
        challengeIntensity: 0.63,
        riskWeight: 0.54,
        nodeCount: 117,
        dominantType: 'CONSTRAINT',
        sentimentLabel: 'constraint-heavy',
      },
    ],
    overallCreative: 47,
    overallConstraint: 31,
    balanceLabel: 'aligned',
  },

  biasDetection: {
    contributionBalance: [
      { actor: 'Sarah Chen', share: 0.11, normalisedShare: 0.08, mentionCount: 112 },
      { actor: 'James Wright', share: 0.10, normalisedShare: 0.08, mentionCount: 102 },
      { actor: 'Maria Lopez', share: 0.09, normalisedShare: 0.08, mentionCount: 92 },
      { actor: 'Andrew Thornton', share: 0.07, normalisedShare: 0.08, mentionCount: 71 },
      { actor: 'Natasha Ivanova', share: 0.08, normalisedShare: 0.08, mentionCount: 82 },
      { actor: 'David Kim', share: 0.08, normalisedShare: 0.08, mentionCount: 82 },
      { actor: 'Emma Taylor', share: 0.07, normalisedShare: 0.08, mentionCount: 71 },
      { actor: 'Tom Richards', share: 0.06, normalisedShare: 0.08, mentionCount: 61 },
      { actor: 'Lisa Patel', share: 0.06, normalisedShare: 0.08, mentionCount: 61 },
      { actor: 'Ryan O\'Brien', share: 0.07, normalisedShare: 0.08, mentionCount: 71 },
      { actor: 'Amy Zhang', share: 0.06, normalisedShare: 0.08, mentionCount: 61 },
      { actor: 'Others', share: 0.15, normalisedShare: 0.08, mentionCount: 153 },
    ],
    giniCoefficient: 0.19,
    dominantVoice: null,
    sentimentByLayer: [
      { layer: 'H1', positive: 75, concerned: 16, critical: 9 },
      { layer: 'H2', positive: 42, concerned: 40, critical: 18 },
      { layer: 'H3', positive: 31, concerned: 35, critical: 34 },
      { layer: 'H4', positive: 55, concerned: 28, critical: 17 },
    ],
    languageIntensity: [
      { actor: 'Sarah Chen', avgSeverity: 0.38, nodeCount: 112 },
      { actor: 'James Wright', avgSeverity: 0.47, nodeCount: 102 },
      { actor: 'Maria Lopez', avgSeverity: 0.41, nodeCount: 92 },
      { actor: 'Andrew Thornton', avgSeverity: 0.53, nodeCount: 71 },
      { actor: 'Lisa Patel', avgSeverity: 0.59, nodeCount: 61 },
      { actor: 'Ryan O\'Brien', avgSeverity: 0.44, nodeCount: 71 },
    ],
    overallBiasLevel: 'low',
  },

  balanceSafeguard: {
    flags: [
      {
        type: 'excess_constraint',
        severity: 'info',
        message: 'Regulation domain remains constraint-heavy, though overall balance has improved significantly.',
        metric: 0.55,
        threshold: 0.50,
      },
    ],
    overallBalance: 72,
    diagnosis: 'Organisational psyche has moved from fragmented to aligned — live session surfaced enablers that bridge the gap between customer vision and operational reality.',
  },

  multiLens: {
    lenses: [
      { lens: 'People', score: 74, evidence: ['AI upskilling programme designed with 3 implementation tracks', 'Cultural readiness assessed through frontline input'], concern: null },
      { lens: 'Operations', score: 58, evidence: ['Process redesign priorities ranked by impact/effort', 'Quick-win automation candidates identified'], concern: 'Legacy system migration timeline remains uncertain' },
      { lens: 'Customer', score: 85, evidence: ['Personalisation roadmap with privacy-first approach', 'Journey pain points mapped to specific enablers'], concern: null },
      { lens: 'Technology', score: 63, evidence: ['Data platform consolidation strategy agreed', 'AI pilot scope defined with clear success metrics'], concern: 'Integration complexity may delay pilot launch' },
      { lens: 'Regulation', score: 42, evidence: ['Compliance-by-design approach adopted', 'GDPR impact on personalisation quantified'], concern: 'Regulatory uncertainty in AI governance still a blocker' },
    ],
  },
};

// ──────────────────────────────────────────────────────────────
// Delta — Before → After comparison
// ──────────────────────────────────────────────────────────────

export const DEMO_DIAGNOSTIC_DELTA: DiagnosticDelta = {
  domainDeltas: [
    { domain: 'People', creativeDelta: 9, constraintDelta: -6, direction: 'more-creative' },
    { domain: 'Operations', creativeDelta: 11, constraintDelta: -10, direction: 'more-creative' },
    { domain: 'Customer', creativeDelta: 7, constraintDelta: -4, direction: 'more-creative' },
    { domain: 'Technology', creativeDelta: 12, constraintDelta: -11, direction: 'more-creative' },
    { domain: 'Regulation', creativeDelta: 7, constraintDelta: -10, direction: 'more-creative' },
  ],
  newDomainsAppeared: [],
  balanceShift: 'Moved from fragmented to aligned — creative energy increased across all domains while constraint density decreased',
  biasChange: 'Contribution balance improved (Gini 0.31 → 0.19) — voices are more evenly distributed after live session dialogue',
  overallCreativeDelta: 9,
  overallConstraintDelta: -8,
};

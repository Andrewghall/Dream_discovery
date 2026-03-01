/**
 * Hemisphere Diagnostic — Organisational Psyche Engine
 *
 * Types for the diagnostic layer that transforms hemisphere node/edge data
 * into measurable organisational health indices:
 *   1. Sentiment Index     — creative vs constraint density per domain
 *   2. Bias Detection      — contribution balance, dominant voices, layer divergence
 *   3. Balance Safeguard   — pattern-matched flags for systemic imbalances
 *   4. Multi-Lens Analysis  — theme x lens scoring matrix
 */

// Re-export hemisphere primitives used throughout diagnostic code
export type NodeType =
  | 'VISION'
  | 'BELIEF'
  | 'CHALLENGE'
  | 'FRICTION'
  | 'CONSTRAINT'
  | 'ENABLER'
  | 'EVIDENCE';

export type HemisphereLayer = 'H1' | 'H2' | 'H3' | 'H4';

export interface HemisphereNodeSource {
  sessionId: string;
  participantName: string;
}

export interface HemisphereNodeEvidence {
  quote?: string;
  qaTag?: string;
  createdAt?: string;
  chunkId?: string;
}

export interface HemisphereNode {
  id: string;
  type: NodeType;
  label: string;
  summary?: string;
  phaseTags: string[];
  layer: HemisphereLayer;
  weight: number;
  severity?: number;
  confidence?: number;
  sources: HemisphereNodeSource[];
  evidence?: HemisphereNodeEvidence[];
}

export interface HemisphereEdge {
  id: string;
  source: string;
  target: string;
  strength: number;
  kind: 'EQUIVALENT' | 'REINFORCING' | 'DERIVATIVE';
}

// ──────────────────────────────────────────────────────────────
// 1. Sentiment Index
// ──────────────────────────────────────────────────────────────

export type SentimentLabel =
  | 'innovation-led'
  | 'constraint-heavy'
  | 'balanced'
  | 'risk-aware'
  | 'vision-rich';

export interface DomainSentimentScore {
  /** Domain name (e.g. "People", "Technology") */
  domain: string;
  /** % of nodes classified as creative (VISION + BELIEF + ENABLER) */
  creativeDensity: number;
  /** % of nodes classified as constraint (CONSTRAINT + FRICTION) */
  constraintDensity: number;
  /** Cross-domain edge count for ENABLER nodes — indicates redesign energy */
  redesignEnergy: number;
  /** Average severity of CHALLENGE + FRICTION nodes (0-1) */
  challengeIntensity: number;
  /** CONSTRAINT severity x frequency weight (0-1) */
  riskWeight: number;
  /** Total nodes in this domain */
  nodeCount: number;
  /** Dominant node type in this domain */
  dominantType: NodeType;
  /** Derived label from creative/constraint ratio */
  sentimentLabel: SentimentLabel;
}

export interface SentimentIndex {
  /** Per-domain sentiment scores */
  domains: DomainSentimentScore[];
  /** Overall creative density across all domains (0-100) */
  overallCreative: number;
  /** Overall constraint density across all domains (0-100) */
  overallConstraint: number;
  /** Composite balance label derived from overall ratios */
  balanceLabel:
    | 'expansive'
    | 'defensive'
    | 'fragmented'
    | 'aligned'
    | 'risk-dominated'
    | 'innovation-dominated';
}

// ──────────────────────────────────────────────────────────────
// 2. Bias Detection
// ──────────────────────────────────────────────────────────────

export interface ActorContribution {
  /** Participant name */
  actor: string;
  /** Share of total nodes attributed to this actor (0-1) */
  share: number;
  /** Absolute node count */
  mentionCount: number;
}

export interface LayerSentiment {
  /** Hemisphere layer */
  layer: HemisphereLayer;
  /** % of nodes with positive sentiment (VISION, BELIEF, ENABLER) */
  positive: number;
  /** % of nodes with concerned sentiment (CHALLENGE, FRICTION) */
  concerned: number;
  /** % of nodes with critical sentiment (CONSTRAINT) */
  critical: number;
}

export interface ActorLanguageIntensity {
  /** Participant name */
  actor: string;
  /** Average severity of nodes attributed to this actor */
  avgSeverity: number;
  /** Number of nodes */
  nodeCount: number;
}

export interface BiasDetection {
  /** Contribution balance per actor */
  contributionBalance: ActorContribution[];
  /** Gini coefficient (0 = perfectly balanced, 1 = single voice) */
  giniCoefficient: number;
  /** Dominant voice if any actor has >40% share */
  dominantVoice: { name: string; share: number } | null;
  /** Sentiment distribution by hemisphere layer */
  sentimentByLayer: LayerSentiment[];
  /** Language intensity (severity) per actor */
  languageIntensity: ActorLanguageIntensity[];
  /** Overall bias assessment */
  overallBiasLevel: 'low' | 'moderate' | 'significant';
}

// ──────────────────────────────────────────────────────────────
// 3. Balance Safeguard
// ──────────────────────────────────────────────────────────────

export type SafeguardFlagType =
  | 'excess_imagination'
  | 'excess_constraint'
  | 'low_mobilisation'
  | 'missing_domain'
  | 'single_voice_dominance'
  | 'layer_imbalance';

export type SafeguardSeverity = 'info' | 'warning' | 'critical';

export interface SafeguardFlag {
  /** Classification of the imbalance */
  type: SafeguardFlagType;
  /** How serious this flag is */
  severity: SafeguardSeverity;
  /** Human-readable description */
  message: string;
  /** The metric value that triggered this flag */
  metric: number;
  /** The threshold that was breached */
  threshold: number;
}

export interface BalanceSafeguard {
  /** Active safeguard flags */
  flags: SafeguardFlag[];
  /** Composite balance score (0-100, higher = more balanced) */
  overallBalance: number;
  /** One-sentence diagnosis of the organisational balance */
  diagnosis: string;
}

// ──────────────────────────────────────────────────────────────
// 4. Multi-Lens Analysis
// ──────────────────────────────────────────────────────────────

export interface LensScore {
  /** Lens / dimension name (e.g. "People", "Technology") */
  lens: string;
  /** Composite score (0-100) derived from node types, severity, edge density */
  score: number;
  /** Key evidence points supporting this score */
  evidence: string[];
  /** Primary concern surfaced by this lens (if any) */
  concern: string | null;
}

export interface MultiLensAnalysis {
  /** Per-lens scores and evidence */
  lenses: LensScore[];
}

// ──────────────────────────────────────────────────────────────
// Composite: Full Hemisphere Diagnostic
// ──────────────────────────────────────────────────────────────

export interface HemisphereDiagnostic {
  workshopId: string;
  generatedAt: string;
  /** Identifier for snapshot (null for Discovery baseline) */
  snapshotId: string | null;
  /** Total nodes analysed */
  nodeCount: number;
  /** Total edges analysed */
  edgeCount: number;

  /** 1. Sentiment Index */
  sentimentIndex: SentimentIndex;
  /** 2. Bias Detection */
  biasDetection: BiasDetection;
  /** 3. Balance Safeguard */
  balanceSafeguard: BalanceSafeguard;
  /** 4. Multi-Lens Analysis */
  multiLens: MultiLensAnalysis;
}

// ──────────────────────────────────────────────────────────────
// Before/After Delta
// ──────────────────────────────────────────────────────────────

export interface DomainDelta {
  domain: string;
  /** Change in creative density (after - before) */
  creativeDelta: number;
  /** Change in constraint density (after - before) */
  constraintDelta: number;
  /** Net direction of movement */
  direction: 'more-creative' | 'more-constrained' | 'stable';
}

export interface DiagnosticDelta {
  /** Per-domain movement between before and after */
  domainDeltas: DomainDelta[];
  /** Domains that appeared only in the "after" diagnostic */
  newDomainsAppeared: string[];
  /** Human-readable description of balance shift */
  balanceShift: string;
  /** Human-readable description of bias change */
  biasChange: string;
  /** Overall creative density delta */
  overallCreativeDelta: number;
  /** Overall constraint density delta */
  overallConstraintDelta: number;
}

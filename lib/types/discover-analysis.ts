/**
 * Discover Analysis — Organisational Truth Engine
 *
 * Types for the 5 analytical components of the Discover Analysis dashboard:
 *   1. Alignment Heatmap   — actor x theme alignment/divergence
 *   2. Tension Surface      — ranked unresolved tensions
 *   3. Narrative Divergence  — language differences across organisational layers
 *   4. Constraint Map        — weighted constraints and dependencies
 *   5. Confidence Index      — certainty/hedging/uncertainty distribution
 */

// ──────────────────────────────────────────────────────────────
// 1. Alignment Heatmap
// ──────────────────────────────────────────────────────────────

export interface AlignmentCell {
  theme: string;
  actor: string;
  /** -1 (strong divergence) → 0 (neutral) → +1 (strong alignment) */
  alignmentScore: number;
  /** Distribution of positive/negative/neutral sentiment for this cell */
  sentimentBalance: {
    positive: number;
    negative: number;
    neutral: number;
  };
  /** Number of utterances contributing to this cell — indicates confidence */
  utteranceCount: number;
  /** Representative quotes for tooltip / drill-down */
  sampleQuotes: string[];
}

export interface AlignmentHeatmapData {
  /** Themes on Y-axis (sorted by total utterance count desc) */
  themes: string[];
  /** Actors on X-axis (sorted by total utterance count desc) */
  actors: string[];
  /** Flat array of cells — one per theme×actor pair that has data */
  cells: AlignmentCell[];
}

// ──────────────────────────────────────────────────────────────
// 2. Tension Surface
// ──────────────────────────────────────────────────────────────

export interface TensionViewpoint {
  actor: string;
  position: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  evidenceQuote: string;
}

export interface TensionEntry {
  id: string;
  topic: string;
  rank: number;
  /** Deterministic score: SeverityWeight x DivergenceVariance x CrossActorSpread */
  tensionIndex: number;
  /** 'critical' | 'significant' | 'moderate' */
  severity: 'critical' | 'significant' | 'moderate';
  /** Competing viewpoints from different actors */
  viewpoints: TensionViewpoint[];
  /** Actors affected by this tension */
  affectedActors: string[];
  /** Constraint IDs related to this tension */
  relatedConstraints: string[];
  /** Primary domain this tension relates to */
  domain: string;
}

export interface TensionSurfaceData {
  tensions: TensionEntry[];
}

// ──────────────────────────────────────────────────────────────
// 3. Narrative Divergence
// ──────────────────────────────────────────────────────────────

export type NarrativeLayer = 'executive' | 'operational' | 'frontline';

export interface ParticipantLayerAssignment {
  participantId: string;
  name: string;
  role: string | null;
  department: string | null;
  layer: NarrativeLayer;
  /** AI confidence in this classification (0-1) */
  confidence: number;
  /** Short AI explanation for why this role was classified this way */
  aiReason: string;
  /** Whether this was manually overridden by a facilitator */
  isOverridden: boolean;
}

export interface TermFrequency {
  term: string;
  count: number;
  /** Normalised frequency (0-1) relative to max in this layer */
  normalised: number;
}

export interface NarrativeLayerData {
  layer: NarrativeLayer;
  participantCount: number;
  topTerms: TermFrequency[];
  dominantSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  temporalFocus: {
    past: number;
    present: number;
    future: number;
  };
  samplePhrases: string[];
}

export interface DivergencePoint {
  topic: string;
  /** What each layer says about this topic */
  layerPositions: {
    layer: NarrativeLayer;
    language: string;
    sentiment: string;
  }[];
}

export interface NarrativeDivergenceData {
  /** AI-classified layer assignments with override support */
  layerAssignments: ParticipantLayerAssignment[];
  /** Aggregated data per layer */
  layers: NarrativeLayerData[];
  /** Points where layers diverge on the same topic */
  divergencePoints: DivergencePoint[];
}

// ──────────────────────────────────────────────────────────────
// 4. Constraint Map
// ──────────────────────────────────────────────────────────────

export interface ConstraintNode {
  id: string;
  description: string;
  domain: string;
  /** How often this constraint was mentioned */
  frequency: number;
  severity: 'critical' | 'significant' | 'moderate';
  /** Computed weight: frequency × severity multiplier */
  weight: number;
  /** IDs of constraints this one depends on */
  dependsOn: string[];
  /** IDs of constraints this one blocks */
  blocks: string[];
}

export interface ConstraintRelationship {
  source: string;
  target: string;
  type: 'depends_on' | 'blocks' | 'amplifies';
}

export interface ConstraintMapData {
  constraints: ConstraintNode[];
  relationships: ConstraintRelationship[];
}

// ──────────────────────────────────────────────────────────────
// 5. Confidence Index
// ──────────────────────────────────────────────────────────────

export interface ConfidenceDistribution {
  /** Count of data points classified as certain (confidence > 0.8) */
  certain: number;
  /** Count of data points classified as hedging (0.5-0.8 with uncertainties) */
  hedging: number;
  /** Count of data points classified as uncertain (< 0.5) */
  uncertain: number;
}

export interface ConfidenceByDomain {
  domain: string;
  distribution: ConfidenceDistribution;
  /** Sample hedging phrases found in this domain */
  hedgingPhrases: string[];
}

export interface ConfidenceByLayer {
  layer: NarrativeLayer;
  distribution: ConfidenceDistribution;
}

export interface ConfidenceIndexData {
  overall: ConfidenceDistribution;
  byDomain: ConfidenceByDomain[];
  byLayer: ConfidenceByLayer[];
}

// ──────────────────────────────────────────────────────────────
// Composite: Full Discover Analysis
// ──────────────────────────────────────────────────────────────

export interface DataQualityNote {
  /** Where the structural data came from */
  source: 'full_analysis' | 'interview_reports';
  /** Number of interview reports used */
  participantCount: number;
  /** Human-readable caveat shown to the facilitator */
  note: string;
}

export interface DiscoverAnalysis {
  workshopId: string;
  generatedAt: string;
  participantCount: number;
  /** 1. Alignment Heatmap data */
  alignment: AlignmentHeatmapData;
  /** 2. Tension Surface data */
  tensions: TensionSurfaceData;
  /** 3. Narrative Divergence data */
  narrative: NarrativeDivergenceData;
  /** 4. Constraint Map data */
  constraints: ConstraintMapData;
  /** 5. Confidence Index data */
  confidence: ConfidenceIndexData;
  /** Present when analysis was derived from interview reports rather than deep agentic analysis */
  dataQuality?: DataQualityNote;
}

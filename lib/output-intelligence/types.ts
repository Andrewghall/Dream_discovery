/**
 * DREAM Output Intelligence — Types
 *
 * Defines the signal aggregate (input) and all 5 engine outputs.
 */

import type { GraphIntelligence, CausalChain, EdgeTier } from '@/lib/output/relationship-graph';

// Re-export graph types so consumers can import from a single place
export type { GraphIntelligence, CausalChain, EdgeTier };

// ── Input Signal Aggregate ──────────────────────────────────────────────────

export interface WorkshopSignals {
  context: {
    workshopName: string;
    clientName: string;
    businessContext: string;
    industry: string;
    lenses: string[];
    objectives: string;
  };
  discovery: {
    themes: string[];
    tensions: Array<{ topic: string; perspectives: string[]; severity?: string }>;
    constraints: Array<{ title: string; description?: string; type?: string }>;
    alignment: number | null;        // 0-100
    narrativeDivergence: number | null;
    participantCount: number;
    insights: Array<{ text: string; type: string; category?: string }>;
    /**
     * Signals grouped by participant cohort (role group).
     * Only present when participant role data is available.
     * Enables OI agents to identify role-specific root causes and cross-cohort divergence.
     */
    cohortBreakdown?: Array<{
      cohortLabel: string;        // e.g. "Management", "Customer Ops", "Leadership"
      roles: string[];            // raw role strings that map to this cohort
      participantCount: number;
      aspirationRatio: number;    // 0-1: proportion of VISION/OPPORTUNITY/ENABLER insights
      topFrictions: string[];     // up to 3 CHALLENGE/CONSTRAINT insight texts
      topAspirations: string[];   // up to 3 VISION/OPPORTUNITY insight texts
      insightSample: Array<{ text: string; type: string }>;  // up to 8
    }>;
  };
  liveSession: {
    reimaginePads: Array<{ text: string; type?: string; lens?: string }>;
    constraintPads: Array<{ text: string; type?: string; lens?: string }>;
    defineApproachPads: Array<{ text: string; type?: string; lens?: string }>;
    journey: Array<{ stage: string; description?: string; aiScore?: number; painPoints?: string[] }>;
    hemisphereShift: number | null;  // 0-1 shift from left to right brain
  };
  scratchpad: {
    execSummary: string | null;
    potentialSolution: string | null;
    summaryContent: string | null;
  };
  /** Semantically relevant findings from past workshops in the same organisation */
  historicalMemory?: {
    chunks: Array<{ text: string; source: string; similarity: number }>;
    queryUsed: string;
  };
  /**
   * Deterministic relationship graph intelligence built from live session nodes
   * and discovery insights. Populated by signal-aggregator when snapshot data
   * contains theme-labelled nodes. Undefined when insufficient data.
   */
  graphIntelligence?: GraphIntelligence;
}

// ── Engine 1: Discovery Validation ─────────────────────────────────────────

export interface ConfirmedIssue {
  issue: string;
  discoverySignal: string;
  workshopEvidence: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface NewIssue {
  issue: string;
  workshopEvidence: string;
  significance: string;
}

export interface ReducedIssue {
  issue: string;
  reason: string;
}

export interface DiscoveryValidation {
  confirmedIssues: ConfirmedIssue[];
  newIssues: NewIssue[];
  reducedIssues: ReducedIssue[];
  hypothesisAccuracy: number | null;  // 0-100, null = insufficient evidence
  summary: string;
}

// ── Engine 2: Root Cause Intelligence ──────────────────────────────────────

export interface RootCause {
  rank: number;
  cause: string;
  category: string;
  journeyStages: string[];
  affectedLenses: string[];
  evidence: string[];
  severity: 'critical' | 'significant' | 'moderate';
}

export interface FrictionPoint {
  stage: string;
  frictionLevel: number;   // 0-10
  primaryCause: string;
}

export interface RootCauseIntelligence {
  rootCauses: RootCause[];
  systemicPattern: string;
  frictionMap: FrictionPoint[];
}

// ── Engine 3: Future State Design ──────────────────────────────────────────

export interface AiHumanTask {
  task: string;
  recommendation: 'AI Only' | 'AI Assisted' | 'Human Only';
  rationale: string;
}

export interface OperatingModelChange {
  area: string;
  currentState: string;
  futureState: string;
  enabler: string;
}

export interface FutureStateDesign {
  targetOperatingModel: string;
  aiHumanModel: AiHumanTask[];
  operatingModelChanges: OperatingModelChange[];
  redesignPrinciples: string[];
  narrative: string;
}

// ── Engine 4: Execution Roadmap ─────────────────────────────────────────────

export interface RoadmapInitiative {
  title: string;
  description: string;
  outcome: string;
}

export interface RoadmapPhase {
  phase: 'Phase 1 — Immediate Enablement' | 'Phase 2 — Structural Transformation' | 'Phase 3 — Advanced Automation';
  timeframe: string;
  initiatives: RoadmapInitiative[];
  capabilities: string[];
  dependencies: string[];
  constraints: string[];
}

export interface ExecutionRoadmap {
  phases: RoadmapPhase[];
  criticalPath: string;
  keyRisks: string[];
}

// ── Engine 5: Strategic Impact ──────────────────────────────────────────────

export interface ImpactBucket {
  percentage: number;
  description: string;
}

export interface EfficiencyGain {
  metric: string;
  estimated: string;
  basis: string;
}

export interface ExperienceImprovement {
  dimension: string;
  currentState: string;
  futureState: string;
  impact: string;
}

export interface StrategicImpact {
  automationPotential: ImpactBucket | null;
  aiAssistedWork: ImpactBucket | null;
  humanOnlyWork: ImpactBucket | null;
  efficiencyGains: EfficiencyGain[];
  experienceImprovements: ExperienceImprovement[];
  businessCaseSummary: string;
  confidenceScore: number | null;  // 0-100, null = insufficient evidence
}

// ── Causal Intelligence (graph-backed) ────────────────────────────────────────

/**
 * A single board-facing finding derived from relationship graph evidence.
 * Every field is traceable to specific graph nodes, edges, or intelligence outputs.
 */
export interface CausalFinding {
  findingId: string;
  /**
   * ORGANISATIONAL_ISSUE  — bottleneck or high-risk compensating behaviour; gate ≥ REINFORCED
   * REINFORCED_FINDING    — multi-participant, multi-lens pattern with relationship support
   * EMERGING_PATTERN      — credible but not yet systemic; clearly labelled as such
   * CONTRADICTION         — opposing participant views on the same topic
   * EVIDENCE_GAP          — high-frequency constraint with no response pathway
   */
  category: 'ORGANISATIONAL_ISSUE' | 'REINFORCED_FINDING' | 'EMERGING_PATTERN' | 'CONTRADICTION' | 'EVIDENCE_GAP';
  issueTitle: string;
  whyItMatters: string;
  whoItAffects: string;
  /** Verbatim cluster label + evidence tier that grounds this finding */
  evidenceBasis: string;
  /** The causal chain this finding sits within, if applicable */
  causalChain?: {
    constraintLabel: string;
    enablerLabel: string;
    reimaginationLabel: string;
    chainStrength: number;
    weakestLinkTier: EdgeTier;
  };
  /** Human-readable description of any bottleneck role this node plays */
  bottleneckContext?: string;
  /** Human-readable description of compensating behaviour risk, if applicable */
  compensatingBehaviourContext?: string;
  operationalImplication: string;
  recommendedAction: string;
  /** Edge IDs from the relationship graph that support this finding */
  evidenceEdgeIds: string[];
  /** Node ID from the relationship graph this finding is anchored to */
  evidenceNodeId?: string;
}

export interface CausalIntelligence {
  organisationalIssues: CausalFinding[];
  reinforcedFindings: CausalFinding[];
  emergingPatterns: CausalFinding[];
  contradictions: CausalFinding[];
  evidenceGaps: CausalFinding[];
  /** Top causal chains extracted from the graph, with LLM-enriched narrative */
  dominantCausalChains: Array<{
    constraintLabel: string;
    enablerLabel: string;
    reimaginationLabel: string;
    chainStrength: number;
    narrative: string;
  }>;
  graphCoverageScore: number;
  generatedAtMs: number;
}

// ── Master Output ────────────────────────────────────────────────────────────

export interface WorkshopOutputIntelligence {
  discoveryValidation: DiscoveryValidation;
  rootCause: RootCauseIntelligence;
  futureState: FutureStateDesign;
  roadmap: ExecutionRoadmap;
  strategicImpact: StrategicImpact;
  /**
   * Graph-backed causal intelligence. Optional — populated when the relationship
   * graph has sufficient data (graphCoverageScore > 0). Absent for workshops
   * without theme-labelled live session nodes.
   */
  causalIntelligence?: CausalIntelligence;
  generatedAtMs: number;
  lensesUsed: string[];
}

// ── Stored envelope (as saved to DB) ─────────────────────────────────────────

export interface StoredOutputIntelligence {
  version: 1;
  generatedAtMs: number;
  lensesUsed: string[];
  signalsHash: string;
  intelligence: WorkshopOutputIntelligence;
  errors?: Partial<Record<EngineKey, string>>;
}

// ── Report Summary (single GPT-4o synthesis) ─────────────────────────────────

export interface LensFinding {
  lens: string;                 // e.g. "People", "Technology"
  finding: string;              // specific finding for this lens
}

export interface ExecSummary {
  theAsk: string;               // one sentence: what was commissioned and why
  theAnswer: string;            // one sentence: direct answer to the ask
  whatWeFound: string[];        // 6-8 specific findings, each grounded in evidence
  lensFindings: LensFinding[];  // per-lens breakdown of what the workshop revealed
  whyItMatters: string;         // 3-4 sentences: business impact, cost, risk if unchanged
  opportunityOrRisk: string;    // 2-3 sentences: specific opportunity or risk revealed
  urgency: string;              // one sentence: why act now
  nextStepsPreview: string;     // one sentence bridging to the solution direction
}

export interface WhatMustChange {
  area: string;
  currentState: string;
  requiredChange: string;
}

export interface SolutionSummary {
  direction: string;            // one-sentence transformation headline
  rationale: string;            // 2-3 sentences: why this is the right direction
  whatMustChange: WhatMustChange[];  // 3-5 specific change areas
  startingPoint: string;        // 2-3 sentences: what to do first and why
  successIndicators: string[];  // 3-5 observable outcomes
}

// ── Report Builder Layout ─────────────────────────────────────────────────────

export interface ReportSectionConfig {
  id: string;                // builtin id (e.g. 'executive_summary') or custom nanoid
  type: 'builtin' | 'custom' | 'chapter';
  title: string;
  enabled: boolean;
  collapsed: boolean;        // UI state only — does not affect PDF
  excludedItems: string[];   // item IDs hidden from this section in the PDF
  customContent?: {
    text?: string;
    imageUrl?: string;
    imageAlt?: string;
    commentary?: string;  // editable explanation shown below content
  };
}

export interface ReportLayout {
  sections: ReportSectionConfig[];
  version: 1;
  clientLogoUrl?: string;   // Client logo embedded on PDF cover page
}

export function defaultReportLayout(): ReportLayout {
  return {
    version: 1,
    sections: [
      { id: 'executive_summary',       type: 'builtin', title: 'Executive Summary',        enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'supporting_evidence',     type: 'builtin', title: 'Supporting Evidence',      enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'root_causes',             type: 'builtin', title: 'Root Causes',              enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'solution_direction',      type: 'builtin', title: 'Solution Direction',       enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'journey_map',             type: 'builtin', title: 'Customer Journey',         enabled: true,  collapsed: false, excludedItems: [] },
      // Cross-page sections — disabled until toggled on from their source page
      { id: 'strategic_impact',        type: 'builtin', title: 'Strategic Impact',         enabled: false, collapsed: false, excludedItems: [] },
      { id: 'discovery_diagnostic',    type: 'builtin', title: 'Discovery Diagnostic',     enabled: false, collapsed: false, excludedItems: [] },
      { id: 'discovery_signals',       type: 'builtin', title: 'Discovery Signals',        enabled: false, collapsed: false, excludedItems: [] },
      { id: 'insight_summary',         type: 'builtin', title: 'Insight Map Summary',      enabled: false, collapsed: false, excludedItems: [] },
      // Structural Analysis sub-sections — disabled until toggled on from Discovery Output
      { id: 'structural_alignment',    type: 'builtin', title: 'Domain Misalignment',      enabled: false, collapsed: false, excludedItems: [] },
      { id: 'structural_narrative',    type: 'builtin', title: 'Narrative Divergence',     enabled: false, collapsed: false, excludedItems: [] },
      { id: 'structural_tensions',     type: 'builtin', title: 'Transformation Tensions',  enabled: false, collapsed: false, excludedItems: [] },
      { id: 'structural_barriers',     type: 'builtin', title: 'Structural Barriers',      enabled: false, collapsed: false, excludedItems: [] },
      { id: 'structural_confidence',   type: 'builtin', title: 'Transformation Readiness', enabled: false, collapsed: false, excludedItems: [] },
      // Discovery Signal Map + Facilitator — disabled until toggled on
      { id: 'discovery_signal_map',    type: 'builtin', title: 'Discovery Signal Map',     enabled: false, collapsed: false, excludedItems: [] },
      { id: 'facilitator_contact',     type: 'builtin', title: 'Facilitator Contact',      enabled: false, collapsed: false, excludedItems: [] },
      // Conclusion — enabled by default, positioned last
      { id: 'report_conclusion',       type: 'builtin', title: 'Summary & Next Steps',     enabled: true,  collapsed: false, excludedItems: [] },
    ],
  };
}

// ── Facilitator Contact ───────────────────────────────────────────────────────

export interface FacilitatorContact {
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  companyLogoUrl?: string;
}

// ── Report Conclusion ─────────────────────────────────────────────────────────

export interface ReportNextStep {
  id: string;
  title: string;
  description: string;
}

export interface ReportConclusion {
  summary: string;
  nextSteps: ReportNextStep[];
}

// ── Full Report Summary ───────────────────────────────────────────────────────

export interface ReportSummary {
  workshopAsk: string;
  keyInsight: string;
  executiveSummary: ExecSummary;
  solutionSummary: SolutionSummary;
  transformationDirection: string;
  validationPassed: boolean;
  validationGaps: string[];
  generatedAtMs: number;
  journeyIntro?: string;
  layout?: ReportLayout;
  reportConclusion?: ReportConclusion;
  signalMapImageUrl?: string;
  facilitatorContact?: FacilitatorContact;
}

// ── SSE Event Types ───────────────────────────────────────────────────────────

export type EngineKey = 'discoveryValidation' | 'rootCause' | 'futureState' | 'roadmap' | 'strategicImpact';

export interface EngineStartedEvent {
  engine: EngineKey;
  label: string;
}

export interface EngineCompleteEvent {
  engine: EngineKey;
  label: string;
}

export interface EngineErrorEvent {
  engine: EngineKey;
  label: string;
  error: string;
}

export interface IntelligenceCompleteEvent {
  intelligence: WorkshopOutputIntelligence;
  lensesUsed: string[];
  generatedAtMs: number;
}

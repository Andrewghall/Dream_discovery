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
    reimaginePads: Array<{ text: string; type?: string; lens?: string; actor?: string }>;
    constraintPads: Array<{ text: string; type?: string; lens?: string; actor?: string }>;
    defineApproachPads: Array<{ text: string; type?: string; lens?: string; actor?: string }>;
    /**
     * DISCOVERY phase signals from the live snapshot — present alongside
     * the structured discovery.insights. These carry actor (speakerId) labels
     * and lens tags directly from participant nodes, enabling role-specific
     * analysis of the current-state pain that the reimagined future must address.
     */
    discoveryPads: Array<{ text: string; type?: string; lens?: string; actor?: string }>;
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
   * Normalised findings from ready evidence documents uploaded to this workshop.
   * Optional — absent when no documents have been processed (status=ready).
   * When absent, all OI agents behave exactly as without evidence.
   */
  evidenceDocuments?: Array<{
    fileName: string;
    summary: string;
    keyFindings: string[];
    signalDirection: string;   // 'red' | 'amber' | 'green' | 'mixed'
    confidence: number;        // 0-1
  }>;
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

/** A constraint surfaced directly by participants during the workshop */
export interface WorkshopConstraint {
  title: string;
  type: 'Structural' | 'Cultural' | 'Technical' | 'Regulatory' | 'Resource' | 'Leadership';
  severity: 'critical' | 'significant' | 'moderate';
  /** Representative quote or close paraphrase in participant language */
  participantVoice: string;
  affectedLenses: string[];
  /** 2-3 sentences on why this constraint exists at a systemic level */
  rootCause: string;
  resolutionStatus: 'Addressed in Vision' | 'Partially Addressed' | 'Requires Enabler' | 'Structural — Hard to Change';
}

/** A force working in favour of transformation */
export interface DrivingForce {
  force: string;
  strength: 'strong' | 'moderate' | 'emerging';
  /** Where this driving force comes from e.g. "Leadership mandate", "Staff aspiration" */
  source: string;
}

export interface RootCauseIntelligence {
  rootCauses: RootCause[];
  systemicPattern: string;
  frictionMap: FrictionPoint[];
  /** One memorable sentence capturing the essential tension — used as force field headline */
  forceFieldHeadline?: string;
  /** Constraints as named by workshop participants, with their voice preserved */
  workshopConstraints?: WorkshopConstraint[];
  /** Forces working in favour of transformation — the other side of the force field */
  drivingForces?: DrivingForce[];
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

export interface FutureStateTheme {
  title: string;
  badge: 'very high' | 'high' | 'medium';
  description: string;
  subSections: Array<{ title: string; detail: string }>;
}

export interface FutureStateDesign {
  // ── Core (legacy — always present) ───────────────────────────────────────
  targetOperatingModel: string;
  aiHumanModel: AiHumanTask[];
  operatingModelChanges: OperatingModelChange[];
  redesignPrinciples: string[];
  narrative: string;

  // ── PAM-quality extended fields (present on new generations) ─────────────
  /** Compelling headline for the reimagined future */
  title?: string;
  /** 2-3 sentence overview of the transformation vision */
  description?: string;
  /** Three-stage transformation arc */
  threeHouses?: {
    current: { label: string; description: string };
    transition: { label: string; description: string };
    future: { label: string; description: string };
  };
  /** 5 directional shifts — from current → to future */
  directionOfTravel?: Array<{ from: string; to: string }>;
  /** Exactly 5 primary themes (very high / high priority) */
  primaryThemes?: FutureStateTheme[];
  /** Exactly 3 supporting themes (medium priority, numbered 6-8) */
  supportingThemes?: FutureStateTheme[];
  /** Strategic alignment framing */
  visionAlignment?: {
    corePrinciples: string[];
    platformPosition: string;
  };
  /** 2-3 sentences on what 3-5 year success looks like */
  horizonVision?: string;
  /**
   * Actor-perspective future journey — what each role now experiences
   * in the reimagined operating model. Built from actor-tagged REIMAGINE
   * signals cross-referenced with DISCOVERY current-pain signals.
   */
  reimaginedJourney?: {
    headline: string;
    actorJourneys: Array<{
      /** e.g. "Customer & Passenger", "Frontline Agent", "BPO Agent" */
      actor: string;
      /** 2-3 sentences on their current reality grounded in discovery signals */
      currentReality: string;
      /** 3-4 vivid sentences painting their future experience from reimagine signals */
      reimaginedExperience: string;
      /** 2-3 specific enablers that make this actor's future possible */
      keyEnablers: string[];
    }>;
  };
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

// ── ROI & Benefits Realisation ─────────────────────────────────────────────

export interface RoiPhaseEstimate {
  /** Short phase label e.g. "Phase 1" */
  phase: string;
  /** Cost range to deliver this phase e.g. "£150k – £300k" */
  estimatedCost: string;
  /** Annualised benefit once delivered e.g. "£380k – £520k / yr" */
  estimatedAnnualBenefit: string;
  /** 2-3 concrete benefit drivers e.g. ["FTE efficiency gain", "Reduced escalation handling"] */
  benefitDrivers: string[];
  /** When cumulative benefit exceeds cost e.g. "8–12 months" */
  breakEvenTimeline: string;
  /** ROI multiple over the full programme horizon e.g. "2.6×" */
  roiMultiple: string;
  /** Evidence quality for this estimate */
  confidenceLevel: 'High' | 'Medium' | 'Low';
}

export interface RoiSummary {
  phases: RoiPhaseEstimate[];
  /** Total programme investment e.g. "£600k – £1.1m" */
  totalProgrammeCost: string;
  /** Total 3-year cumulative benefit e.g. "£2.3m – £3.8m" */
  totalThreeYearBenefit: string;
  /** Programme-level payback e.g. "12–18 months" */
  paybackPeriod: string;
  /** 2-4 grounding assumptions surfaced from workshop signals */
  keyAssumptions: string[];
  /** 1-2 sentence narrative summary of the business case */
  narrative: string;
}

export interface ExecutionRoadmap {
  phases: RoadmapPhase[];
  criticalPath: string;
  keyRisks: string[];
  /** Workshop-grounded ROI and benefits realisation estimates — generated with roadmap */
  roiSummary?: RoiSummary;
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
  /** Up to 3 verbatim participant quotes from the grounding evidence cluster */
  evidenceQuotes?: Array<{ text: string; participantRole: string | null; lens: string | null }>;
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

// ── Transformation Logic Map ──────────────────────────────────────────────────
//
// A purely deterministic, graph-derived visual model that answers:
//   • Are constraints being addressed by the transformation plan?
//   • Where do problems converge into transformation pressure points?
//   • Where is effort disconnected from real problems?
//   • Where is vision disconnected from execution?
//
// Computed from GraphIntelligence — no LLM call required.

/** A node in the Transformation Logic Map — one evidence cluster */
export interface TLMNode {
  nodeId: string;
  displayLabel: string;
  layer: 'CONSTRAINT' | 'ENABLER' | 'REIMAGINATION';
  // Classification flags (non-exclusive)
  isCoalescent: boolean;    // Bottleneck / high out-degree convergence point
  isOrphan: boolean;        // No credible causal connection
  orphanType?: 'CONSTRAINT_NO_RESPONSE' | 'REIMAGINATION_UNSUPPORTED' | 'ENABLER_LEADS_NOWHERE';
  inValidChain: boolean;    // Part of a dominant constraint→enabler→reimagination chain
  isCompensating: boolean;  // Workaround enabler (compensates_for edge to a live constraint)
  // Scoring — drives node prominence in the visual layout
  compositeScore: number;   // 0–100
  rawFrequency: number;     // Mention count
  connectionDegree: number; // Total edges — higher = more central in force layout
  // Evidence
  quotes: Array<{ text: string; participantRole: string | null; lens: string | null }>;
}

/** A directional relationship between two TLM nodes */
export interface TLMEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationshipType: 'drives' | 'enables' | 'constrains' | 'compensates_for' | 'responds_to' | 'contradicts' | 'blocks' | 'depends_on';
  score: number;         // 0–100
  tier: EdgeTier;
  isChainEdge: boolean;  // Part of a dominant causal chain — rendered prominently
  rationale: string;
  /** Evidence backing this link — derived from real utterances, not semantic inference.
   *  Optional: absent on Brain Scan output generated before this field was added. */
  evidence?: {
    mentionCount: number;   // Total utterances (proxy: sum of quote counts for both nodes)
    actorCount: number;     // Distinct participant roles across both nodes' quotes
    quotes: Array<{ text: string; participantRole: string | null; lens: string | null }>;
  };
}

export interface TransformationLogicMap {
  nodes: TLMNode[];
  edges: TLMEdge[];
  /** Nodes where many links converge — transformation pressure points */
  coalescencePoints: Array<{
    nodeId: string;
    label: string;
    layer: string;
    outDegree: number;
    affectedCount: number;
    compositeScore: number;
  }>;
  /** Summary of disconnected nodes by layer */
  orphanSummary: {
    constraintOrphans: number;   // Known problems with no transformation plan
    enablerOrphans: number;      // Activity without purpose
    visionOrphans: number;       // Strategy without execution path
    topOrphanLabels: string[];
  };
  /** The strongest complete constraint→enabler→vision chains */
  strongestChains: Array<{
    chainId: string;
    constraintLabel: string;
    enablerLabel: string;
    reimaginationLabel: string;
    chainStrength: number;
  }>;
  /** % of constraint nodes that are part of at least one valid chain */
  coverageScore: number;
  /** 2-3 sentence interpretation of what the map reveals about this organisation */
  interpretationSummary: string;
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
  /**
   * Transformation Logic Map — deterministic visual model derived from the
   * relationship graph. Shows coalescence, orphans, valid chains, and islands.
   * Optional — absent when graphIntelligence has no meaningful coverage.
   */
  transformationLogicMap?: TransformationLogicMap;
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

export interface DecisionOption {
  label: string;        // e.g. "Option A: Full programme"
  description: string;  // 1-2 sentences on what this option entails
}

export interface DecisionAsk {
  statement: string;          // "We are asking the ExCo to approve..."
  options?: DecisionOption[]; // 2-3 decision options (optional)
  recommendation: string;     // What we recommend they choose and why (1 sentence)
  ifNoAction: string;         // Specific consequence of inaction (1-2 sentences)
}

export interface ExecSummary {
  theAsk: string;               // one sentence: what was commissioned and why
  theAnswer: string;            // one sentence: direct answer to the ask
  whatWeFoundPositive: string[]; // 2-4 strengths, enablers, or positive signals grounded in evidence
  whatWeFound: string[];        // 6-8 specific challenges/problems, each grounded in evidence
  lensFindings: LensFinding[];  // per-lens breakdown of what the workshop revealed
  whyItMatters: string;         // 3-4 sentences: business impact, cost, risk if unchanged
  opportunityOrRisk: string;    // 2-3 sentences: specific opportunity or risk revealed
  urgency: string;              // one sentence: why act now
  nextStepsPreview: string;     // one sentence bridging to the solution direction
  decisionAsk?: DecisionAsk;   // what we are asking the executive to decide
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
  version: 1 | 2 | 3 | 4;
  clientLogoUrl?: string;   // Client logo embedded on PDF cover page
}

export function defaultReportLayout(): ReportLayout {
  return {
    version: 4,
    sections: [
      // ── Executive Summary — ALWAYS FIRST ─────────────────────────────────
      { id: 'executive_summary',       type: 'builtin',  title: 'Executive Summary',           enabled: true,  collapsed: false, excludedItems: [] },
      // ── Chapter 1: Discovery Diagnostic ──────────────────────────────────
      { id: 'ch_discovery',            type: 'chapter',  title: 'Discovery Diagnostic',        enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'discovery_diagnostic',    type: 'builtin',  title: 'Discovery Diagnostic',        enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'discovery_signals',       type: 'builtin',  title: 'Discovery Signals',           enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'discovery_signal_map',    type: 'builtin',  title: 'Discovery Signal Map',        enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'structural_alignment',    type: 'builtin',  title: 'Domain Misalignment',         enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'structural_narrative',    type: 'builtin',  title: 'Narrative Divergence',        enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'journey_map',             type: 'builtin',  title: 'Customer Journey Map',        enabled: true,  collapsed: false, excludedItems: [] },
      // ── Chapter 2: Reimagine ─────────────────────────────────────────────
      { id: 'ch_reimagine',            type: 'chapter',  title: 'Reimagine',                   enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'solution_direction',      type: 'builtin',  title: 'Solution Direction',          enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'strategic_impact',        type: 'builtin',  title: 'Strategic Impact',            enabled: true,  collapsed: false, excludedItems: [] },
      // ── Chapter 3: Constraints ───────────────────────────────────────────
      { id: 'ch_constraints',          type: 'chapter',  title: 'Constraints',                 enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'structural_tensions',     type: 'builtin',  title: 'Transformation Tensions',     enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'structural_barriers',     type: 'builtin',  title: 'Structural Barriers',         enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'structural_confidence',   type: 'builtin',  title: 'Transformation Readiness',    enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'supporting_evidence',     type: 'builtin',  title: 'Supporting Evidence',         enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'root_causes',             type: 'builtin',  title: 'Root Causes',                 enabled: true,  collapsed: false, excludedItems: [] },
      // ── Chapter 4: Way Forward ───────────────────────────────────────────
      { id: 'ch_wayforward',           type: 'chapter',  title: 'Way Forward',                 enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'way_forward',             type: 'builtin',  title: 'Way Forward',                 enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'report_conclusion',       type: 'builtin',  title: 'Summary & Next Steps',        enabled: true,  collapsed: false, excludedItems: [] },
      { id: 'facilitator_contact',     type: 'builtin',  title: 'Facilitator Contact',         enabled: false, collapsed: false, excludedItems: [] },
      // ── Available but off by default ─────────────────────────────────────
      { id: 'transformation_priorities', type: 'builtin', title: 'Transformation Priorities',  enabled: false, collapsed: false, excludedItems: [] },
      { id: 'connected_model',         type: 'builtin',  title: 'Connected Model',             enabled: false, collapsed: false, excludedItems: [] },
      { id: 'insight_summary',         type: 'builtin',  title: 'Insight Map Summary',         enabled: false, collapsed: false, excludedItems: [] },
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

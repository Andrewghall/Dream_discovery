/**
 * DREAM Output Intelligence — Types
 *
 * Defines the signal aggregate (input) and all 5 engine outputs.
 */

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
  hypothesisAccuracy: number;  // 0-100
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
  automationPotential: ImpactBucket;
  aiAssistedWork: ImpactBucket;
  humanOnlyWork: ImpactBucket;
  efficiencyGains: EfficiencyGain[];
  experienceImprovements: ExperienceImprovement[];
  businessCaseSummary: string;
  confidenceScore: number;  // 0-100
}

// ── Master Output ────────────────────────────────────────────────────────────

export interface WorkshopOutputIntelligence {
  discoveryValidation: DiscoveryValidation;
  rootCause: RootCauseIntelligence;
  futureState: FutureStateDesign;
  roadmap: ExecutionRoadmap;
  strategicImpact: StrategicImpact;
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
  type: 'builtin' | 'custom';
  title: string;
  enabled: boolean;
  collapsed: boolean;        // UI state only — does not affect PDF
  excludedItems: string[];   // item IDs hidden from this section in the PDF
  customContent?: {
    text?: string;
    imageUrl?: string;
    imageAlt?: string;
  };
}

export interface ReportLayout {
  sections: ReportSectionConfig[];
  version: 1;
}

export function defaultReportLayout(): ReportLayout {
  return {
    version: 1,
    sections: [
      { id: 'executive_summary',   type: 'builtin', title: 'Executive Summary',   enabled: true, collapsed: false, excludedItems: [] },
      { id: 'supporting_evidence', type: 'builtin', title: 'Supporting Evidence', enabled: true, collapsed: false, excludedItems: [] },
      { id: 'root_causes',         type: 'builtin', title: 'Root Causes',         enabled: true, collapsed: false, excludedItems: [] },
      { id: 'solution_direction',  type: 'builtin', title: 'Solution Direction',  enabled: true, collapsed: false, excludedItems: [] },
      { id: 'journey_map',         type: 'builtin', title: 'Customer Journey',    enabled: true, collapsed: false, excludedItems: [] },
    ],
  };
}

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

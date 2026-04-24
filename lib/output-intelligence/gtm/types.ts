/**
 * DREAM GTM / ICP Output Intelligence — Types
 *
 * Four-phase output model:
 *   Phase 1 — Reality Map     (what is actually happening today)
 *   Phase 2 — Ideal State     (what winning properly looks like)
 *   Phase 3 — Constraints     (what stops the ideal state)
 *   Phase 4 — Way Forward     (executable path from reality → target)
 *   + Executive View          (10-second board summary)
 */

// ── Phase 1: Reality Map ──────────────────────────────────────────────────────

export type GtmLens =
  | 'People'
  | 'Commercial'
  | 'Operations'
  | 'Technology'
  | 'Partners'
  | 'Risk/Compliance';

export interface GtmTruthStatement {
  text: string;
  lens: GtmLens;
  significance: 'high' | 'medium' | 'low';
}

export interface GtmWinLossPattern {
  pattern: string;
  wins: string;
  losses: string;
  shouldNotWin?: string;
}

export interface GtmDealFlowStage {
  stage: string;
  stallPoints: string[];
  trustDropPoints: string[];
  reshapingPoints: string[];
}

export interface GtmDeliveryContradiction {
  sold: string;
  delivered: string;
  gap: string;
  impact: string;
}

export interface GtmRealityMap {
  realitySummary: string;
  truthStatements: GtmTruthStatement[];
  winLossPatterns: GtmWinLossPattern[];
  dealFlowReality: {
    stages: GtmDealFlowStage[];
    summary: string;
  };
  deliveryContradictions: GtmDeliveryContradiction[];
  implicitIcpPatterns: string[];
  propositionReality: string;
  commercialReality: string;
  gtmMotionReality: string;
  partnerReality: string;
  technologyCapabilityReality: string;
  corePatterns: {
    whereWeWinAndWhy: string;
    whereWeLoseAndWhy: string;
    whereWeAreInconsistent: string;
  };
}

// ── Phase 2: Ideal State ──────────────────────────────────────────────────────

export interface GtmIcpDefinition {
  weAreFor: {
    problemFit: string;
    environmentFit: string;
    buyerFit: string;
    deliveryFit: string;
    behaviourFit: string;
  };
  weAreNotFor: {
    wrongProblem: string;
    wrongBuyer: string;
    wrongDeliveryConditions: string;
    wrongCommercialBehaviour: string;
  };
}

export interface GtmTargetSegment {
  segmentName: string;
  problemType: string;
  buyerType: string;
  triggerEvent: string;
  whyWeWin: string;
}

export interface GtmPropositionCard {
  weHelp: string;
  solve: string;
  by: string;
  soThat: string;
}

export interface GtmCleanPathStage {
  stage: string;
  trustBuildPoints: string[];
  decisionPoints: string[];
  proofPoints: string[];
}

export interface GtmIdealState {
  northStar: string;
  endPoint: {
    desiredBusinessEndState: string;
    growthOrExitLogic: string;
    valueCreationLogic: string;
    whatMustBeTrueCommercially: string;
  };
  icpDefinition: GtmIcpDefinition;
  targetSegments: GtmTargetSegment[];
  propositionCard: GtmPropositionCard;
  cleanGtmPath: {
    stages: GtmCleanPathStage[];
  };
  sellableDeliverableOverlap: {
    sellableOnly: string[];
    deliverableOnly: string[];
    sellableAndDeliverable: string[];
  };
  partnerOwnershipModel: {
    owned: string[];
    shared: string[];
    dependent: string[];
  };
}

// ── Phase 3: Constraints ──────────────────────────────────────────────────────

export type GtmRiskColour = 'red' | 'amber' | 'green';

export interface GtmConstraintBlock {
  lens: GtmLens;
  blockers: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'significant' | 'moderate';
  }>;
}

export interface GtmContradiction {
  target: string;
  reality: string;
  conflict: string;
}

export interface GtmDependency {
  name: string;
  type: 'internal_capability' | 'external_partner' | 'technology' | 'governance' | 'delivery_model';
  riskMarker: 'fragile' | 'unproven' | 'over_reliant' | 'unowned';
  description: string;
}

export interface GtmTradeOff {
  keep: string;
  lose: string;
  commercialConsequence: string;
}

export interface GtmConstraints {
  constraintSummary: string;
  constraintStack: GtmConstraintBlock[];
  contradictionMap: GtmContradiction[];
  dependencyMap: GtmDependency[];
  tradeOffMap: GtmTradeOff[];
  failureExposure: {
    buyerTrust: GtmRiskColour;
    deliveryConfidence: GtmRiskColour;
    commercialViability: GtmRiskColour;
    technologyProof: GtmRiskColour;
    partnerDependency: GtmRiskColour;
    riskPosition: GtmRiskColour;
  };
}

// ── Phase 4: Way Forward ──────────────────────────────────────────────────────

export interface GtmAction {
  priority: 1 | 2 | 3 | 4 | 5;
  action: string;
  owner: string;
  testableOutcome: string;
  linkedConstraint: string;
}

export interface GtmSequenceStep {
  step: number;
  action: string;
  owner: string;
  unlock: string;
  dependency: string;
}

export interface GtmActivationRow {
  before: string;
  after: string;
  expectedSignal: string;
}

export interface GtmDeliveryFix {
  promise: string;
  currentCapability: string;
  requiredFix: string;
  sellOrStop: 'sell' | 'stop' | 'fix_first';
}

export interface GtmRiskShift {
  lateStageRisk: string;
  earlyStageControl: string;
  owner: string;
}

export interface GtmFailurePoint {
  failurePoint: string;
  whyItWillHappen: string;
  preventionAction: string;
}

export interface GtmWayForward {
  actionStack: GtmAction[];
  sequenceMap: GtmSequenceStep[];
  gtmActivation: GtmActivationRow[];
  icpEnforcementTool: {
    pursueCriteria: string[];
    rejectCriteria: string[];
    exceptionRules: string[];
  };
  deliveryFixMap: GtmDeliveryFix[];
  partnerActionMap: {
    keep: string[];
    fix: string[];
    remove: string[];
  };
  riskShiftMap: GtmRiskShift[];
  failurePremortem: GtmFailurePoint[];
  successSignals: {
    thirtyDays: string[];
    sixtyDays: string[];
    ninetyDays: string[];
  };
}

// ── Executive View ────────────────────────────────────────────────────────────

export interface GtmExecutiveView {
  headline: string;
  northStar: string;
  icpOneLiner: string;
  threeTruths: string[];
  threeBlockers: string[];
  threeActions: string[];
}

// ── Master GTM Output ─────────────────────────────────────────────────────────

export interface GtmOutputIntelligence {
  realityMap: GtmRealityMap;
  idealState: GtmIdealState;
  constraints: GtmConstraints;
  wayForward: GtmWayForward;
  executiveView: GtmExecutiveView;
  generatedAtMs: number;
  lensesUsed: string[];
}

// ── Engine Keys ───────────────────────────────────────────────────────────────

export type GtmEngineKey =
  | 'gtmReality'
  | 'gtmIdealState'
  | 'gtmConstraints'
  | 'gtmWayForward'
  | 'gtmExecutive';

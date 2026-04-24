/**
 * DREAM GTM Output Intelligence — Pipeline
 *
 * Orchestrates the 5 GTM agents:
 *   1. Reality Map   — parallel
 *   2. Ideal State   — parallel
 *   3. Constraints   — parallel
 *   4. Way Forward   — parallel
 *   5. Executive     — sequential (depends on 1-4)
 *
 * Returns typed results with fallbacks on any engine failure.
 */

import type { WorkshopSignals } from '../types';
import type {
  GtmOutputIntelligence,
  GtmEngineKey,
  GtmRealityMap,
  GtmIdealState,
  GtmConstraints,
  GtmWayForward,
  GtmExecutiveView,
} from './types';
import { runGtmRealityAgent } from './agents/gtm-reality-agent';
import { runGtmIdealStateAgent } from './agents/gtm-reimagine-agent';
import { runGtmConstraintsAgent } from './agents/gtm-constraints-agent';
import { runGtmWayForwardAgent } from './agents/gtm-wayforward-agent';
import { runGtmExecutiveAgent } from './agents/gtm-executive-agent';

export type GtmEngineProgressCallback = (
  engine: GtmEngineKey,
  event: 'started' | 'complete' | 'error',
  detail?: string
) => void;

export interface GtmPipelineResult {
  intelligence: GtmOutputIntelligence;
  errors: Partial<Record<GtmEngineKey, string>>;
}

// ── Fallbacks ─────────────────────────────────────────────────────────────────

function realityFallback(): GtmRealityMap {
  return {
    realitySummary: 'Reality analysis could not be completed — insufficient signal data.',
    truthStatements: [],
    winLossPatterns: [],
    dealFlowReality: { stages: [], summary: '' },
    deliveryContradictions: [],
    implicitIcpPatterns: [],
    propositionReality: '',
    commercialReality: '',
    gtmMotionReality: '',
    partnerReality: '',
    technologyCapabilityReality: '',
    corePatterns: { whereWeWinAndWhy: '', whereWeLoseAndWhy: '', whereWeAreInconsistent: '' },
  };
}

function idealStateFallback(): GtmIdealState {
  return {
    northStar: 'North Star could not be generated — insufficient signal data.',
    endPoint: {
      desiredBusinessEndState: '',
      growthOrExitLogic: '',
      valueCreationLogic: '',
      whatMustBeTrueCommercially: '',
    },
    icpDefinition: {
      weAreFor: {
        problemFit: '',
        environmentFit: '',
        buyerFit: '',
        deliveryFit: '',
        behaviourFit: '',
      },
      weAreNotFor: {
        wrongProblem: '',
        wrongBuyer: '',
        wrongDeliveryConditions: '',
        wrongCommercialBehaviour: '',
      },
    },
    targetSegments: [],
    propositionCard: { weHelp: '', solve: '', by: '', soThat: '' },
    cleanGtmPath: { stages: [] },
    sellableDeliverableOverlap: {
      sellableOnly: [],
      deliverableOnly: [],
      sellableAndDeliverable: [],
    },
    partnerOwnershipModel: { owned: [], shared: [], dependent: [] },
  };
}

function constraintsFallback(): GtmConstraints {
  return {
    constraintSummary: 'Constraints analysis could not be completed — insufficient signal data.',
    constraintStack: [],
    contradictionMap: [],
    dependencyMap: [],
    tradeOffMap: [],
    failureExposure: {
      buyerTrust: 'amber',
      deliveryConfidence: 'amber',
      commercialViability: 'amber',
      technologyProof: 'amber',
      partnerDependency: 'amber',
      riskPosition: 'amber',
    },
  };
}

function wayForwardFallback(): GtmWayForward {
  return {
    actionStack: [],
    sequenceMap: [],
    gtmActivation: [],
    icpEnforcementTool: { pursueCriteria: [], rejectCriteria: [], exceptionRules: [] },
    deliveryFixMap: [],
    partnerActionMap: { keep: [], fix: [], remove: [] },
    riskShiftMap: [],
    failurePremortem: [],
    successSignals: { thirtyDays: [], sixtyDays: [], ninetyDays: [] },
  };
}

function executiveFallback(): GtmExecutiveView {
  return {
    headline: 'Executive summary could not be generated.',
    northStar: '',
    icpOneLiner: '',
    threeTruths: [],
    threeBlockers: [],
    threeActions: [],
  };
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runGtmPipeline(
  signals: WorkshopSignals,
  onEngineProgress?: GtmEngineProgressCallback
): Promise<GtmPipelineResult> {
  const errors: Partial<Record<GtmEngineKey, string>> = {};

  // Notify engines starting
  const parallelEngines: GtmEngineKey[] = ['gtmReality', 'gtmIdealState', 'gtmConstraints', 'gtmWayForward'];
  parallelEngines.forEach((e) => onEngineProgress?.(e, 'started'));

  // Run 4 agents in parallel
  const [rm, is, co, wf] = await Promise.allSettled([
    runGtmRealityAgent(signals, (msg) => console.log(msg)),
    runGtmIdealStateAgent(signals, (msg) => console.log(msg)),
    runGtmConstraintsAgent(signals, (msg) => console.log(msg)),
    runGtmWayForwardAgent(signals, (msg) => console.log(msg)),
  ]);

  // Resolve with fallbacks
  const realityMap =
    rm.status === 'fulfilled'
      ? rm.value
      : (errors.gtmReality = rm.reason instanceof Error ? rm.reason.message : String(rm.reason),
         realityFallback());

  const idealState =
    is.status === 'fulfilled'
      ? is.value
      : (errors.gtmIdealState = is.reason instanceof Error ? is.reason.message : String(is.reason),
         idealStateFallback());

  const constraints =
    co.status === 'fulfilled'
      ? co.value
      : (errors.gtmConstraints = co.reason instanceof Error ? co.reason.message : String(co.reason),
         constraintsFallback());

  const wayForward =
    wf.status === 'fulfilled'
      ? wf.value
      : (errors.gtmWayForward = wf.reason instanceof Error ? wf.reason.message : String(wf.reason),
         wayForwardFallback());

  // Emit progress for parallel engines
  onEngineProgress?.('gtmReality', rm.status === 'fulfilled' ? 'complete' : 'error', errors.gtmReality);
  onEngineProgress?.('gtmIdealState', is.status === 'fulfilled' ? 'complete' : 'error', errors.gtmIdealState);
  onEngineProgress?.('gtmConstraints', co.status === 'fulfilled' ? 'complete' : 'error', errors.gtmConstraints);
  onEngineProgress?.('gtmWayForward', wf.status === 'fulfilled' ? 'complete' : 'error', errors.gtmWayForward);

  // Executive agent runs last — synthesises from the 4 parallel outputs
  onEngineProgress?.('gtmExecutive', 'started');
  let executiveView: GtmExecutiveView;
  try {
    executiveView = await runGtmExecutiveAgent(
      signals,
      realityMap,
      idealState,
      constraints,
      wayForward,
      (msg) => console.log(msg)
    );
    onEngineProgress?.('gtmExecutive', 'complete');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.gtmExecutive = msg;
    onEngineProgress?.('gtmExecutive', 'error', msg);
    executiveView = executiveFallback();
  }

  const intelligence: GtmOutputIntelligence = {
    realityMap,
    idealState,
    constraints,
    wayForward,
    executiveView,
    generatedAtMs: Date.now(),
    lensesUsed: signals.context.lenses,
  };

  return { intelligence, errors };
}

// EthentaFlow interrogation framework — typed constants for all lenses.
// Each lens defines its anchor measurement question, interrogation intent,
// probe patterns, evidence targets, and failure signals.
//
// Principle: We do not generate static questions. We generate a system that
// interrogates reality until truth is evidenced.

import type { Lens } from './types.js';

export interface LensFramework {
  lensId: Lens;
  anchorMeasurementQuestion: string;
  interrogationIntent: string[];
  probePatterns: string[];
  evidenceTargets: string[];
  failureSignals: string[];
}

export const FRAMEWORK: LensFramework[] = [
  {
    lensId: 'people',
    anchorMeasurementQuestion:
      "Across recent wins, losses, and live deals, where is capability and behavioural consistency today, where should it be to win the right work, and where will it end up if nothing changes?",
    interrogationIntent: [
      "Understand whether people can credibly sell and deliver the proposition",
      "Surface behavioural gaps across sales, solution, and delivery",
      "Identify where trust is created or destroyed in real buyer interactions",
    ],
    probePatterns: [
      "ask for a recent win where a person made the difference",
      "ask for a loss where behaviour broke trust",
      "ask where stories diverge across teams",
      "ask who strengthens or weakens the proposition in live deals",
      "ask what moves capability from current to target",
    ],
    evidenceTargets: [
      "named deal example",
      "specific interaction or moment",
      "observable behaviour",
      "clear impact on buyer trust or outcome",
    ],
    failureSignals: [
      "no real example provided",
      "generic statements about capability",
      "no link to deal outcome",
      "score not justified with evidence",
    ],
  },
  {
    lensId: 'operations',
    anchorMeasurementQuestion:
      "Across recent wins, losses, and live deals, where is delivery credibility and execution reliability today, where should it be to support winning the right work, and where will it end up if nothing changes?",
    interrogationIntent: [
      "Test whether delivery can actually support what is being sold",
      "Identify where execution breaks post-sale",
      "Surface fragile deal types and operational risk patterns",
    ],
    probePatterns: [
      "ask for a deal where delivery failed after sale",
      "ask which work types become unstable in delivery",
      "ask where delivery limits what can be sold",
      "ask which opportunities should be avoided",
      "ask where delivery strengthened a win",
    ],
    evidenceTargets: [
      "specific deal or delivery example",
      "handoff or breakdown moment",
      "clear mismatch between promise and execution",
      "impact on delivery, margin, or client outcome",
    ],
    failureSignals: [
      "no linkage to real delivery outcomes",
      "abstract process discussion",
      "no identification of risk or fragility",
      "score not tied to operational reality",
    ],
  },
  {
    lensId: 'technology',
    anchorMeasurementQuestion:
      "Across recent wins, losses, and live deals, where is technical credibility in the proposition today, where should it be to support winning the right work, and where will it end up if nothing changes?",
    interrogationIntent: [
      "Test whether technology claims are believable and provable",
      "Identify gaps between stated capability and demonstrable reality",
      "Surface where technology strengthens or weakens deals",
    ],
    probePatterns: [
      "ask for a deal where tech helped win",
      "ask where competitors exposed a gap",
      "ask where buyers were asked to believe unproven capability",
      "ask which deals carry technical risk",
      "ask what must be proven to move credibility",
    ],
    evidenceTargets: [
      "specific deal example",
      "technical claim vs proof gap",
      "buyer reaction to tech credibility",
      "impact on win/loss or risk",
    ],
    failureSignals: [
      "vague statements about technology",
      "no distinction between claimed and proven capability",
      "no deal linkage",
      "score not grounded in evidence",
    ],
  },
  {
    lensId: 'commercial',
    anchorMeasurementQuestion:
      "Across recent wins, losses, and live deals, where is clarity on who to pursue and who to avoid today, where should it be to support winning the right work, and where will it end up if nothing changes?",
    interrogationIntent: [
      "Define the true ICP based on real outcomes",
      "Identify patterns in strong-fit vs weak-fit work",
      "Surface where revenue is being chased incorrectly",
    ],
    probePatterns: [
      "ask for patterns in recent wins",
      "ask for patterns in losses or poor-fit work",
      "ask which deals should not have been pursued",
      "ask what buyers were actually paying for",
      "ask what defines a strong-fit opportunity",
    ],
    evidenceTargets: [
      "clear deal pattern or segment",
      "specific buyer problem",
      "evidence of repeatability or failure",
      "commercial outcome impact",
    ],
    failureSignals: [
      "generic market descriptions",
      "no distinction between good and bad work",
      "no pattern recognition",
      "score not tied to real deal evidence",
    ],
  },
  {
    lensId: 'risk_compliance',
    anchorMeasurementQuestion:
      "Across recent wins, losses, and live deals, where is deal viability under risk, procurement, and compliance pressure today, where should it be to support winning the right work, and where will it end up if nothing changes?",
    interrogationIntent: [
      "Understand how risk and compliance affect deal viability",
      "Identify where risk surfaces too late",
      "Surface where deals become unattractive after pursuit",
    ],
    probePatterns: [
      "ask for deals that collapsed under risk pressure",
      "ask where risk surfaced too late",
      "ask where approvals reshaped deals",
      "ask where early clarity helped win",
      "ask what risk is protecting vs blocking",
    ],
    evidenceTargets: [
      "specific deal example",
      "moment risk impacted the deal",
      "clear description of constraint",
      "impact on speed, viability, or outcome",
    ],
    failureSignals: [
      "abstract compliance discussion",
      "no deal linkage",
      "no timing of when risk appears",
      "score not evidence-based",
    ],
  },
  {
    lensId: 'partners',
    anchorMeasurementQuestion:
      "Across recent wins, losses, and live deals, where is partner dependence in the proposition today, where should it be to support winning the right work, and where will it end up if nothing changes?",
    interrogationIntent: [
      "Understand where partners strengthen or weaken the proposition",
      "Identify dependency risk and fragility",
      "Surface where partner reliance impacts credibility",
    ],
    probePatterns: [
      "ask for wins enabled by partners",
      "ask for losses caused by partner weakness",
      "ask where partner commitments don't match the story",
      "ask which deals depend too heavily on partners",
      "ask what must be owned vs partnered",
    ],
    evidenceTargets: [
      "specific deal example",
      "partner role in outcome",
      "dependency vs control clarity",
      "impact on credibility or delivery",
    ],
    failureSignals: [
      "generic partner statements",
      "no linkage to deal outcomes",
      "no identification of dependency risk",
      "score not grounded in reality",
    ],
  },
];

/** Returns the framework entry for a given lens, or undefined if not found. */
export function getLensFramework(lens: Lens): LensFramework | undefined {
  return FRAMEWORK.find(f => f.lensId === lens);
}

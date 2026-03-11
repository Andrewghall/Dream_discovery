/**
 * DREAM Output Intelligence — Evidence Gating
 *
 * Pure functions that compute evidence sufficiency scores and gate
 * numeric outputs to null when signals are insufficient to support
 * meaningful estimates.
 */

import type { WorkshopSignals, StrategicImpact, DiscoveryValidation } from './types';

// ── Strategic Impact Gating ──────────────────────────────────────────────────

export function computeStrategicEvidenceScore(signals: WorkshopSignals): number {
  let score = 0;
  const journeyWithAi = signals.liveSession.journey.filter((j) => j.aiScore !== undefined);
  if (journeyWithAi.length >= 3) score += 40;
  else if (journeyWithAi.length >= 1) score += 20;
  if (signals.liveSession.reimaginePads.length >= 10) score += 30;
  else if (signals.liveSession.reimaginePads.length >= 3) score += 15;
  if (signals.discovery.insights.length >= 10) score += 20;
  else if (signals.discovery.insights.length >= 3) score += 10;
  if (signals.scratchpad.execSummary) score += 10;
  return score; // max 100
}

export function gateStrategicImpact(result: StrategicImpact, evidenceScore: number): StrategicImpact {
  if (evidenceScore < 40) {
    return { ...result, automationPotential: null, aiAssistedWork: null, humanOnlyWork: null, confidenceScore: null };
  }
  // Detect exact anchor pattern copied from prompt schema
  const isAnchorPattern =
    result.automationPotential?.percentage === 35 &&
    result.aiAssistedWork?.percentage === 45 &&
    result.humanOnlyWork?.percentage === 20;
  if (isAnchorPattern) {
    return { ...result, automationPotential: null, aiAssistedWork: null, humanOnlyWork: null, confidenceScore: null };
  }
  return result;
}

// ── Discovery Validation Gating ──────────────────────────────────────────────

export function computeDiscoveryEvidenceScore(signals: WorkshopSignals): number {
  let score = 0;
  if (signals.discovery.themes.length >= 3) score += 30;
  if (signals.discovery.tensions.length >= 2) score += 25;
  if (signals.discovery.constraints.length >= 2) score += 20;
  const totalPads =
    signals.liveSession.reimaginePads.length +
    signals.liveSession.constraintPads.length +
    signals.liveSession.defineApproachPads.length;
  if (totalPads >= 10) score += 25;
  else if (totalPads >= 3) score += 15;
  return score; // max 100
}

export function gateDiscoveryValidation(result: DiscoveryValidation, evidenceScore: number): DiscoveryValidation {
  if (evidenceScore < 30) {
    return { ...result, hypothesisAccuracy: null };
  }
  // Detect exact anchor value copied from prompt schema
  if (result.hypothesisAccuracy === 75) {
    return { ...result, hypothesisAccuracy: null };
  }
  return result;
}

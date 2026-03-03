/**
 * Output Dashboard Types
 *
 * Types for the 5-section decision-intelligence output dashboard.
 * All scoring is deterministic. No GPT-decided ordering.
 */

import type { AlignmentHeatmapData } from './discover-analysis';
import type { HemisphereDiagnostic, DiagnosticDelta } from './hemisphere-diagnostic';

// ── Section Navigation ────────────────────────────────────────

export type OutputSection =
  | 'executive-summary'
  | 'mindset-shift'
  | 'journey-intelligence'
  | 'strategic-decisions'
  | 'constraints-friction';

// ── Strategic Decisions (Section 4) ───────────────────────────

export interface DeclaredEndState {
  whatWeAreBuilding: string;
  whyItMatters: string;
  successLooksLike: string;
}

export interface StrategicPillar {
  title: string;
  outcomeStatement: string;
  journeyImpact: string;
  actorImpact: string;
  keyTensionToResolve: string;
}

export interface DirectionItem {
  action: string;
  owner: string;
  riskExposure: string;
  timeframe: '30-day' | '60-day';
}

export interface StrategicDecisionsData {
  declaredEndState: DeclaredEndState;
  pillars: StrategicPillar[];
  direction: DirectionItem[];
}

// ── Actor Alignment Matrix (Section 3B) ───────────────────────

export interface ActorAlignmentEntry {
  actor: string;
  /** Normalized sentiment index (-1 to +1) */
  sentimentIndex: number;
  frictionAreas: string[];
  desiredFutureState: string;
  capabilityGap: string;
  /** Number of data points for this actor */
  sampleSize: number;
  /** Variance of alignment scores (divergence via variance, not volume) */
  divergenceVariance: number;
}

// ── Constraint Impact (Section 5) ─────────────────────────────

export interface ConstraintImpactEntry {
  id: string;
  description: string;
  domain: string;
  dependencyCount: number;
  actorSpread: number;
  /** 1=moderate, 2=significant, 3=critical */
  severity: number;
  /** dependencyCount x actorSpread x severity */
  impactScore: number;
  /** true = structural blocker, false = operational irritation */
  isStructural: boolean;
}

// ── Normalization ─────────────────────────────────────────────

export interface NormalizationResult {
  /** 0-1 ratio of participation imbalance */
  participationImbalance: number;
  /** Warning message if imbalance > 30%, null otherwise */
  imbalanceWarning: string | null;
  /** Actor name to count mapping */
  actorGroupSizes: Record<string, number>;
  totalParticipants: number;
}

// ── Computed Confidence Score ──────────────────────────────────

export interface ComputedConfidenceScore {
  /** Raw score: (certain - hedged) / total */
  raw: number;
  /** Adjusted for actor distribution imbalance */
  adjusted: number;
  /** Total statement count used */
  totalStatements: number;
}

// ── Cognitive Shift Delta ─────────────────────────────────────

export interface CognitiveShiftDelta {
  /** Change in overall creative density */
  creativeDelta: number;
  /** Change in overall constraint density */
  constraintDelta: number;
  /** Change in balance score (0-100) */
  balanceDelta: number;
  /** Domains that moved toward creativity */
  domainsMoreCreative: string[];
  /** Domains that moved toward constraints */
  domainsMoreConstrained: string[];
  /** Domains that stayed stable */
  domainsStable: string[];
  /** Overall shift description */
  shiftDescription: string;
}

// ── Quality Control ───────────────────────────────────────────

export interface QualityControlResult {
  warnings: string[];
  ready: boolean;
}

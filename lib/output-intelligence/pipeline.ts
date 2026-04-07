/**
 * DREAM Output Intelligence — Pipeline
 *
 * Orchestrates all 5 intelligence agents in parallel using Promise.allSettled.
 * Returns typed results and handles partial failures gracefully.
 */

import { prisma } from '@/lib/prisma';
import { aggregateWorkshopSignals } from './signal-aggregator';
import type { WorkshopSignals, WorkshopOutputIntelligence, EngineKey, ReportSummary, StoredOutputIntelligence } from './types';
import {
  computeStrategicEvidenceScore,
  gateStrategicImpact,
  computeDiscoveryEvidenceScore,
  gateDiscoveryValidation,
} from './evidence-gating';
import { runDiscoveryValidationAgent } from './agents/discovery-validation-agent';
import { runReportSummaryAgent } from './agents/report-summary-agent';
import { runRootCauseAgent } from './agents/root-cause-agent';
import { runFutureStateAgent } from './agents/future-state-agent';
import { runExecutionRoadmapAgent } from './agents/execution-roadmap-agent';
import { runStrategicImpactAgent } from './agents/strategic-impact-agent';
import { runCausalSynthesisAgent } from './agents/causal-synthesis-agent';
import { buildTransformationLogicMap } from './engines/transformation-logic-engine';

export type EngineProgressCallback = (engine: EngineKey, event: 'started' | 'complete' | 'error', detail?: string) => void;

export interface PipelineResult {
  intelligence: WorkshopOutputIntelligence;
  errors: Partial<Record<EngineKey, string>>;
}

// ── Fallback values for failed engines ───────────────────────────────────────

function discoveryValidationFallback() {
  return {
    confirmedIssues: [],
    newIssues: [],
    reducedIssues: [],
    hypothesisAccuracy: null,
    summary: 'Discovery validation could not be completed due to insufficient signal data.',
  };
}

function rootCauseFallback() {
  return {
    rootCauses: [],
    systemicPattern: 'Root cause analysis could not be completed due to insufficient signal data.',
    frictionMap: [],
  };
}

function futureStateFallback() {
  return {
    targetOperatingModel: 'Future state could not be generated due to insufficient workshop signals.',
    aiHumanModel: [],
    operatingModelChanges: [],
    redesignPrinciples: [],
    narrative: '',
  };
}

function executionRoadmapFallback() {
  return {
    phases: [
      {
        phase: 'Phase 1 — Immediate Enablement' as const,
        timeframe: 'To be determined',
        initiatives: [],
        capabilities: [],
        dependencies: [],
        constraints: [],
      },
      {
        phase: 'Phase 2 — Structural Transformation' as const,
        timeframe: 'To be determined',
        initiatives: [],
        capabilities: [],
        dependencies: [],
        constraints: [],
      },
      {
        phase: 'Phase 3 — Advanced Automation' as const,
        timeframe: 'To be determined',
        initiatives: [],
        capabilities: [],
        dependencies: [],
        constraints: [],
      },
    ],
    criticalPath: 'Roadmap could not be generated — insufficient signal data.',
    keyRisks: [],
  };
}

function strategicImpactFallback() {
  return {
    automationPotential: null,
    aiAssistedWork: null,
    humanOnlyWork: null,
    efficiencyGains: [],
    experienceImprovements: [],
    businessCaseSummary: 'Strategic impact could not be calculated due to insufficient signal data.',
    confidenceScore: null,
  };
}

// ── Pipeline ────────────────────────────────────────────────────────────────

export async function runIntelligencePipeline(
  signals: WorkshopSignals,
  onEngineProgress?: EngineProgressCallback
): Promise<PipelineResult> {
  const errors: Partial<Record<EngineKey, string>> = {};

  // Notify all engines starting
  const engines: EngineKey[] = [
    'discoveryValidation',
    'rootCause',
    'futureState',
    'roadmap',
    'strategicImpact',
  ];
  engines.forEach((e) => onEngineProgress?.(e, 'started'));

  // Run all 6 agents in parallel (5 LLM agents + 1 graph-backed causal synthesis)
  const [dv, rc, fs, er, si, cs] = await Promise.allSettled([
    runDiscoveryValidationAgent(signals, (msg) => console.log(msg)),
    runRootCauseAgent(signals, (msg) => console.log(msg)),
    runFutureStateAgent(signals, (msg) => console.log(msg)),
    runExecutionRoadmapAgent(signals, (msg) => console.log(msg)),
    runStrategicImpactAgent(signals, (msg) => console.log(msg)),
    runCausalSynthesisAgent(signals, (msg) => console.log(msg)),
  ]);

  // Compute evidence scores for gating
  const strategicEvidenceScore = computeStrategicEvidenceScore(signals);
  const discoveryEvidenceScore = computeDiscoveryEvidenceScore(signals);

  // Resolve results with fallbacks and evidence gating
  const discoveryValidation =
    dv.status === 'fulfilled'
      ? gateDiscoveryValidation(dv.value, discoveryEvidenceScore)
      : (errors.discoveryValidation = dv.reason instanceof Error ? dv.reason.message : String(dv.reason),
         discoveryValidationFallback());

  const rootCause =
    rc.status === 'fulfilled'
      ? rc.value
      : (errors.rootCause = rc.reason instanceof Error ? rc.reason.message : String(rc.reason),
         rootCauseFallback());

  const futureState =
    fs.status === 'fulfilled'
      ? fs.value
      : (errors.futureState = fs.reason instanceof Error ? fs.reason.message : String(fs.reason),
         futureStateFallback());

  const roadmap =
    er.status === 'fulfilled'
      ? er.value
      : (errors.roadmap = er.reason instanceof Error ? er.reason.message : String(er.reason),
         executionRoadmapFallback());

  const strategicImpact =
    si.status === 'fulfilled'
      ? gateStrategicImpact(si.value, strategicEvidenceScore)
      : (errors.strategicImpact = si.reason instanceof Error ? si.reason.message : String(si.reason),
         strategicImpactFallback());

  // Emit completion/error events
  onEngineProgress?.('discoveryValidation', dv.status === 'fulfilled' ? 'complete' : 'error', errors.discoveryValidation);
  onEngineProgress?.('rootCause', rc.status === 'fulfilled' ? 'complete' : 'error', errors.rootCause);
  onEngineProgress?.('futureState', fs.status === 'fulfilled' ? 'complete' : 'error', errors.futureState);
  onEngineProgress?.('roadmap', er.status === 'fulfilled' ? 'complete' : 'error', errors.roadmap);
  onEngineProgress?.('strategicImpact', si.status === 'fulfilled' ? 'complete' : 'error', errors.strategicImpact);

  // Causal synthesis — optional, null when graph has insufficient data
  const causalIntelligence =
    cs.status === 'fulfilled' && cs.value !== null
      ? cs.value
      : undefined;
  // Causal synthesis failures are silent (no error logged — null result is valid when graph is absent)

  // Transformation Logic Map — deterministic, no LLM — derived from graphIntelligence
  let transformationLogicMap: WorkshopOutputIntelligence['transformationLogicMap'];
  if (signals.graphIntelligence && (
    signals.graphIntelligence.dominantCausalChains.length > 0 ||
    signals.graphIntelligence.bottlenecks.length > 0 ||
    signals.graphIntelligence.brokenChains.length > 0
  )) {
    try {
      transformationLogicMap = buildTransformationLogicMap(signals.graphIntelligence);
    } catch (err) {
      console.error('[pipeline] transformation logic map build failed:', err);
    }
  }

  const intelligence: WorkshopOutputIntelligence = {
    discoveryValidation,
    rootCause,
    futureState,
    roadmap,
    strategicImpact,
    causalIntelligence,
    transformationLogicMap,
    generatedAtMs: Date.now(),
    lensesUsed: signals.context.lenses,
  };

  return { intelligence, errors };
}

// ── Report Summary Pipeline ───────────────────────────────────────────────────
// Reads all existing intelligence from DB, calls single GPT-4o agent,
// stores result in workshop.reportSummary JSON field, returns it.

export async function runReportSummaryPipeline(
  workshopId: string,
  onProgress?: (msg: string) => void
): Promise<ReportSummary> {
  onProgress?.('Loading workshop intelligence…');

  // 1. Load existing output intelligence from DB
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { outputIntelligence: true, reportSummary: true },
  });

  if (!workshop) throw new Error(`Workshop ${workshopId} not found`);
  if (!workshop.outputIntelligence) {
    throw new Error('Output intelligence not yet generated. Run "Generate Analysis" first.');
  }

  const stored = workshop.outputIntelligence as unknown as StoredOutputIntelligence;
  const intelligence = stored.intelligence;

  // 2. Aggregate signals for context
  onProgress?.('Aggregating workshop signals…');
  const signals = await aggregateWorkshopSignals(workshopId);

  // 3. Run single GPT-4o report summary agent
  const generatedReportSummary = await runReportSummaryAgent(signals, intelligence, onProgress);
  const existingReportSummary = (workshop.reportSummary ?? {}) as Partial<ReportSummary>;
  // Use `in` rather than `??` so that an explicit null stored by the PATCH route
  // (meaning "user cleared this field") is preserved rather than overwritten by AI output.
  const reportSummary: ReportSummary = {
    ...generatedReportSummary,
    layout: 'layout' in existingReportSummary ? existingReportSummary.layout : generatedReportSummary.layout,
    reportConclusion: 'reportConclusion' in existingReportSummary ? existingReportSummary.reportConclusion : generatedReportSummary.reportConclusion,
    facilitatorContact: 'facilitatorContact' in existingReportSummary ? existingReportSummary.facilitatorContact : generatedReportSummary.facilitatorContact,
    signalMapImageUrl: 'signalMapImageUrl' in existingReportSummary ? existingReportSummary.signalMapImageUrl : generatedReportSummary.signalMapImageUrl,
  };

  // 4. Store in DB (non-fatal — column may not exist until prisma db push is run)
  try {
    await prisma.workshop.update({
      where: { id: workshopId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { reportSummary: reportSummary as any },
    });
  } catch (err) {
    console.error('[Report Summary] DB store failed (run prisma db push):', err);
  }

  return reportSummary;
}

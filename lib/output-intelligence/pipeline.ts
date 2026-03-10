/**
 * DREAM Output Intelligence — Pipeline
 *
 * Orchestrates all 5 intelligence agents in parallel using Promise.allSettled.
 * Returns typed results and handles partial failures gracefully.
 */

import { prisma } from '@/lib/prisma';
import { aggregateWorkshopSignals } from './signal-aggregator';
import type { WorkshopSignals, WorkshopOutputIntelligence, EngineKey, ReportSummary, StoredOutputIntelligence } from './types';
import { runDiscoveryValidationAgent } from './agents/discovery-validation-agent';
import { runReportSummaryAgent } from './agents/report-summary-agent';
import { runRootCauseAgent } from './agents/root-cause-agent';
import { runFutureStateAgent } from './agents/future-state-agent';
import { runExecutionRoadmapAgent } from './agents/execution-roadmap-agent';
import { runStrategicImpactAgent } from './agents/strategic-impact-agent';

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
    hypothesisAccuracy: 0,
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
    automationPotential: { percentage: 0, description: 'Could not be calculated' },
    aiAssistedWork: { percentage: 0, description: 'Could not be calculated' },
    humanOnlyWork: { percentage: 100, description: 'Could not be calculated' },
    efficiencyGains: [],
    experienceImprovements: [],
    businessCaseSummary: 'Strategic impact could not be calculated due to insufficient signal data.',
    confidenceScore: 0,
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

  // Run all 5 agents in parallel
  const [dv, rc, fs, er, si] = await Promise.allSettled([
    runDiscoveryValidationAgent(signals, (msg) => console.log(msg)),
    runRootCauseAgent(signals, (msg) => console.log(msg)),
    runFutureStateAgent(signals, (msg) => console.log(msg)),
    runExecutionRoadmapAgent(signals, (msg) => console.log(msg)),
    runStrategicImpactAgent(signals, (msg) => console.log(msg)),
  ]);

  // Resolve results with fallbacks
  const discoveryValidation =
    dv.status === 'fulfilled'
      ? dv.value
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
      ? si.value
      : (errors.strategicImpact = si.reason instanceof Error ? si.reason.message : String(si.reason),
         strategicImpactFallback());

  // Emit completion/error events
  onEngineProgress?.('discoveryValidation', dv.status === 'fulfilled' ? 'complete' : 'error', errors.discoveryValidation);
  onEngineProgress?.('rootCause', rc.status === 'fulfilled' ? 'complete' : 'error', errors.rootCause);
  onEngineProgress?.('futureState', fs.status === 'fulfilled' ? 'complete' : 'error', errors.futureState);
  onEngineProgress?.('roadmap', er.status === 'fulfilled' ? 'complete' : 'error', errors.roadmap);
  onEngineProgress?.('strategicImpact', si.status === 'fulfilled' ? 'complete' : 'error', errors.strategicImpact);

  const intelligence: WorkshopOutputIntelligence = {
    discoveryValidation,
    rootCause,
    futureState,
    roadmap,
    strategicImpact,
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
    select: { outputIntelligence: true },
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
  const reportSummary = await runReportSummaryAgent(signals, intelligence, onProgress);

  // 4. Store in DB
  await prisma.workshop.update({
    where: { id: workshopId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { reportSummary: reportSummary as any },
  });

  return reportSummary;
}

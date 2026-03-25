/**
 * DREAM Output Intelligence — Signal Aggregator
 *
 * Collects all available workshop signals into a single WorkshopSignals
 * object for consumption by the 5 intelligence agents.
 *
 * Gracefully handles missing data at every stage.
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { WorkshopSignals } from './types';
import { retrieveRelevant } from '@/lib/embeddings/retrieve';
import { groupRole } from '@/lib/discover-analysis/compute-alignment';
import { buildWorkshopGraphIntelligence } from '@/lib/output/build-workshop-graph';

// ── Types from DB shapes ─────────────────────────────────────────────────────

type DiscoverAnalysis = {
  tensions?: Array<{ topic: string; perspectives: string[]; severity?: string }>;
  constraints?: Array<{ title: string; description?: string; type?: string }>;
  alignment?: { score?: number };
  narrativeDivergence?: number;
};

type SnapshotPayload = {
  nodesById?: Record<string, { rawText: string; dialoguePhase?: string; classification?: { primaryType?: string }; lens?: string }>;
  nodes?: Record<string, { rawText: string; dialoguePhase?: string; classification?: { primaryType?: string }; lens?: string }>;
  journey?: Array<{ stage: string; description?: string; aiAgencyScore?: number; painPoints?: string[] }>;
  hemisphereShift?: number;
};

// ── Helper ───────────────────────────────────────────────────────────────────

function safeJson<T>(val: unknown): T | null {
  if (!val || typeof val !== 'object') return null;
  return val as T;
}

function truncate(str: string, maxLen = 300): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ── Main aggregator ──────────────────────────────────────────────────────────

export async function aggregateWorkshopSignals(workshopId: string): Promise<WorkshopSignals> {
  // Split into two parallel queries:
  // 1. Core metadata + insights + themes (small fields, fast)
  // 2. Latest snapshot payload (potentially large blob, run in parallel)
  const [workshop, latestSnapshotRows] = await Promise.all([
    prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        organizationId: true,
        name: true,
        description: true,
        clientName: true,
        businessContext: true,
        industry: true,
        discoveryQuestions: true,
        blueprint: true,
        prepResearch: true,
        discoverAnalysis: true,
        insights: {
          take: 200,
          select: { id: true, text: true, insightType: true, category: true, participantId: true },
        },
        themes: {
          take: 50,
          select: { themeLabel: true, themeDescription: true },
        },
        scratchpad: {
          select: {
            execSummary: true,
            potentialSolution: true,
            summaryContent: true,
          },
        },
        participants: {
          select: { id: true, role: true, department: true },
        },
      },
    }),
    prisma.liveWorkshopSnapshot.findFirst({
      where: { workshopId },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    }),
  ]);

  if (!workshop) {
    throw new Error(`Workshop ${workshopId} not found`);
  }

  // ── Context: Lenses ─────────────────────────────────────────────────────

  let lenses: string[] = [];

  // Try blueprint first — blueprint stores lenses as { name, description, color, keywords }
  // (Some older blueprints may use `label` instead of `name` — handle both)
  const blueprint = safeJson<{ lenses?: Array<{ name?: string; label?: string }> }>(workshop.blueprint);
  if (blueprint?.lenses && Array.isArray(blueprint.lenses)) {
    lenses = blueprint.lenses.map((l) => l.name ?? l.label ?? '').filter(Boolean);
  }

  // Fall back to discoveryQuestions
  if (lenses.length === 0) {
    const dq = safeJson<Array<{ lens?: string; label?: string }>>(workshop.discoveryQuestions);
    if (Array.isArray(dq)) {
      lenses = [...new Set(dq.map((q) => q.lens ?? q.label ?? '').filter(Boolean))];
    }
  }

  // Final fallback — only if blueprint and discoveryQuestions both have no lenses
  if (lenses.length === 0) {
    lenses = ['People', 'Organisation', 'Customer', 'Technology'];
  }

  // ── Context: Objectives — full Plan phase context ────────────────────────
  // Build a rich objectives string from all available Plan phase sources so
  // the AI agents understand the actual workshop ask, not just businessContext.

  const prepResearch = safeJson<{
    workshopObjective?: string;
    businessContext?: string;
    companyOverview?: string;
    keyPublicChallenges?: string[];
    industryContext?: string;
  }>(workshop.prepResearch);

  const objectiveParts: string[] = [];

  // Workshop description = "why we are doing this" (set in Plan phase)
  if (workshop.description) {
    objectiveParts.push(`Workshop Purpose: ${workshop.description}`);
  }

  // Business context = desired outcomes
  if (workshop.businessContext) {
    objectiveParts.push(`Desired Outcomes: ${workshop.businessContext}`);
  }

  // Specific challenge areas from research agent (the real "what needs solving")
  if (prepResearch?.keyPublicChallenges && prepResearch.keyPublicChallenges.length > 0) {
    objectiveParts.push(
      `Key Challenge Areas:\n${prepResearch.keyPublicChallenges.map((c) => `• ${c}`).join('\n')}`
    );
  }

  // Industry / operational context (e.g. "contact centre", "airline", "retail")
  if (prepResearch?.industryContext) {
    objectiveParts.push(`Industry Context: ${prepResearch.industryContext}`);
  }

  // Legacy field fallbacks
  if (objectiveParts.length === 0) {
    const legacy = prepResearch?.workshopObjective
      ?? prepResearch?.businessContext
      ?? prepResearch?.companyOverview
      ?? '';
    if (legacy) objectiveParts.push(legacy);
  }

  const objectives = objectiveParts.filter(Boolean).join('\n\n');

  // ── Discovery Signals ────────────────────────────────────────────────────

  const da = safeJson<DiscoverAnalysis>(workshop.discoverAnalysis);

  const tensions = Array.isArray(da?.tensions) ? da.tensions : [];
  const constraints = Array.isArray(da?.constraints) ? da.constraints : [];
  const alignment = da?.alignment?.score ?? null;
  const narrativeDivergence = da?.narrativeDivergence ?? null;

  const themes = workshop.themes.map((t) =>
    t.themeDescription ? `${t.themeLabel}: ${t.themeDescription}` : t.themeLabel
  );

  const insights = workshop.insights.map((i) => ({
    text: truncate(i.text),
    type: i.insightType,
    category: i.category ?? undefined,
  }));

  // ── Cohort Breakdown ─────────────────────────────────────────────────────
  // Groups insights by participant role cohort so OI agents can identify
  // role-specific root causes and cross-cohort divergence.

  const cohortBreakdown = (() => {
    // Build participantId → { role, department } map
    const participantMap = new Map<string, { role: string | null; department: string | null }>();
    for (const p of workshop.participants) {
      participantMap.set(p.id, { role: p.role ?? null, department: p.department ?? null });
    }

    // Group insights by cohort label
    type CohortAcc = {
      roles: Set<string>;
      participantIds: Set<string>;
      frictions: string[];
      aspirations: string[];
      allInsights: Array<{ text: string; type: string }>;
    };
    const cohortMap = new Map<string, CohortAcc>();

    const ASPIRATION_TYPES = new Set(['VISION', 'OPPORTUNITY', 'ENABLER']);
    const FRICTION_TYPES = new Set(['CHALLENGE', 'CONSTRAINT', 'FRICTION']);

    for (const insight of workshop.insights) {
      if (!insight.participantId) continue;
      const participant = participantMap.get(insight.participantId);
      if (!participant) continue;

      const cohortLabel = groupRole(participant.role);
      if (!cohortMap.has(cohortLabel)) {
        cohortMap.set(cohortLabel, { roles: new Set(), participantIds: new Set(), frictions: [], aspirations: [], allInsights: [] });
      }
      const acc = cohortMap.get(cohortLabel)!;
      acc.participantIds.add(insight.participantId);
      if (participant.role) acc.roles.add(participant.role);

      const insightType = String(insight.insightType).toUpperCase();
      const text = truncate(insight.text, 200);
      acc.allInsights.push({ text, type: insightType });
      if (FRICTION_TYPES.has(insightType)) acc.frictions.push(text);
      if (ASPIRATION_TYPES.has(insightType)) acc.aspirations.push(text);
    }

    const result: NonNullable<WorkshopSignals['discovery']['cohortBreakdown']> = [];
    for (const [cohortLabel, acc] of cohortMap) {
      if (acc.allInsights.length === 0) continue;
      const aspirationRatio = acc.allInsights.length > 0
        ? acc.aspirations.length / acc.allInsights.length
        : 0;
      result.push({
        cohortLabel,
        roles: [...acc.roles],
        participantCount: acc.participantIds.size,
        aspirationRatio,
        topFrictions: acc.frictions.slice(0, 3),
        topAspirations: acc.aspirations.slice(0, 3),
        insightSample: acc.allInsights.slice(0, 8),
      });
    }

    // Sort by participant count descending (most represented cohort first)
    result.sort((a, b) => b.participantCount - a.participantCount);
    return result.length > 0 ? result : undefined;
  })();

  // ── Live Session Signals ─────────────────────────────────────────────────

  const reimaginePads: WorkshopSignals['liveSession']['reimaginePads'] = [];
  const constraintPads: WorkshopSignals['liveSession']['constraintPads'] = [];
  const defineApproachPads: WorkshopSignals['liveSession']['defineApproachPads'] = [];
  let journey: WorkshopSignals['liveSession']['journey'] = [];
  let hemisphereShift: number | null = null;

  const latestSnapshot = latestSnapshotRows;
  if (latestSnapshot) {
    const payload = safeJson<SnapshotPayload>(latestSnapshot.payload);
    const rawNodes = payload?.nodesById ?? payload?.nodes ?? {};

    for (const node of Object.values(rawNodes)) {
      if (!node.rawText) continue;
      const pad = {
        text: truncate(node.rawText, 400),
        type: node.classification?.primaryType ?? undefined,
        lens: node.lens ?? undefined,
      };
      const phase = node.dialoguePhase?.toUpperCase();
      if (phase === 'REIMAGINE') reimaginePads.push(pad);
      else if (phase === 'CONSTRAINTS') constraintPads.push(pad);
      else if (phase === 'DEFINE_APPROACH') defineApproachPads.push(pad);
    }

    if (Array.isArray(payload?.journey)) {
      journey = payload.journey.map((j) => ({
        stage: j.stage,
        description: j.description,
        aiScore: j.aiAgencyScore,
        painPoints: j.painPoints,
      }));
    }

    // Fallback: derive journey stages from liveJourney.interactions (seeded workshops)
    if (journey.length === 0) {
      const lj = (latestSnapshot.payload as Record<string, unknown> | null)?.liveJourney;
      if (lj && typeof lj === 'object' && !Array.isArray(lj)) {
        const interactions = (lj as Record<string, unknown>).interactions;
        if (Array.isArray(interactions)) {
          const stageMap = new Map<string, { actions: string[]; painPoints: string[]; aiScores: number[] }>();
          for (const ix of interactions as Array<Record<string, unknown>>) {
            const stage = typeof ix.stage === 'string' ? ix.stage : '';
            if (!stage) continue;
            if (!stageMap.has(stage)) stageMap.set(stage, { actions: [], painPoints: [], aiScores: [] });
            const entry = stageMap.get(stage)!;
            if (typeof ix.action === 'string' && ix.action) entry.actions.push(truncate(ix.action, 200));
            if (ix.isPainPoint && typeof ix.action === 'string') entry.painPoints.push(truncate(ix.action, 150));
            if (ix.aiAgencyNow === 'autonomous') entry.aiScores.push(0.9);
            else if (ix.aiAgencyNow === 'assisted') entry.aiScores.push(0.5);
            else entry.aiScores.push(0.1);
          }
          for (const [stage, data] of stageMap) {
            const avgAiScore = data.aiScores.length > 0
              ? data.aiScores.reduce((a, b) => a + b, 0) / data.aiScores.length
              : undefined;
            journey.push({
              stage,
              description: data.actions.slice(0, 2).join(' '),
              aiScore: avgAiScore,
              painPoints: data.painPoints.slice(0, 3),
            });
          }
        }
      }
    }

    hemisphereShift = payload?.hemisphereShift ?? null;
  }

  // ── Scratchpad Signals ───────────────────────────────────────────────────

  function extractText(json: unknown): string | null {
    if (!json) return null;
    if (typeof json === 'string') return truncate(json, 800);
    if (typeof json === 'object') {
      // Extract string values from objects
      const vals = Object.values(json as Record<string, unknown>)
        .filter((v) => typeof v === 'string')
        .map((v) => truncate(v as string, 200));
      return vals.length > 0 ? vals.join('\n') : null;
    }
    return null;
  }

  const execSummary = extractText(workshop.scratchpad?.execSummary);
  const potentialSolution = extractText(workshop.scratchpad?.potentialSolution);
  const summaryContent = extractText(workshop.scratchpad?.summaryContent);

  // ── Assemble WorkshopSignals ──────────────────────────────────────────────

  const signals: WorkshopSignals = {
    context: {
      workshopName: workshop.name,
      clientName: workshop.clientName ?? '',
      businessContext: workshop.businessContext ?? prepResearch?.companyOverview ?? '',
      industry: workshop.industry ?? '',
      lenses,
      objectives,
    },
    discovery: {
      themes,
      tensions,
      constraints,
      alignment,
      narrativeDivergence,
      participantCount: workshop.participants.length,
      insights,
      cohortBreakdown,
    },
    liveSession: {
      reimaginePads,
      constraintPads,
      defineApproachPads,
      journey,
      hemisphereShift,
    },
    scratchpad: {
      execSummary,
      potentialSolution,
      summaryContent,
    },
  };

  // ── Relationship Graph Intelligence ──────────────────────────────────────
  // Builds a deterministic causal graph from live snapshot nodes + discovery
  // insights. Gracefully skips when nodes have no theme labels (graph will be
  // empty) or when no snapshot exists yet.
  try {
    const rawNodeMap = latestSnapshot
      ? ((safeJson<SnapshotPayload>(latestSnapshot.payload)?.nodesById
          ?? safeJson<SnapshotPayload>(latestSnapshot.payload)?.nodes) ?? {})
      : {};

    const graphIntelligence = buildWorkshopGraphIntelligence({
      workshopId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodesById: rawNodeMap as any,
      insights: workshop.insights,
      participants: workshop.participants,
    });

    // Only attach when the graph has meaningful coverage
    if (graphIntelligence.summary.graphCoverageScore > 0 || graphIntelligence.summary.totalChains > 0) {
      signals.graphIntelligence = graphIntelligence;
    }
  } catch (err) {
    console.error('[signal-aggregator] graph intelligence build failed:', err);
  }

  // ── Historical Memory — cross-workshop semantic retrieval ─────────────────
  // Finds semantically relevant findings from other past workshops in this org.
  // Gracefully skips if embeddings aren't populated yet or retrieval fails.
  try {
    const memoryQuery = [workshop.businessContext, workshop.industry, objectives]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 500);

    if (memoryQuery.trim()) {
      const chunks = await retrieveRelevant(memoryQuery, {
        organizationId: workshop.organizationId,
        excludeWorkshopId: workshopId,   // exclude the current workshop
        sources: ['discovery_themes', 'conversation_insights', 'data_points'],
        topK: 6,
        minSimilarity: 0.74,
      });
      if (chunks.length > 0) {
        signals.historicalMemory = {
          chunks: chunks.map((c) => ({
            text: c.text,
            source: c.source,
            similarity: c.similarity,
          })),
          queryUsed: memoryQuery,
        };
      }
    }
  } catch (err) {
    console.error('[signal-aggregator] historicalMemory retrieval failed:', err);
  }

  return signals;
}

// ── Signals hash (detects stale intelligence) ─────────────────────────────────

export function computeSignalsHash(signals: WorkshopSignals): string {
  const content = JSON.stringify({
    themes: signals.discovery.themes,
    tensionCount: signals.discovery.tensions.length,
    reimagineCount: signals.liveSession.reimaginePads.length,
    constraintCount: signals.liveSession.constraintPads.length,
    defineCount: signals.liveSession.defineApproachPads.length,
    participantCount: signals.discovery.participantCount,
    lenses: signals.context.lenses,
  });
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

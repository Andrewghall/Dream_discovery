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
  // Fetch workshop + all related data in one query
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      name: true,
      clientName: true,
      businessContext: true,
      industry: true,
      discoveryQuestions: true,
      blueprint: true,
      prepResearch: true,
      discoverAnalysis: true,
      insights: {
        take: 200,
        select: { text: true, insightType: true, category: true },
      },
      themes: {
        take: 50,
        select: { themeLabel: true, themeDescription: true },
      },
      liveSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { payload: true },
      },
      scratchpad: {
        select: {
          execSummary: true,
          potentialSolution: true,
          summaryContent: true,
        },
      },
      participants: {
        select: { id: true },
      },
    },
  });

  if (!workshop) {
    throw new Error(`Workshop ${workshopId} not found`);
  }

  // ── Context: Lenses ─────────────────────────────────────────────────────

  let lenses: string[] = [];

  // Try blueprint first
  const blueprint = safeJson<{ lenses?: Array<{ label: string }> }>(workshop.blueprint);
  if (blueprint?.lenses && Array.isArray(blueprint.lenses)) {
    lenses = blueprint.lenses.map((l) => l.label).filter(Boolean);
  }

  // Fall back to discoveryQuestions
  if (lenses.length === 0) {
    const dq = safeJson<Array<{ lens?: string; label?: string }>>(workshop.discoveryQuestions);
    if (Array.isArray(dq)) {
      lenses = [...new Set(dq.map((q) => q.lens ?? q.label ?? '').filter(Boolean))];
    }
  }

  // Final fallback
  if (lenses.length === 0) {
    lenses = ['People', 'Organisation', 'Customer', 'Technology'];
  }

  // ── Context: Objectives from prep research ──────────────────────────────

  const prepResearch = safeJson<{
    workshopObjective?: string;
    businessContext?: string;
    companyOverview?: string;
    keyPublicChallenges?: string[];
  }>(workshop.prepResearch);

  const objectives = prepResearch?.workshopObjective
    ?? prepResearch?.businessContext
    ?? workshop.businessContext
    ?? '';

  // ── Discovery Signals ────────────────────────────────────────────────────

  const da = safeJson<DiscoverAnalysis>(workshop.discoverAnalysis);

  const tensions = da?.tensions ?? [];
  const constraints = da?.constraints ?? [];
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

  // ── Live Session Signals ─────────────────────────────────────────────────

  let reimaginePads: WorkshopSignals['liveSession']['reimaginePads'] = [];
  let constraintPads: WorkshopSignals['liveSession']['constraintPads'] = [];
  let defineApproachPads: WorkshopSignals['liveSession']['defineApproachPads'] = [];
  let journey: WorkshopSignals['liveSession']['journey'] = [];
  let hemisphereShift: number | null = null;

  const latestSnapshot = workshop.liveSnapshots[0];
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

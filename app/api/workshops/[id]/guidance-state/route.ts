/**
 * /api/workshops/[id]/guidance-state
 *
 * GET  --Returns current guidance state for the workshop
 *        With ?init=true: also loads prep data (customQuestions, research, briefing)
 *        from the DB and populates prepContext in the in-memory guidance state.
 * POST --Updates guidance state (facilitator actions)
 *
 * This endpoint syncs facilitator-side state to the server so agents
 * can read it before invoking. Updates include: advance theme, modify
 * journey, toggle freeflow, change dialogue phase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import {
  getGuidanceState,
  getOrCreateGuidanceState,
  updateGuidanceState,
  type GuidedTheme,
} from '@/lib/cognition/guidance-state';
import type { DialoguePhase } from '@/lib/cognitive-guidance/pipeline';
import type { WorkshopPrepResearch, WorkshopIntelligence } from '@/lib/cognition/agents/agent-types';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import { readHistoricalMetricsFromJson } from '@/lib/historical-metrics/types';

export const dynamic = 'force-dynamic';

// ── Auth helper ─────────────────────────────────────────

async function authenticateWorkshop(workshopId: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: 'Unauthorized', status: 401 };

  const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!validation.valid) return { error: validation.error, status: 403 };

  return { error: null, status: 200 };
}

// ══════════════════════════════════════════════════════════════
// GET --Return current guidance state
// ══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const { error, status } = await authenticateWorkshop(workshopId);
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const isInit = searchParams.get('init') === 'true';

  // ── Init mode: load prep data from DB and populate guidance state ──
  if (isInit) {
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        clientName: true,
        industry: true,
        dreamTrack: true,
        targetDomain: true,
        prepResearch: true,
        customQuestions: true,
        discoveryBriefing: true,
        blueprint: true,
        historicalMetrics: true,
      },
    });

    if (workshop) {
      // Ensure guidance state exists
      const state = getOrCreateGuidanceState(workshopId);

      // Parse blueprint and historical metrics from DB JSON
      const blueprint = readBlueprintFromJson((workshop as any).blueprint);
      const historicalMetrics = readHistoricalMetricsFromJson(workshop.historicalMetrics);

      // Populate prepContext + blueprint + historicalMetrics if not already set
      if (!state.prepContext) {
        const bpCoverage = blueprint?.questionPolicy?.coverageThresholdPercent;
        updateGuidanceState(workshopId, {
          prepContext: {
            clientName: workshop.clientName,
            industry: workshop.industry,
            dreamTrack: workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
            targetDomain: workshop.targetDomain,
            research: workshop.prepResearch as unknown as WorkshopPrepResearch | null,
            discoveryIntelligence: workshop.discoveryBriefing as unknown as WorkshopIntelligence | null,
          },
          blueprint,
          historicalMetrics,
          ...(bpCoverage != null ? { coverageThreshold: bpCoverage } : {}),
        });
      } else {
        // Blueprint or metrics may have been generated/uploaded after the first init
        if (!state.blueprint && blueprint) {
          updateGuidanceState(workshopId, { blueprint });
        }
        if (!state.historicalMetrics && historicalMetrics) {
          updateGuidanceState(workshopId, { historicalMetrics });
        }
      }

      return NextResponse.json({
        guidanceState: getGuidanceState(workshopId),
        customQuestions: workshop.customQuestions || null,
        blueprint,
      });
    }
  }

  const state = getGuidanceState(workshopId);
  if (!state) {
    return NextResponse.json({
      guidanceState: null,
      customQuestions: null,
      message: 'No guidance state exists for this workshop yet.',
    });
  }

  return NextResponse.json({ guidanceState: state, customQuestions: null });
}

// ══════════════════════════════════════════════════════════════
// POST --Update guidance state
// ══════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const { error, status } = await authenticateWorkshop(workshopId);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json();

  // Ensure state exists
  getOrCreateGuidanceState(workshopId);

  // Build updates from body
  const updates: Parameters<typeof updateGuidanceState>[1] = {};

  if (typeof body.activeThemeId === 'string' || body.activeThemeId === null) {
    updates.activeThemeId = body.activeThemeId;
  }

  if (Array.isArray(body.themes)) {
    updates.themes = body.themes as GuidedTheme[];
  }

  if (typeof body.freeflowMode === 'boolean') {
    updates.freeflowMode = body.freeflowMode;
  }

  if (typeof body.dialoguePhase === 'string') {
    updates.dialoguePhase = body.dialoguePhase as DialoguePhase;
  }

  if (body.prepContext !== undefined) {
    updates.prepContext = body.prepContext;
  }

  if (body.currentMainQuestion !== undefined) {
    updates.currentMainQuestion = body.currentMainQuestion;
  }

  if (body.journeyCompletionState !== undefined) {
    updates.journeyCompletionState = body.journeyCompletionState;
  }

  if (body.coverageThreshold !== undefined) {
    const raw = Number(body.coverageThreshold);
    if (!Number.isNaN(raw)) {
      updates.coverageThreshold = Math.max(50, Math.min(95, Math.round(raw)));
    }
  }

  const updated = updateGuidanceState(workshopId, updates);

  return NextResponse.json({ guidanceState: updated });
}

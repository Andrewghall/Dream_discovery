/**
 * Hemisphere Diagnostic API
 *
 * GET — Computes organisational psyche diagnostic from hemisphere data.
 *
 * Returns before (Discovery baseline), after (Live snapshot), and delta.
 * Pure computation — no LLM calls. Deterministic from node/edge topology.
 *
 * Query params:
 *   ?snapshotId=xxx — Live snapshot to use for the "after" diagnostic
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { buildGraphFromSessions, buildGraphFromSnapshot } from '@/lib/hemisphere-diagnostic/build-hemisphere-graph';
import { computeDiagnostic } from '@/lib/hemisphere-diagnostic/compute-diagnostic';
import { computeDiagnosticDelta } from '@/lib/hemisphere-diagnostic/compute-delta';
import { getDimensionNames } from '@/lib/cognition/workshop-dimensions';
import type { WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';

export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const snapshotId = request.nextUrl.searchParams.get('snapshotId') || null;

    // Fetch workshop metadata for dimensions
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { prepResearch: true },
    });

    const prepResearch = workshop?.prepResearch as WorkshopPrepResearch | null;
    const dimensions = getDimensionNames(prepResearch);

    // Also fetch dimension names for the builder (for phaseTag mapping)
    const industryDimensions = Array.isArray(prepResearch?.industryDimensions)
      ? (prepResearch!.industryDimensions as Array<{ name: string }>).map(d => d.name)
      : null;

    // ── Build "before" diagnostic (Discovery sessions) ──────
    let before = null;
    try {
      const beforeGraph = await buildGraphFromSessions(workshopId, 'BASELINE', industryDimensions);
      if (beforeGraph.nodes.length > 0) {
        before = computeDiagnostic(
          beforeGraph.nodes,
          beforeGraph.edges,
          workshopId,
          null,
          dimensions,
        );
      }
    } catch (error) {
      console.warn('[Diagnostic] Failed to build before graph:', error);
    }

    // ── Build "after" diagnostic (Live snapshot) ─────────────
    let after = null;
    if (snapshotId) {
      try {
        const snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
          where: { id: snapshotId, workshopId },
        }) as { id: string; payload: unknown } | null;

        if (snapshot) {
          const payload = snapshot.payload as Record<string, unknown> | null;
          const afterGraph = buildGraphFromSnapshot(payload, industryDimensions);
          if (afterGraph.nodes.length > 0) {
            after = computeDiagnostic(
              afterGraph.nodes,
              afterGraph.edges,
              workshopId,
              snapshotId,
              dimensions,
            );
          }
        }
      } catch (error) {
        console.warn('[Diagnostic] Failed to build after graph:', error);
      }
    }

    // ── Compute delta if both exist ─────────────────────────
    let delta = null;
    if (before && after) {
      delta = computeDiagnosticDelta(before, after);
    }

    return NextResponse.json({
      ok: true,
      before,
      after,
      delta,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Diagnostic] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Diagnostic failed' },
      { status: 500 },
    );
  }
}

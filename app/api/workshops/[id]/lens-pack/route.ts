/**
 * /api/workshops/[id]/lens-pack
 *
 * GET — Returns the EthentaFlow LensPack for this workshop, built from
 *       prepResearch.industryDimensions. This is the source of truth for
 *       domain scoring vocabulary during live capture.
 *
 * Response shape:
 *   { ok: true,  lensPack: LensPack, source: 'prep_research' | 'default', dimensionCount: number }
 *   { ok: false, error: string } on auth failure
 *   { ok: true,  lensPack: null,    source: 'missing', reason: string } if no prep data
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import {
  buildLensPackFromPrepResearch,
  DEFAULT_LENS_PACK,
  type PrepIndustryDimension,
} from '@/lib/ethentaflow/lens-pack-ontology';
import type { WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true, prepResearch: true },
  });

  if (!workshop) {
    return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });
  }

  const research = workshop.prepResearch as WorkshopPrepResearch | null;
  const dimensions = research?.industryDimensions;

  // ── No prep research ─────────────────────────────────────────────────────
  if (!dimensions || dimensions.length === 0) {
    console.warn(
      `[LensPack] Workshop ${workshopId} ("${workshop.name}") has no industryDimensions in prepResearch. ` +
      `Domain scorer will use DEFAULT_LENS_PACK. Run the Research Agent to generate prep data.`,
    );
    return NextResponse.json({
      ok: true,
      lensPack: null,
      source: 'missing' as const,
      reason: research
        ? 'prepResearch exists but industryDimensions is empty or null — run Research Agent'
        : 'no prepResearch found for this workshop — run Research Agent',
      dimensionCount: 0,
    });
  }

  // ── Build workshop-specific lens pack ───────────────────────────────────
  try {
    const lensPack = buildLensPackFromPrepResearch(
      workshopId,
      workshop.name,
      dimensions as PrepIndustryDimension[],
    );

    console.log(
      `[LensPack] Built lens pack for workshop ${workshopId} ("${workshop.name}") ` +
      `with ${lensPack.domains.length} domains: ${lensPack.domains.map(d => d.name).join(', ')}`,
    );

    return NextResponse.json({
      ok: true,
      lensPack,
      source: 'prep_research' as const,
      dimensionCount: lensPack.domains.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[LensPack] Build failed for workshop ${workshopId}:`, msg);
    // Return default rather than 500 — live capture must not be blocked
    return NextResponse.json({
      ok: true,
      lensPack: DEFAULT_LENS_PACK,
      source: 'default_fallback' as const,
      reason: `Build error: ${msg}`,
      dimensionCount: DEFAULT_LENS_PACK.domains.length,
    });
  }
}

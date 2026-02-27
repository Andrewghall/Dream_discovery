import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workshops/[id]/agentic-analyses?since=<ISO timestamp>
 *
 * Polls for agentic analyses created since a given timestamp.
 * Used by the cognitive guidance page to pick up GPT-4o-mini results
 * that can't reliably be delivered via in-memory SSE on Vercel.
 *
 * Returns analyses with domains, themes, actors — the data needed
 * by buildLiveJourney() to populate the journey map and by
 * applyLensMapping() to enrich CogNode domains.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const since = request.nextUrl.searchParams.get('since');
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 60_000); // Default: last 60s

  const analyses = await prisma.agenticAnalysis.findMany({
    where: {
      dataPoint: { workshopId },
      createdAt: { gt: sinceDate },
    },
    select: {
      dataPointId: true,
      domains: true,
      themes: true,
      actors: true,
      semanticMeaning: true,
      sentimentTone: true,
      overallConfidence: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 50, // Cap to prevent oversized responses
  });

  return NextResponse.json({ analyses });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/workshops/[id]/raw-transcript?since=<sequence>
 *
 * Returns raw_transcript_entries in arrival order.
 * Optional `since` param returns only entries with sequence > since,
 * for incremental polling.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: workshopId } = await params;
  const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const sinceParam = req.nextUrl.searchParams.get('since');
  const since = sinceParam !== null && Number.isFinite(Number(sinceParam)) ? Number(sinceParam) : -1;

  const entries = await prisma.rawTranscriptEntry.findMany({
    where: {
      workshopId,
      ...(since >= 0 ? { sequence: { gt: since } } : {}),
    },
    orderBy: [{ sequence: 'asc' }, { startTimeMs: 'asc' }],
    select: {
      id: true,
      sequence: true,
      speakerId: true,
      text: true,
      startTimeMs: true,
      endTimeMs: true,
      speechFinal: true,
      confidence: true,
    },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      sequence: e.sequence,
      speakerId: e.speakerId,
      text: e.text,
      startTimeMs: e.startTimeMs.toString(),
      endTimeMs: e.endTimeMs.toString(),
      speechFinal: e.speechFinal,
      confidence: e.confidence,
    })),
  });
}

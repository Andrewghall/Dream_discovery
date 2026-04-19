import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/workshops/[id]/debug/trace
 *
 * Returns the full ingest trace for a workshop:
 *   ThoughtWindows → linked TranscriptChunks → DataPoint (if created)
 *
 * Used by the replay debugger at /admin/workshops/[id]/debug/trace
 * to show exactly where each spoken passage became a hemisphere node,
 * was blocked, or was stored as raw capture only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: workshopId } = await params;
  const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true },
  });
  if (!workshop) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Load all ThoughtWindows with their linked chunks and DataPoint
  const rawWindows = await prisma.thoughtWindow.findMany({
    where: { workshopId },
    orderBy: { openedAtMs: 'asc' },
  });

  // Load chunks linked to these windows
  const windowIds = rawWindows.map((w) => w.id);

  const [chunks, dataPoints] = await Promise.all([
    prisma.transcriptChunk.findMany({
      where: { thoughtWindowId: { in: windowIds } },
      select: {
        id: true,
        text: true,
        startTimeMs: true,
        speakerId: true,
        source: true,
        thoughtWindowId: true,
      },
      orderBy: { startTimeMs: 'asc' },
    }),
    prisma.dataPoint.findMany({
      where: { thoughtWindowId: { in: windowIds } },
      select: {
        id: true,
        rawText: true,
        sequenceIndex: true,
        reasoningRole: true,
        sourceWindowId: true,
        thoughtWindowId: true,
        classification: {
          select: { primaryType: true, confidence: true },
        },
      },
    }),
  ]);

  // Load split siblings
  const sourceWindowIds = dataPoints
    .map((d) => d.sourceWindowId)
    .filter((id): id is string => !!id);

  const siblings = sourceWindowIds.length > 0
    ? await prisma.dataPoint.findMany({
        where: { workshopId, sourceWindowId: { in: sourceWindowIds } },
        select: {
          id: true,
          rawText: true,
          sequenceIndex: true,
          reasoningRole: true,
          sourceWindowId: true,
          thoughtWindowId: true,
        },
        orderBy: [{ sourceWindowId: 'asc' }, { sequenceIndex: 'asc' }],
      })
    : [];

  // Build lookup maps
  const chunksByWindow = chunks.reduce<Record<string, typeof chunks>>((acc, c) => {
    if (c.thoughtWindowId) (acc[c.thoughtWindowId] ??= []).push(c);
    return acc;
  }, {});

  const dpByWindow = dataPoints.reduce<Record<string, (typeof dataPoints)[number]>>((acc, d) => {
    if (d.thoughtWindowId) acc[d.thoughtWindowId] = d;
    return acc;
  }, {});

  const siblingsBySource = siblings.reduce<Record<string, typeof siblings>>((acc, s) => {
    if (s.sourceWindowId) (acc[s.sourceWindowId] ??= []).push(s);
    return acc;
  }, {});

  // Shape response
  const shaped = rawWindows.map((w) => {
    const dp = dpByWindow[w.id];
    const windowChunks = chunksByWindow[w.id] ?? [];
    const dpSiblings = dp?.sourceWindowId
      ? (siblingsBySource[dp.sourceWindowId] ?? []).filter((s) => s.thoughtWindowId !== dp.thoughtWindowId)
      : [];

    return {
      id: w.id,
      speakerId: w.speakerId,
      state: w.state,
      fullText: w.fullText,
      resolvedText: w.resolvedText,
      openedAtMs: w.openedAtMs.toString(),
      spokenRecordCount: w.spokenRecordCount,
      chunks: windowChunks.map((c) => ({
        id: c.id,
        text: c.text,
        startTimeMs: c.startTimeMs.toString(),
        speakerId: c.speakerId,
        source: c.source,
      })),
      dataPoint: dp ? {
        id: dp.id,
        rawText: dp.rawText,
        sequenceIndex: dp.sequenceIndex,
        reasoningRole: dp.reasoningRole,
        sourceWindowId: dp.sourceWindowId,
        primaryType: dp.classification?.primaryType ?? null,
        confidence: dp.classification?.confidence ?? null,
        siblings: dpSiblings.map((s) => ({
          id: s.id,
          rawText: s.rawText,
          sequenceIndex: s.sequenceIndex,
          reasoningRole: s.reasoningRole,
        })),
      } : null,
      blocked: w.state === 'EXPIRED' && !dp,
      blockReason: (w.state === 'EXPIRED' && !dp) ? 'window expired without DataPoint' : null,
    };
  });

  return NextResponse.json({
    workshopName: workshop.name,
    windows: shaped,
    totalWindows: shaped.length,
    totalDataPoints: shaped.filter((w) => w.dataPoint).length,
    totalBlocked: shaped.filter((w) => w.blocked).length,
  });
}

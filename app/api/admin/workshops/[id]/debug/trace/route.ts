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

  const rawWindows = await prisma.thoughtWindow.findMany({
    where: { workshopId },
    orderBy: { openedAtMs: 'asc' },
  });

  const windowIds = rawWindows.map((w) => w.id);

  // Raw transcript entries matched to windows by speaker + time range.
  // raw_transcript_entries is the source of truth — never modified.
  const [rawEntries, dataPoints] = await Promise.all([
    prisma.rawTranscriptEntry.findMany({
      where: { workshopId },
      select: {
        id: true,
        text: true,
        startTimeMs: true,
        endTimeMs: true,
        speakerId: true,
        speechFinal: true,
        sequence: true,
      },
      orderBy: [{ sequence: 'asc' }, { startTimeMs: 'asc' }],
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

  // Match raw entries to windows by speaker + time range.
  // Windows have openedAtMs/lastActivityAtMs; entries have startTimeMs.
  // Allow ±2s tolerance for clock jitter between client write and window open.
  const TOLERANCE_MS = BigInt(2_000);
  const chunksByWindow = rawWindows.reduce<Record<string, typeof rawEntries>>((acc, w) => {
    const low = w.openedAtMs - TOLERANCE_MS;
    const high = w.lastActivityAtMs + TOLERANCE_MS;
    const matches = rawEntries.filter(
      (e) =>
        e.speakerId === w.speakerId &&
        e.startTimeMs >= low &&
        e.startTimeMs <= high,
    );
    if (matches.length > 0) acc[w.id] = matches;
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
        speechFinal: c.speechFinal,
        sequence: c.sequence,
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

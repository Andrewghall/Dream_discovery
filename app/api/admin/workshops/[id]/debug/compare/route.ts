import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const TOLERANCE_MS = BigInt(2_000);

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

  const [rawEntries, rawWindows, dataPoints, outboxEvents] = await Promise.all([
    prisma.rawTranscriptEntry.findMany({
      where: { workshopId },
      orderBy: [{ sequence: 'asc' }, { startTimeMs: 'asc' }],
      select: {
        id: true,
        workshopId: true,
        sequence: true,
        speakerId: true,
        text: true,
        startTimeMs: true,
        endTimeMs: true,
        speechFinal: true,
        confidence: true,
        createdAt: true,
      },
    }),
    prisma.thoughtWindow.findMany({
      where: { workshopId },
      orderBy: { openedAtMs: 'asc' },
      select: {
        id: true,
        speakerId: true,
        state: true,
        fullText: true,
        resolvedText: true,
        openedAtMs: true,
        lastActivityAtMs: true,
        closedAtMs: true,
        extractionNote: true,
      },
    }),
    prisma.dataPoint.findMany({
      where: { workshopId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        thoughtWindowId: true,
        sourceWindowId: true,
        rawText: true,
        createdAt: true,
        spokenRecordIds: true,
        sequenceIndex: true,
        reasoningRole: true,
      },
    }),
    prisma.workshopEventOutbox.findMany({
      where: { workshopId, type: 'datapoint.created' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, payload: true },
    }),
  ]);

  const dpsByWindowId = new Map<string, typeof dataPoints>();
  for (const dp of dataPoints) {
    if (!dp.thoughtWindowId) continue;
    if (!dpsByWindowId.has(dp.thoughtWindowId)) dpsByWindowId.set(dp.thoughtWindowId, []);
    dpsByWindowId.get(dp.thoughtWindowId)!.push(dp);
  }

  const outboxByDpId = new Map<string, (typeof outboxEvents)[number]>();
  for (const ev of outboxEvents) {
    const payload = ev.payload as Record<string, unknown>;
    const dpNode = payload?.dataPoint as Record<string, unknown> | undefined;
    const dpId = typeof dpNode?.id === 'string' ? dpNode.id : null;
    if (dpId && !outboxByDpId.has(dpId)) outboxByDpId.set(dpId, ev);
  }

  const matchedRawIds = new Set<string>();

  const windowRows = rawWindows.map((w) => {
    const low = w.openedAtMs - TOLERANCE_MS;
    const high = w.lastActivityAtMs + TOLERANCE_MS;
    const matchedRaw = rawEntries.filter((e) => {
      if (e.speakerId !== w.speakerId) return false;
      if (e.startTimeMs < low || e.startTimeMs > high) return false;
      return true;
    });
    for (const raw of matchedRaw) matchedRawIds.add(raw.id);

    const dps = dpsByWindowId.get(w.id) ?? [];
    const extractUnits = dps.map((dp) => ({
      id: dp.id,
      text: dp.rawText,
      sequenceIndex: dp.sequenceIndex,
      reasoningRole: dp.reasoningRole,
    }));
    const emitEvents = dps
      .map((dp) => {
        const event = outboxByDpId.get(dp.id);
        return event
          ? {
              id: event.id,
              dataPointId: dp.id,
              createdAt: event.createdAt.toISOString(),
            }
          : null;
      })
      .filter((event): event is NonNullable<typeof event> => event !== null);
    const firstRaw = matchedRaw[0] ?? null;
    const firstStored = matchedRaw[0] ?? null;
    const commitTime = w.closedAtMs ? Number(w.closedAtMs) : null;
    const hemisphereTime = emitEvents[0] ? new Date(emitEvents[0].createdAt).getTime() : null;
    const accepted = dps.length > 0 ? true : (w.state === 'EXPIRED' ? false : null);
    const rejectionReason =
      dps.length === 0
        ? (w.extractionNote ?? (w.state === 'EXPIRED' ? 'window expired without DataPoint' : null))
        : null;

    return {
      id: `window:${w.id}`,
      sortTimeMs: firstRaw ? Number(firstRaw.startTimeMs) : Number(w.openedAtMs),
      speakerId: w.speakerId,
      searchText: [
        matchedRaw.map((r) => r.text).join(' '),
        w.fullText,
        w.resolvedText ?? '',
        dps.map((dp) => dp.rawText).join(' '),
      ].join(' ').toLowerCase(),
      capture: {
        rows: matchedRaw.map((raw) => ({
          id: raw.id,
          sequence: raw.sequence,
          timestampMs: raw.startTimeMs.toString(),
          speakerId: raw.speakerId,
          rawText: raw.text,
          isFinal: true,
          speechFinal: raw.speechFinal,
          confidence: raw.confidence,
        })),
      },
      stored: {
        rows: matchedRaw.map((raw) => ({
          id: raw.id,
          workshopId: raw.workshopId,
          linkedSourceChunkId: raw.id,
          writeTimestamp: raw.createdAt.toISOString(),
          speakerId: raw.speakerId,
          rawText: raw.text,
        })),
      },
      processed: {
        thoughtWindowId: w.id,
        commitId: w.id,
        commitTimeMs: commitTime,
        committedText: w.resolvedText ?? w.fullText,
        extractedUnits: extractUnits,
        accepted,
        rejectionReason,
        dataPointIds: dps.map((dp) => dp.id),
        hemisphereText: dps.map((dp) => dp.rawText),
        hemisphereTimeMs: hemisphereTime,
        emitEvents,
        sourceChunkIds: dps.flatMap((dp) => dp.spokenRecordIds),
      },
      timing: {
        captureTimeMs: firstRaw ? Number(firstRaw.startTimeMs) : null,
        storedTimeMs: firstStored ? new Date(firstStored.createdAt).getTime() : null,
        commitTimeMs: commitTime,
        hemisphereTimeMs: hemisphereTime,
      },
    };
  });

  const rawOnlyRows = rawEntries
    .filter((raw) => !matchedRawIds.has(raw.id))
    .map((raw) => ({
      id: `raw:${raw.id}`,
      sortTimeMs: Number(raw.startTimeMs),
      speakerId: raw.speakerId,
      searchText: raw.text.toLowerCase(),
      capture: {
        rows: [{
          id: raw.id,
          sequence: raw.sequence,
          timestampMs: raw.startTimeMs.toString(),
          speakerId: raw.speakerId,
          rawText: raw.text,
          isFinal: true,
          speechFinal: raw.speechFinal,
          confidence: raw.confidence,
        }],
      },
      stored: {
        rows: [{
          id: raw.id,
          workshopId: raw.workshopId,
          linkedSourceChunkId: raw.id,
          writeTimestamp: raw.createdAt.toISOString(),
          speakerId: raw.speakerId,
          rawText: raw.text,
        }],
      },
      processed: {
        thoughtWindowId: null,
        commitId: null,
        commitTimeMs: null,
        committedText: null,
        extractedUnits: [],
        accepted: null,
        rejectionReason: null,
        dataPointIds: [],
        hemisphereText: [],
        hemisphereTimeMs: null,
        emitEvents: [],
        sourceChunkIds: [raw.id],
      },
      timing: {
        captureTimeMs: Number(raw.startTimeMs),
        storedTimeMs: new Date(raw.createdAt).getTime(),
        commitTimeMs: null,
        hemisphereTimeMs: null,
      },
    }));

  const rows = [...windowRows, ...rawOnlyRows]
    .sort((a, b) => a.sortTimeMs - b.sortTimeMs)
    .map((row) => {
      const captureToStoredMs =
        row.timing.captureTimeMs !== null && row.timing.storedTimeMs !== null
          ? row.timing.storedTimeMs - row.timing.captureTimeMs
          : null;
      const storedToCommitMs =
        row.timing.storedTimeMs !== null && row.timing.commitTimeMs !== null
          ? row.timing.commitTimeMs - row.timing.storedTimeMs
          : null;
      const commitToHemisphereMs =
        row.timing.commitTimeMs !== null && row.timing.hemisphereTimeMs !== null
          ? row.timing.hemisphereTimeMs - row.timing.commitTimeMs
          : null;
      const totalMs =
        row.timing.captureTimeMs !== null && row.timing.hemisphereTimeMs !== null
          ? row.timing.hemisphereTimeMs - row.timing.captureTimeMs
          : null;

      return {
        ...row,
        timing: {
          ...row.timing,
          captureToStoredMs,
          storedToCommitMs,
          commitToHemisphereMs,
          totalMs,
        },
      };
    });

  return NextResponse.json({
    workshopId,
    workshopName: workshop.name,
    rows,
    generatedAt: new Date().toISOString(),
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';

import type { TraceOutcome, TraceEntry, TraceResponse, TraceEmitEvent, TraceDataPointUnit, TraceTiming } from '@/lib/debug/trace-types';

export const dynamic = 'force-dynamic';

const TOLERANCE_MS = BigInt(2_000);

// ──────────────────────────────────────────────────────────────────────────────
// Route handler
// ──────────────────────────────────────────────────────────────────────────────

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

  // ── Fetch all data in parallel ──────────────────────────────────────────────
  const [rawWindows, rawEntries, allDataPoints, outboxEvents] = await Promise.all([
    prisma.thoughtWindow.findMany({
      where: { workshopId },
      orderBy: { openedAtMs: 'asc' },
    }),

    prisma.rawTranscriptEntry.findMany({
      where: { workshopId },
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
    }),

    prisma.dataPoint.findMany({
      where: { workshopId },
      include: {
        classification: { select: { primaryType: true, confidence: true, suggestedArea: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.workshopEventOutbox.findMany({
      where: { workshopId, type: 'datapoint.created' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, payload: true, createdAt: true },
    }),
  ]);

  // ── Index DataPoints by thoughtWindowId ────────────────────────────────────
  const dpByWindowId = new Map<string, typeof allDataPoints>();
  for (const dp of allDataPoints) {
    if (!dp.thoughtWindowId) continue;
    if (!dpByWindowId.has(dp.thoughtWindowId)) dpByWindowId.set(dp.thoughtWindowId, []);
    dpByWindowId.get(dp.thoughtWindowId)!.push(dp);
  }

  // ── Index outbox events by dataPointId ─────────────────────────────────────
  type OutboxRow = (typeof outboxEvents)[number];
  const outboxByDpId = new Map<string, OutboxRow>();
  for (const ev of outboxEvents) {
    const p = ev.payload as Record<string, unknown>;
    const dpNode = p?.dataPoint as Record<string, unknown> | undefined;
    const dpId = typeof dpNode?.id === 'string' ? dpNode.id : null;
    if (dpId && !outboxByDpId.has(dpId)) outboxByDpId.set(dpId, ev);
  }

  // ── Match raw entries → windows ────────────────────────────────────────────
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

  const sessionStartMs = rawEntries[0]?.startTimeMs ?? rawWindows[0]?.openedAtMs ?? null;

  // ── Build trace entries ────────────────────────────────────────────────────
  const traces: TraceEntry[] = rawWindows.map((w) => {
    const chunks = chunksByWindow[w.id] ?? [];
    const dps = dpByWindowId.get(w.id) ?? [];
    const isResolved = w.state === 'RESOLVED';
    const isExpired = w.state === 'EXPIRED';
    const hasDataPoints = dps.length > 0;

    // Timing
    const firstChunkTs = chunks.length > 0 ? chunks[0].startTimeMs.toString() : null;
    const lastChunkTs = chunks.length > 0 ? chunks[chunks.length - 1].startTimeMs.toString() : null;
    const windowOpenTs = w.openedAtMs.toString();
    const windowCloseTs = w.closedAtMs ? w.closedAtMs.toString() : null;
    const dpCreateTs = hasDataPoints ? dps[0].createdAt.toISOString() : null;

    // Earliest emit event for this window's DataPoints
    const emitEvents: TraceEmitEvent[] = dps
      .map((dp) => {
        const ev = outboxByDpId.get(dp.id);
        if (!ev) return null;
        return { id: ev.id, type: ev.type, dataPointId: dp.id, createdAt: ev.createdAt.toISOString() };
      })
      .filter((x): x is TraceEmitEvent => x !== null);

    const earliestEmitTs = emitEvents.length > 0 ? emitEvents[0].createdAt : null;

    const timing: TraceTiming = {
      firstChunkTs,
      lastChunkTs,
      windowOpenTs,
      windowCloseTs,
      dataPointCreateTs: dpCreateTs,
      eventEmitTs: earliestEmitTs,
      firstChunkToCommitMs: firstChunkTs && windowCloseTs
        ? Number(windowCloseTs) - Number(firstChunkTs) : null,
      lastChunkToCommitMs: lastChunkTs && windowCloseTs
        ? Number(windowCloseTs) - Number(lastChunkTs) : null,
      commitToDataPointMs: windowCloseTs && dpCreateTs
        ? new Date(dpCreateTs).getTime() - Number(windowCloseTs) : null,
      dataPointToEmitMs: dpCreateTs && earliestEmitTs
        ? new Date(earliestEmitTs).getTime() - new Date(dpCreateTs).getTime() : null,
      totalEndToEndMs: firstChunkTs && earliestEmitTs
        ? new Date(earliestEmitTs).getTime() - Number(firstChunkTs) : null,
    };

    // Commit evaluation
    const commitPass = isResolved;
    const commitBlockReason = isExpired ? 'window expired without DataPoint' : null;
    const committedText = w.resolvedText ?? (isResolved ? w.fullText : null);
    const commitWordCount = committedText ? committedText.split(/\s+/).filter(Boolean).length : 0;

    // Extraction
    const extractionInputText = committedText;
    const extractionUnits: TraceDataPointUnit[] = dps.map((dp) => ({
      id: dp.id,
      rawText: dp.rawText,
      sequenceIndex: dp.sequenceIndex ?? null,
      reasoningRole: dp.reasoningRole ?? null,
      sourceWindowId: dp.sourceWindowId ?? null,
      createdAt: dp.createdAt.toISOString(),
      primaryType: dp.classification?.primaryType ?? null,
      primaryDomain: dp.classification?.suggestedArea ?? null,
      confidence: dp.classification?.confidence ?? null,
    }));

    const persistenceSkipped = isResolved && !hasDataPoints;
    const persistenceSkippedReason = persistenceSkipped
      ? 'extractor returned 0 meaning units' : null;

    // Hemisphere
    const emitted = emitEvents.length > 0;
    const hemisphereNodeIds = dps.map((dp) => dp.id);
    const hemisphereRendered = emitted;
    const hemisphereNote = !hasDataPoints ? 'No DataPoint created' :
      !emitted ? 'DataPoint created but no outbox event found' : null;

    // Outcome
    let outcome: TraceOutcome;
    if (!commitPass) outcome = 'blocked_at_commit';
    else if (!hasDataPoints) outcome = 'rejected_in_extraction';
    else if (!emitted) outcome = 'persisted_not_emitted';
    else outcome = 'rendered';

    // Summary
    let summary: string;
    if (outcome === 'blocked_at_commit') {
      summary = `${chunks.length} raw chunks → blocked at commit: ${commitBlockReason ?? 'window expired'}`;
    } else if (outcome === 'rejected_in_extraction') {
      summary = `${chunks.length} raw chunks → committed → extracted 0 units → no DataPoint`;
    } else if (outcome === 'persisted_not_emitted') {
      summary = `${chunks.length} raw chunks → committed → extracted ${dps.length} → created ${dps.length} DataPoints → not emitted`;
    } else {
      summary = `${chunks.length} raw chunks → committed → extracted ${dps.length} → created ${dps.length} DataPoints → rendered ${hemisphereNodeIds.length} nodes`;
    }

    return {
      windowId: w.id,
      speakerId: w.speakerId,
      windowState: w.state,

      rawChunks: chunks.map((c) => ({
        id: c.id,
        sequence: c.sequence,
        speakerId: c.speakerId,
        text: c.text,
        startTimeMs: c.startTimeMs.toString(),
        endTimeMs: c.endTimeMs.toString(),
        speechFinal: c.speechFinal,
        confidence: c.confidence,
      })),

      windowOpenTs,
      windowCloseTs,
      windowFullText: w.fullText,
      windowResolvedText: w.resolvedText ?? null,
      windowChunkCount: w.spokenRecordCount,

      commitPass,
      commitBlockReason,
      commitWordCount,
      commitTrigger: isExpired ? 'expired' : isResolved ? 'resolved' : 'open',

      committedText,
      commitTs: windowCloseTs,

      extractionInputText,
      extractionUnitsProduced: dps.length,
      extractionUnits,
      extractionNote: w.extractionNote ?? null,

      dataPoints: extractionUnits,
      persistenceSkipped,
      persistenceSkippedReason,

      emitEvents,
      emitted,

      hemisphereNodeIds,
      hemisphereRendered,
      hemisphereNote,

      timing,
      summary,
      outcome,
    };
  });

  const totalRendered = traces.filter((t) => t.outcome === 'rendered').length;
  const totalBlocked = traces.filter((t) => t.outcome === 'blocked_at_commit').length;
  const totalRejected = traces.filter((t) => t.outcome === 'rejected_in_extraction').length;

  return NextResponse.json({
    workshopName: workshop.name,
    traces,
    totalTraces: traces.length,
    totalRendered,
    totalBlocked,
    totalRejected,
    sessionStartMs: sessionStartMs?.toString() ?? null,
  } satisfies TraceResponse);
}

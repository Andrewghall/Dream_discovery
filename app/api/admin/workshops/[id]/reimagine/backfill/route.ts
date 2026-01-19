import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { ensureReimagineSignal } from '@/lib/reimagine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BackfillBody = {
  limit?: number;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;

    const p = prisma as any;

    const startedAt = Date.now();
    const deadlineMs = 8000;

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId }, select: { id: true } });
    if (!workshop) return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as BackfillBody;
    const take = Number.isFinite(body?.limit) ? Math.max(1, Math.min(60, Math.floor(body.limit as number))) : 20;

    const dataPoints = (await p.dataPoint.findMany({
      where: {
        workshopId,
        reimagineSignal: { is: null },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        rawText: true,
        annotation: { select: { dialoguePhase: true } },
      },
      take,
    })) as Array<{ id: string; rawText: string; annotation: { dialoguePhase: unknown } | null }>;

    let attempted = 0;
    let errors = 0;

    for (const dp of dataPoints) {
      if (Date.now() - startedAt > deadlineMs) break;
      const rawText = (dp.rawText || '').trim();
      if (!rawText) continue;
      attempted += 1;
      try {
        void ensureReimagineSignal({
          workshopId,
          dataPointId: dp.id,
          rawText,
          dialoguePhase: (dp.annotation?.dialoguePhase as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null) || null,
        }).catch(() => {});
      } catch {
        errors += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      workshopId,
      scanned: dataPoints.length,
      attempted,
      errors,
      timedOut: Date.now() - startedAt > deadlineMs,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Backfill failed' }, { status: 500 });
  }
}

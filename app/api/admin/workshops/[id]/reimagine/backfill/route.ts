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

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId }, select: { id: true } });
    if (!workshop) return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as BackfillBody;
    const take = Number.isFinite(body?.limit) ? Math.max(1, Math.min(250, Math.floor(body.limit as number))) : 60;

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
      const rawText = (dp.rawText || '').trim();
      if (!rawText) continue;
      attempted += 1;
      try {
        await ensureReimagineSignal({
          workshopId,
          dataPointId: dp.id,
          rawText,
          dialoguePhase: (dp.annotation?.dialoguePhase as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null) || null,
        });
      } catch {
        errors += 1;
      }
    }

    const created = await p.reimagineSignal.count({
      where: { dataPointId: { in: dataPoints.map((d) => d.id) } },
    });

    return NextResponse.json({
      ok: true,
      workshopId,
      scanned: dataPoints.length,
      attempted,
      created,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Backfill failed' }, { status: 500 });
  }
}

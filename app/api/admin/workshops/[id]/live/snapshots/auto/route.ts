import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_UTTERANCES = 2000;

type AutoSnapshotBody = {
  name?: string | null;
  startIso?: string | null;
  endIso?: string | null;
  dialoguePhase?: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null;
};

function safePhase(value: unknown): AutoSnapshotBody['dialoguePhase'] {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (s === 'REIMAGINE' || s === 'CONSTRAINTS' || s === 'DEFINE_APPROACH') return s;
  return null;
}

function parseIso(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const body = (await request.json().catch(() => null)) as AutoSnapshotBody | null;

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const dialoguePhase = safePhase(body?.dialoguePhase) ?? 'REIMAGINE';
    const start = parseIso(body?.startIso);
    const end = parseIso(body?.endIso);

    if (!name) return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 });
    if (!start || !end) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid start/end ISO timestamps' }, { status: 400 });
    }

    const rows = await prisma.transcriptChunk.findMany({
      where: {
        workshopId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_UTTERANCES,
      select: {
        id: true,
        text: true,
        speakerId: true,
        startTimeMs: true,
        endTimeMs: true,
        createdAt: true,
      },
    });

    const utterances = rows
      .map((r) => ({
        rawText: r.text,
        speakerId: r.speakerId,
        startTimeMs: r.startTimeMs,
        endTimeMs: r.endTimeMs,
        createdAt: r.createdAt,
      }))
      .filter((u) => typeof u.rawText === 'string' && u.rawText.trim());

    const payload = {
      v: 2,
      source: 'transcript_chunks',
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      utterances,
      interpreted: [],
      synthesisByDomain: null,
      pressurePoints: [],
    };

    const created = (await (prisma as any).liveWorkshopSnapshot.create({
      data: {
        workshopId,
        name,
        dialoguePhase,
        payload,
      },
      select: { id: true, name: true, dialoguePhase: true, createdAt: true },
    })) as { id: string; name: string; dialoguePhase: string; createdAt: Date };

    return NextResponse.json({ ok: true, snapshot: created, utteranceCount: utterances.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create snapshot';
    console.error('Error creating auto snapshot:', error);
    return NextResponse.json({ ok: false, error: 'Failed to create snapshot', detail: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function prismaErrorDetail(error: unknown): { message: string; code?: string; meta?: unknown } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      message: error.message,
      code: error.code,
      meta: error.meta,
    };
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { message: error.message };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

function isMissingSnapshotsTable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('live_workshop_snapshots') &&
    (msg.includes('does not exist') || msg.includes('42P01') || msg.toLowerCase().includes('relation'))
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    const rows = (await (prisma as any).liveWorkshopSnapshot.findMany({
      where: { workshopId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        dialoguePhase: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 50,
    })) as Array<{
      id: string;
      name: string;
      dialoguePhase: string;
      createdAt: Date;
      updatedAt: Date;
    }>;

    return NextResponse.json({ ok: true, snapshots: rows });
  } catch (error) {
    if (isMissingSnapshotsTable(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Live snapshots are not available in this environment yet',
          detail:
            'Database is missing table live_workshop_snapshots. Apply the migration and redeploy.',
        },
        { status: 409 }
      );
    }
    console.error('Error listing live snapshots:', error);
    const detail = prismaErrorDetail(error);
    return NextResponse.json(
      { ok: false, error: 'Failed to list snapshots', detail: detail.message, code: detail.code, meta: detail.meta },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const body = (await request.json().catch(() => null)) as
      | {
          name?: unknown;
          dialoguePhase?: unknown;
          payload?: unknown;
        }
      | null;

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const dialoguePhase = typeof body?.dialoguePhase === 'string' ? body.dialoguePhase.trim() : '';
    const payload = body?.payload;

    if (!name) {
      return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 });
    }
    if (!dialoguePhase) {
      return NextResponse.json({ ok: false, error: 'Missing dialoguePhase' }, { status: 400 });
    }
    if (payload == null || typeof payload !== 'object') {
      return NextResponse.json({ ok: false, error: 'Missing payload' }, { status: 400 });
    }

     const workshopExists = await prisma.workshop.findUnique({
       where: { id: workshopId },
       select: { id: true },
     });
     if (!workshopExists) {
       return NextResponse.json(
         { ok: false, error: 'Workshop not found', detail: 'Cannot create snapshot for an unknown workshop' },
         { status: 404 }
       );
     }

    const created = (await (prisma as any).liveWorkshopSnapshot.create({
      data: {
        workshopId,
        name,
        dialoguePhase,
        payload,
      },
      select: {
        id: true,
        name: true,
        dialoguePhase: true,
        createdAt: true,
      },
    })) as { id: string; name: string; dialoguePhase: string; createdAt: Date };

    return NextResponse.json({ ok: true, snapshot: created });
  } catch (error) {
    if (isMissingSnapshotsTable(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Live snapshots are not available in this environment yet',
          detail:
            'Database is missing table live_workshop_snapshots. Apply the migration and redeploy.',
        },
        { status: 409 }
      );
    }
    const detail = prismaErrorDetail(error);
    if (detail.code === 'P2003') {
      return NextResponse.json(
        { ok: false, error: 'Failed to create snapshot', detail: detail.message, code: detail.code, meta: detail.meta },
        { status: 409 }
      );
    }
    console.error('Error creating live snapshot:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create snapshot', detail: detail.message, code: detail.code, meta: detail.meta },
      { status: 500 }
    );
  }
}

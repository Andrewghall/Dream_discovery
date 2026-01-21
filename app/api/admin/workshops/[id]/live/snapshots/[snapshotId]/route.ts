import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isMissingSnapshotsTable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('live_workshop_snapshots') &&
    (msg.includes('does not exist') || msg.includes('42P01') || msg.toLowerCase().includes('relation'))
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const { id: workshopId, snapshotId } = await params;

    const snap = (await (prisma as any).liveWorkshopSnapshot.findFirst({
      where: { id: snapshotId, workshopId },
      select: {
        id: true,
        name: true,
        dialoguePhase: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    })) as
      | {
          id: string;
          name: string;
          dialoguePhase: string;
          payload: unknown;
          createdAt: Date;
          updatedAt: Date;
        }
      | null;

    if (!snap) {
      return NextResponse.json({ ok: false, error: 'Snapshot not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, snapshot: snap });
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
    console.error('Error loading live snapshot:', error);
    return NextResponse.json({ ok: false, error: 'Failed to load snapshot' }, { status: 500 });
  }
}

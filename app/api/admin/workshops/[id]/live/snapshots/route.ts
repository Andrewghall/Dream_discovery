import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { CreateSnapshotSchema, zodError } from '@/lib/validation/schemas';

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

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
    return NextResponse.json({ ok: false, error: 'Failed to list snapshots' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }
    const parsedSnap = CreateSnapshotSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsedSnap.success) return zodError(parsedSnap.error);

    const name = parsedSnap.data.name?.trim() ?? '';
    const dialoguePhase = parsedSnap.data.dialoguePhase?.trim() ?? '';
    const payload = parsedSnap.data.payload;

    if (!name) {
      return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 });
    }
    if (!dialoguePhase) {
      return NextResponse.json({ ok: false, error: 'Missing dialoguePhase' }, { status: 400 });
    }
    if (payload == null) {
      return NextResponse.json({ ok: false, error: 'Missing payload' }, { status: 400 });
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
    console.error('Error creating live snapshot:', error);
    return NextResponse.json({ ok: false, error: 'Failed to create snapshot' }, { status: 500 });
  }
}

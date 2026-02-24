import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const { id: workshopId, snapshotId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
      where: {
        id: snapshotId,
        workshopId,
      },
    });

    if (!snapshot) {
      return NextResponse.json(
        { ok: false, error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      snapshot: {
        id: snapshot.id,
        name: snapshot.name,
        dialoguePhase: snapshot.dialoguePhase,
        payload: snapshot.payload,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
    });
  } catch (error) {
    console.error('[GET Snapshot] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load snapshot',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const { id: workshopId, snapshotId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }
    const body = await req.json();

    // Update the snapshot payload
    const snapshot = await (prisma as any).liveWorkshopSnapshot.update({
      where: {
        id: snapshotId,
        workshopId, // Ensure snapshot belongs to this workshop
      },
      data: {
        payload: body.payload,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      snapshot: {
        id: snapshot.id,
      },
    });
  } catch (error) {
    console.error('[PUT Snapshot] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to update snapshot',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

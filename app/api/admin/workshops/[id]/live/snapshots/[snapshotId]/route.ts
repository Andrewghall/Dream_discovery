import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const { id: workshopId, snapshotId } = await params;
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

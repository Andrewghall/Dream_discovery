import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const body = await request.json();
    const { name, email, role, department } = body;

    // Create participant with unique discovery token
    const participant = await prisma.workshopParticipant.create({
      data: {
        workshopId,
        name,
        email,
        role: role || null,
        department: department || null,
      },
    });

    return NextResponse.json({ participant });
  } catch (error) {
    console.error('Error adding participant:', error);
    return NextResponse.json(
      { error: 'Failed to add participant' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const body = await request.json().catch(() => ({}));
    const participantId = body?.participantId as string | undefined;

    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const participant = await prisma.workshopParticipant.findUnique({
      where: { id: participantId },
      select: { id: true, workshopId: true },
    });

    if (!participant || participant.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    await prisma.workshopParticipant.delete({
      where: { id: participantId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json(
      { error: 'Failed to remove participant' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const body = (await request.json().catch(() => null)) as
      | { participantId?: unknown; doNotSendAgain?: unknown }
      | null;

    const participantId = typeof body?.participantId === 'string' ? body.participantId : '';
    const doNotSendAgain = typeof body?.doNotSendAgain === 'boolean' ? body.doNotSendAgain : null;

    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    if (doNotSendAgain === null) {
      return NextResponse.json({ error: 'doNotSendAgain must be a boolean' }, { status: 400 });
    }

    const participant = await prisma.workshopParticipant.findUnique({
      where: { id: participantId },
      select: { id: true, workshopId: true },
    });

    if (!participant || participant.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const updated = await prisma.workshopParticipant.update({
      where: { id: participantId },
      data: { doNotSendAgain } as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ participant: updated });
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json(
      { error: 'Failed to update participant' },
      { status: 500 }
    );
  }
}

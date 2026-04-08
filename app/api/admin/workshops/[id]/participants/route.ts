import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit/audit-logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

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

    if (auth.organizationId) {
      logAuditEvent({ organizationId: auth.organizationId, userId: auth.userId ?? undefined, action: 'CREATE_PARTICIPANT', resourceType: 'participant', resourceId: participant.id, metadata: { workshopId, participantEmail: email, participantName: name }, success: true }).catch(err => console.error('[audit] create_participant:', err));
    }

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
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

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

    if (auth.organizationId) {
      logAuditEvent({ organizationId: auth.organizationId, userId: auth.userId ?? undefined, action: 'DELETE_PARTICIPANT', resourceType: 'participant', resourceId: participantId, metadata: { workshopId }, success: true }).catch(err => console.error('[audit] delete_participant:', err));
    }

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
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

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

    if (auth.organizationId) {
      logAuditEvent({ organizationId: auth.organizationId, userId: auth.userId ?? undefined, action: 'UPDATE_PARTICIPANT', resourceType: 'participant', resourceId: participantId, metadata: { workshopId, doNotSendAgain }, success: true }).catch(err => console.error('[audit] update_participant:', err));
    }

    return NextResponse.json({ participant: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Unknown argument') && message.includes('doNotSendAgain')) {
      return NextResponse.json(
        {
          error: 'Participant suppression flag is not available in this environment yet',
          detail:
            'Database is missing column doNotSendAgain. Apply the migration (ALTER TABLE workshop_participants ADD COLUMN doNotSendAgain BOOLEAN NOT NULL DEFAULT FALSE) and redeploy.',
        },
        { status: 409 }
      );
    }

    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 });
  }
}

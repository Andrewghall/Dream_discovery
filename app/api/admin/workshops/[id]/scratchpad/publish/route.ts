import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { logAuditEvent } from '@/lib/audit/audit-logger';

export async function POST(
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

    const scratchpad = await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    if (user.organizationId) {
      logAuditEvent({ organizationId: user.organizationId, userId: user.userId ?? undefined, action: 'PUBLISH_OUTPUT', resourceType: 'workshop', resourceId: workshopId, success: true }).catch(err => console.error('[audit] publish_output:', err));
    }

    return NextResponse.json({ scratchpad });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[scratchpad-publish] Failed to publish scratchpad:', message);
    return NextResponse.json(
      { error: 'Failed to publish scratchpad', details: { message } },
      { status: 500 }
    );
  }
}

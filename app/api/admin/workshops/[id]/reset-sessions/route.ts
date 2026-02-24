import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

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
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Delete all conversation sessions and messages for this workshop
    await prisma.conversationMessage.deleteMany({
      where: {
        session: {
          workshopId,
        },
      },
    });

    await prisma.conversationSession.deleteMany({
      where: { workshopId },
    });

    console.log(`✅ Reset all conversation sessions for workshop ${workshopId}`);

    return NextResponse.json({
      success: true,
      message: 'All conversation sessions reset',
    });
  } catch (error) {
    console.error('Error resetting sessions:', error);
    return NextResponse.json(
      { error: 'Failed to reset sessions' },
      { status: 500 }
    );
  }
}

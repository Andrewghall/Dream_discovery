import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

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

    // Clear emailSentAt for all participants in this workshop
    const result = await prisma.workshopParticipant.updateMany({
      where: { workshopId },
      data: { emailSentAt: null },
    });

    console.log(`✅ Cleared email status for ${result.count} participant(s)`);

    return NextResponse.json({
      success: true,
      clearedCount: result.count,
    });
  } catch (error) {
    console.error('Error clearing email status:', error);
    return NextResponse.json(
      { error: 'Failed to clear email status' },
      { status: 500 }
    );
  }
}

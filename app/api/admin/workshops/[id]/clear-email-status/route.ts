import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

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

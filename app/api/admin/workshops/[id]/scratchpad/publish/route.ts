import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    const scratchpad = await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ scratchpad });
  } catch (error) {
    console.error('Failed to publish scratchpad:', error);
    return NextResponse.json(
      { error: 'Failed to publish scratchpad' },
      { status: 500 }
    );
  }
}

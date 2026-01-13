import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    return NextResponse.json({ workshop });
  } catch (error) {
    console.error('Error fetching workshop:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workshop' },
      { status: 500 }
    );
  }
}

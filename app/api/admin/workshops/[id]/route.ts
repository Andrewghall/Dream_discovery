import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
          select: {
            id: true,
            workshopId: true,
            email: true,
            name: true,
            role: true,
            department: true,
            discoveryToken: true,
            attributionPreference: true,
            emailSentAt: true,
            responseStartedAt: true,
            responseCompletedAt: true,
            reminderSentAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    return NextResponse.json(
      { workshop },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error fetching workshop:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workshop' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const includeRegulation = body?.includeRegulation as boolean | undefined;

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    const updated = await prisma.workshop.update({
      where: { id },
      data: {
        ...(typeof includeRegulation === 'boolean' ? { includeRegulation } : {}),
      },
    });

    return NextResponse.json({ workshop: updated });
  } catch (error) {
    console.error('Error updating workshop:', error);
    return NextResponse.json(
      { error: 'Failed to update workshop' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    await prisma.workshop.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workshop:', error);
    return NextResponse.json(
      { error: 'Failed to delete workshop' },
      { status: 500 }
    );
  }
}

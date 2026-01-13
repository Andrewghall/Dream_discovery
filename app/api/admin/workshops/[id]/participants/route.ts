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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const body = await request.json();
    const { password } = body;

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update or create scratchpad with commercial password
    const scratchpad = await prisma.workshopScratchpad.upsert({
      where: { workshopId },
      update: {
        commercialPassword: hashedPassword,
        updatedAt: new Date(),
      },
      create: {
        workshopId,
        commercialPassword: hashedPassword,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Commercial password set successfully',
    });
  } catch (error) {
    console.error('Failed to set commercial password:', error);
    return NextResponse.json(
      { error: 'Failed to set commercial password' },
      { status: 500 }
    );
  }
}

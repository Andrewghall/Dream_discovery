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

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    const scratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
      select: { commercialPassword: true },
    });

    if (!scratchpad || !scratchpad.commercialPassword) {
      return NextResponse.json(
        { error: 'No password set for commercial section' },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(password, scratchpad.commercialPassword);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to verify password:', error);
    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    const scratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
    });

    // Return null scratchpad if not found (instead of 404)
    // This allows the UI to handle creation
    return NextResponse.json({ scratchpad: scratchpad || null });
  } catch (error) {
    console.error('Failed to fetch scratchpad:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scratchpad' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const body = await request.json();

    const scratchpad = await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: {
        execSummary: body.execSummary,
        discoveryOutput: body.discoveryOutput,
        reimagineContent: body.reimagineContent,
        constraintsContent: body.constraintsContent,
        commercialContent: body.commercialContent,
        summaryContent: body.summaryContent,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ scratchpad });
  } catch (error) {
    console.error('Failed to update scratchpad:', error);
    return NextResponse.json(
      { error: 'Failed to update scratchpad' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const body = await request.json();

    // Check if scratchpad already exists
    const existing = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Scratchpad already exists for this workshop' },
        { status: 400 }
      );
    }

    // Hash commercial password if provided
    let hashedPassword = null;
    if (body.commercialPassword) {
      hashedPassword = await bcrypt.hash(body.commercialPassword, 10);
    }

    // Create new scratchpad
    const scratchpad = await prisma.workshopScratchpad.create({
      data: {
        workshopId,
        execSummary: body.execSummary || null,
        discoveryOutput: body.discoveryOutput || null,
        reimagineContent: body.reimagineContent || null,
        constraintsContent: body.constraintsContent || null,
        commercialContent: body.commercialContent || null,
        commercialPassword: hashedPassword,
        summaryContent: body.summaryContent || null,
        generatedFromSnapshot: body.generatedFromSnapshot || null,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ scratchpad });
  } catch (error) {
    console.error('Failed to create scratchpad:', error);
    return NextResponse.json(
      { error: 'Failed to create scratchpad' },
      { status: 500 }
    );
  }
}

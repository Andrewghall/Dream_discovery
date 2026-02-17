import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { generateAgenticStrategy } from '@/lib/agents/sales-call-agent';
import type { MeetingPlan } from '@/lib/sales/sales-analysis';

export const dynamic = 'force-dynamic';

// GET — fetch the current meeting plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, name: true, workshopType: true, meetingPlan: true, organizationId: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ meetingPlan: workshop.meetingPlan || {} });
  } catch (error) {
    console.error('Error fetching meeting plan:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting plan' }, { status: 500 });
  }
}

// PUT — save/update the meeting plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;
    const body = await request.json();
    const { meetingPlan } = body;

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, organizationId: true, workshopType: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.workshop.update({
      where: { id: workshopId },
      data: { meetingPlan },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving meeting plan:', error);
    return NextResponse.json({ error: 'Failed to save meeting plan' }, { status: 500 });
  }
}

// POST — generate AI strategy from the meeting plan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, organizationId: true, meetingPlan: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const plan = (workshop.meetingPlan as MeetingPlan) || {};
    const result = await generateAgenticStrategy(plan);

    // Save structured strategy back into the meeting plan
    const updatedPlan = { ...plan, generatedStrategy: JSON.parse(JSON.stringify(result)) };
    await prisma.workshop.update({
      where: { id: workshopId },
      data: { meetingPlan: updatedPlan },
    });

    return NextResponse.json({ strategy: result });
  } catch (error) {
    console.error('Error generating strategy:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate strategy: ${message}` }, { status: 500 });
  }
}

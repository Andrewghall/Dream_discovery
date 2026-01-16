import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication and get orgId from session
    // For now, we'll fetch all workshops
    
    const workshops = await prisma.workshop.findMany({
      include: {
        participants: {
          select: {
            id: true,
            responseCompletedAt: true,
          },
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    type WorkshopRow = (typeof workshops)[number];
    type WorkshopParticipantRow = WorkshopRow['participants'][number];

    const workshopsWithStats = workshops.map((workshop: WorkshopRow) => ({
      id: workshop.id,
      name: workshop.name,
      workshopType: workshop.workshopType,
      status: workshop.status,
      scheduledDate: workshop.scheduledDate,
      participantCount: workshop._count.participants,
      completedResponses: workshop.participants.filter((p: WorkshopParticipantRow) => p.responseCompletedAt).length,
    }));

    return NextResponse.json(
      { workshops: workshopsWithStats },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error fetching workshops:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workshops' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, businessContext, workshopType, scheduledDate, responseDeadline, includeRegulation } = body;

    // TODO: Add authentication and get userId and orgId from session
    // For now, we'll need to create a default org and user first

    await prisma.organization.upsert({
      where: { id: 'demo-org' },
      update: {},
      create: {
        id: 'demo-org',
        name: 'Demo Organization',
      },
    });

    await prisma.user.upsert({
      where: { id: 'demo-user' },
      update: {},
      create: {
        id: 'demo-user',
        email: 'demo@dream.local',
        name: 'Demo User',
        organizationId: 'demo-org',
      },
    });

    // Create workshop
    const workshop = await prisma.workshop.create({
      data: {
        name,
        description,
        businessContext,
        workshopType: workshopType || 'CUSTOM',
        includeRegulation: includeRegulation ?? true,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        responseDeadline: responseDeadline ? new Date(responseDeadline) : undefined,
        organizationId: 'demo-org', // Using demo org from seed data
        createdById: 'demo-user', // Using demo user from seed data
      },
    });

    return NextResponse.json({ workshop });
  } catch (error: unknown) {
    console.error('Error creating workshop:', error);

    if (error instanceof PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          error: 'Failed to create workshop',
          details: {
            code: error.code,
            message: error.message,
            meta: error.meta,
          },
        },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to create workshop',
          details: {
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create workshop' },
      { status: 500 }
    );
  }
}

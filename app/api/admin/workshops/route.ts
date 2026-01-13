import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    const workshopsWithStats = workshops.map((workshop) => ({
      id: workshop.id,
      name: workshop.name,
      workshopType: workshop.workshopType,
      status: workshop.status,
      scheduledDate: workshop.scheduledDate,
      participantCount: workshop._count.participants,
      completedResponses: workshop.participants.filter((p) => p.responseCompletedAt).length,
    }));

    return NextResponse.json({ workshops: workshopsWithStats });
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
    
    // Create workshop
    const workshop = await prisma.workshop.create({
      data: {
        name,
        description,
        businessContext,
        workshopType: workshopType || 'CUSTOM',
        includeRegulation: includeRegulation ?? true,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        responseDeadline: responseDeadline ? new Date(responseDeadline) : null,
        organizationId: 'demo-org', // Using demo org from seed data
        createdById: 'demo-user', // Using demo user from seed data
      } as any,
    });

    return NextResponse.json({ workshop });
  } catch (error) {
    console.error('Error creating workshop:', error);
    return NextResponse.json(
      { error: 'Failed to create workshop' },
      { status: 500 }
    );
  }
}

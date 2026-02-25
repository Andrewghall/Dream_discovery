import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isPlatformAdmin = session.role === 'PLATFORM_ADMIN';
    const isTenantAdmin = session.role === 'TENANT_ADMIN';
    const orgId = session.organizationId;

    const url = request.nextUrl;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    // PLATFORM_ADMIN sees all; TENANT_ADMIN sees all in their org;
    // TENANT_USER sees their own + workshops shared with them
    const where = isPlatformAdmin
      ? {}
      : isTenantAdmin
        ? { organizationId: orgId! }
        : {
            organizationId: orgId!,
            OR: [
              { createdById: session.userId },
              { shares: { some: { userId: session.userId } } },
            ],
          };

    const [totalCount, workshops] = await Promise.all([
      prisma.workshop.count({ where }),
      prisma.workshop.findMany({
        where,
        skip,
        take: limit,
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
      }),
    ]);

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
      {
        workshops: workshopsWithStats,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: page * limit < totalCount,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Error fetching workshops:', error);

    return NextResponse.json({ error: 'Failed to fetch workshops' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name, description, businessContext, workshopType,
      scheduledDate, responseDeadline, includeRegulation,
      clientName, industry, companyWebsite, dreamTrack, targetDomain,
    } = body;

    // Determine which org this workshop belongs to
    const organizationId = session.role === 'PLATFORM_ADMIN'
      ? (body.organizationId || session.organizationId)
      : session.organizationId!;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const workshop = await prisma.workshop.create({
      data: {
        name,
        description,
        businessContext,
        workshopType: workshopType || 'CUSTOM',
        includeRegulation: includeRegulation ?? true,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        responseDeadline: responseDeadline ? new Date(responseDeadline) : undefined,
        organizationId,
        createdById: session.userId,
        // DREAM prep fields
        clientName: clientName || undefined,
        industry: industry || undefined,
        companyWebsite: companyWebsite || undefined,
        dreamTrack: dreamTrack || undefined,
        targetDomain: targetDomain || undefined,
      },
    });

    return NextResponse.json({ workshop });
  } catch (error: unknown) {
    console.error('Error creating workshop:', error);

    return NextResponse.json({ error: 'Failed to create workshop' }, { status: 500 });
  }
}

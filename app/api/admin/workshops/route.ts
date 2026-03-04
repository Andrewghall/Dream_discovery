import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { getDomainPack } from '@/lib/domain-packs';
import { composeBlueprint } from '@/lib/workshop/blueprint';
import type { EngagementType } from '@prisma/client';

export const dynamic = 'force-dynamic';

function toEngagementEnum(value: unknown): EngagementType | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const normalized = value.trim().toUpperCase();
  const valid: EngagementType[] = [
    'DIAGNOSTIC_BASELINE',
    'OPERATIONAL_DEEP_DIVE',
    'AI_ENABLEMENT',
    'TRANSFORMATION_SPRINT',
    'CULTURAL_ALIGNMENT',
  ];
  if (valid.includes(normalized as EngagementType)) {
    return normalized as EngagementType;
  }

  // Accept UI keys like "operational_deep_dive"
  const fromKey = normalized.replace(/[^A-Z0-9_]/g, '_');
  if (valid.includes(fromKey as EngagementType)) {
    return fromKey as EngagementType;
  }
  return undefined;
}

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
              liveSnapshots: true,
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
      snapshotCount: workshop._count.liveSnapshots,
    }));

    // When no workshops found for a filtered (non-platform-admin) query,
    // check the global count so the client can show a helpful diagnostic.
    let globalCount: number | undefined;
    if (totalCount === 0 && !isPlatformAdmin) {
      globalCount = await prisma.workshop.count();
      console.warn('[workshops] Empty result for filtered user', {
        role: session.role,
        organizationId: orgId || null,
        userId: session.userId,
        globalWorkshopCount: globalCount,
      });
    }

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
        ...(globalCount !== undefined ? { _debug: { globalWorkshopCount: globalCount, userRole: session.role, userOrgId: orgId } } : {}),
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
      engagementType, domainPack,
    } = body;

    // Determine which org this workshop belongs to
    const organizationId = session.role === 'PLATFORM_ADMIN'
      ? (body.organizationId || session.organizationId)
      : session.organizationId!;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const normalizedEngagementType = toEngagementEnum(engagementType);

    // Compose runtime blueprint from setup selections
    const blueprint = composeBlueprint({
      industry: industry || null,
      dreamTrack: dreamTrack || null,
      engagementType: engagementType || null,
      domainPack: domainPack || null,
      purpose: description || null,
      outcomes: businessContext || null,
    });

    const workshopData = {
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
      // Field Discovery / Diagnostic extension
      engagementType: normalizedEngagementType,
      domainPack: domainPack || undefined,
      domainPackConfig: domainPack ? (getDomainPack(domainPack) as any ?? undefined) : undefined,
      // Runtime blueprint snapshot
      blueprint: blueprint as any,
    };

    let workshop;
    try {
      workshop = await prisma.workshop.create({ data: workshopData });
    } catch (err) {
      // Backward compatibility: allow workshop creation even if DB is behind code
      const msg = err instanceof Error ? err.message : String(err);
      const msgLower = msg.toLowerCase();
      if (msgLower.includes('engagement_type') || msgLower.includes('domain_pack') || msgLower.includes('blueprint')) {
        workshop = await prisma.workshop.create({
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
            clientName: clientName || undefined,
            industry: industry || undefined,
            companyWebsite: companyWebsite || undefined,
            dreamTrack: dreamTrack || undefined,
            targetDomain: targetDomain || undefined,
          },
        });
      } else {
        throw err;
      }
    }

    return NextResponse.json({ workshop });
  } catch (error: unknown) {
    console.error('Error creating workshop:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create workshop', details: { message } },
      { status: 500 }
    );
  }
}

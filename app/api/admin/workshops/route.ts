import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { resolveIndustryPack } from '@/lib/domain-packs';
import { generateBlueprint } from '@/lib/cognition/workshop-blueprint-generator';
import type { EngagementType } from '@prisma/client';
import { auditLog, getClientIp } from '@/lib/audit/log-action';
import { encryptWorkshopData } from '@/lib/workshop-encryption';

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

    // PLATFORM_ADMIN: no access to workshop data (GDPR — workshops are tenant-owned)
    if (session.role === 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { error: 'Platform administrators cannot access workshop data' },
        { status: 403 }
      );
    }

    const isTenantAdmin = session.role === 'TENANT_ADMIN';
    const orgId = session.organizationId;

    const url = request.nextUrl;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    // TENANT_ADMIN sees all in their org + all example workshops (cross-org)
    // TENANT_USER sees their own + workshops shared with them + all example workshops
    const where = isTenantAdmin
      ? { OR: [{ organizationId: orgId! }, { isExample: true }] }
      : {
          OR: [
            {
              organizationId: orgId!,
              OR: [
                { createdById: session.userId },
                { shares: { some: { userId: session.userId } } },
              ],
            },
            { isExample: true },
          ],
        };

    const [totalCount, workshops] = await Promise.all([
      prisma.workshop.count({ where }),
      prisma.workshop.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          workshopType: true,
          status: true,
          scheduledDate: true,
          createdAt: true,
          isExample: true,
          _count: {
            select: {
              participants: true,
              liveSnapshots: true,
            },
          },
        },
        orderBy: [
          // Pin example workshops to the top of the list
          { isExample: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
    ]);

    // Get completed participant counts in one aggregate query — avoids fetching all participant rows
    const workshopIds = workshops.map((w) => w.id);
    const completedCounts = workshopIds.length > 0
      ? await prisma.workshopParticipant.groupBy({
          by: ['workshopId'],
          where: {
            workshopId: { in: workshopIds },
            responseCompletedAt: { not: null },
          },
          _count: { id: true },
        })
      : [];
    const completedMap = new Map(completedCounts.map((c) => [c.workshopId, c._count.id]));

    const workshopsWithStats = workshops.map((workshop) => ({
      id: workshop.id,
      name: workshop.name,
      workshopType: workshop.workshopType,
      status: workshop.status,
      scheduledDate: workshop.scheduledDate,
      participantCount: workshop._count.participants,
      completedResponses: completedMap.get(workshop.id) ?? 0,
      snapshotCount: workshop._count.liveSnapshots,
      isExample: workshop.isExample,
    }));

    // When no workshops found, check the global count so the client can show a helpful diagnostic.
    let globalCount: number | undefined;
    if (totalCount === 0) {
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

    // PLATFORM_ADMIN: cannot create workshops (GDPR — workshops are tenant-owned)
    if (session.role === 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { error: 'Platform administrators cannot create workshops' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name, description, businessContext, workshopType,
      scheduledDate, responseDeadline, includeRegulation,
      clientName, industry, companyWebsite, dreamTrack, targetDomain,
      engagementType,
    } = body;

    const organizationId = session.organizationId!;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const normalizedEngagementType = toEngagementEnum(engagementType);

    // Resolve industry-specific domain pack from industry + engagement type + dream track.
    // This replaces the old manual domainPack key selection.
    const resolvedPack = resolveIndustryPack(industry, engagementType, dreamTrack);

    // Generate domain-aware runtime blueprint from setup selections.
    // clientName is included so industry detection (e.g. airline) can
    // fire even when the industry field is not explicitly set.
    const blueprint = generateBlueprint({
      industry: industry || null,
      dreamTrack: dreamTrack || null,
      engagementType: engagementType || null,
      domainPack: resolvedPack?.key || null,
      purpose: description || null,
      outcomes: businessContext || null,
      clientName: clientName || null,
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
      // domainPack column is for legacy pack keys only (contact_centre, enterprise, etc.)
      // Industry packs are fully represented in domainPackConfig — never write an industry
      // pack key into domainPack or it pollutes every downstream key-based discriminator.
      domainPack: undefined,
      domainPackConfig: resolvedPack ? (resolvedPack as any) : undefined,
      // Runtime blueprint snapshot
      blueprint: blueprint as any,
    };

    const workshop = await prisma.workshop.create({ data: encryptWorkshopData(workshopData) });

    auditLog({
      organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'workshop.created',
      resourceType: 'workshop',
      resourceId: workshop.id,
      method: 'POST',
      path: '/api/admin/workshops',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
      metadata: { name: workshop.name, workshopType: workshop.workshopType },
    });

    return NextResponse.json({ workshop });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isSchemaError = message.toLowerCase().includes('does not exist in the current database')
      || message.toLowerCase().includes('unknown field');
    console.error(
      '[workshop-create]',
      isSchemaError ? 'SCHEMA DRIFT DETECTED' : 'Error creating workshop:',
      message,
    );

    return NextResponse.json(
      {
        error: 'Failed to create workshop',
        details: {
          message,
          ...(isSchemaError && {
            schemaDrift: true,
            hint: 'The database schema is out of sync with the application. Run pending migrations.',
          }),
        },
      },
      { status: 500 },
    );
  }
}

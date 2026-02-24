import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ConversationStatus, Prisma } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const dynamic = 'force-dynamic';

function isConversationStatus(value: string): value is ConversationStatus {
  return (Object.values(ConversationStatus) as string[]).includes(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }
    const status = request.nextUrl.searchParams.get('status');

    // PAGINATION: Add query params
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 200); // Max 200
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationSessionWhereInput = { workshopId };
    if (typeof status === 'string' && status.trim() && isConversationStatus(status.trim())) {
      const s = status.trim() as ConversationStatus;
      where.status = s;
    }

    // Get total count for pagination
    const totalCount = await prisma.conversationSession.count({ where });

    const sessions = await prisma.conversationSession.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        participant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const sessionIds = sessions.map((s) => s.id);
    const reports = sessionIds.length
      ? ((await (prisma as any).conversationReport.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { sessionId: true },
        })) as Array<{ sessionId: string }>)
      : [];
    const hasReport = new Set(reports.map((r) => r.sessionId));

    return NextResponse.json({
      ok: true,
      workshopId,
      sessions: sessions.map((s) => ({
        sessionId: s.id,
        status: s.status,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
        participant: s.participant,
        hasReport: hasReport.has(s.id),
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Error listing workshop sessions:', error);
    return NextResponse.json({ ok: false, error: 'Failed to list sessions' }, { status: 500 });
  }
}

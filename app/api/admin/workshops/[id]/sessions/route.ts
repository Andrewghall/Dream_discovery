import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ConversationStatus, Prisma } from '@prisma/client';

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
    const status = request.nextUrl.searchParams.get('status');

    const where: Prisma.ConversationSessionWhereInput = { workshopId };
    if (typeof status === 'string' && status.trim() && isConversationStatus(status.trim())) {
      const s = status.trim() as ConversationStatus;
      where.status = s;
    }

    const sessions = await prisma.conversationSession.findMany({
      where,
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
    });
  } catch (error) {
    console.error('Error listing workshop sessions:', error);
    return NextResponse.json({ ok: false, error: 'Failed to list sessions' }, { status: 500 });
  }
}

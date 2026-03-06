import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const reports = await prisma.conversationReport.findMany({
      where: { workshopId },
      include: {
        participant: { select: { name: true, role: true, department: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      reports: reports.map((r) => ({
        id: r.id,
        participantId: r.participantId,
        participantName: r.participant?.name || 'Participant',
        participantRole: r.participant?.role || null,
        participantDepartment: r.participant?.department || null,
        executiveSummary: r.executiveSummary,
        feedback: r.feedback,
        tone: r.tone,
        keyInsights: r.keyInsights,
        phaseInsights: r.phaseInsights,
        wordCloudThemes: r.wordCloudThemes,
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch participant reports';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

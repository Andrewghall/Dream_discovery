/**
 * POST /api/admin/workshops/[id]/capture-sessions/[sessionId]/analyse
 *
 * Run the field extraction agent on a capture session's transcripts.
 * Creates Finding records and triggers incremental synthesis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { getCaptureSession } from '@/lib/field-discovery/capture-session-manager';
import { extractFindings } from '@/lib/field-discovery/field-extraction-agent';
import { prisma } from '@/lib/prisma';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: workshopId, sessionId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const session = await getCaptureSession(sessionId);
    if (!session || session.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Only allow analysis on sessions that have been transcribed
    if (session.status !== 'TRANSCRIBED' && session.status !== 'ANALYSED') {
      return NextResponse.json(
        { error: `Session must be in TRANSCRIBED status to analyse (current: ${session.status})` },
        { status: 400 }
      );
    }

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId }, select: { blueprint: true } });
    const bp = readBlueprintFromJson(workshop?.blueprint);
    const lensNames = bp?.lenses?.map((l) => l.name) ?? [];

    const result = await extractFindings({
      sessionId,
      workshopId,
      captureType: session.captureType,
      actorRole: session.actorRole,
      area: session.area,
      lensNames,
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error analysing capture session:', error);
    return NextResponse.json({ error: 'Failed to analyse capture session' }, { status: 500 });
  }
}

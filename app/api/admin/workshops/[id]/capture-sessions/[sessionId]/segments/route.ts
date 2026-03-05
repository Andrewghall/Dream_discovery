/**
 * POST  /api/admin/workshops/[id]/capture-sessions/[sessionId]/segments - Add segment
 * PATCH /api/admin/workshops/[id]/capture-sessions/[sessionId]/segments - Update segment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import {
  getCaptureSession,
  createSegment,
  updateSegment,
} from '@/lib/field-discovery/capture-session-manager';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const { segmentIndex, startTimeMs, endTimeMs, audioReference, transcriptReference, transcript, status } = body;

    if (segmentIndex === undefined || segmentIndex === null) {
      return NextResponse.json({ error: 'segmentIndex is required' }, { status: 400 });
    }

    const segment = await createSegment({
      captureSessionId: sessionId,
      segmentIndex,
      startTimeMs: startTimeMs != null ? BigInt(startTimeMs) : undefined,
      endTimeMs: endTimeMs != null ? BigInt(endTimeMs) : undefined,
      audioReference,
      transcriptReference,
      transcript,
      status,
    });

    // Serialise BigInt for JSON response
    return NextResponse.json({
      segment: {
        ...segment,
        startTimeMs: segment.startTimeMs?.toString() ?? null,
        endTimeMs: segment.endTimeMs?.toString() ?? null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating segment:', error);
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
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

    const body = await request.json();
    const { segmentId, endTimeMs, audioReference, transcriptReference, transcript, status } = body;

    if (!segmentId) {
      return NextResponse.json({ error: 'segmentId is required' }, { status: 400 });
    }

    const updated = await updateSegment(segmentId, {
      endTimeMs: endTimeMs != null ? BigInt(endTimeMs) : undefined,
      audioReference,
      transcriptReference,
      transcript,
      status,
    });

    return NextResponse.json({
      segment: {
        ...updated,
        startTimeMs: updated.startTimeMs?.toString() ?? null,
        endTimeMs: updated.endTimeMs?.toString() ?? null,
      },
    });
  } catch (error) {
    console.error('Error updating segment:', error);
    return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 });
  }
}

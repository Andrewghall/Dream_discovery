/**
 * GET    /api/admin/workshops/[id]/capture-sessions/[sessionId] - Get session details
 * PATCH  /api/admin/workshops/[id]/capture-sessions/[sessionId] - Update session
 * DELETE /api/admin/workshops/[id]/capture-sessions/[sessionId] - Delete session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import {
  getCaptureSession,
  updateCaptureSession,
  deleteCaptureSession,
} from '@/lib/field-discovery/capture-session-manager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
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

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error fetching capture session:', error);
    return NextResponse.json({ error: 'Failed to fetch capture session' }, { status: 500 });
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

    const existing = await getCaptureSession(sessionId);
    if (!existing || existing.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await request.json();
    const session = await updateCaptureSession(sessionId, body);

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error updating capture session:', error);
    return NextResponse.json({ error: 'Failed to update capture session' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: workshopId, sessionId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const existing = await getCaptureSession(sessionId);
    if (!existing || existing.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Remove associated findings before deleting the session
    // (schema uses onDelete: SetNull so we need to do this explicitly)
    await prisma.finding.deleteMany({ where: { captureSessionId: sessionId } });
    await deleteCaptureSession(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting capture session:', error);
    return NextResponse.json({ error: 'Failed to delete capture session' }, { status: 500 });
  }
}

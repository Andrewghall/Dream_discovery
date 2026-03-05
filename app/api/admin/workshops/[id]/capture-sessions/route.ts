/**
 * GET  /api/admin/workshops/[id]/capture-sessions - List capture sessions
 * POST /api/admin/workshops/[id]/capture-sessions - Create a capture session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import {
  listCaptureSessions,
  createCaptureSession,
  getSessionProgress,
} from '@/lib/field-discovery/capture-session-manager';
import type { CaptureType, CaptureSessionStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const url = request.nextUrl;
    const captureType = url.searchParams.get('captureType') as CaptureType | null;
    const status = url.searchParams.get('status') as CaptureSessionStatus | null;
    const actorRole = url.searchParams.get('actorRole');

    const [sessions, progress] = await Promise.all([
      listCaptureSessions(workshopId, {
        captureType: captureType ?? undefined,
        status: status ?? undefined,
        actorRole: actorRole ?? undefined,
      }),
      getSessionProgress(workshopId),
    ]);

    return NextResponse.json(
      { sessions, progress },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error listing capture sessions:', error);
    return NextResponse.json({ error: 'Failed to list capture sessions' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const body = await request.json();
    const { captureType, actorRole, area, department, participantName, consentFlag, deviceType } = body;

    if (!captureType) {
      return NextResponse.json({ error: 'captureType is required' }, { status: 400 });
    }

    const session = await createCaptureSession({
      workshopId,
      captureType,
      actorRole,
      area,
      department,
      participantName,
      consentFlag,
      deviceType,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Error creating capture session:', error);
    return NextResponse.json({ error: 'Failed to create capture session' }, { status: 500 });
  }
}

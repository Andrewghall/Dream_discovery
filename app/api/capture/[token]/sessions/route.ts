/**
 * POST /api/capture/[token]/sessions
 *
 * Token-authenticated session creation for mobile field capture.
 * No admin session required — the signed JWT capture token proves authorisation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptureToken } from '@/lib/field-discovery/capture-token-auth';
import { createCaptureSession } from '@/lib/field-discovery/capture-session-manager';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const auth = await verifyCaptureToken(token);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Invalid or expired capture token' }, { status: 401 });
    }

    const body = await request.json();
    const { captureType, actorRole, area, department, participantName, consentFlag, deviceType } =
      body;

    if (!captureType) {
      return NextResponse.json({ error: 'captureType is required' }, { status: 400 });
    }

    const session = await createCaptureSession({
      workshopId: auth.workshopId,
      captureType,
      actorRole,
      area,
      department,
      participantName,
      consentFlag,
      deviceType: deviceType ?? 'MOBILE',
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('[capture/sessions] Error:', error);
    return NextResponse.json({ error: 'Failed to create capture session' }, { status: 500 });
  }
}

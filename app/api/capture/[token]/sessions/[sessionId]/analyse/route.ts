/**
 * POST /api/capture/[token]/sessions/[sessionId]/analyse
 *
 * Token-authenticated analysis trigger for mobile capture sessions.
 * Mirrors the admin route but uses JWT capture token auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptureToken } from '@/lib/field-discovery/capture-token-auth';
import { getCaptureSession } from '@/lib/field-discovery/capture-session-manager';
import { extractFindings } from '@/lib/field-discovery/field-extraction-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; sessionId: string }> },
) {
  try {
    const { token, sessionId } = await params;

    const auth = await verifyCaptureToken(token);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Invalid or expired capture token' }, { status: 401 });
    }

    const session = await getCaptureSession(sessionId);
    if (!session || session.workshopId !== auth.workshopId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'TRANSCRIBED' && session.status !== 'ANALYSED') {
      return NextResponse.json(
        { error: `Session must be TRANSCRIBED to analyse (current: ${session.status})` },
        { status: 400 },
      );
    }

    const result = await extractFindings({
      sessionId,
      workshopId: auth.workshopId,
      captureType: session.captureType,
      actorRole: session.actorRole,
      area: session.area,
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error('[capture/analyse] Error:', error);
    return NextResponse.json({ error: 'Failed to analyse session' }, { status: 500 });
  }
}

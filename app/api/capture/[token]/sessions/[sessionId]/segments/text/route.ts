/**
 * POST /api/capture/[token]/sessions/[sessionId]/segments/text
 *
 * Token-authenticated text segment submission for offline Web Speech API recording.
 * Accepts a pre-cleaned transcript instead of an audio file — no Railway call needed.
 *
 * Used when a mobile device records offline (isLocalSession=true) with the Web Speech API.
 * On reconnect, page.tsx syncOfflineData() posts each stored text segment here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptureToken } from '@/lib/field-discovery/capture-token-auth';
import { getCaptureSession } from '@/lib/field-discovery/capture-session-manager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; sessionId: string }> },
) {
  try {
    const { token, sessionId } = await params;

    // Verify JWT token
    const auth = await verifyCaptureToken(token);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Invalid or expired capture token' }, { status: 401 });
    }

    // Verify session belongs to this workshop
    const session = await getCaptureSession(sessionId);
    if (!session || session.workshopId !== auth.workshopId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Parse JSON body
    const body = await request.json();
    const { segmentIndex, startedAt, stoppedAt, transcript } = body as {
      segmentIndex: unknown;
      startedAt: unknown;
      stoppedAt: unknown;
      transcript: unknown;
    };

    if (typeof segmentIndex !== 'number' || !Number.isInteger(segmentIndex)) {
      return NextResponse.json({ error: 'segmentIndex must be an integer' }, { status: 400 });
    }
    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'transcript is required and must be a string' }, { status: 400 });
    }

    const startTimeMs = startedAt ? BigInt(new Date(String(startedAt)).getTime()) : null;
    const endTimeMs = stoppedAt ? BigInt(new Date(String(stoppedAt)).getTime()) : null;

    // Upsert CaptureSegment with pre-cleaned transcript (no transcription needed)
    const existingSegment = await prisma.captureSegment.findFirst({
      where: { captureSessionId: sessionId, segmentIndex },
    });

    const segmentData = {
      transcript: transcript as string,
      status: 'TRANSCRIBED' as const,
      startTimeMs,
      endTimeMs,
    };

    if (existingSegment) {
      await prisma.captureSegment.update({ where: { id: existingSegment.id }, data: segmentData });
    } else {
      await prisma.captureSegment.create({
        data: { captureSessionId: sessionId, segmentIndex, ...segmentData },
      });
    }

    // Promote session to TRANSCRIBED when all segments have transcripts
    const [totalSegments, transcribedSegments] = await Promise.all([
      prisma.captureSegment.count({ where: { captureSessionId: sessionId } }),
      prisma.captureSegment.count({
        where: { captureSessionId: sessionId, transcript: { not: null } },
      }),
    ]);
    if (totalSegments > 0 && transcribedSegments === totalSegments) {
      await prisma.captureSession.update({
        where: { id: sessionId },
        data: { status: 'TRANSCRIBED' },
      });
    }

    return NextResponse.json({ transcript, segmentIndex });
  } catch (error) {
    console.error('[capture/segments/text] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to save text segment' }, { status: 500 });
  }
}

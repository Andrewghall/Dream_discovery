/**
 * POST /api/admin/workshops/[id]/capture-sessions/[sessionId]/segments/transcribe
 *
 * Receives an audio blob via FormData, sends it to CaptureAPI for
 * transcription, and stores the transcript on the CaptureSegment record.
 *
 * On CaptureAPI failure the segment record is still created with status
 * 'FAILED' and the response includes an error field (200) so the client
 * can continue recording without interruption.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { getCaptureSession } from '@/lib/field-discovery/capture-session-manager';
import { transcribeAudio } from '@/lib/captureapi/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: workshopId, sessionId } = await params;

    // -----------------------------------------------------------------------
    // Auth + access control
    // -----------------------------------------------------------------------
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const validation = await validateWorkshopAccess(
      workshopId,
      user.organizationId,
      user.role,
      user.userId
    );
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 });
    }

    // -----------------------------------------------------------------------
    // Session lookup
    // -----------------------------------------------------------------------
    const session = await getCaptureSession(sessionId);
    if (!session || session.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // -----------------------------------------------------------------------
    // Parse FormData
    // -----------------------------------------------------------------------
    const formData = await request.formData();

    const audioFile = formData.get('audio');
    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'audio file is required in FormData' },
        { status: 400 }
      );
    }

    const segmentIndexRaw = formData.get('segmentIndex');
    if (segmentIndexRaw === null || segmentIndexRaw === undefined) {
      return NextResponse.json(
        { error: 'segmentIndex is required' },
        { status: 400 }
      );
    }
    const segmentIndex = parseInt(String(segmentIndexRaw), 10);
    if (Number.isNaN(segmentIndex)) {
      return NextResponse.json(
        { error: 'segmentIndex must be a valid integer' },
        { status: 400 }
      );
    }

    const startedAtRaw = formData.get('startedAt');
    const stoppedAtRaw = formData.get('stoppedAt');

    // Convert ISO date strings to BigInt millisecond timestamps
    const startTimeMs =
      startedAtRaw ? BigInt(new Date(String(startedAtRaw)).getTime()) : null;
    const endTimeMs =
      stoppedAtRaw ? BigInt(new Date(String(stoppedAtRaw)).getTime()) : null;

    // -----------------------------------------------------------------------
    // Call CaptureAPI for transcription
    // -----------------------------------------------------------------------
    let transcriptionResult;
    let transcriptionFailed = false;
    let failureMessage = '';

    try {
      transcriptionResult = await transcribeAudio(audioFile, {
        mode: 'field_asset',
        enableSLM: true,
      });
    } catch (err) {
      transcriptionFailed = true;
      failureMessage =
        err instanceof Error ? err.message : 'Unknown transcription error';
      console.error('[transcribe route] CaptureAPI failed:', failureMessage);
    }

    // -----------------------------------------------------------------------
    // Upsert CaptureSegment record
    //
    // The schema does not have a unique compound constraint on
    // (captureSessionId, segmentIndex), so we find-then-create/update.
    // -----------------------------------------------------------------------
    const existingSegment = await prisma.captureSegment.findFirst({
      where: {
        captureSessionId: sessionId,
        segmentIndex,
      },
    });

    const segmentData = {
      transcript: transcriptionFailed
        ? null
        : (transcriptionResult?.transcription.cleanText ?? null),
      status: transcriptionFailed ? 'FAILED' : 'TRANSCRIBED',
      startTimeMs,
      endTimeMs,
    };

    if (existingSegment) {
      await prisma.captureSegment.update({
        where: { id: existingSegment.id },
        data: segmentData,
      });
    } else {
      await prisma.captureSegment.create({
        data: {
          captureSessionId: sessionId,
          segmentIndex,
          ...segmentData,
        },
      });
    }

    // -----------------------------------------------------------------------
    // Check whether ALL segments for this session now have transcripts.
    // If every segment is transcribed, promote the session status.
    // -----------------------------------------------------------------------
    if (!transcriptionFailed) {
      const totalSegments = await prisma.captureSegment.count({
        where: { captureSessionId: sessionId },
      });
      const transcribedSegments = await prisma.captureSegment.count({
        where: {
          captureSessionId: sessionId,
          transcript: { not: null },
        },
      });

      if (totalSegments > 0 && transcribedSegments === totalSegments) {
        await prisma.captureSession.update({
          where: { id: sessionId },
          data: { status: 'TRANSCRIBED' },
        });
      }
    }

    // -----------------------------------------------------------------------
    // Return response
    // -----------------------------------------------------------------------
    if (transcriptionFailed) {
      return NextResponse.json({
        error: failureMessage,
        segmentIndex,
        status: 'FAILED',
      });
    }

    const { transcription, analysis, metadata } = transcriptionResult!;

    return NextResponse.json({
      transcript: transcription.cleanText,
      rawText: transcription.rawText,
      confidence: transcription.confidence,
      emotionalTone: analysis.emotionalTone,
      entities: analysis.entities,
      processingTimeMs: metadata.processingTimeMs,
    });
  } catch (error) {
    console.error('[transcribe route] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe segment' },
      { status: 500 }
    );
  }
}

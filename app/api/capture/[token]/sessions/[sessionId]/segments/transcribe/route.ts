/**
 * POST /api/capture/[token]/sessions/[sessionId]/segments/transcribe
 *
 * Token-authenticated audio segment upload + transcription for mobile capture.
 * Mirrors /api/admin/workshops/[id]/capture-sessions/[sessionId]/segments/transcribe
 * but uses the JWT capture token instead of an admin session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptureToken } from '@/lib/field-discovery/capture-token-auth';
import { getCaptureSession } from '@/lib/field-discovery/capture-session-manager';
import { transcribeAudio } from '@/lib/captureapi/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

    // Parse FormData
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'audio file is required in FormData' }, { status: 400 });
    }

    const segmentIndexRaw = formData.get('segmentIndex');
    if (segmentIndexRaw === null) {
      return NextResponse.json({ error: 'segmentIndex is required' }, { status: 400 });
    }
    const segmentIndex = parseInt(String(segmentIndexRaw), 10);
    if (Number.isNaN(segmentIndex)) {
      return NextResponse.json({ error: 'segmentIndex must be a valid integer' }, { status: 400 });
    }

    const startedAtRaw = formData.get('startedAt');
    const stoppedAtRaw = formData.get('stoppedAt');
    const startTimeMs = startedAtRaw ? BigInt(new Date(String(startedAtRaw)).getTime()) : null;
    const endTimeMs = stoppedAtRaw ? BigInt(new Date(String(stoppedAtRaw)).getTime()) : null;

    // Call CaptureAPI for transcription
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
      failureMessage = err instanceof Error ? err.message : 'Unknown transcription error';
      console.error('[capture/transcribe] CaptureAPI failed:', failureMessage);
    }

    // Upsert CaptureSegment
    const existingSegment = await prisma.captureSegment.findFirst({
      where: { captureSessionId: sessionId, segmentIndex },
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
      await prisma.captureSegment.update({ where: { id: existingSegment.id }, data: segmentData });
    } else {
      await prisma.captureSegment.create({
        data: { captureSessionId: sessionId, segmentIndex, ...segmentData },
      });
    }

    // Promote session status when all segments transcribed
    if (!transcriptionFailed) {
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
    }

    if (transcriptionFailed) {
      return NextResponse.json({ error: failureMessage, segmentIndex, status: 'FAILED' });
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
    console.error('[capture/transcribe] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to transcribe segment' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

import { prisma } from '@/lib/prisma';
import { emitWorkshopEvent } from '@/lib/realtime/workshop-events';
import { classifyDataPoint } from '@/lib/workshop/classify-datapoint';

type IngestTranscriptChunkBody = {
  speakerId: string | null;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number | null;
  source: 'zoom' | 'deepgram' | 'whisper';
  dialoguePhase?: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null;
};

function safeDialoguePhase(
  v: unknown
): 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  if (s === 'REIMAGINE') return 'REIMAGINE';
  if (s === 'CONSTRAINTS') return 'CONSTRAINTS';
  if (s === 'DEFINE_APPROACH') return 'DEFINE_APPROACH';
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const body = (await request.json()) as IngestTranscriptChunkBody;

    const text = (body?.text || '').trim();
    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const startTimeMs = Number.isFinite(body.startTime) ? Math.max(0, Math.round(body.startTime)) : 0;
    const endTimeMs = Number.isFinite(body.endTime) ? Math.max(startTimeMs, Math.round(body.endTime)) : startTimeMs;

    const src =
      body.source === 'deepgram' ? 'DEEPGRAM' : body.source === 'whisper' ? 'WHISPER' : 'ZOOM';

    const existing = await prisma.transcriptChunk.findFirst({
      where: {
        workshopId,
        speakerId: body.speakerId || null,
        startTimeMs,
        endTimeMs,
        text,
        source: src,
      },
      include: {
        dataPoint: {
          include: {
            classification: true,
            annotation: true,
          },
        },
      },
    });

    if (existing?.dataPoint) {
      const requestedPhase = safeDialoguePhase(body.dialoguePhase);
      if (requestedPhase && !existing.dataPoint.annotation) {
        try {
          await prisma.dataPointAnnotation.create({
            data: {
              dataPointId: existing.dataPoint.id,
              dialoguePhase: requestedPhase,
            },
          });
        } catch {
          // ignore (race / already created)
        }
      }
      return NextResponse.json({
        ok: true,
        deduped: true,
        transcriptChunkId: existing.id,
        dataPointId: existing.dataPoint.id,
        classificationId: existing.dataPoint.classification?.id || null,
      });
    }

    // Persist transcript chunk
    const transcriptChunk =
      existing ||
      (await prisma.transcriptChunk.create({
        data: {
          workshopId,
          speakerId: body.speakerId || null,
          startTimeMs,
          endTimeMs,
          text,
          confidence: typeof body.confidence === 'number' ? body.confidence : null,
          source: src,
        },
      }));

    // Convert to DataPoint
    const dataPoint = await prisma.dataPoint.create({
      data: {
        workshopId,
        transcriptChunkId: transcriptChunk.id,
        rawText: text,
        source: 'SPEECH',
        speakerId: body.speakerId || null,
      },
    });

    const dialoguePhase = safeDialoguePhase(body.dialoguePhase);
    if (dialoguePhase) {
      await prisma.dataPointAnnotation.create({
        data: {
          dataPointId: dataPoint.id,
          dialoguePhase,
        },
      });
    }

    emitWorkshopEvent(workshopId, {
      id: nanoid(),
      type: 'datapoint.created',
      createdAt: Date.now(),
      payload: {
        dataPoint: {
          id: dataPoint.id,
          rawText: dataPoint.rawText,
          source: dataPoint.source,
          speakerId: dataPoint.speakerId,
          createdAt: dataPoint.createdAt,
          dialoguePhase,
        },
        transcriptChunk: {
          id: transcriptChunk.id,
          speakerId: transcriptChunk.speakerId,
          startTimeMs: transcriptChunk.startTimeMs,
          endTimeMs: transcriptChunk.endTimeMs,
          text: transcriptChunk.text,
          confidence: transcriptChunk.confidence,
          source: transcriptChunk.source,
          createdAt: transcriptChunk.createdAt,
        },
      },
    });

    // Classify
    const cls = await classifyDataPoint({ text });

    const classification = await prisma.dataPointClassification.create({
      data: {
        dataPointId: dataPoint.id,
        primaryType: cls.primaryType,
        confidence: cls.confidence,
        keywords: cls.keywords,
        suggestedArea: cls.suggestedArea,
      },
    });

    emitWorkshopEvent(workshopId, {
      id: nanoid(),
      type: 'classification.updated',
      createdAt: Date.now(),
      payload: {
        dataPointId: dataPoint.id,
        classification: {
          id: classification.id,
          primaryType: classification.primaryType,
          confidence: classification.confidence,
          keywords: classification.keywords,
          suggestedArea: classification.suggestedArea,
          updatedAt: classification.updatedAt,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      transcriptChunkId: transcriptChunk.id,
      dataPointId: dataPoint.id,
      classificationId: classification.id,
    });
  } catch (error) {
    console.error('Error ingesting transcript chunk:', error);
    return NextResponse.json({ error: 'Failed to ingest transcript chunk' }, { status: 500 });
  }
}

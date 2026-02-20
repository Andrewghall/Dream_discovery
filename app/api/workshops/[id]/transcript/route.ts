import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { nanoid } from 'nanoid';

import { prisma } from '@/lib/prisma';
import { emitWorkshopEvent } from '@/lib/realtime/workshop-events';
import { deriveIntent } from '@/lib/workshop/derive-intent';
import { analyzeUtteranceAgentically, AgenticContext } from '@/lib/agents/workshop-analyst-agent';

type IngestTranscriptChunkBody = {
  speakerId: string | null;
  startTime: number;
  endTime: number;
  text: string; // Clean text from SLM
  rawText?: string; // Original from transcription service
  confidence: number | null;
  source: 'zoom' | 'deepgram' | 'whisper';
  dialoguePhase?: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null;
  // SLM metadata
  slmMetadata?: {
    entities: Array<{ type: string; value: string }>;
    emotionalTone: string;
    slmConfidence: number;
    processingTimeMs: number;
    slmUsed: boolean;
  };
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

    // OPTIMIZATION: Fetch recent transcripts once and cache (prevents 3 separate queries)
    let cachedRecentTranscripts: Array<{
      id: string;
      text: string;
      speakerId: string | null;
      createdAt: Date;
    }> | null = null;

    const getRecentTranscripts = async (excludeId?: string) => {
      if (!cachedRecentTranscripts) {
        cachedRecentTranscripts = await prisma.transcriptChunk.findMany({
          where: { workshopId },
          orderBy: { createdAt: 'desc' },
          take: 20, // Fetch 20 to cover all use cases
          select: {
            id: true,
            text: true,
            speakerId: true,
            createdAt: true,
          },
        });
      }
      // Filter out excluded ID if provided
      return excludeId
        ? cachedRecentTranscripts.filter((t) => t.id !== excludeId)
        : cachedRecentTranscripts;
    };

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
      const dataPointId = existing.dataPoint.id;
      const requestedPhase = safeDialoguePhase(body.dialoguePhase);
      if (requestedPhase && !existing.dataPoint.annotation) {
        try {
          await prisma.dataPointAnnotation.create({
            data: {
              dataPointId,
              dialoguePhase: requestedPhase,
            },
          });
        } catch {
          // ignore (race / already created)
        }
      }

      if (!existing.dataPoint.annotation?.intent) {
        after(async () => {
          try {
            // Use cached transcripts for intent derivation
            const recentTranscripts = await getRecentTranscripts();
            const contextMessages = recentTranscripts.slice(0, 10).reverse().map((t) => ({
              speaker: t.speakerId,
              text: t.text,
            }));

            const intent = await deriveIntent({ text, recentContext: contextMessages });
            if (!intent) return;

            const annotation = await prisma.dataPointAnnotation.upsert({
              where: { dataPointId },
              create: {
                dataPointId,
                dialoguePhase: requestedPhase,
                intent,
              },
              update: { intent },
            });

            emitWorkshopEvent(workshopId, {
              id: nanoid(),
              type: 'annotation.updated',
              createdAt: Date.now(),
              payload: {
                dataPointId,
                annotation: {
                  dialoguePhase: annotation.dialoguePhase,
                  intent: annotation.intent,
                  updatedAt: annotation.updatedAt,
                },
              },
            });
          } catch {
            // ignore
          }
        });
      }

      return NextResponse.json({
        ok: true,
        deduped: true,
        transcriptChunkId: existing.id,
        dataPointId,
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
          // Store SLM metadata in the metadata JSON field
          metadata: body.slmMetadata || body.rawText
            ? {
                ...(body.rawText && { rawText: body.rawText }),
                ...(body.slmMetadata && { slmMetadata: body.slmMetadata }),
              }
            : undefined,
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

    // Use cached transcripts for AI analysis context
    // Exclude the current transcript chunk to avoid circular reference
    const recentTranscripts = await getRecentTranscripts(transcriptChunk.id);

    // Reverse to chronological order (oldest first) for context, take 10
    const contextMessages = recentTranscripts.slice(0, 10).reverse().map((t) => ({
      speaker: t.speakerId,
      text: t.text,
    }));

    const intentPromise = deriveIntent({ text, recentContext: contextMessages }).catch(() => null);

    // Classification now handled by the agentic agent in the after() callback below
    // This ensures full conversation context is used for accurate classification

    const intent = await intentPromise;
    if (intent) {
      const annotation = await prisma.dataPointAnnotation.upsert({
        where: { dataPointId: dataPoint.id },
        create: {
          dataPointId: dataPoint.id,
          dialoguePhase,
          intent,
        },
        update: { intent },
      });

      emitWorkshopEvent(workshopId, {
        id: nanoid(),
        type: 'annotation.updated',
        createdAt: Date.now(),
        payload: {
          dataPointId: dataPoint.id,
          annotation: {
            dialoguePhase: annotation.dialoguePhase,
            intent: annotation.intent,
            updatedAt: annotation.updatedAt,
          },
        },
      });
    }

    // Run agentic analysis after response is sent (Vercel keeps function alive)
    after(async () => {
      try {
        // Get workshop context for agent
        const workshop = await prisma.workshop.findUnique({
          where: { id: workshopId },
          select: {
            name: true,
            description: true,
            businessContext: true,
          },
        });

        if (!workshop) return;

        // Build agent context with more utterances for richer understanding
        // Use cached transcripts for agent analysis
        const agentTranscripts = await getRecentTranscripts();

        // Get emerging themes from prior classifications
        const existingThemes = await prisma.dataPointClassification.findMany({
          where: {
            dataPoint: { workshopId },
          },
          select: {
            keywords: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        // Aggregate theme occurrences
        const themeMap = new Map<string, { count: number; lastSeen: Date }>();
        for (const cls of existingThemes) {
          for (const keyword of cls.keywords || []) {
            const existing = themeMap.get(keyword);
            if (!existing || cls.createdAt > existing.lastSeen) {
              themeMap.set(keyword, {
                count: (existing?.count || 0) + 1,
                lastSeen: cls.createdAt,
              });
            }
          }
        }

        const emergingThemes = Array.from(themeMap.entries())
          .filter(([, data]) => data.count >= 2)
          .slice(0, 10)
          .map(([label, data]) => ({
            label,
            occurrences: data.count,
            lastSeen: data.lastSeen.toISOString(),
          }));

        // Build agent context
        const agenticContext: AgenticContext = {
          workshopGoal: workshop.businessContext || workshop.description || workshop.name,
          currentPhase: dialoguePhase || 'REIMAGINE',
          recentUtterances: agentTranscripts.reverse().map((t) => ({
            id: t.id,
            speaker: t.speakerId,
            text: t.text,
          })),
          emergingThemes,
        };

        // Run agentic analysis
        console.log('[Transcript Route] Running agentic analysis for:', text.substring(0, 100));
        const analysis = await analyzeUtteranceAgentically({
          utterance: text,
          speaker: body.speakerId,
          utteranceId: dataPoint.id,
          context: agenticContext,
        });
        console.log('[Transcript Route] Agentic result:', {
          meaning: analysis.interpretation.semanticMeaning.substring(0, 80),
          domains: analysis.domains.length,
          themes: analysis.themes.length,
          confidence: analysis.overallConfidence,
        });

        // Store the analysis
        await prisma.agenticAnalysis.create({
          data: {
            dataPointId: dataPoint.id,
            semanticMeaning: analysis.interpretation.semanticMeaning,
            speakerIntent: analysis.interpretation.speakerIntent,
            temporalFocus: analysis.interpretation.temporalFocus,
            sentimentTone: analysis.interpretation.sentimentTone,
            domains: analysis.domains,
            themes: analysis.themes,
            connections: analysis.connections,
            actors: analysis.actors,
            overallConfidence: analysis.overallConfidence,
            uncertainties: analysis.uncertainties,
            agentModel: 'gpt-4o-mini',
            analysisVersion: '1.0',
          },
        });

        // Create classification from the agentic analysis (unified: one agent, one call)
        const classification = await prisma.dataPointClassification.create({
          data: {
            dataPointId: dataPoint.id,
            primaryType: analysis.primaryType,
            confidence: analysis.overallConfidence,
            keywords: analysis.themes.map((t: { label: string }) => t.label).slice(0, 8),
            suggestedArea: analysis.domains[0]?.domain || null,
          },
        });

        // Emit classification event for real-time UI node update
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

        // Emit agentic analysis event for real-time UI updates
        emitWorkshopEvent(workshopId, {
          id: nanoid(),
          type: 'agentic.analyzed',
          createdAt: Date.now(),
          payload: {
            dataPointId: dataPoint.id,
            analysis,
          },
        });
      } catch (error) {
        console.error('Agentic analysis failed:', error);
        // Don't fail the transcript ingestion if agentic analysis fails
      }
    });

    return NextResponse.json({
      ok: true,
      transcriptChunkId: transcriptChunk.id,
      dataPointId: dataPoint.id,
      classificationId: null, // Classification now arrives asynchronously via agentic agent
    });
  } catch (error) {
    console.error('Error ingesting transcript chunk:', error);
    return NextResponse.json({ error: 'Failed to ingest transcript chunk' }, { status: 500 });
  }
}

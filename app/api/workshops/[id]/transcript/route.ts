import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { nanoid } from 'nanoid';

import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { emitWorkshopEvent, persistAndEmit } from '@/lib/realtime/workshop-events';
import { deriveIntent } from '@/lib/workshop/derive-intent';
import { addFragment, flushWorkshop, type FlushedUtterance } from '@/lib/workshop/utterance-buffer';
import { getOrCreateCognitiveState } from '@/lib/cognition/state-store';
import { applyCognitiveUpdate } from '@/lib/cognition/reasoning-engine';
import { getGPT4oMiniEngine } from '@/lib/cognition/engines/gpt4o-mini-engine';
import { runFacilitationOrchestrator } from '@/lib/cognition/agents/facilitation-orchestrator';
import { pushUtterance } from '@/lib/cognition/cognitive-state';

type IngestTranscriptChunkBody = {
  speakerId: string | null;
  startTime: number;
  endTime: number;
  text: string; // Clean text from SLM
  rawText?: string; // Original from transcription service
  confidence: number | null;
  source: 'zoom' | 'deepgram' | 'whisper';
  dialoguePhase?: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null;
  flush?: boolean; // When true, force-flush the utterance buffer (e.g. capture stopped)
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

// ── Filler word set for trivial-fragment detection ──────────
// Intentionally narrow: only genuine non-semantic noise.
// Words like 'is', 'we', 'you', 'think', 'know' carry meaning in
// workshop speech and must NOT be treated as filler — doing so
// causes real content (e.g. "sustainability is important") to be
// silently dropped before DataPoints are created.
const FILLER_WORDS = new Set([
  'um', 'uh', 'hmm', 'hm', 'ah', 'oh', 'er',
  'so', 'yeah', 'yes', 'no', 'ok', 'okay',
  'the', 'a', 'an', 'and', 'but', 'or',
  'to', 'of', 'in', 'at', 'by', 'for', 'on', 'with',
]);

function isTextTrivial(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return true; // Fewer than 3 total words
  const substantive = text
    .toLowerCase()
    .replace(/[^a-z\s']/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER_WORDS.has(w));
  return substantive.length < 1; // Drop only if zero substantive words
}

// ══════════════════════════════════════════════════════════════
// processCompleteUtterance — creates DataPoint + agentic analysis
// for a COMPLETE, buffered utterance (not a raw fragment)
// ══════════════════════════════════════════════════════════════
async function processCompleteUtterance(
  workshopId: string,
  utterance: FlushedUtterance,
  bodyDialoguePhase: string | null | undefined,
  bodySpeakerId: string | null,
  bodySlmMetadata?: Record<string, unknown>,
) {
  const text = utterance.text;
  const src = utterance.source === 'WHISPER' ? 'WHISPER' : utterance.source === 'ZOOM' ? 'ZOOM' : 'DEEPGRAM';

  // ── Fetch recent transcripts for context ──────────────────
  const recentTranscripts = await prisma.transcriptChunk.findMany({
    where: { workshopId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      text: true,
      speakerId: true,
      createdAt: true,
    },
  });

  // ── Dedup check ───────────────────────────────────────────
  const existing = await prisma.transcriptChunk.findFirst({
    where: {
      workshopId,
      speakerId: utterance.speakerId || null,
      startTimeMs: utterance.startTimeMs,
      endTimeMs: utterance.endTimeMs,
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
    // Already processed — just ensure annotation exists
    const dataPointId = existing.dataPoint.id;
    const requestedPhase = safeDialoguePhase(bodyDialoguePhase);
    if (requestedPhase && !existing.dataPoint.annotation) {
      try {
        await prisma.dataPointAnnotation.create({
          data: { dataPointId, dialoguePhase: requestedPhase },
        });
      } catch {
        // ignore race
      }
    }
    return { deduped: true, dataPointId };
  }

  // ── Create merged transcript chunk ────────────────────────
  const transcriptChunk = await prisma.transcriptChunk.create({
    data: {
      workshopId,
      speakerId: utterance.speakerId || null,
      startTimeMs: utterance.startTimeMs,
      endTimeMs: utterance.endTimeMs,
      text,
      confidence: utterance.confidence,
      source: src,
      metadata: (bodySlmMetadata || utterance.rawText
        ? {
            ...(utterance.rawText && { rawText: utterance.rawText }),
            ...(bodySlmMetadata && { slmMetadata: bodySlmMetadata }),
            buffered: true, // Mark as assembled from multiple fragments
          }
        : undefined) as any,
    },
  });

  // ── Create DataPoint ──────────────────────────────────────
  const dataPoint = await prisma.dataPoint.create({
    data: {
      workshopId,
      transcriptChunkId: transcriptChunk.id,
      rawText: text,
      source: 'SPEECH',
      speakerId: utterance.speakerId || null,
    },
  });

  const dialoguePhase = safeDialoguePhase(bodyDialoguePhase ?? utterance.dialoguePhase);
  if (dialoguePhase) {
    await prisma.dataPointAnnotation.create({
      data: {
        dataPointId: dataPoint.id,
        dialoguePhase,
      },
    });
  }

  // ── Emit SSE: node appears immediately on hemisphere ──────
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
        startTimeMs: Number(transcriptChunk.startTimeMs),
        endTimeMs: Number(transcriptChunk.endTimeMs),
        text: transcriptChunk.text,
        confidence: transcriptChunk.confidence,
        source: transcriptChunk.source,
        createdAt: transcriptChunk.createdAt,
      },
    },
  });

  // ── Derive intent (fast, synchronous) ─────────────────────
  const contextMessages = recentTranscripts.slice(0, 10).reverse().map((t) => ({
    speaker: t.speakerId,
    text: t.text,
  }));

  const intent = await deriveIntent({ text, recentContext: contextMessages }).catch(() => null);
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

  // ── Cognitive analysis (async, after response) ──────────────
  // The DREAM agent processes this utterance in context of its
  // full cognitive state — beliefs, contradictions, entities, momentum.
  after(async () => {
    try {
      // Outbox cleanup — delete events older than 24 hours to prevent unbounded growth
      await (prisma as any).workshopEventOutbox.deleteMany({
        where: {
          workshopId,
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) },
        },
      }).catch(() => {}); // non-fatal

      const workshop = await prisma.workshop.findUnique({
        where: { id: workshopId },
        select: { name: true, description: true, businessContext: true, prepResearch: true },
      });
      if (!workshop) return;

      // Get or create the cognitive state for this workshop
      const cognitiveState = getOrCreateCognitiveState(
        workshopId,
        workshop.businessContext || workshop.description || workshop.name,
        (dialoguePhase as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH') || 'REIMAGINE',
      );

      // Populate custom dimensions from research (if available and not already set)
      if (!cognitiveState.customDimensions && workshop.prepResearch) {
        const research = workshop.prepResearch as Record<string, unknown>;
        if (Array.isArray(research.industryDimensions) && research.industryDimensions.length > 0) {
          cognitiveState.customDimensions = research.industryDimensions as unknown as typeof cognitiveState.customDimensions;
        }
      }

      // Run the cognitive reasoning engine
      const engine = getGPT4oMiniEngine();
      console.log('[Cognitive] Processing utterance:', text.substring(0, 100));

      const stateUpdate = await engine.processUtterance(
        cognitiveState,
        {
          text,
          speaker: bodySpeakerId,
          utteranceId: dataPoint.id,
          startTimeMs: utterance.startTimeMs,
          endTimeMs: utterance.endTimeMs,
        },
        // Live reasoning callback — emits each agentic tool call as an SSE event in real-time
        (entry) => {
          emitWorkshopEvent(workshopId, {
            id: nanoid(),
            type: 'agentic.reasoning',
            createdAt: entry.timestampMs,
            payload: {
              level: entry.level,
              icon: entry.icon,
              summary: entry.summary,
              details: entry.details,
            },
          });
        },
      );

      // Apply the update to the cognitive state (state engine owns dynamics)
      const events = applyCognitiveUpdate(cognitiveState, stateUpdate, dataPoint.id);

      // Store raw utterance text for agent grounding
      pushUtterance(cognitiveState, {
        id: dataPoint.id,
        text,
        speaker: bodySpeakerId,
        timestampMs: utterance.startTimeMs,
      });

      console.log('[Cognitive] Result:', {
        primaryType: stateUpdate.primaryType,
        meaning: stateUpdate.classification.semanticMeaning.substring(0, 80),
        newBeliefs: events.newBeliefs.length,
        reinforced: events.reinforcedBeliefs.length,
        stabilised: events.stabilisedBeliefs.length,
        contradictions: events.newContradictions.length,
        totalBeliefs: cognitiveState.beliefs.size,
      });

      // Store agentic analysis (backwards-compatible with existing schema)
      await prisma.agenticAnalysis.create({
        data: {
          dataPointId: dataPoint.id,
          semanticMeaning: stateUpdate.classification.semanticMeaning,
          speakerIntent: stateUpdate.classification.speakerIntent,
          temporalFocus: stateUpdate.classification.temporalFocus,
          sentimentTone: stateUpdate.classification.sentimentTone,
          domains: stateUpdate.beliefUpdates.flatMap(b => b.domains.map(d => ({
            domain: d.domain,
            relevance: d.relevance,
            reasoning: b.reasoning,
          }))),
          themes: stateUpdate.beliefUpdates.map(b => ({
            label: b.label,
            category: b.category,
            confidence: b.confidence,
            reasoning: b.reasoning,
          })),
          connections: [],
          actors: stateUpdate.actorUpdates.map(a => ({
            name: a.name,
            role: a.role,
            interactions: a.interactions,
          })),
          overallConfidence: stateUpdate.overallConfidence,
          uncertainties: [],
          agentModel: engine.engineName,
          analysisVersion: '2.0-cognitive',
        },
      });

      // Persist agentic analysis to outbox (hemisphere domain distribution + lens mapping)
      await persistAndEmit(workshopId, {
        type: 'agentic.analyzed',
        createdAt: Date.now(),
        payload: {
          dataPointId: dataPoint.id,
          analysis: {
            interpretation: {
              semanticMeaning: stateUpdate.classification.semanticMeaning,
              sentimentTone: stateUpdate.classification.sentimentTone,
            },
            domains: stateUpdate.beliefUpdates.flatMap(b => b.domains.map(d => ({
              domain: d.domain,
              relevance: d.relevance,
              reasoning: b.reasoning,
            }))),
            themes: stateUpdate.beliefUpdates.map(b => ({
              label: b.label,
              category: b.category,
              confidence: b.confidence,
              reasoning: b.reasoning,
            })),
            actors: stateUpdate.actorUpdates.map(a => ({
              name: a.name,
              role: a.role,
              interactions: a.interactions,
            })),
            overallConfidence: stateUpdate.overallConfidence,
          },
        },
      });

      // Create classification from cognitive analysis
      const primaryDomain = stateUpdate.beliefUpdates[0]?.domains[0]?.domain || null;
      const keywords = stateUpdate.beliefUpdates.map(b => b.label).slice(0, 8);

      const classification = await prisma.dataPointClassification.create({
        data: {
          dataPointId: dataPoint.id,
          primaryType: stateUpdate.primaryType,
          confidence: stateUpdate.overallConfidence,
          keywords,
          suggestedArea: primaryDomain,
        },
      });

      // Persist classification to outbox (hemisphere node update)
      await persistAndEmit(workshopId, {
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

      // Persist cognitive state events to outbox for live UI
      for (const belief of events.newBeliefs) {
        await persistAndEmit(workshopId, {
          type: 'belief.created',
          createdAt: Date.now(),
          payload: {
            belief: {
              id: belief.id,
              label: belief.label,
              category: belief.category,
              primaryType: belief.primaryType,
              domains: belief.domains,
              confidence: belief.confidence,
              evidenceCount: belief.evidenceCount,
              stabilised: belief.stabilised,
            },
          },
        });
      }

      for (const belief of events.reinforcedBeliefs) {
        await persistAndEmit(workshopId, {
          type: 'belief.reinforced',
          createdAt: Date.now(),
          payload: {
            belief: {
              id: belief.id,
              label: belief.label,
              confidence: belief.confidence,
              evidenceCount: belief.evidenceCount,
              stabilised: belief.stabilised,
            },
          },
        });
      }

      for (const belief of events.stabilisedBeliefs) {
        await persistAndEmit(workshopId, {
          type: 'belief.stabilised',
          createdAt: Date.now(),
          payload: {
            belief: {
              id: belief.id,
              label: belief.label,
              category: belief.category,
              primaryType: belief.primaryType,
              domains: belief.domains,
              confidence: belief.confidence,
              evidenceCount: belief.evidenceCount,
            },
          },
        });
      }

      for (const contradiction of events.newContradictions) {
        const beliefA = cognitiveState.beliefs.get(contradiction.beliefAId);
        const beliefB = cognitiveState.beliefs.get(contradiction.beliefBId);
        await persistAndEmit(workshopId, {
          type: 'contradiction.detected',
          createdAt: Date.now(),
          payload: {
            contradiction: {
              id: contradiction.id,
              beliefA: beliefA ? { id: beliefA.id, label: beliefA.label } : null,
              beliefB: beliefB ? { id: beliefB.id, label: beliefB.label } : null,
            },
          },
        });
      }

      // Emit reasoning entries for the live panel
      for (const entry of events.reasoningEntries) {
        emitWorkshopEvent(workshopId, {
          id: nanoid(),
          type: 'agentic.reasoning',
          createdAt: entry.timestampMs,
          payload: {
            level: entry.level,
            icon: entry.icon,
            summary: entry.summary,
            details: entry.details,
          },
        });
      }

      // ── Facilitation Orchestrator (agentic agents) ──────
      // Runs Theme Agent, Facilitation Agent, Constraint Agent
      // with Guardian verification. Emits theme.suggested,
      // pad.generated, constraint.mapped, and agent.conversation.
      try {
        await runFacilitationOrchestrator(
          workshopId,
          cognitiveState,
          async (type, payload) => {
            await persistAndEmit(workshopId, {
              type,
              createdAt: Date.now(),
              payload,
            });
          },
          async (entry) => {
            await persistAndEmit(workshopId, {
              type: 'agent.conversation',
              createdAt: entry.timestampMs,
              payload: entry,
            });
          },
        );
      } catch (orchError) {
        console.error('[Facilitation Orchestrator] Failed:', orchError);
      }
    } catch (error) {
      console.error('Cognitive analysis failed:', error);
    }
  });

  return {
    deduped: false,
    transcriptChunkId: transcriptChunk.id,
    dataPointId: dataPoint.id,
    // Include full payload so the client can render immediately
    // (SSE may not deliver across Vercel serverless isolates)
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
      startTimeMs: Number(transcriptChunk.startTimeMs),
      endTimeMs: Number(transcriptChunk.endTimeMs),
      text: transcriptChunk.text,
      confidence: transcriptChunk.confidence,
      source: transcriptChunk.source,
      createdAt: transcriptChunk.createdAt,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// POST handler — receives raw transcript fragments from client
// ══════════════════════════════════════════════════════════════
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as IngestTranscriptChunkBody;

    const text = (body?.text || '').trim();

    // ── Handle flush-only requests (no real text) ─────────────
    if (body.flush && (!text || text === '__flush__')) {
      const flushed = flushWorkshop(workshopId);
      const results: Array<{ dataPointId?: string; deduped?: boolean }> = [];

      for (const utterance of flushed) {
        if (isTextTrivial(utterance.text)) continue;
        try {
          const result = await processCompleteUtterance(
            workshopId,
            utterance,
            body.dialoguePhase,
            body.speakerId,
          );
          results.push(result);
        } catch (error) {
          console.error('[Transcript] Error processing flushed utterance:', error);
        }
      }

      return NextResponse.json({
        ok: true,
        flushed: true,
        flushedCount: results.length,
        results,
      });
    }

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const startTimeMs = Number.isFinite(body.startTime) ? Math.max(0, Math.round(body.startTime)) : 0;
    const endTimeMs = Number.isFinite(body.endTime) ? Math.max(startTimeMs, Math.round(body.endTime)) : startTimeMs;
    const src =
      body.source === 'deepgram' ? 'DEEPGRAM' : body.source === 'whisper' ? 'WHISPER' : 'ZOOM';

    // ── Always store the raw transcript chunk for audio timeline ──
    await prisma.transcriptChunk.create({
      data: {
        workshopId,
        speakerId: body.speakerId || null,
        startTimeMs,
        endTimeMs,
        text,
        confidence: typeof body.confidence === 'number' ? body.confidence : null,
        source: src,
        metadata: body.slmMetadata || body.rawText
          ? {
              ...(body.rawText && { rawText: body.rawText }),
              ...(body.slmMetadata && { slmMetadata: body.slmMetadata }),
            }
          : undefined,
      },
    }).catch(() => null); // Ignore duplicates

    // ── Filter trivial text before buffering ─────────────────
    if (isTextTrivial(text)) {
      return NextResponse.json({
        ok: true,
        buffered: false,
        skipped: true,
        reason: 'Trivial fragment — transcript chunk stored only',
      });
    }

    // ── Feed into the utterance buffer ───────────────────────
    // The buffer accumulates fragments until it detects a complete
    // thought (sentence boundary, speaker change, or time gap).
    const flushed = addFragment(workshopId, {
      text,
      speakerId: body.speakerId || null,
      startTimeMs,
      endTimeMs,
      confidence: typeof body.confidence === 'number' ? body.confidence : null,
      source: src,
      rawText: body.rawText,
      slmMetadata: body.slmMetadata as Record<string, unknown> | undefined,
      dialoguePhase: body.dialoguePhase || null,
    });

    // If client requested a flush (e.g. capture stopped), force-flush remaining
    if (body.flush) {
      const remaining = flushWorkshop(workshopId);
      for (const r of remaining) {
        if (!flushed.some((f) => f.text === r.text)) {
          flushed.push(r);
        }
      }
    }

    if (flushed.length === 0) {
      // Text is being accumulated — waiting for more context
      return NextResponse.json({
        ok: true,
        buffered: true,
        message: 'Fragment buffered — waiting for complete thought',
      });
    }

    // ── Process each flushed complete utterance ──────────────
    const results: Array<{ dataPointId?: string; deduped?: boolean; error?: string }> = [];
    const skippedTrivial: string[] = [];

    for (const utterance of flushed) {
      // Skip if the merged text is still trivial
      if (isTextTrivial(utterance.text)) {
        skippedTrivial.push(utterance.text.substring(0, 60));
        continue;
      }

      try {
        const result = await processCompleteUtterance(
          workshopId,
          utterance,
          body.dialoguePhase,
          body.speakerId,
          body.slmMetadata as Record<string, unknown> | undefined,
        );
        results.push(result);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Transcript] Error processing buffered utterance:', error);
        results.push({ error: errMsg });
      }
    }

    return NextResponse.json({
      ok: true,
      buffered: false,
      flushedCount: flushed.length,
      results,
      skippedTrivial: skippedTrivial.length > 0 ? skippedTrivial : undefined,
      classificationId: null, // Classification arrives asynchronously
    });
  } catch (error) {
    console.error('Error ingesting transcript chunk:', error);
    return NextResponse.json({ error: 'Failed to ingest transcript chunk' }, { status: 500 });
  }
}

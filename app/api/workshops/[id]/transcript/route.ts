import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { apiLimiter } from '@/lib/rate-limit';
import { emitWorkshopEvent, persistAndEmit } from '@/lib/realtime/workshop-events';
import { deriveIntent } from '@/lib/workshop/derive-intent';
import type { FlushedUtterance } from '@/lib/workshop/utterance-buffer';
import { getOrCreateCognitiveState } from '@/lib/cognition/state-store';
import { applyCognitiveUpdate } from '@/lib/cognition/reasoning-engine';
import { getGPT4oMiniEngine } from '@/lib/cognition/engines/gpt4o-mini-engine';
import { runFacilitationOrchestrator } from '@/lib/cognition/agents/facilitation-orchestrator';
import { pushUtterance } from '@/lib/cognition/cognitive-state';
import { isStatementSelfContained } from '@/lib/live/semantic-gate';

// Journey agent + cognitive analysis run inside after() — up to 40s per cycle.
// Without this, Vercel kills the background work before the journey agent completes.
export const maxDuration = 60;

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
  traceId?: string,
) {
  const trace = traceId ? `[trace:${traceId}]` : '';
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

  // ── Semantic gate — reject dependent fragments before committing ─
  // Use the last 3 transcript chunks as context for the evaluation.
  const gateContext = recentTranscripts.slice(0, 3).reverse().map((t) => ({
    speaker: t.speakerId,
    text: t.text,
  }));
  const gate = await isStatementSelfContained(text, gateContext);
  if (!gate.selfContained) {
    console.log(`[SemanticGate]${trace} Rejected fragment: "${text.substring(0, 80)}" — ${gate.reason}`);
    return { rejected: true, reason: gate.reason };
  }
  console.log(`[SemanticGate]${trace} Accepted: "${text.substring(0, 60)}"`)

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

  // ── Persist + emit: node appears on hemisphere for all sessions ──
  await persistAndEmit(workshopId, {
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

    await persistAndEmit(workshopId, {
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
      console.log(`[Cognitive]${trace} Processing utterance:`, text.substring(0, 100));

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

      console.log(`[Cognitive]${trace} Result:`, {
        primaryType: stateUpdate.primaryType,
        meaning: stateUpdate.classification.semanticMeaning.substring(0, 80),
        newBeliefs: events.newBeliefs.length,
        reinforced: events.reinforcedBeliefs.length,
        stabilised: events.stabilisedBeliefs.length,
        contradictions: events.newContradictions.length,
        totalBeliefs: cognitiveState.beliefs.size,
      });

      // ── Domain post-processing: enforce dominant domain, cap at 3 ──
      // The model sometimes hedges with flat 0.5 distributions across all
      // dimensions. Deduplicate, sort by relevance, take top 3, and ensure
      // the primary domain has a clear lead (≥ 0.6). If it doesn't, boost it.
      const rawDomains = stateUpdate.beliefUpdates.flatMap(b => b.domains.map(d => ({
        domain: d.domain,
        relevance: d.relevance,
        reasoning: b.reasoning,
      })));
      // Deduplicate: keep highest relevance per domain
      const domainMap = new Map<string, typeof rawDomains[number]>();
      for (const d of rawDomains) {
        const existing = domainMap.get(d.domain);
        if (!existing || d.relevance > existing.relevance) domainMap.set(d.domain, d);
      }
      // Sort descending, cap at 3
      const sortedDomains = [...domainMap.values()].sort((a, b) => b.relevance - a.relevance).slice(0, 3);
      // Enforce dominant: if top domain is not clearly leading (< 0.6), boost it to 0.75
      if (sortedDomains.length > 0 && sortedDomains[0].relevance < 0.6) {
        sortedDomains[0] = { ...sortedDomains[0], relevance: 0.75 };
      }
      // Drop secondaries that are within 0.1 of each other and top (all tied = flat distribution)
      const primaryRelevance = sortedDomains[0]?.relevance ?? 0;
      const finalDomains = sortedDomains.filter((d, i) =>
        i === 0 || (primaryRelevance - d.relevance) >= 0.15
      );

      // Store agentic analysis (backwards-compatible with existing schema)
      await prisma.agenticAnalysis.create({
        data: {
          dataPointId: dataPoint.id,
          semanticMeaning: stateUpdate.classification.semanticMeaning,
          speakerIntent: stateUpdate.classification.speakerIntent,
          temporalFocus: stateUpdate.classification.temporalFocus,
          sentimentTone: stateUpdate.classification.sentimentTone,
          domains: finalDomains,
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
            domains: finalDomains,
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
      const primaryDomain = finalDomains[0]?.domain || stateUpdate.beliefUpdates[0]?.domains[0]?.domain || null;
      // Extract keywords from actual speech rather than abstract belief labels.
      // Pull noun-like tokens (3+ chars, not stop words) from the committed utterance text.
      const STOP = new Set(['the','and','that','this','with','have','from','they','will','been','were','what','when','which','who','how','can','could','should','would','their','there','here','some','then','than','just','also','into','about','more','these','those','your','our','its','has','are','for','not','but','was','you','all','any','may','her','him','his','its','get','got','had','him','her']);
      const speechKeywords = text
        .toLowerCase()
        .replace(/[^a-z\s'-]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOP.has(w))
        .reduce((acc: string[], w) => (acc.includes(w) ? acc : [...acc, w]), [])
        .slice(0, 6);
      const keywords = speechKeywords.length >= 3 ? speechKeywords : stateUpdate.beliefUpdates.map(b => b.label).slice(0, 6);

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
      // pad.generated, constraint.mapped, agent.conversation.
      // Also runs mandatory journey assessment on every utterance (no belief gate).
      console.log(`[JourneyPipeline] transcript-received workshopId=${workshopId} text="${text.substring(0, 80)}" beliefs=${cognitiveState.beliefs.size} utterances=${cognitiveState.recentUtterances.length}`);
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

    // ── Auth: session cookie (browser) OR X-Capture-Secret (Railway server-to-server) ──
    const captureSecret = request.headers.get('x-capture-secret');
    const expectedSecret = process.env.CAPTURE_INGEST_SECRET;
    const isServerToServer = !!(captureSecret && expectedSecret && captureSecret === expectedSecret);

    if (!isServerToServer) {
      // Fall back to session cookie auth (browser path)
      const user = await getAuthenticatedUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
      if (!access.valid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Rate limit: 120 req/min per workshop (2/s — well above normal live-session cadence)
    const rl = await apiLimiter.check(120, `transcript:${workshopId}`);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Trace ID — threads through all logs for this ingest request
    const traceId = nanoid(8);

    const body = (await request.json()) as IngestTranscriptChunkBody;

    const text = (body?.text || '').trim();

    // ── Flush-only requests (capture stopped) — no buffer to drain ──
    // CaptureAPI SLM produces complete sentences; no in-memory accumulation.
    if (body.flush && (!text || text === '__flush__')) {
      return NextResponse.json({ ok: true, flushed: true, flushedCount: 0, results: [] });
    }

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const startTimeMs = Number.isFinite(body.startTime) ? Math.max(0, Math.round(body.startTime)) : 0;
    const endTimeMs = Number.isFinite(body.endTime) ? Math.max(startTimeMs, Math.round(body.endTime)) : startTimeMs;
    const src =
      body.source === 'deepgram' ? 'DEEPGRAM' : body.source === 'whisper' ? 'WHISPER' : 'ZOOM';

    // ── Filter trivial text — store raw chunk only, skip analysis ─
    if (isTextTrivial(text)) {
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
      }).catch(() => null);

      return NextResponse.json({
        ok: true,
        buffered: false,
        skipped: true,
        reason: 'Trivial fragment — stored only',
      });
    }

    // ── Each chunk from CaptureAPI SLM is already a complete sentence ──
    // No buffering needed. Process directly.
    const utterance: FlushedUtterance = {
      text,
      speakerId: body.speakerId || null,
      startTimeMs,
      endTimeMs,
      confidence: typeof body.confidence === 'number' ? body.confidence : null,
      source: src,
      rawText: body.rawText,
      slmMetadata: body.slmMetadata as Record<string, unknown> | undefined,
      dialoguePhase: body.dialoguePhase || null,
    };

    try {
      const result = await processCompleteUtterance(
        workshopId,
        utterance,
        body.dialoguePhase,
        body.speakerId,
        body.slmMetadata as Record<string, unknown> | undefined,
        traceId,
      );
      return NextResponse.json({
        ok: true,
        buffered: false,
        flushedCount: 1,
        results: [result],
        classificationId: null,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Transcript][trace:${traceId}] Error processing utterance:`, error);
      return NextResponse.json({
        ok: true,
        buffered: false,
        flushedCount: 0,
        results: [{ error: errMsg }],
      });
    }
  } catch (error) {
    console.error('[Transcript] Error ingesting transcript chunk:', error);
    return NextResponse.json({ error: 'Failed to ingest transcript chunk' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { classifyReasoningRole } from '@/lib/ethentaflow/reasoning-role';
import { env } from '@/lib/env';
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
import { extractFeatures } from '@/lib/ethentaflow/thought-feature-extractor';
import { runStructuralGuard, logGuardResult } from '@/lib/ethentaflow/thought-guard';
import { DEFAULT_LENS_PACK } from '@/lib/ethentaflow/lens-pack-ontology';
// Journey agent + cognitive analysis run inside after() — up to 40s per cycle.
// Without this, Vercel kills the background work before the journey agent completes.
export const maxDuration = 60;

type ClientDomainHint = {
  primaryDomain: string;
  secondaryDomain: string | null;
  confidence: number;
  decisionPath: string;
};

type IncomingSpokenRecord = {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  confidence: number | null;
  source: 'zoom' | 'deepgram' | 'whisper';
};

type IngestTranscriptChunkBody = {
  speakerId: string | null;
  startTime: number;
  endTime: number;
  text: string; // Resolved thought text (full accumulated text from ThoughtStateMachine)
  rawText?: string; // Original from transcription service
  confidence: number | null;
  source: 'zoom' | 'deepgram' | 'whisper';
  dialoguePhase?: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null;
  flush?: boolean;
  // Individual spoken records — one per Deepgram isFinal result.
  // Linked to the ThoughtWindow before DataPoint creation.
  spokenRecords?: IncomingSpokenRecord[];
  // Legacy field — no-op. Raw transcript is now stored at receipt via raw_transcript_entries.
  rawCaptureOnly?: boolean;
  // Deterministic domain result from EthentaFlow client scorer.
  clientDomainHint?: ClientDomainHint | null;
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
// applyServerGuard — delegates to the single shared runCommitGuard.
// Covers all POST paths: WebSocket primary, MediaRecorder fallback,
// cognitive-guidance, and any future server-to-server ingest.
// Uses DEFAULT_LENS_PACK: structural noise filtering doesn't require
// workshop-specific vocabulary.
// ══════════════════════════════════════════════════════════════
function applyServerGuard(
  text: string,
  requestSource: string,
): { blocked: boolean; reason: string | null } {
  const features = extractFeatures(text, DEFAULT_LENS_PACK);
  const result = runStructuralGuard(text, features);
  logGuardResult(`ServerGuard:${requestSource}`, text, features, result);
  return result;
}

// ══════════════════════════════════════════════════════════════
// processResolvedThought
//
// Receives a fully resolved thought (from ThoughtStateMachine commit)
// and runs the two-layer write sequence:
//   1. ThoughtWindow — aggregation record (timing, speaker, text)
//   2. DataPoint     — resolved meaning artifact
//
// Raw transcript is stored verbatim in raw_transcript_entries at receipt
// time (before TSM) and is never modified. ThoughtWindow and DataPoint
// are derived artifacts only.
// ══════════════════════════════════════════════════════════════
type PassageMeta = {
  /** ThoughtWindow ID of the first unit in the split passage (shared by all siblings). */
  sourceWindowId?: string;
  /** 0-based position of this unit within the split passage. */
  sequenceIndex?: number;
  /** Structural role of this unit in the speaker's argument. */
  reasoningRole?: string;
};

async function processResolvedThought(
  workshopId: string,
  utterance: FlushedUtterance,
  bodyDialoguePhase: string | null | undefined,
  bodySpeakerId: string | null,
  incomingSpokenRecords: IncomingSpokenRecord[],
  bodySlmMetadata?: Record<string, unknown>,
  traceId?: string,
  clientDomainHint?: ClientDomainHint | null,
  skipServerGuard = false,
  passageMeta?: PassageMeta,
) {
  const trace = traceId ? `[trace:${traceId}]` : '';
  const text = utterance.text;
  const now = Date.now();

  // Timing: use the span of the incoming spoken records. Fallback to utterance
  // timing for semantic split units 2..N (which share timing with unit 1).
  const firstStartTimeMs = incomingSpokenRecords[0]?.startTimeMs ?? utterance.startTimeMs ?? now;
  const lastEndTimeMs = incomingSpokenRecords[incomingSpokenRecords.length - 1]?.endTimeMs ?? utterance.endTimeMs ?? now;

  // ══ STEP 1 — Guard check. Controls DataPoint creation. ═══════════════════
  // skipServerGuard=true when the full passage was already validated by the
  // stricter client-side runCommitGuard before semantic splitting.
  if (!skipServerGuard) {
    const guard = applyServerGuard(text, utterance.source ?? 'unknown');
    if (guard.blocked) {
      console.log(`[ThoughtWindow${trace}] Guard blocked — no DataPoint:`, guard.reason);
      return { blocked: true, reason: guard.reason, spokenRecordIds: [] };
    }
  }

  // ══ STEP 2 — Create ThoughtWindow (processing artifact, not transcript). ═
  const spanMs = Math.max(0, lastEndTimeMs - firstStartTimeMs);
  const thoughtWindow = await prisma.thoughtWindow.create({
    data: {
      workshopId,
      speakerId: bodySpeakerId ?? null,
      state: 'RESOLVED',
      fullText: text,
      resolvedText: text,
      openedAtMs: BigInt(firstStartTimeMs),
      lastActivityAtMs: BigInt(lastEndTimeMs),
      closedAtMs: BigInt(now),
      spokenRecordCount: incomingSpokenRecords.length,
    },
  });

  // ══ STEP 3 — Create DataPoint. The resolved meaning artifact. ════════════
  console.log('DATAPOINT_CREATED', { speakerId: bodySpeakerId ?? null, thoughtWindowId: thoughtWindow.id, time: Date.now() });
  const dataPoint = await prisma.dataPoint.create({
    data: {
      workshopId,
      thoughtWindowId: thoughtWindow.id,
      spokenRecordIds: [],
      rawText: text,
      source: 'SPEECH',
      speakerId: bodySpeakerId ?? null,
      startTimeMs: BigInt(firstStartTimeMs),
      endTimeMs: BigInt(lastEndTimeMs),
      spanMs,
      spokenRecordCount: incomingSpokenRecords.length,
      // Passage linkage metadata
      sourceWindowId: passageMeta?.sourceWindowId ?? thoughtWindow.id,
      sequenceIndex: passageMeta?.sequenceIndex ?? 0,
      reasoningRole: passageMeta?.reasoningRole ?? null,
      // relatedDataPointIds populated in a batch update after all sibling units are created
    },
  });

  const window = {
    windowId: thoughtWindow.id,
    spokenRecordIds: [] as string[],
    resolvedText: text,
    speakerId: bodySpeakerId,
    startTimeMs: firstStartTimeMs,
    endTimeMs: lastEndTimeMs,
    spanMs,
    spokenRecordCount: incomingSpokenRecords.length,
  };

  const dialoguePhase = safeDialoguePhase(bodyDialoguePhase ?? utterance.dialoguePhase);
  if (dialoguePhase) {
    await prisma.dataPointAnnotation.create({
      data: { dataPointId: dataPoint.id, dialoguePhase },
    });
  }

  // ── Persist + emit: node appears on hemisphere ────────────────────────────
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
        spokenRecordCount: window.spokenRecordCount,
        spanMs: window.spanMs,
        // Passage linkage
        sourceWindowId: dataPoint.sourceWindowId,
        sequenceIndex: dataPoint.sequenceIndex,
        reasoningRole: dataPoint.reasoningRole,
      },
      // Lineage metadata — not used for reasoning, only for UI/audit
      thoughtWindowId: window.windowId,
      spokenRecordIds: window.spokenRecordIds,
    },
  });

  // ── STEP 7: Fetch recent resolved DataPoints for DREAM context ────────────
  // DREAM never sees raw TranscriptChunks. It reasons over resolved thoughts only.
  const recentDataPoints = await prisma.dataPoint.findMany({
    where: { workshopId, thoughtWindowId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      rawText: true,
      speakerId: true,
      createdAt: true,
      spokenRecordCount: true,
    },
  });

  // ── Derive intent (fast, synchronous) ─────────────────────
  const contextMessages = recentDataPoints.slice(0, 10).reverse().map((dp) => ({
    speaker: dp.speakerId,
    text: dp.rawText,
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
      let finalDomains = sortedDomains.filter((d, i) =>
        i === 0 || (primaryRelevance - d.relevance) >= 0.15
      );

      // ── Apply EthentaFlow client domain prior ──────────────────────────────
      // The deterministic scorer runs before the LLM and produces a causally-grounded
      // domain attribution. We use it as a Bayesian prior to correct the LLM's tendency
      // to assign flat distributions or attribute to symptom domains.
      //
      // Contract:
      //   hint.confidence ≥ 0.65 → override: ensure hint primary is at top with ≥ 0.80 relevance
      //   hint.confidence 0.40–0.65 → blend: boost matching domain, soft-demote mismatches
      //   hint.confidence < 0.40 → defer: LLM result stands (deterministic scorer was uncertain)
      if (clientDomainHint && clientDomainHint.confidence >= 0.40) {
        const hint = clientDomainHint;
        const hintDomain = hint.primaryDomain;
        const hintConf = hint.confidence;

        if (hintConf >= 0.65) {
          // Strong prior — force hint domain to primary position
          const existingHint = finalDomains.find(d => d.domain === hintDomain);
          const boostedRelevance = Math.max(0.80, existingHint?.relevance ?? 0);
          const hintEntry = {
            domain: hintDomain,
            relevance: boostedRelevance,
            reasoning: `EthentaFlow deterministic prior (conf=${hintConf.toFixed(2)}): ${hint.decisionPath}`,
          };
          // Rebuild: hint first, then LLM secondaries that don't contradict it
          finalDomains = [
            hintEntry,
            ...finalDomains
              .filter(d => d.domain !== hintDomain)
              .map(d => ({ ...d, relevance: d.relevance * 0.75 })) // demote non-primary
              .filter(d => (boostedRelevance - d.relevance) >= 0.15)
              .slice(0, 2),
          ];
          console.log(`[DomainPrior]${trace} OVERRIDE → ${hintDomain} (hint conf=${hintConf.toFixed(2)})`);
        } else {
          // Moderate prior — blend
          const matchIdx = finalDomains.findIndex(d => d.domain === hintDomain);
          if (matchIdx > 0) {
            // Domain is present but not primary — promote it
            const matched = finalDomains[matchIdx];
            const promoted = { ...matched, relevance: Math.min(matched.relevance + 0.20, 0.90) };
            finalDomains = [promoted, ...finalDomains.filter((_, i) => i !== matchIdx)];
            console.log(`[DomainPrior]${trace} BLEND promote → ${hintDomain} (hint conf=${hintConf.toFixed(2)})`);
          } else if (matchIdx === -1 && hintConf >= 0.50) {
            // Domain not in LLM result at all — insert it at moderate relevance
            finalDomains = [
              { domain: hintDomain, relevance: 0.60, reasoning: `EthentaFlow moderate prior (conf=${hintConf.toFixed(2)})` },
              ...finalDomains.map(d => ({ ...d, relevance: d.relevance * 0.85 })).slice(0, 2),
            ];
            console.log(`[DomainPrior]${trace} BLEND insert → ${hintDomain} (hint conf=${hintConf.toFixed(2)})`);
          }
        }
      }

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
    thoughtWindowId: window.windowId,
    spokenRecordIds: window.spokenRecordIds,
    dataPointId: dataPoint.id,
    dataPoint: {
      id: dataPoint.id,
      rawText: dataPoint.rawText,
      source: dataPoint.source,
      speakerId: dataPoint.speakerId,
      createdAt: dataPoint.createdAt,
      dialoguePhase,
      spokenRecordCount: window.spokenRecordCount,
      spanMs: window.spanMs,
      sourceWindowId: dataPoint.sourceWindowId,
      sequenceIndex: dataPoint.sequenceIndex,
      reasoningRole: dataPoint.reasoningRole,
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

    // ── Trivial fragments — raw transcript already stored at receipt time ────
    // No ThoughtWindow or DataPoint created for noise.
    if (isTextTrivial(text)) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Trivial fragment' });
    }

    // ── rawCaptureOnly — raw transcript already stored at receipt time ────────
    // No further storage needed. Return immediately.
    if (body.rawCaptureOnly) {
      return NextResponse.json({ ok: true, rawCaptureOnly: true });
    }

    // ── Resolved thought — create ThoughtWindow + DataPoint ─────────────────
    const utterance: FlushedUtterance = {
      text,
      speakerId: body.speakerId || null,
      startTimeMs,
      endTimeMs,
      confidence: typeof body.confidence === 'number' ? body.confidence : null,
      source: body.source === 'deepgram' ? 'DEEPGRAM' : body.source === 'whisper' ? 'WHISPER' : 'ZOOM',
      rawText: body.rawText,
      slmMetadata: body.slmMetadata as Record<string, unknown> | undefined,
      dialoguePhase: body.dialoguePhase || null,
    };

    // Normalise spoken records from the request body.
    // New clients send an array of individual Deepgram results.
    // Legacy/fallback clients send no array — we synthesise one record.
    const incomingSpokenRecords: IncomingSpokenRecord[] = Array.isArray(body.spokenRecords) && body.spokenRecords.length > 0
      ? body.spokenRecords.map((r: IncomingSpokenRecord) => ({
          text: r.text || text,
          startTimeMs: Number(r.startTimeMs) || startTimeMs,
          endTimeMs: Number(r.endTimeMs) || endTimeMs,
          confidence: typeof r.confidence === 'number' ? r.confidence : null,
          source: body.source,
        }))
      : [{
          text,
          startTimeMs,
          endTimeMs,
          confidence: typeof body.confidence === 'number' ? body.confidence : null,
          source: body.source,
        }];

    try {
      // One committed passage = one DataPoint. No splitting.
      // The TSM commit is the unit of meaning — the full passage is passed through verbatim.
      const result = await processResolvedThought(
        workshopId,
        utterance,
        body.dialoguePhase,
        body.speakerId,
        incomingSpokenRecords,
        body.slmMetadata as Record<string, unknown> | undefined,
        traceId,
        body.clientDomainHint ?? null,
        false,
        {
          sourceWindowId: undefined,
          sequenceIndex: 0,
          reasoningRole: classifyReasoningRole(text),
        },
      );

      return NextResponse.json({
        ok: true,
        buffered: false,
        flushedCount: 1,
        results: [{ ...result, unitIntent: null, unitReasoningRole: classifyReasoningRole(text) }],
        filteredUnits: [],
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

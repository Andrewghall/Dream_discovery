/**
 * Thought-window aggregation layer.
 *
 * Invariants:
 *   transcriptChunk  = spoken record — written immediately, always
 *   ThoughtWindow    = accumulation record — links spoken records to one thought
 *   DataPoint        = resolved meaning artifact — created once, after resolution
 *
 * In this serverless architecture the client-side ThoughtStateMachine owns the
 * accumulation and continuation logic. When it resolves a thought it fires
 * onCommitCandidate with the full set of chunks and their arrival times.
 * The server receives one POST per resolved thought and runs this manager to:
 *   1. Create one TranscriptChunk per spoken piece (the raw spoken record layer)
 *   2. Create one ThoughtWindow linking all those chunks
 *   3. Return the resolved window data so the caller can create the DataPoint
 *
 * The DataPoint is created by the caller after this function returns, keeping
 * the three writes explicitly sequenced even within one HTTP request.
 */

import { prisma } from '@/lib/prisma';
import { extractFeatures } from './thought-feature-extractor';
import { runCommitGuard } from './thought-guard';
import { DEFAULT_LENS_PACK } from './lens-pack-ontology';
import type { TranscriptSource } from '@prisma/client';

// ─── Speaker-pause hold (server-side windows for future streaming ingest) ─────
export const SPEAKER_PAUSE_HOLD_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IncomingSpokenRecord {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  confidence: number | null;
  source: TranscriptSource;
  metadata?: Record<string, unknown>;
}

export interface ResolvedWindowResult {
  windowId: string;
  spokenRecordIds: string[];   // ordered — all transcriptChunk IDs in this window
  resolvedText: string;
  speakerId: string | null;
  startTimeMs: number;
  endTimeMs: number;
  spanMs: number;
  spokenRecordCount: number;
}

export type WindowOutcome =
  | { status: 'resolved'; window: ResolvedWindowResult }
  | { status: 'blocked'; reason: string }
  | { status: 'error'; message: string };

/**
 * Primary entry point.
 *
 * Receives a batch of spoken records that the client-side ThoughtStateMachine
 * has already resolved into one thought. Creates the spoken record layer, the
 * thought window, and returns the window result so the caller can create the
 * DataPoint.
 *
 * The resolvedText passed here is the full_text from the ThoughtAttempt —
 * the accumulated and guard-validated text. Each entry in spokenRecords is
 * one Deepgram final result that contributed to this thought.
 */
export async function commitThoughtWindow(
  workshopId: string,
  speakerId: string | null,
  resolvedText: string,
  spokenRecords: IncomingSpokenRecord[],
  dialoguePhase?: string | null,
  slmMetadata?: Record<string, unknown>,
  clientDomainHint?: Record<string, unknown> | null,
): Promise<WindowOutcome> {
  const now = Date.now();

  // ── Final guard — same rules as client; catches any bypass path ───────────
  const features = extractFeatures(resolvedText, DEFAULT_LENS_PACK);
  const guard = runCommitGuard(resolvedText, features);
  if (guard.blocked) {
    return { status: 'blocked', reason: guard.reason ?? 'guard-blocked' };
  }

  // ── Normalise spoken records — always have at least the resolved text ─────
  const records: IncomingSpokenRecord[] = spokenRecords.length > 0
    ? spokenRecords
    : [{
        text: resolvedText,
        startTimeMs: now,
        endTimeMs: now,
        confidence: null,
        source: 'DEEPGRAM',
      }];

  const firstRecord = records[0];
  const lastRecord = records[records.length - 1];
  const startTimeMs = firstRecord.startTimeMs;
  const endTimeMs = lastRecord.endTimeMs;
  const spanMs = Math.max(0, endTimeMs - startTimeMs);

  try {
    // ── Create all spoken records (transcriptChunks) ──────────────────────
    // These are the raw spoken layer — written first, always.
    const chunkIds: string[] = [];
    for (const rec of records) {
      const chunk = await prisma.transcriptChunk.create({
        data: {
          workshopId,
          speakerId: speakerId ?? null,
          startTimeMs: BigInt(rec.startTimeMs),
          endTimeMs: BigInt(rec.endTimeMs),
          text: rec.text,
          confidence: rec.confidence,
          source: rec.source,
          metadata: buildChunkMetadata(rec, slmMetadata, clientDomainHint) as any,
        },
      });
      chunkIds.push(chunk.id);
    }

    // ── Create thought window — the aggregation record ────────────────────
    const window = await prisma.thoughtWindow.create({
      data: {
        workshopId,
        speakerId: speakerId ?? null,
        state: 'RESOLVED',
        fullText: resolvedText,
        resolvedText,
        openedAtMs: BigInt(startTimeMs),
        lastActivityAtMs: BigInt(endTimeMs),
        closedAtMs: BigInt(now),
        spokenRecordCount: records.length,
        // Back-link all transcriptChunks to this window
        spokenRecords: { connect: chunkIds.map(id => ({ id })) },
      },
    });

    return {
      status: 'resolved',
      window: {
        windowId: window.id,
        spokenRecordIds: chunkIds,
        resolvedText,
        speakerId,
        startTimeMs,
        endTimeMs,
        spanMs,
        spokenRecordCount: records.length,
      },
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function buildChunkMetadata(
  rec: IncomingSpokenRecord,
  slmMetadata?: Record<string, unknown>,
  clientDomainHint?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  if (rec.metadata) Object.assign(meta, rec.metadata);
  if (slmMetadata) meta.slmMetadata = slmMetadata;
  if (clientDomainHint) meta.ethentaflowDomain = clientDomainHint;
  return Object.keys(meta).length > 0 ? meta : undefined;
}

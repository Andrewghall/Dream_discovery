/**
 * Utterance Buffer — Accumulates transcript fragments into complete thoughts
 *
 * Real-time transcription sends chunks every ~10 seconds. A single thought
 * like "So we worked really closely with the customer to understand their
 * needs" may span two chunks. This buffer accumulates fragments per workshop
 * and only flushes when it detects:
 *
 *   1. A sentence-ending boundary (. ! ?)
 *   2. A speaker change
 *   3. A time gap > threshold (natural pause in speech)
 *   4. Accumulated text exceeds max length (safety valve)
 *   5. Explicit flush request (e.g. capture stopped)
 *
 * The buffer lives in-memory on the server. On Vercel serverless this means
 * each isolate has its own buffer — that's fine because a single live session
 * routes to the same isolate during active streaming.
 */

export type BufferedFragment = {
  text: string;
  speakerId: string | null;
  startTimeMs: number;
  endTimeMs: number;
  confidence: number | null;
  source: string;
  rawText?: string;
  slmMetadata?: Record<string, unknown>;
  dialoguePhase?: string | null;
  arrivedAt?: number; // Wall-clock time this fragment arrived (Date.now())
};

type BufferEntry = {
  fragments: BufferedFragment[];
  lastActivityMs: number;
};

// ── Configuration ───────────────────────────────────────────
const PAUSE_THRESHOLD_MS = 3_000;   // 3s gap = speaker paused → flush
const MAX_BUFFER_AGE_MS = 30_000;   // Never hold text longer than 30s
const MAX_BUFFER_WORDS = 80;        // Flush if accumulated text > 80 words
const CLEANUP_INTERVAL_MS = 60_000; // Clean stale entries every 60s

// ── In-memory buffer store ──────────────────────────────────
// Key: `${workshopId}::${speakerId || '__default__'}`
const buffers = new Map<string, BufferEntry>();

function bufferKey(workshopId: string, speakerId: string | null): string {
  return `${workshopId}::${speakerId || '__default__'}`;
}

/**
 * Minimum word count before sentence-boundary flushing is allowed.
 * CaptureAPI's SLM adds punctuation at speech pauses that don't correspond
 * to thought completion. Short clauses like "we need to consider." (4 words)
 * are often followed by a dependent clause ("if you're happy for AI to...").
 * Requiring ≥10 words prevents premature flush of conditional/introductory
 * phrases, avoiding dangerous out-of-context fragments.
 */
const MIN_SENTENCE_BOUNDARY_WORDS = 10;

/**
 * Check if text ends at a natural sentence boundary
 */
function endsAtSentenceBoundary(text: string): boolean {
  const trimmed = text.trim();
  // Ends with sentence-terminal punctuation
  if (/[.!?][\s"'»)]*$/.test(trimmed)) return true;
  // Ends with common discourse markers that signal thought completion
  // (but only if the text is long enough to be a complete thought)
  if (trimmed.split(/\s+/).length >= 6) {
    if (/[,;:][\s]*$/.test(trimmed)) return false; // Comma = mid-thought
  }
  return false;
}

/**
 * Merge fragments into a single combined text
 */
function mergeFragments(fragments: BufferedFragment[]): {
  text: string;
  speakerId: string | null;
  startTimeMs: number;
  endTimeMs: number;
  confidence: number | null;
  source: string;
  rawText: string | undefined;
  slmMetadata: Record<string, unknown> | undefined;
  dialoguePhase: string | null | undefined;
} {
  const texts = fragments.map((f) => f.text.trim()).filter(Boolean);
  const combined = texts.join(' ').replace(/\s+/g, ' ').trim();

  // Use the last fragment's metadata (most recent/relevant)
  const last = fragments[fragments.length - 1];
  const first = fragments[0];

  // Average confidence across fragments
  const confidences = fragments
    .map((f) => f.confidence)
    .filter((c): c is number => c !== null);
  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;

  return {
    text: combined,
    speakerId: first.speakerId,
    startTimeMs: first.startTimeMs,
    endTimeMs: last.endTimeMs,
    confidence: avgConfidence,
    source: last.source,
    rawText: fragments.map((f) => f.rawText || f.text).join(' ').trim() || undefined,
    slmMetadata: last.slmMetadata,
    dialoguePhase: last.dialoguePhase,
  };
}

export type FlushedUtterance = ReturnType<typeof mergeFragments>;

/**
 * Add a fragment to the buffer and return any complete utterances to flush
 */
export function addFragment(
  workshopId: string,
  fragment: BufferedFragment
): FlushedUtterance[] {
  const results: FlushedUtterance[] = [];
  const key = bufferKey(workshopId, fragment.speakerId);
  const now = Date.now();

  // Check if there's an existing buffer for a DIFFERENT speaker on this workshop
  // If so, flush it — speaker change means the previous person finished
  for (const [k, entry] of buffers.entries()) {
    if (k.startsWith(`${workshopId}::`) && k !== key && entry.fragments.length > 0) {
      results.push(mergeFragments(entry.fragments));
      buffers.delete(k);
    }
  }

  const existing = buffers.get(key);

  if (existing && existing.fragments.length > 0) {
    const lastFragment = existing.fragments[existing.fragments.length - 1];
    const timeSinceLastMs = fragment.startTimeMs - lastFragment.endTimeMs;

    // Check if there's a significant time gap — flush existing buffer
    if (timeSinceLastMs > PAUSE_THRESHOLD_MS) {
      results.push(mergeFragments(existing.fragments));
      existing.fragments = [];
    }

    // Check if accumulated text already ends at a sentence boundary.
    // Require MIN_SENTENCE_BOUNDARY_WORDS to avoid flushing short conditional
    // phrases like "we need to consider." before their dependent clause arrives.
    const accumulatedText = existing.fragments.map((f) => f.text).join(' ');
    if (endsAtSentenceBoundary(accumulatedText) && accumulatedText.split(/\s+/).length >= MIN_SENTENCE_BOUNDARY_WORDS) {
      results.push(mergeFragments(existing.fragments));
      existing.fragments = [];
    }
  }

  // Add the new fragment with wall-clock timestamp
  fragment.arrivedAt = now;
  if (existing) {
    existing.fragments.push(fragment);
    existing.lastActivityMs = now;
  } else {
    buffers.set(key, {
      fragments: [fragment],
      lastActivityMs: now,
    });
  }

  // Get the updated buffer
  const buffer = buffers.get(key)!;
  const combinedText = buffer.fragments.map((f) => f.text).join(' ');
  const wordCount = combinedText.split(/\s+/).filter(Boolean).length;

  // Flush if: max words exceeded
  if (wordCount >= MAX_BUFFER_WORDS) {
    results.push(mergeFragments(buffer.fragments));
    buffer.fragments = [];
  }
  // Flush if: current fragment ends at sentence boundary and we have enough words
  // (MIN_SENTENCE_BOUNDARY_WORDS prevents premature flush of short clauses)
  else if (endsAtSentenceBoundary(combinedText) && wordCount >= MIN_SENTENCE_BOUNDARY_WORDS) {
    results.push(mergeFragments(buffer.fragments));
    buffer.fragments = [];
  }
  // Flush if: buffer has been accumulating for too long (wall-clock time)
  else if (buffer.fragments.length > 0) {
    const firstArrivedAt = buffer.fragments[0].arrivedAt || now;
    const age = now - firstArrivedAt;
    if (age >= MAX_BUFFER_AGE_MS) {
      results.push(mergeFragments(buffer.fragments));
      buffer.fragments = [];
    }
  }

  return results;
}

/**
 * Force-flush all buffered fragments for a workshop (e.g. when capture stops)
 */
export function flushWorkshop(workshopId: string): FlushedUtterance[] {
  const results: FlushedUtterance[] = [];
  const prefix = `${workshopId}::`;

  for (const [key, entry] of buffers.entries()) {
    if (key.startsWith(prefix) && entry.fragments.length > 0) {
      results.push(mergeFragments(entry.fragments));
      buffers.delete(key);
    }
  }

  return results;
}

// ── Periodic cleanup of stale buffers ───────────────────────
// Prevents memory leaks from abandoned sessions
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buffers.entries()) {
      if (now - entry.lastActivityMs > MAX_BUFFER_AGE_MS * 2) {
        buffers.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * lib/evidence/pipeline.ts
 *
 * Orchestrates the full evidence ingestion pipeline for a single uploaded file:
 *
 *   1. Extract raw text/content from the file buffer
 *   2. Run normalisation agent → structured EvidenceDocument fields
 *   3. Chunk text and embed into DocumentChunk (for semantic retrieval)
 *   4. Persist results to EvidenceDocument record
 *
 * Called from the upload API route after storing the raw file.
 * The DB record is created with status='uploading' before this runs,
 * updated to 'processing' when it starts, and 'ready' or 'failed' when done.
 */

import { prisma } from '@/lib/prisma';
import { extractFileContent } from './extractor';
import { normaliseEvidence } from './normalisation-agent';
import { embedAndStore } from '@/lib/embeddings/embed';

// Max chars per chunk for embedding (≈ 512 tokens)
const CHUNK_SIZE = 2000;
// Max chunks to embed per document (cost guard)
const MAX_CHUNKS = 30;

/**
 * Split text into overlapping chunks for embedding.
 */
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - 200; // 200-char overlap
  }
  return chunks.filter(c => c.length > 50); // discard tiny chunks
}

/**
 * Run the full ingestion pipeline for a single evidence document.
 *
 * @param docId      - EvidenceDocument.id (already created with status='uploading')
 * @param workshopId - parent workshop
 * @param buffer     - raw file content
 * @param fileName   - original file name
 * @param mimeType   - detected MIME type
 * @param fileSizeBytes - file size
 */
export async function runEvidencePipeline(
  docId: string,
  workshopId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  fileSizeBytes: number,
): Promise<void> {
  // Mark as processing
  await prisma.evidenceDocument.update({
    where: { id: docId },
    data: { status: 'processing' },
  });

  try {
    // ── Step 1: Extract raw content ─────────────────────────────────────
    const extraction = await extractFileContent(buffer, mimeType, fileName);

    // ── Step 2: Normalise with GPT-4o ───────────────────────────────────
    const normalised = await normaliseEvidence(fileName, extraction);

    // ── Step 3: Persist structured evidence ─────────────────────────────
    await prisma.evidenceDocument.update({
      where: { id: docId },
      data: {
        status: 'ready',
        sourceCategory: normalised.sourceCategory,
        summary: normalised.summary,
        timeframeFrom: normalised.timeframeFrom ?? null,
        timeframeTo: normalised.timeframeTo ?? null,
        findings: normalised.findings as object,
        metrics: normalised.metrics as object,
        excerpts: normalised.excerpts as unknown as object,
        signalDirection: normalised.signalDirection,
        confidence: normalised.confidence,
        relevantLenses: normalised.relevantLenses as unknown as object,
        relevantActors: normalised.relevantActors as unknown as object,
        relevantJourneyStages: normalised.relevantJourneyStages as unknown as object,
      },
    });

    // ── Step 4: Chunk and embed ────────────────────────────────────────────
    // Await all embed calls — in serverless environments (Vercel) unawaited
    // promises are not guaranteed to finish after the route handler returns,
    // which would leave chunks without embeddings and silently broken for RAG.
    if (extraction.text.length > 100) {
      const chunks = chunkText(extraction.text);
      const embedPromises: Promise<void>[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const dc = await prisma.documentChunk.create({
          data: {
            workshopId,
            fileName,
            fileType: mimeType,
            fileSizeBytes,
            storageKey: `evidence/${workshopId}/${docId}`,
            chunkIndex: i,
            totalChunks: chunks.length,
            content: chunk,
            artefactType: 'document',
          },
        });
        embedPromises.push(
          embedAndStore('document_chunks', dc.id, chunk).catch(err =>
            console.error(`[evidence-pipeline] Embed failed for chunk ${i}:`, err),
          ),
        );
      }
      await Promise.allSettled(embedPromises);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Clean up any partially-created document_chunks so they don't contribute
    // stale content to semantic retrieval after a failed ingest.
    await prisma.documentChunk.deleteMany({
      where: { workshopId, storageKey: `evidence/${workshopId}/${docId}` },
    }).catch(cleanupErr => {
      console.error('[evidence-pipeline] Failed to clean up orphaned chunks:', cleanupErr);
    });
    await prisma.evidenceDocument.update({
      where: { id: docId },
      data: {
        status: 'failed',
        errorMessage: message.slice(0, 500),
      },
    });
    throw err; // re-throw so caller can log
  }
}

/**
 * Build an aggregate summary across all ready evidence documents for a workshop.
 */
export async function buildEvidenceSummary(workshopId: string) {
  const docs = await prisma.evidenceDocument.findMany({
    where: { workshopId, status: 'ready' },
  });

  if (docs.length === 0) return null;

  const signalCounts = { red: 0, amber: 0, green: 0, mixed: 0 };
  for (const doc of docs) {
    const dir = (doc.signalDirection as string) ?? 'mixed';
    if (dir in signalCounts) signalCounts[dir as keyof typeof signalCounts]++;
  }

  // Most frequent lenses across all docs
  const lensFreq: Record<string, number> = {};
  for (const doc of docs) {
    const lenses = (doc.relevantLenses as string[] | null) ?? [];
    for (const l of lenses) lensFreq[l] = (lensFreq[l] ?? 0) + 1;
  }
  const topLenses = Object.entries(lensFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([l]) => l);

  const totalFindings = docs.reduce((acc, d) => {
    const f = (d.findings as unknown[] | null) ?? [];
    return acc + f.length;
  }, 0);

  const totalMetrics = docs.reduce((acc, d) => {
    const m = (d.metrics as unknown[] | null) ?? [];
    return acc + m.length;
  }, 0);

  // Dominant signal direction
  const max = Math.max(...Object.values(signalCounts));
  const dominant = (Object.entries(signalCounts).find(([, v]) => v === max)?.[0] ?? 'mixed') as
    | 'red'
    | 'amber'
    | 'green'
    | 'mixed';

  const avgConfidence =
    docs.reduce((acc, d) => acc + (d.confidence ?? 0.5), 0) / docs.length;

  return {
    totalDocuments: docs.length,
    totalFindings,
    totalMetrics,
    signalBreakdown: signalCounts,
    topLenses,
    overallSignalDirection: dominant,
    overallConfidence: Math.round(avgConfidence * 100) / 100,
  };
}

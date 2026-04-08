/**
 * app/api/admin/workshops/[id]/evidence/route.ts
 *
 * Evidence document upload and listing for a workshop.
 *
 * POST   — Upload one or more files (multipart/form-data, field name: "files")
 * GET    — List all evidence documents for the workshop with their current status.
 * DELETE — Remove an evidence document by query param ?docId=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runEvidencePipeline } from '@/lib/evidence/pipeline';
import { ACCEPTED_EVIDENCE_MIME_TYPES, maxFileSizeForType } from '@/lib/evidence/extractor';
import { logAuditEvent } from '@/lib/audit/audit-logger';

// ── Supabase Storage ─────────────────────────────────────────────────────────

// Private bucket — evidence files are not publicly accessible
const EVIDENCE_BUCKET = 'evidence-documents';

function getStorageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials not configured');
  return createClient(url, key);
}

// Auto-create the private evidence bucket if it doesn't exist yet.
// Called once per POST — Supabase listBuckets is cheap.
let bucketEnsured = false;
async function ensureEvidenceBucket() {
  if (bucketEnsured) return;
  const admin = getStorageAdmin();
  const { data } = await admin.storage.listBuckets();
  if (!data?.find(b => b.name === EVIDENCE_BUCKET)) {
    await admin.storage.createBucket(EVIDENCE_BUCKET, { public: false });
  }
  bucketEnsured = true;
}

async function uploadEvidenceFile(
  buffer: Buffer,
  workshopId: string,
  docId: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const admin = getStorageAdmin();
  // Store path only — NOT a public URL. Use signed URLs if download is ever needed.
  const storagePath = `workshops/${workshopId}/evidence/${docId}/${encodeURIComponent(fileName)}`;
  const { error } = await admin.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

async function deleteEvidenceFile(storageKey: string): Promise<void> {
  if (!storageKey) return;
  const admin = getStorageAdmin();
  // storageKey is either a plain path (new) or a legacy public URL (old rows).
  // Handle both formats during the transition window.
  let filePath = storageKey;
  const bucketMarker = `/${EVIDENCE_BUCKET}/`;
  if (storageKey.startsWith('http')) {
    // Legacy: full public URL from old workshop-images bucket — best-effort delete
    const legacyMarker = '/workshop-images/';
    const idx = storageKey.indexOf(legacyMarker);
    if (idx !== -1) {
      const legacyPath = storageKey.slice(idx + legacyMarker.length);
      const legacyAdmin = getStorageAdmin();
      await legacyAdmin.storage.from('workshop-images').remove([legacyPath]).catch(() => {});
    }
    return;
  }
  // New format: plain path in evidence-documents bucket
  if (filePath.includes(bucketMarker)) {
    filePath = filePath.slice(filePath.indexOf(bucketMarker) + bucketMarker.length);
  }
  await admin.storage.from(EVIDENCE_BUCKET).remove([filePath]);
}

// Route-level config — allow up to 120s for GPT-4o processing
export const maxDuration = 120;

// ── POST: Upload evidence files ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    await ensureEvidenceBucket();

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Validate each file
    const acceptedSet = new Set<string>(ACCEPTED_EVIDENCE_MIME_TYPES);
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const mimeOk = acceptedSet.has(file.type) || isAcceptedByExtension(ext);
      if (!mimeOk) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.name} (${file.type || `.${ext}`})` },
          { status: 400 }
        );
      }
      // When the browser doesn't send a MIME type, derive it from the extension so
      // the size cap is computed correctly (not capped at the 25MB default).
      const effectiveMime = file.type || guessMimeFromName(file.name);
      const maxSize = maxFileSizeForType(effectiveMime);
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `File too large: ${file.name} (max ${Math.round(maxSize / 1024 / 1024)}MB)` },
          { status: 400 }
        );
      }
    }

    // Process all files concurrently so total request time is bounded by the
    // slowest single file rather than growing linearly with file count.
    const ingestFile = async (file: File): Promise<{ id: string; fileName: string; status: string; error?: string }> => {
      // 1. Create DB record immediately (status: uploading)
      const doc = await prisma.evidenceDocument.create({
        data: {
          workshopId,
          originalFileName: file.name,
          mimeType: file.type || guessMimeFromName(file.name),
          fileSizeBytes: file.size,
          storageKey: '',
          status: 'uploading',
        },
      });

      try {
        // 2. Upload to private Supabase Storage — store path, not public URL
        const buffer = Buffer.from(await file.arrayBuffer());
        const mime = file.type || guessMimeFromName(file.name);
        const storagePath = await uploadEvidenceFile(buffer, workshopId, doc.id, file.name, mime);

        await prisma.evidenceDocument.update({
          where: { id: doc.id },
          data: { storageKey: storagePath },
        });

        // 3. Run ingestion pipeline (extract → normalise → embed)
        await runEvidencePipeline(doc.id, workshopId, buffer, file.name, mime, file.size);

        return { id: doc.id, fileName: file.name, status: 'ready' };
      } catch (err) {
        console.error(`[evidence] Pipeline failed for ${file.name}:`, err);
        // Delete the orphaned storage object so the bucket doesn't accumulate failed blobs
        const currentKey = (await prisma.evidenceDocument.findUnique({
          where: { id: doc.id },
          select: { storageKey: true },
        }))?.storageKey ?? '';
        if (currentKey) {
          deleteEvidenceFile(currentKey).catch(storageErr =>
            console.error('[evidence] Failed to clean up storage object after ingest failure:', storageErr),
          );
        }
        return {
          id: doc.id,
          fileName: file.name,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Processing failed',
        };
      }
    };

    const settled = await Promise.allSettled(files.map(ingestFile));
    const results = settled.map(r =>
      r.status === 'fulfilled'
        ? r.value
        : { id: '', fileName: '', status: 'failed', error: 'Unexpected ingest error' },
    );

    // 4. Invalidate stale CV and synthesis once — after all files are processed.
    if (results.some(r => r.status === 'ready')) {
      await invalidateEvidenceDerivatives(workshopId);
    }

    if (auth.organizationId) {
      const uploaded = results.filter(r => r.status === 'ready');
      if (uploaded.length > 0) {
        logAuditEvent({ organizationId: auth.organizationId, userId: auth.userId ?? undefined, action: 'UPLOAD_EVIDENCE', resourceType: 'workshop', resourceId: workshopId, metadata: { fileCount: uploaded.length, fileNames: uploaded.map(r => r.fileName) }, success: true }).catch(err => console.error('[audit] upload_evidence:', err));
      }
    }

    return NextResponse.json({ documents: results });
  } catch (err) {
    console.error('[evidence] Upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

// ── GET: List evidence documents ────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const [docs, workshop] = await Promise.all([
      prisma.evidenceDocument.findMany({
        where: { workshopId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workshop.findUnique({
        where: { id: workshopId },
        select: { evidenceSynthesis: true },
      }),
    ]);

    return NextResponse.json({
      documents: docs,
      evidenceSynthesis: workshop?.evidenceSynthesis ?? null,
    });
  } catch (err) {
    console.error('[evidence] List error:', err);
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}

// ── DELETE: Remove an evidence document ────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('docId');
    if (!docId) {
      return NextResponse.json({ error: 'docId query param required' }, { status: 400 });
    }

    const doc = await prisma.evidenceDocument.findFirst({
      where: { id: docId, workshopId },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from Supabase Storage (non-fatal)
    try {
      await deleteEvidenceFile(doc.storageKey);
    } catch {
      // Non-fatal — continue to DB delete
    }

    // Delete document_chunks for this document explicitly.
    // DocumentChunk has no FK to EvidenceDocument — only to Workshop — so there
    // is no cascade. Chunks must be removed here or they remain searchable.
    // The ingest pipeline stores chunks under 'evidence/${workshopId}/${docId}',
    // NOT the uploaded file path — use that same key here.
    await prisma.documentChunk.deleteMany({
      where: { workshopId, storageKey: `evidence/${workshopId}/${docId}` },
    });

    // Delete DB record
    await prisma.evidenceDocument.delete({ where: { id: docId } });

    // Invalidate stale cross-validation and synthesis — document set has changed
    await invalidateEvidenceDerivatives(workshopId);

    if (auth.organizationId) {
      logAuditEvent({ organizationId: auth.organizationId, userId: auth.userId ?? undefined, action: 'DELETE_EVIDENCE', resourceType: 'workshop', resourceId: workshopId, metadata: { docId, fileName: doc.originalFileName }, success: true }).catch(err => console.error('[audit] delete_evidence:', err));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[evidence] Delete error:', err);
    return NextResponse.json({ error: 'Failed to delete evidence document' }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Clear cross-validation results on all ready docs and the workshop-level synthesis. */
async function invalidateEvidenceDerivatives(workshopId: string) {
  await Promise.all([
    prisma.evidenceDocument.updateMany({
      where: { workshopId, status: 'ready' },
      data: { crossValidation: Prisma.JsonNull },
    }),
    prisma.workshop.update({
      where: { id: workshopId },
      data: { evidenceSynthesis: Prisma.JsonNull },
    }),
  ]);
}

function isAcceptedByExtension(ext: string): boolean {
  // .doc excluded — mammoth only supports .docx (OOXML), not legacy binary .doc
  // .ppt excluded — officeparser only handles .pptx (OOXML), not legacy binary .ppt
  return [
    'pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx',
    'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'md',
  ].includes(ext);
}

function guessMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // ppt (legacy binary) intentionally excluded — officeparser cannot process it
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  return map[ext] ?? 'application/octet-stream';
}

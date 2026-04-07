// @vitest-environment node

/**
 * Regression coverage for the Evidence feature routes.
 *
 * Covers:
 *   - Upload rejects unsupported .doc files (400)
 *   - Cross-validation returns 422 when synthesized discovery is missing
 *   - Cross-validation succeeds when valid v2Output exists
 *   - Successful upload invalidates stale cross-validation and evidence synthesis
 *   - Delete removes semantic document_chunks using the ingest storage key
 *   - Delete invalidates stale derived state
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks — hoisted, no top-level variable references inside factories ──────

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    userId: 'user-test',
    organizationId: 'org-test',
    role: 'PLATFORM_ADMIN',
  }),
}));

vi.mock('@/lib/middleware/validate-workshop-access', () => ({
  validateWorkshopAccess: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    storage: {
      listBuckets: vi.fn().mockResolvedValue({ data: [{ name: 'evidence-documents' }] }),
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
  }),
}));

vi.mock('@/lib/evidence/pipeline', () => ({
  runEvidencePipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/evidence/cross-validation-agent', () => ({
  runCrossValidation: vi.fn().mockResolvedValue({
    corroborated: [{ discoveryFinding: 'f1', evidenceFinding: 'e1', documentId: 'doc-1', documentName: 'test.pdf', alignment: 'corroborated', confidence: 0.9 }],
    contradicted: [],
    partiallySupported: [],
    unsupported: [],
    evidenceOnly: [],
    conclusionImpact: 'Strong alignment.',
    generatedAt: new Date().toISOString(),
  }),
  buildDiscoverySnapshot: vi.fn().mockReturnValue({ workshopName: 'Test', truths: ['truth 1'] }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    evidenceDocument: {
      create: vi.fn().mockResolvedValue({ id: 'doc-1', workshopId: 'ws-test', storageKey: '' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    documentChunk: {
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    workshop: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

// ── Supabase env vars required by getStorageAdmin() ───────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// ── Import route handlers and mocked prisma after all mocks are set up ────

import { POST as EVIDENCE_POST, DELETE as EVIDENCE_DELETE } from '@/app/api/admin/workshops/[id]/evidence/route';
import { POST as CROSS_VALIDATE_POST } from '@/app/api/admin/workshops/[id]/evidence/cross-validate/route';
import { prisma } from '@/lib/prisma';
import { vi as viAlias } from 'vitest'; // alias to avoid lint complaints below

// ── Helpers ───────────────────────────────────────────────────────────────

const WS_ID = 'ws-test';
const resolvedParams = Promise.resolve({ id: WS_ID });

function makeFormDataRequest(files: Array<{ name: string; type: string; content: string }>): NextRequest {
  const formData = new FormData();
  for (const f of files) {
    const blob = new Blob([f.content], { type: f.type });
    formData.append('files', new File([blob], f.name, { type: f.type }));
  }
  return new NextRequest(`http://localhost/api/admin/workshops/${WS_ID}/evidence`, {
    method: 'POST',
    body: formData,
  });
}

function makeDeleteRequest(docId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/workshops/${WS_ID}/evidence?docId=${docId}`,
    { method: 'DELETE' }
  );
}

function makeCrossValidateRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/workshops/${WS_ID}/evidence/cross-validate`,
    { method: 'POST' }
  );
}

function makeReadyDocRow(id = 'doc-1') {
  return {
    id,
    workshopId: WS_ID,
    originalFileName: 'test.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1000,
    storageKey: `workshops/${WS_ID}/evidence/${id}/test.pdf`,
    status: 'ready',
    sourceCategory: 'other',
    summary: 'summary',
    signalDirection: 'amber',
    confidence: 0.7,
    findings: [],
    metrics: [],
    excerpts: [],
    relevantLenses: [],
    relevantActors: [],
    relevantJourneyStages: [],
    errorMessage: null,
    timeframeFrom: null,
    timeframeTo: null,
    crossValidation: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Upload validation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /evidence — upload validation', () => {
  it('rejects .doc files with 400', async () => {
    const req = makeFormDataRequest([
      { name: 'report.doc', type: 'application/msword', content: 'binary doc content' },
    ]);
    const res = await EVIDENCE_POST(req, { params: resolvedParams });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported file type/i);
    expect(body.error).toContain('report.doc');
  });

  it('accepts .docx files and processes them', async () => {
    const req = makeFormDataRequest([
      {
        name: 'report.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: 'docx content',
      },
    ]);
    const res = await EVIDENCE_POST(req, { params: resolvedParams });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.documents)).toBe(true);
  });

  it('rejects empty file list with 400', async () => {
    const formData = new FormData();
    const req = new NextRequest(`http://localhost/api/admin/workshops/${WS_ID}/evidence`, {
      method: 'POST',
      body: formData,
    });
    const res = await EVIDENCE_POST(req, { params: resolvedParams });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no files/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-validation guard
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /evidence/cross-validate', () => {
  it('returns 422 when scratchpad v2Output is absent', async () => {
    vi.mocked(prisma.workshop.findUnique).mockResolvedValue({
      name: 'Test Workshop',
      scratchpad: null,
    } as never);
    vi.mocked(prisma.evidenceDocument.findMany).mockResolvedValue([makeReadyDocRow()] as never);

    const res = await CROSS_VALIDATE_POST(makeCrossValidateRequest(), { params: resolvedParams });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/discovery synthesis is required/i);
  });

  it('returns 422 when v2Output.discover.truths is an empty array', async () => {
    vi.mocked(prisma.workshop.findUnique).mockResolvedValue({
      name: 'Test Workshop',
      scratchpad: { v2Output: { discover: { truths: [] } } },
    } as never);
    vi.mocked(prisma.evidenceDocument.findMany).mockResolvedValue([makeReadyDocRow()] as never);

    const res = await CROSS_VALIDATE_POST(makeCrossValidateRequest(), { params: resolvedParams });

    expect(res.status).toBe(422);
  });

  it('returns 200 with crossValidation when v2Output has discover.truths', async () => {
    vi.mocked(prisma.workshop.findUnique).mockResolvedValue({
      name: 'Test Workshop',
      scratchpad: {
        v2Output: {
          discover: {
            truths: [{ id: 't1', statement: 'Staff are overwhelmed', confidence: 0.9, themes: ['workload'] }],
          },
        },
      },
    } as never);
    vi.mocked(prisma.evidenceDocument.findMany).mockResolvedValue([makeReadyDocRow()] as never);

    const res = await CROSS_VALIDATE_POST(makeCrossValidateRequest(), { params: resolvedParams });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crossValidation).toBeDefined();
    expect(body.crossValidation.corroborated).toHaveLength(1);
  });

  it('returns 400 when no ready evidence documents exist', async () => {
    vi.mocked(prisma.workshop.findUnique).mockResolvedValue({
      name: 'Test Workshop',
      scratchpad: { v2Output: { discover: { truths: [{ id: 't1', statement: 'A truth' }] } } },
    } as never);
    vi.mocked(prisma.evidenceDocument.findMany).mockResolvedValue([] as never);

    const res = await CROSS_VALIDATE_POST(makeCrossValidateRequest(), { params: resolvedParams });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Upload invalidation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /evidence — upload invalidates derived state', () => {
  it('calls updateMany(crossValidation=null) and workshop.update(evidenceSynthesis=null) after upload', async () => {
    const req = makeFormDataRequest([
      { name: 'metrics.csv', type: 'text/csv', content: 'col1,col2\n1,2' },
    ]);

    await EVIDENCE_POST(req, { params: resolvedParams });

    expect(vi.mocked(prisma.evidenceDocument.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workshopId: WS_ID, status: 'ready' },
        data: expect.objectContaining({ crossValidation: expect.anything() }),
      })
    );
    expect(vi.mocked(prisma.workshop.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WS_ID },
        data: expect.objectContaining({ evidenceSynthesis: expect.anything() }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete — chunk cleanup and invalidation
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /evidence — chunk removal and invalidation', () => {
  const DOC_ID = 'doc-abc';

  beforeEach(() => {
    vi.mocked(prisma.evidenceDocument.findFirst).mockResolvedValue({
      id: DOC_ID,
      workshopId: WS_ID,
      storageKey: `workshops/${WS_ID}/evidence/${DOC_ID}/report.pdf`,
    } as never);
  });

  it('deletes document_chunks using the ingest key format evidence/${workshopId}/${docId}', async () => {
    const req = makeDeleteRequest(DOC_ID);
    const res = await EVIDENCE_DELETE(req, { params: resolvedParams });

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.documentChunk.deleteMany)).toHaveBeenCalledWith({
      where: {
        workshopId: WS_ID,
        storageKey: `evidence/${WS_ID}/${DOC_ID}`,
      },
    });
  });

  it('does not use the uploaded file path as chunk storage key', async () => {
    const fileStorageKey = `workshops/${WS_ID}/evidence/${DOC_ID}/report.pdf`;
    const req = makeDeleteRequest(DOC_ID);
    await EVIDENCE_DELETE(req, { params: resolvedParams });

    const calls = vi.mocked(prisma.documentChunk.deleteMany).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0].where.storageKey).not.toBe(fileStorageKey);
    expect(calls[0][0].where.storageKey).toBe(`evidence/${WS_ID}/${DOC_ID}`);
  });

  it('calls updateMany and workshop.update to invalidate derived state', async () => {
    const req = makeDeleteRequest(DOC_ID);
    await EVIDENCE_DELETE(req, { params: resolvedParams });

    expect(vi.mocked(prisma.evidenceDocument.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workshopId: WS_ID, status: 'ready' } })
    );
    expect(vi.mocked(prisma.workshop.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WS_ID } })
    );
  });

  it('returns 404 when the document does not belong to the workshop', async () => {
    vi.mocked(prisma.evidenceDocument.findFirst).mockResolvedValue(null as never);
    const req = makeDeleteRequest('nonexistent-id');
    const res = await EVIDENCE_DELETE(req, { params: resolvedParams });

    expect(res.status).toBe(404);
  });
});

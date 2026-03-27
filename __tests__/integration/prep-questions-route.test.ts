// @vitest-environment node

/**
 * Route-level integration tests for prep/questions and admin/workshops PATCH.
 *
 * Tests the ACTUAL route handlers with real NextRequest/NextResponse objects.
 * Proves that the HTTP layer enforces validation — not just the shared validator function.
 *
 * Covers:
 *   PUT  /api/workshops/[id]/prep/questions  — returns 422 on invalid, 200 on valid
 *   PATCH /api/admin/workshops/[id]          — returns 422 when customQuestions is invalid
 */

import { vi, describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks (hoisted before imports) ────────────────────────────

vi.mock('@/lib/auth/get-session-user', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    userId: 'user-test',
    organizationId: 'org-test',
    role: 'PLATFORM_ADMIN',
  }),
}));

vi.mock('@/lib/middleware/validate-workshop-access', () => ({
  validateWorkshopAccess: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workshop: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ws-test',
        description: 'Test workshop',
        businessContext: 'Test context',
        clientName: 'TestCorp',
        industry: 'Test',
        companyWebsite: null,
        dreamTrack: null,
        targetDomain: null,
        prepResearch: null,
        customQuestions: null,
        discoveryBriefing: null,
        blueprint: null,
      }),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'ws-fork' }),
    },
  },
}));

vi.mock('@/lib/cognition/agents/question-set-agent', () => ({
  runQuestionSetAgent: vi.fn(),
  buildWorkshopQuestionSet: vi.fn(),
  getPhaseLensOrder: vi.fn(),
  buildQuestionSetSystemPrompt: vi.fn(),
}));

// ── Import route handlers after mocks ─────────────────────────

import { PUT } from '@/app/api/workshops/[id]/prep/questions/route';
import { PATCH } from '@/app/api/admin/workshops/[id]/route';
import { POST as FORK_POST } from '@/app/api/admin/workshops/[id]/fork/route';

// ── Helpers ───────────────────────────────────────────────────

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/workshops/ws-test/prep/questions', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/workshops/ws-test', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeForkRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/workshops/ws-test/fork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

const resolvedParams = Promise.resolve({ id: 'ws-test' });

function validQuestionSet() {
  const phases: Record<string, unknown> = {};
  for (const phase of ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH']) {
    phases[phase] = {
      label: phase,
      description: 'Test phase',
      lensOrder: ['TestLens'],
      questions: [{ id: 'q1', phase, lens: 'TestLens', text: 'Test question', purpose: 'Test', order: 1, subQuestions: [] }],
    };
  }
  return {
    phases,
    designRationale: 'Test',
    generatedAtMs: Date.now(),
    dataConfidence: 'high',
    dataSufficiencyNotes: [],
  };
}

// ══════════════════════════════════════════════════════════════
// PUT /api/workshops/[id]/prep/questions
// ══════════════════════════════════════════════════════════════

describe('PUT prep/questions — route-level validation', () => {
  it('returns 422 when customQuestions is null', async () => {
    const res = await PUT(makePutRequest({ customQuestions: null }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/non-null object/);
  });

  it('returns 422 when customQuestions has no phases property', async () => {
    const res = await PUT(makePutRequest({ customQuestions: {} }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/phases.*missing/i);
  });

  it('returns 422 when REIMAGINE phase is missing', async () => {
    const qs = validQuestionSet();
    delete (qs.phases as Record<string, unknown>).REIMAGINE;
    const res = await PUT(makePutRequest({ customQuestions: qs }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/REIMAGINE/);
  });

  it('returns 422 when CONSTRAINTS phase is missing', async () => {
    const qs = validQuestionSet();
    delete (qs.phases as Record<string, unknown>).CONSTRAINTS;
    const res = await PUT(makePutRequest({ customQuestions: qs }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/CONSTRAINTS/);
  });

  it('returns 422 when DEFINE_APPROACH phase is missing', async () => {
    const qs = validQuestionSet();
    delete (qs.phases as Record<string, unknown>).DEFINE_APPROACH;
    const res = await PUT(makePutRequest({ customQuestions: qs }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/DEFINE_APPROACH/);
  });

  it('returns 422 when a phase has zero questions', async () => {
    const qs = validQuestionSet();
    (qs.phases as Record<string, unknown>).REIMAGINE = { questions: [], lensOrder: [] };
    const res = await PUT(makePutRequest({ customQuestions: qs }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/REIMAGINE.*no questions/i);
  });

  it('returns 200 when question set is complete and valid', async () => {
    const res = await PUT(makePutRequest({ customQuestions: validQuestionSet() }), { params: resolvedParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/admin/workshops/[id]
// ══════════════════════════════════════════════════════════════

describe('PATCH admin/workshops/[id] — customQuestions validation', () => {
  it('returns 422 when customQuestions is null', async () => {
    const res = await PATCH(makePatchRequest({ customQuestions: null }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/non-null object/);
  });

  it('returns 422 when customQuestions has no phases', async () => {
    const res = await PATCH(makePatchRequest({ customQuestions: {} }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/phases.*missing/i);
  });

  it('returns 422 when a phase has empty questions', async () => {
    const qs = validQuestionSet();
    (qs.phases as Record<string, unknown>).CONSTRAINTS = { questions: [], lensOrder: [] };
    const res = await PATCH(makePatchRequest({ customQuestions: qs }), { params: resolvedParams });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/CONSTRAINTS.*no questions/i);
  });

  it('does not set customQuestions when payload omits it (no false positive)', async () => {
    const { prisma } = await import('@/lib/prisma');
    const updateSpy = vi.spyOn(prisma.workshop, 'update');
    // Send a patch with only name — customQuestions absent from body
    await PATCH(makePatchRequest({ name: 'Updated Name' }), { params: resolvedParams });
    // update should be called but customQuestions should not be in the data
    if (updateSpy.mock.calls.length > 0) {
      const callArg = updateSpy.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(callArg.data).not.toHaveProperty('customQuestions');
    }
  });
});

// ══════════════════════════════════════════════════════════════
// POST /api/admin/workshops/[id]/fork — customQuestions validation
// Proves the fork route validates before copying customQuestions.
// ══════════════════════════════════════════════════════════════

describe('POST fork/route — customQuestions validation on copy', () => {
  it('omits customQuestions in fork when source has invalid (empty phases) question set', async () => {
    const { prisma } = await import('@/lib/prisma');
    // Source workshop has an invalid question set (missing questions in phases)
    vi.spyOn(prisma.workshop, 'findUnique').mockResolvedValueOnce({
      id: 'ws-source',
      name: 'Example Workshop',
      isExample: true,
      customQuestions: {
        phases: {
          REIMAGINE: { questions: [], lensOrder: [] },   // empty — invalid
          CONSTRAINTS: { questions: [], lensOrder: [] },
          DEFINE_APPROACH: { questions: [], lensOrder: [] },
        },
        designRationale: '',
        generatedAtMs: Date.now(),
        dataConfidence: 'low',
        dataSufficiencyNotes: [],
      },
    } as never);
    vi.spyOn(prisma.workshop, 'findFirst').mockResolvedValueOnce(null); // no existing fork
    const createSpy = vi.spyOn(prisma.workshop, 'create').mockResolvedValueOnce({ id: 'ws-fork' } as never);

    await FORK_POST(makeForkRequest(), { params: resolvedParams });

    expect(createSpy).toHaveBeenCalled();
    const createData = (createSpy.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    // customQuestions must NOT be set — invalid source data must not propagate
    expect(createData.customQuestions).toBeUndefined();
  });

  it('copies customQuestions in fork when source has a valid question set', async () => {
    const { prisma } = await import('@/lib/prisma');
    const validQs = validQuestionSet();
    vi.spyOn(prisma.workshop, 'findUnique').mockResolvedValueOnce({
      id: 'ws-source',
      name: 'Example Workshop',
      isExample: true,
      customQuestions: validQs,
    } as never);
    vi.spyOn(prisma.workshop, 'findFirst').mockResolvedValueOnce(null);
    const createSpy = vi.spyOn(prisma.workshop, 'create').mockResolvedValueOnce({ id: 'ws-fork' } as never);

    await FORK_POST(makeForkRequest(), { params: resolvedParams });

    expect(createSpy).toHaveBeenCalled();
    const createData = (createSpy.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    // Valid customQuestions must be copied
    expect(createData.customQuestions).toBeDefined();
  });

  it('omits customQuestions in fork when source has null question set', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.spyOn(prisma.workshop, 'findUnique').mockResolvedValueOnce({
      id: 'ws-source',
      name: 'Example Workshop',
      isExample: true,
      customQuestions: null,
    } as never);
    vi.spyOn(prisma.workshop, 'findFirst').mockResolvedValueOnce(null);
    const createSpy = vi.spyOn(prisma.workshop, 'create').mockResolvedValueOnce({ id: 'ws-fork' } as never);

    await FORK_POST(makeForkRequest(), { params: resolvedParams });

    const createData = (createSpy.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(createData.customQuestions).toBeUndefined();
  });
});

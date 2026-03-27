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
    },
  },
}));

// ── Import route handlers after mocks ─────────────────────────

import { PUT } from '@/app/api/workshops/[id]/prep/questions/route';
import { PATCH } from '@/app/api/admin/workshops/[id]/route';

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

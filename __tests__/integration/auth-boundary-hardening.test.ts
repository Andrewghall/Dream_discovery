/**
 * Integration Tests - Auth Boundary Hardening (Remediation #1)
 *
 * Tests that:
 *   1. /api/conversation/report rejects unauthenticated and cross-participant requests
 *   2. /api/conversation/update-preferences rejects unauthenticated and cross-session requests
 *   3. /api/test-email rejects non-admin callers
 *   4. Happy paths work for authorised callers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';
import {
  createMockRequest,
  getResponseJSON,
  getResponseStatus,
} from '../utils/test-helpers';
import { mockParticipant, mockConversationSession, mockWorkshop } from '../utils/test-fixtures';

// ── Mocks ──────────────────────────────────────────────────

// Mock auth helper
const mockGetAuthenticatedUser = vi.fn();
vi.mock('@/lib/auth/get-session-user', () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

// Mock OpenAI (report route uses it for GPT calls)
vi.mock('openai', () => {
  return {
    default: class {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    executiveSummary: 'Test summary',
                    tone: 'neutral',
                    feedback: 'Test feedback',
                    score: 50,
                    label: 'medium',
                    rationale: 'Test rationale',
                    missingInfoSuggestions: [],
                    keyInsights: [],
                  }),
                },
              },
            ],
          }),
        },
      };
    },
  };
});

// Mock email sending
vi.mock('@/lib/email/send-report', () => ({
  sendDiscoveryReportEmail: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' } }),
}));

// Mock Resend for test-email route (use a plain async function so vi.clearAllMocks does not strip the return value)
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async () => ({ data: { id: 'mock-resend-id' }, error: null }),
    };
  },
}));

// Mock fixed questions
vi.mock('@/lib/conversation/fixed-questions', () => ({
  fixedQuestionsForVersion: vi.fn().mockReturnValue({}),
}));

// ── Imports (after mocks) ──────────────────────────────────

import { GET as reportGET } from '@/app/api/conversation/report/route';
import { POST as preferencesPOST } from '@/app/api/conversation/update-preferences/route';
import { GET as testEmailGET } from '@/app/api/test-email/route';

// ── Fixtures ───────────────────────────────────────────────

const VALID_TOKEN = mockParticipant.discoveryToken;
const WRONG_TOKEN = 'wrong-token-value';
const SESSION_ID = mockConversationSession.id;

const fullSession = {
  ...mockConversationSession,
  workshop: { ...mockWorkshop, includeRegulation: true },
  participant: { ...mockParticipant },
  report: null,
  messages: [],
  dataPoints: [],
};

const adminUser = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  role: 'PLATFORM_ADMIN',
  organizationId: 'test-org-id',
  sessionId: 'admin-session-id',
};

// ────────────────────────────────────────────────────────────
// 1. Report Route
// ────────────────────────────────────────────────────────────

describe('GET /api/conversation/report', () => {
  beforeEach(() => {
    resetMockPrisma();
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(null);
  });

  it('rejects requests with no auth (no token, no admin cookie)', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3001/api/conversation/report',
      searchParams: { sessionId: SESSION_ID },
    });

    const res = await reportGET(req as NextRequest);
    expect(getResponseStatus(res)).toBe(401);
    const body = await getResponseJSON(res);
    expect(body.error).toMatch(/[Aa]uthentication required/);
  });

  it('rejects when participant token does not match session owner', async () => {
    mockPrisma.conversationSession.findUnique.mockResolvedValue(fullSession);

    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3001/api/conversation/report',
      searchParams: { sessionId: SESSION_ID, token: WRONG_TOKEN },
    });

    const res = await reportGET(req as NextRequest);
    expect(getResponseStatus(res)).toBe(403);
    const body = await getResponseJSON(res);
    expect(body.error).toMatch(/[Ff]orbidden/);
  });

  it('allows access with correct participant token (happy path)', async () => {
    mockPrisma.conversationSession.findUnique.mockResolvedValue(fullSession);

    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3001/api/conversation/report',
      searchParams: { sessionId: SESSION_ID, token: VALID_TOKEN },
    });

    const res = await reportGET(req as NextRequest);
    expect(getResponseStatus(res)).toBe(200);
    const body = await getResponseJSON(res);
    expect(body.sessionId).toBe(SESSION_ID);
  });

  it('allows access with admin cookie (no token needed)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(adminUser);
    mockPrisma.conversationSession.findUnique.mockResolvedValue(fullSession);

    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3001/api/conversation/report',
      searchParams: { sessionId: SESSION_ID },
    });

    const res = await reportGET(req as NextRequest);
    expect(getResponseStatus(res)).toBe(200);
    const body = await getResponseJSON(res);
    expect(body.sessionId).toBe(SESSION_ID);
  });

  it('still allows demo mode without auth', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3001/api/conversation/report',
      searchParams: { demo: '1' },
    });

    const res = await reportGET(req as NextRequest);
    expect(getResponseStatus(res)).toBe(200);
    const body = await getResponseJSON(res);
    expect(body.sessionId).toBe('demo');
  });
});

// ────────────────────────────────────────────────────────────
// 2. Update Preferences Route
// ────────────────────────────────────────────────────────────

describe('POST /api/conversation/update-preferences', () => {
  beforeEach(() => {
    resetMockPrisma();
    vi.clearAllMocks();
  });

  it('rejects requests with no token', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3001/api/conversation/update-preferences',
      body: { sessionId: SESSION_ID, language: 'fr' },
    });

    const res = await preferencesPOST(req as NextRequest);
    expect(getResponseStatus(res)).toBe(401);
    const body = await getResponseJSON(res);
    expect(body.error).toMatch(/[Aa]uthentication required/);
  });

  it('rejects when token does not match session owner', async () => {
    mockPrisma.conversationSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      participantId: mockParticipant.id,
      participant: { discoveryToken: VALID_TOKEN },
    });

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3001/api/conversation/update-preferences',
      body: { sessionId: SESSION_ID, token: WRONG_TOKEN, language: 'fr' },
    });

    const res = await preferencesPOST(req as NextRequest);
    expect(getResponseStatus(res)).toBe(403);
    const body = await getResponseJSON(res);
    expect(body.error).toMatch(/[Ff]orbidden/);
  });

  it('allows update with correct token (happy path)', async () => {
    mockPrisma.conversationSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      participantId: mockParticipant.id,
      participant: { discoveryToken: VALID_TOKEN },
    });
    mockPrisma.conversationSession.update.mockResolvedValue({
      id: SESSION_ID,
      language: 'fr',
    });

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3001/api/conversation/update-preferences',
      body: { sessionId: SESSION_ID, token: VALID_TOKEN, language: 'fr' },
    });

    const res = await preferencesPOST(req as NextRequest);
    expect(getResponseStatus(res)).toBe(200);
    const body = await getResponseJSON(res);
    expect(body.success).toBe(true);

    expect(mockPrisma.conversationSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { language: 'fr' },
    });
  });
});

// ────────────────────────────────────────────────────────────
// 3. Test Email Route
// ────────────────────────────────────────────────────────────

describe('GET /api/test-email', () => {
  beforeEach(() => {
    resetMockPrisma();
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(null);
  });

  it('rejects unauthenticated requests', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3001/api/test-email',
    });

    const res = await testEmailGET();
    expect(getResponseStatus(res)).toBe(401);
    const body = await getResponseJSON(res);
    expect(body.error).toMatch(/[Aa]uthentication required/);
  });

  it('rejects non-admin authenticated users', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      userId: 'tenant-user',
      email: 'tenant@example.com',
      role: 'TENANT_ADMIN',
      organizationId: 'org-1',
      sessionId: 'sess-1',
    });

    const res = await testEmailGET();
    expect(getResponseStatus(res)).toBe(403);
    const body = await getResponseJSON(res);
    expect(body.error).toMatch(/[Pp]latform admin/);
  });

  it('allows platform admin access (happy path)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(adminUser);

    const res = await testEmailGET();
    expect(getResponseStatus(res)).toBe(200);
    const body = await getResponseJSON(res);
    expect(body.success).toBe(true);
  });
});

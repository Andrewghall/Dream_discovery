/**
 * Integration Tests - Conversation Report Persistence/Reuse (Remediation #7)
 *
 * Tests that:
 *   1. First call generates + persists the report via upsert
 *   2. Second call with same inputs reuses stored report (no regeneration)
 *   3. Changed inputs regenerate (fingerprint mismatch)
 *   4. force=1 bypasses reuse
 *   5. Fingerprint is coherent with stored data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';
import { createHash } from 'crypto';

// -- Extend shared mock with models not in shared mock -------------------
const reportUpsert = vi.fn();
const reportFindUnique = vi.fn();
(mockPrisma as Record<string, unknown>).conversationReport = {
  upsert: reportUpsert,
  findUnique: reportFindUnique,
};

const messageFindMany = vi.fn();
(mockPrisma.conversationMessage as Record<string, unknown>).findMany = messageFindMany;

// -- Mock auth -----------------------------------------------------------
vi.mock('@/lib/auth/get-session-user', () => ({
  getAuthenticatedUser: vi.fn(async () => ({
    userId: 'admin-id',
    email: 'admin@example.com',
    role: 'PLATFORM_ADMIN',
    organizationId: null,
    sessionId: 'session-id',
  })),
}));

// -- Mock OpenAI (no real API calls) -------------------------------------
vi.mock('openai', () => {
  return {
    default: class {
      chat = {
        completions: {
          create: vi.fn(async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  score: 55,
                  label: 'medium',
                  rationale: 'Test rationale',
                  missingInfoSuggestions: ['Add more detail'],
                  keyInsights: [{
                    title: 'Test Insight',
                    insight: 'Something observed',
                    confidence: 'medium',
                    evidence: ['quote one'],
                  }],
                  executiveSummary: 'Generated summary',
                  tone: 'neutral',
                  feedback: 'Generated feedback',
                }),
              },
            }],
          })),
        },
      };
    },
  };
});

// -- Mock email (non-fatal) ----------------------------------------------
vi.mock('@/lib/email/send-report', () => ({
  sendDiscoveryReportEmail: vi.fn(async () => ({ data: { id: 'mock' } })),
}));

vi.mock('@/lib/conversation/fixed-questions', () => ({
  fixedQuestionsForVersion: vi.fn(() => ({
    people: [{ text: 'Q1' }],
  })),
}));

// -- Import route handler ------------------------------------------------
import { GET } from '@/app/api/conversation/report/route';

// -- Helpers -------------------------------------------------------------
function stableFingerprint(value: unknown): string {
  const json = JSON.stringify(value);
  return createHash('sha256').update(json).digest('hex');
}

function buildRequest(params: Record<string, string>) {
  const searchParams = new Map(Object.entries(params));
  return {
    nextUrl: {
      searchParams: {
        get: (key: string) => searchParams.get(key) ?? null,
      },
    },
    headers: {
      get: () => 'localhost:3000',
    },
  } as any;
}

// -- Fixtures ------------------------------------------------------------
const SESSION_ID = 'sess-1';
const WORKSHOP_ID = 'ws-1';
const PARTICIPANT_ID = 'part-1';

const dataPoints = [
  {
    questionKey: 'people:strengths:0',
    rawText: 'Good teamwork across departments',
    createdAt: new Date(),
  },
];

const qaPairsForFingerprint = [{
  phase: 'people',
  question: 'Q1',
  answer: 'Good teamwork across departments',
  tag: 'strengths',
}];

const expectedFingerprint = stableFingerprint({
  sessionId: SESSION_ID,
  includeRegulation: true,
  qaPairs: qaPairsForFingerprint,
});

function buildSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    workshopId: WORKSHOP_ID,
    participantId: PARTICIPANT_ID,
    status: 'COMPLETED',
    includeRegulation: true,
    workshop: { name: 'Test Workshop', includeRegulation: true },
    participant: {
      name: 'Alice',
      email: 'alice@example.com',
      role: 'Manager',
      department: 'Ops',
      discoveryToken: 'tok-1',
    },
    report: null,
    messages: [],
    dataPoints,
    ...overrides,
  };
}

// -- Tests ---------------------------------------------------------------

describe('Report Persistence/Reuse Consistency (Remediation #7)', () => {
  beforeEach(() => {
    resetMockPrisma();
    reportUpsert.mockReset();
    reportFindUnique.mockReset();
    // Re-attach after reset
    (mockPrisma as Record<string, unknown>).conversationReport = {
      upsert: reportUpsert,
      findUnique: reportFindUnique,
    };
    // Default: OPENAI_API_KEY is set so generation path runs
    process.env.OPENAI_API_KEY = 'test-key';
  });

  describe('first call generates and persists', () => {
    it('calls upsert with generated report + fingerprint on first call', async () => {
      mockPrisma.conversationSession.findUnique.mockResolvedValue(buildSession());
      reportUpsert.mockResolvedValue({});

      const res = await GET(buildRequest({ sessionId: SESSION_ID, skipEmail: '1' }));

      expect(res.status).toBe(200);
      const body = await res.json();

      // Report was generated (not reused)
      expect(body.executiveSummary).toBeDefined();
      expect(body.sessionId).toBe(SESSION_ID);

      // Upsert was called to persist
      expect(reportUpsert).toHaveBeenCalledTimes(1);
      const upsertCall = reportUpsert.mock.calls[0][0];

      // Create data contains the fingerprint
      expect(upsertCall.where).toEqual({ sessionId: SESSION_ID });
      expect(upsertCall.create.sessionId).toBe(SESSION_ID);
      expect(upsertCall.create.workshopId).toBe(WORKSHOP_ID);
      expect(upsertCall.create.participantId).toBe(PARTICIPANT_ID);
      expect(upsertCall.create.inputQuality.agenticFingerprint).toBe(expectedFingerprint);

      // Update data also contains the fingerprint
      expect(upsertCall.update.inputQuality.agenticFingerprint).toBe(expectedFingerprint);
    });
  });

  describe('second call with same inputs reuses', () => {
    it('skips generation and upsert when fingerprint matches stored report', async () => {
      const storedReport = {
        id: 'report-1',
        executiveSummary: 'Stored summary',
        tone: 'neutral',
        feedback: 'Stored feedback',
        inputQuality: {
          score: 55,
          label: 'medium',
          rationale: 'Test rationale',
          missingInfoSuggestions: ['Add more detail'],
          agenticFingerprint: expectedFingerprint,
        },
        keyInsights: [{ title: 'Stored Insight', insight: 'From DB', confidence: 'high', evidence: ['quote'] }],
        phaseInsights: [{ phase: 'people', currentScore: 5 }],
        wordCloudThemes: [{ text: 'teamwork', value: 3 }],
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(
        buildSession({ report: storedReport }),
      );

      const res = await GET(buildRequest({ sessionId: SESSION_ID, skipEmail: '1' }));

      expect(res.status).toBe(200);
      const body = await res.json();

      // Reused stored data
      expect(body.executiveSummary).toBe('Stored summary');
      expect(body.feedback).toBe('Stored feedback');
      expect(body.keyInsights).toEqual(storedReport.keyInsights);
      expect(body.phaseInsights).toEqual(storedReport.phaseInsights);
      expect(body.wordCloudThemes).toEqual(storedReport.wordCloudThemes);

      // Upsert was NOT called (reuse path)
      expect(reportUpsert).not.toHaveBeenCalled();
    });
  });

  describe('changed inputs regenerate', () => {
    it('regenerates when stored fingerprint does not match current inputs', async () => {
      const staleReport = {
        id: 'report-1',
        executiveSummary: 'Stale summary',
        tone: 'neutral',
        feedback: 'Stale feedback',
        inputQuality: {
          score: 55,
          label: 'medium',
          rationale: 'Old rationale',
          missingInfoSuggestions: [],
          agenticFingerprint: 'wrong-fingerprint-from-different-inputs',
        },
        keyInsights: [],
        phaseInsights: [],
        wordCloudThemes: [],
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(
        buildSession({ report: staleReport }),
      );
      reportUpsert.mockResolvedValue({});

      const res = await GET(buildRequest({ sessionId: SESSION_ID, skipEmail: '1' }));

      expect(res.status).toBe(200);
      const body = await res.json();

      // New content was generated (not the stale stored one)
      expect(body.executiveSummary).not.toBe('Stale summary');

      // Upsert was called with fresh data
      expect(reportUpsert).toHaveBeenCalledTimes(1);
      const upsertCall = reportUpsert.mock.calls[0][0];
      expect(upsertCall.create.inputQuality.agenticFingerprint).toBe(expectedFingerprint);
    });
  });

  describe('force=1 bypasses reuse', () => {
    it('regenerates even when fingerprint matches if force=1', async () => {
      const matchingReport = {
        id: 'report-1',
        executiveSummary: 'Cached summary',
        tone: 'neutral',
        feedback: 'Cached feedback',
        inputQuality: {
          score: 55,
          label: 'medium',
          rationale: 'Test rationale',
          missingInfoSuggestions: [],
          agenticFingerprint: expectedFingerprint,
        },
        keyInsights: [],
        phaseInsights: [],
        wordCloudThemes: [],
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(
        buildSession({ report: matchingReport }),
      );
      reportUpsert.mockResolvedValue({});

      const res = await GET(buildRequest({ sessionId: SESSION_ID, skipEmail: '1', force: '1' }));

      expect(res.status).toBe(200);
      const body = await res.json();

      // Regenerated (not the cached summary)
      expect(body.executiveSummary).not.toBe('Cached summary');

      // Upsert was called (force bypass)
      expect(reportUpsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('persistence failure is non-fatal', () => {
    it('still returns the report even if upsert fails', async () => {
      mockPrisma.conversationSession.findUnique.mockResolvedValue(buildSession());
      reportUpsert.mockRejectedValue(new Error('DB write failed'));

      const res = await GET(buildRequest({ sessionId: SESSION_ID, skipEmail: '1' }));

      // Response succeeds despite persistence failure
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.executiveSummary).toBeDefined();
    });
  });
});

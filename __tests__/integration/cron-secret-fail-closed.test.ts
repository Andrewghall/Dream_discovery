/**
 * Integration Tests - Cron Secret Fail-Closed (Remediation #5)
 *
 * Tests that:
 *   1. Missing CRON_SECRET env var rejects requests (fail-closed)
 *   2. Wrong Bearer token is rejected
 *   3. Correct Bearer token succeeds
 *   4. Both cron endpoints behave consistently
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';

// -- Mock monitoring alerts (used by check-security) ---------------------
vi.mock('@/lib/monitoring/alerts', () => ({
  checkFailedLoginPatterns: vi.fn(async () => {}),
}));

// -- Extend shared mock with session.deleteMany (used by cleanup) --------
const sessionDeleteMany = vi.fn();
(mockPrisma.session as Record<string, unknown>).deleteMany = sessionDeleteMany;

// -- Import the route handlers under test --------------------------------
import { GET as checkSecurityGET, POST as checkSecurityPOST } from '@/app/api/cron/check-security/route';
import { GET as cleanupSessionsGET } from '@/app/api/cron/cleanup-sessions/route';

// -- Helpers -------------------------------------------------------------
function buildCronRequest(token?: string) {
  const headers = new Map<string, string>();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return {
    headers: {
      get: (name: string) => headers.get(name) ?? null,
    },
  } as any;
}

// -- Tests ---------------------------------------------------------------

describe('Cron Secret Fail-Closed (Remediation #5)', () => {
  const REAL_SECRET = 'my-secure-cron-secret';

  beforeEach(() => {
    resetMockPrisma();
    sessionDeleteMany.mockReset();
    (mockPrisma.session as Record<string, unknown>).deleteMany = sessionDeleteMany;
    // Clear CRON_SECRET before each test
    delete process.env.CRON_SECRET;
  });

  // ---- check-security endpoint -----------------------------------------

  describe('GET /api/cron/check-security', () => {
    it('rejects when CRON_SECRET env var is missing', async () => {
      // CRON_SECRET is not set (deleted in beforeEach)
      const res = await checkSecurityGET(buildCronRequest('any-token'));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('rejects when CRON_SECRET is empty string', async () => {
      process.env.CRON_SECRET = '';

      const res = await checkSecurityGET(buildCronRequest(''));

      expect(res.status).toBe(401);
    });

    it('rejects when Bearer token is wrong', async () => {
      process.env.CRON_SECRET = REAL_SECRET;

      const res = await checkSecurityGET(buildCronRequest('wrong-token'));

      expect(res.status).toBe(401);
    });

    it('rejects when no Authorization header is provided', async () => {
      process.env.CRON_SECRET = REAL_SECRET;

      const res = await checkSecurityGET(buildCronRequest());

      expect(res.status).toBe(401);
    });

    it('succeeds with correct Bearer token', async () => {
      process.env.CRON_SECRET = REAL_SECRET;

      const res = await checkSecurityGET(buildCronRequest(REAL_SECRET));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Security check completed');
    });

    it('POST also works with correct token (manual trigger)', async () => {
      process.env.CRON_SECRET = REAL_SECRET;

      const res = await checkSecurityPOST(buildCronRequest(REAL_SECRET));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('no longer accepts the old hardcoded fallback token', async () => {
      // CRON_SECRET is not set
      const res = await checkSecurityGET(buildCronRequest('change-me-in-production'));

      expect(res.status).toBe(401);
    });
  });

  // ---- cleanup-sessions endpoint (already correct, confirm behavior) ---

  describe('GET /api/cron/cleanup-sessions', () => {
    it('rejects when CRON_SECRET env var is missing', async () => {
      const res = await cleanupSessionsGET(buildCronRequest('any-token'));

      expect(res.status).toBe(401);
    });

    it('rejects when Bearer token is wrong', async () => {
      process.env.CRON_SECRET = REAL_SECRET;

      const res = await cleanupSessionsGET(buildCronRequest('wrong-token'));

      expect(res.status).toBe(401);
    });

    it('succeeds with correct Bearer token', async () => {
      process.env.CRON_SECRET = REAL_SECRET;
      sessionDeleteMany.mockResolvedValue({ count: 5 });

      const res = await cleanupSessionsGET(buildCronRequest(REAL_SECRET));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.deletedCount).toBe(5);
    });
  });
});

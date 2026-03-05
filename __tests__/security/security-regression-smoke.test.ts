/**
 * Security Regression Smoke Tests (Remediation #9)
 *
 * Fast, targeted checks for critical security boundaries that
 * complement the per-remediation integration tests.
 *
 * Covers gaps not tested elsewhere:
 *   - validateWorkshopAccess: cross-org isolation (PLATFORM_ADMIN / TENANT_ADMIN / TENANT_USER)
 *   - validateParticipantAccess: cross-org isolation via workshop relationship
 *   - withRateLimit wrapper: 429 enforcement + headers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';

// ---------------------------------------------------------------------------
// Mock rate limiters (vi.hoisted so the fn is available in hoisted vi.mock)
// ---------------------------------------------------------------------------

const { mockRateLimitCheck } = vi.hoisted(() => ({
  mockRateLimitCheck: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: { check: mockRateLimitCheck },
  authLimiter: { check: mockRateLimitCheck },
  strictLimiter: { check: mockRateLimitCheck },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'mock-id',
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  validateWorkshopAccess,
  validateParticipantAccess,
} from '@/lib/middleware/validate-workshop-access';
import { withRateLimit } from '@/lib/with-rate-limit';
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const USER_A = 'user-a';

const workshopInOrgA = { id: 'ws-1', organizationId: ORG_A, createdById: USER_A };
const workshopInOrgB = { id: 'ws-2', organizationId: ORG_B, createdById: 'user-b' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Security Regression Smoke Tests (Remediation #9)', () => {
  beforeEach(() => {
    resetMockPrisma();
    mockRateLimitCheck.mockReset();
  });

  // -----------------------------------------------------------------------
  // validateWorkshopAccess: cross-org isolation
  // -----------------------------------------------------------------------

  describe('validateWorkshopAccess: cross-org isolation', () => {
    it('PLATFORM_ADMIN can access any workshop', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshopInOrgA);

      const result = await validateWorkshopAccess('ws-1', null, 'PLATFORM_ADMIN');

      expect(result.valid).toBe(true);
      expect(result.workshop).toMatchObject({ id: 'ws-1', organizationId: ORG_A });
    });

    it('TENANT_ADMIN can access workshop in own org', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshopInOrgA);

      const result = await validateWorkshopAccess('ws-1', ORG_A, 'TENANT_ADMIN');

      expect(result.valid).toBe(true);
    });

    it('TENANT_ADMIN blocked from cross-org workshop', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshopInOrgB);

      const result = await validateWorkshopAccess('ws-2', ORG_A, 'TENANT_ADMIN');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('different organization');
    });

    it('TENANT_USER can access own workshop in own org', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshopInOrgA);

      const result = await validateWorkshopAccess('ws-1', ORG_A, 'TENANT_USER', USER_A);

      expect(result.valid).toBe(true);
    });

    it('TENANT_USER blocked from workshop they do not own (same org)', async () => {
      const otherUsersWorkshop = { id: 'ws-3', organizationId: ORG_A, createdById: 'other-user' };
      mockPrisma.workshop.findUnique.mockResolvedValue(otherUsersWorkshop);

      const result = await validateWorkshopAccess('ws-3', ORG_A, 'TENANT_USER', USER_A);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('do not own');
    });

    it('TENANT_USER blocked from cross-org workshop', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshopInOrgB);

      const result = await validateWorkshopAccess('ws-2', ORG_A, 'TENANT_USER', USER_A);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('different organization');
    });

    it('returns not found for non-existent workshop', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(null);

      const result = await validateWorkshopAccess('no-such', ORG_A, 'TENANT_ADMIN');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects unknown role', async () => {
      const result = await validateWorkshopAccess('ws-1', ORG_A, 'UNKNOWN_ROLE');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  // -----------------------------------------------------------------------
  // validateParticipantAccess: delegates to workshop check
  // -----------------------------------------------------------------------

  describe('validateParticipantAccess: cross-org isolation', () => {
    it('grants access when participant workshop is in same org', async () => {
      mockPrisma.workshopParticipant.findUnique.mockResolvedValue({
        workshopId: 'ws-1',
        workshop: workshopInOrgA,
      });
      mockPrisma.workshop.findUnique.mockResolvedValue(workshopInOrgA);

      const result = await validateParticipantAccess('part-1', ORG_A, 'TENANT_ADMIN');

      expect(result.valid).toBe(true);
    });

    it('denies access when participant workshop is cross-org', async () => {
      mockPrisma.workshopParticipant.findUnique.mockResolvedValue({
        workshopId: 'ws-2',
        workshop: workshopInOrgB,
      });
      mockPrisma.workshop.findUnique.mockResolvedValue(workshopInOrgB);

      const result = await validateParticipantAccess('part-2', ORG_A, 'TENANT_ADMIN');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('different organization');
    });

    it('returns not found for non-existent participant', async () => {
      mockPrisma.workshopParticipant.findUnique.mockResolvedValue(null);

      const result = await validateParticipantAccess('no-such', ORG_A, 'TENANT_ADMIN');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // -----------------------------------------------------------------------
  // withRateLimit wrapper: 429 enforcement
  // -----------------------------------------------------------------------

  describe('withRateLimit wrapper: 429 enforcement', () => {
    const dummyHandler = vi.fn(async () =>
      NextResponse.json({ ok: true }),
    );

    function buildNextRequest(ip = '1.2.3.4'): NextRequest {
      return new NextRequest('http://localhost/api/test', {
        headers: { 'x-forwarded-for': ip },
      });
    }

    it('returns 429 with Retry-After header when rate limit exceeded', async () => {
      const resetTime = Date.now() + 30_000;
      mockRateLimitCheck.mockResolvedValue({ success: false, remaining: 0, reset: resetTime });
      // Suppress $executeRaw for audit log
      mockPrisma.$executeRaw.mockResolvedValue(0);

      const wrapped = withRateLimit(dummyHandler, 'api');
      const response = await wrapped(buildNextRequest());

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toContain('Too many requests');
      expect(response.headers.get('Retry-After')).toBeDefined();

      // Handler was NOT called
      expect(dummyHandler).not.toHaveBeenCalled();
    });

    it('passes through and adds rate limit headers when under limit', async () => {
      const resetTime = Date.now() + 60_000;
      mockRateLimitCheck.mockResolvedValue({ success: true, remaining: 59, reset: resetTime });

      const wrapped = withRateLimit(dummyHandler, 'api');
      const response = await wrapped(buildNextRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('59');
      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();

      // Handler WAS called
      expect(dummyHandler).toHaveBeenCalledTimes(1);
    });

    it('uses auth limiter with tighter limit for auth type', async () => {
      mockRateLimitCheck.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });

      const wrapped = withRateLimit(dummyHandler, 'auth');
      await wrapped(buildNextRequest());

      // auth type uses limit=5 (from withRateLimit implementation)
      expect(mockRateLimitCheck).toHaveBeenCalledWith(5, expect.any(String));
    });

    it('uses strict limiter with medium limit for strict type', async () => {
      mockRateLimitCheck.mockResolvedValue({ success: true, remaining: 9, reset: Date.now() + 60_000 });

      const wrapped = withRateLimit(dummyHandler, 'strict');
      await wrapped(buildNextRequest());

      // strict type uses limit=10
      expect(mockRateLimitCheck).toHaveBeenCalledWith(10, expect.any(String));
    });
  });
});

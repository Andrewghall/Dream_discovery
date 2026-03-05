/**
 * Unit Tests: Access Review Helper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma: any = vi.hoisted(() => {
  const mock: any = {
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    consentRecord: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    conversationSession: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    conversationMessage: { deleteMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation((callback: any) => callback(mock));
  return mock;
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { generateAccessReview } from '@/lib/compliance/access-review';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    role: 'TENANT_USER',
    organizationId: 'org-1',
    organization: { name: 'Test Org' },
    lastLoginAt: new Date(),
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Access Review Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAccessReview', () => {
    it('should return empty report when no users exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const report = await generateAccessReview();

      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.users).toEqual([]);
      expect(report.flags).toEqual([]);
    });

    it('should list all users with their details', async () => {
      const users = [
        makeUser({ id: 'u1', email: 'a@b.com', name: 'Alice' }),
        makeUser({ id: 'u2', email: 'c@d.com', name: 'Bob', role: 'TENANT_ADMIN' }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const report = await generateAccessReview();

      expect(report.users).toHaveLength(2);
      expect(report.users[0].userId).toBe('u1');
      expect(report.users[0].email).toBe('a@b.com');
      expect(report.users[1].role).toBe('TENANT_ADMIN');
    });

    it('should flag users who have not logged in for 90+ days', async () => {
      const oldLogin = new Date();
      oldLogin.setDate(oldLogin.getDate() - 100); // 100 days ago

      const users = [
        makeUser({ id: 'inactive-user', email: 'old@user.com', lastLoginAt: oldLogin }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const report = await generateAccessReview();

      const inactiveFlags = report.flags.filter((f) => f.flagType === 'INACTIVE_USER');
      expect(inactiveFlags).toHaveLength(1);
      expect(inactiveFlags[0].userId).toBe('inactive-user');
      expect(inactiveFlags[0].description).toContain('has not logged in since');
    });

    it('should flag users who have never logged in', async () => {
      const users = [
        makeUser({ id: 'never-logged', email: 'new@user.com', lastLoginAt: null }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const report = await generateAccessReview();

      const inactiveFlags = report.flags.filter((f) => f.flagType === 'INACTIVE_USER');
      expect(inactiveFlags).toHaveLength(1);
      expect(inactiveFlags[0].description).toContain('never logged in');
    });

    it('should flag PLATFORM_ADMIN users', async () => {
      const users = [
        makeUser({ id: 'admin-user', email: 'admin@co.com', role: 'PLATFORM_ADMIN' }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const report = await generateAccessReview();

      const adminFlags = report.flags.filter((f) => f.flagType === 'PLATFORM_ADMIN');
      expect(adminFlags).toHaveLength(1);
      expect(adminFlags[0].description).toContain('PLATFORM_ADMIN');
    });

    it('should flag users with no organization', async () => {
      const users = [
        makeUser({
          id: 'no-org-user',
          email: 'orphan@user.com',
          organizationId: null,
          organization: null,
        }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const report = await generateAccessReview();

      const noOrgFlags = report.flags.filter((f) => f.flagType === 'NO_ORGANIZATION');
      expect(noOrgFlags).toHaveLength(1);
      expect(noOrgFlags[0].description).toContain('not assigned to any organization');
    });

    it('should produce multiple flags for a single problematic user', async () => {
      const users = [
        makeUser({
          id: 'problem-user',
          email: 'problem@user.com',
          role: 'PLATFORM_ADMIN',
          organizationId: null,
          organization: null,
          lastLoginAt: null,
        }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const report = await generateAccessReview();

      // Should have flags for: INACTIVE_USER, PLATFORM_ADMIN, NO_ORGANIZATION
      expect(report.flags).toHaveLength(3);
      const flagTypes = report.flags.map((f) => f.flagType);
      expect(flagTypes).toContain('INACTIVE_USER');
      expect(flagTypes).toContain('PLATFORM_ADMIN');
      expect(flagTypes).toContain('NO_ORGANIZATION');
    });

    it('should not flag recently active non-admin users with org', async () => {
      const recentLogin = new Date(); // today
      const users = [
        makeUser({
          id: 'good-user',
          email: 'good@user.com',
          role: 'TENANT_USER',
          lastLoginAt: recentLogin,
        }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const report = await generateAccessReview();

      expect(report.flags).toHaveLength(0);
    });

    it('should include organization name from joined relation', async () => {
      const users = [
        makeUser({
          organization: { name: 'Acme Corp' },
        }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const report = await generateAccessReview();

      expect(report.users[0].organizationName).toBe('Acme Corp');
    });
  });
});

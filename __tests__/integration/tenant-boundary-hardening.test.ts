/**
 * Integration Tests - Tenant Boundary Hardening (Remediation #3)
 *
 * Tests that:
 *   1. TENANT_ADMIN cannot change organizationId for any user
 *   2. TENANT_ADMIN can only modify users in their own organization
 *   3. PLATFORM_ADMIN can still reassign organizationId freely
 *   4. TENANT_ADMIN can still update allowed fields (name, email, role, isActive)
 *   5. Cross-org TENANT_ADMIN update is blocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';

// -- Extend shared mock with auditLog.create (not in shared mock) --------
const auditLogCreate = vi.fn();
(mockPrisma.auditLog as Record<string, unknown>).create = auditLogCreate;

// -- Session mock control ------------------------------------------------
let mockSessionPayload: Record<string, unknown> | null = null;

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => mockSessionPayload),
  verifySessionToken: vi.fn(),
  createSessionToken: vi.fn(),
}));

// -- Import the route handlers under test --------------------------------
import { PATCH, GET } from '@/app/api/admin/users/[id]/route';

// -- Helpers -------------------------------------------------------------
function buildRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as any;
}

function buildParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// -- Fixtures ------------------------------------------------------------
const ORG_A = 'org-a';
const ORG_B = 'org-b';

const tenantAdminSession = {
  sessionId: 'session-ta',
  userId: 'tenant-admin-id',
  email: 'admin@org-a.com',
  role: 'TENANT_ADMIN',
  organizationId: ORG_A,
  createdAt: Date.now(),
};

const platformAdminSession = {
  sessionId: 'session-pa',
  userId: 'platform-admin-id',
  email: 'superadmin@platform.com',
  role: 'PLATFORM_ADMIN',
  organizationId: null,
  createdAt: Date.now(),
};

const userInOrgA = {
  id: 'user-in-a',
  name: 'Alice',
  email: 'alice@org-a.com',
  role: 'TENANT_USER',
  organizationId: ORG_A,
  isActive: true,
};

const userInOrgB = {
  id: 'user-in-b',
  name: 'Bob',
  email: 'bob@org-b.com',
  role: 'TENANT_USER',
  organizationId: ORG_B,
  isActive: true,
};

// -- Tests ---------------------------------------------------------------

describe('Tenant Boundary Hardening (Remediation #3)', () => {
  beforeEach(() => {
    resetMockPrisma();
    auditLogCreate.mockReset();
    // Re-attach after resetMockPrisma clears mocks
    (mockPrisma.auditLog as Record<string, unknown>).create = auditLogCreate;
    mockSessionPayload = null;
  });

  // ---- organizationId reassignment guards ----------------------------

  describe('organizationId reassignment', () => {
    it('TENANT_ADMIN cannot change organizationId for a user in their own org', async () => {
      mockSessionPayload = tenantAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(userInOrgA);

      const res = await PATCH(
        buildRequest({ organizationId: ORG_B }),
        buildParams(userInOrgA.id),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('tenant admins cannot reassign organization');
      // Ensure no DB update was attempted
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('TENANT_ADMIN cannot set organizationId to null (remove from org)', async () => {
      mockSessionPayload = tenantAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(userInOrgA);

      const res = await PATCH(
        buildRequest({ organizationId: null }),
        buildParams(userInOrgA.id),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('tenant admins cannot reassign organization');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('PLATFORM_ADMIN can reassign organizationId freely', async () => {
      mockSessionPayload = platformAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(userInOrgA);

      const updatedUser = {
        ...userInOrgA,
        organizationId: ORG_B,
        lastLoginAt: null,
        createdAt: new Date(),
        organization: { id: ORG_B, name: 'Org B' },
      };
      mockPrisma.user.update.mockResolvedValue(updatedUser);
      auditLogCreate.mockResolvedValue({});

      const res = await PATCH(
        buildRequest({ organizationId: ORG_B }),
        buildParams(userInOrgA.id),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.organizationId).toBe(ORG_B);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: ORG_B }),
        }),
      );
    });
  });

  // ---- Cross-org access guards ---------------------------------------

  describe('cross-org tenant admin access', () => {
    it('TENANT_ADMIN cannot update a user in a different org', async () => {
      mockSessionPayload = tenantAdminSession; // org-a
      mockPrisma.user.findUnique.mockResolvedValue(userInOrgB); // org-b

      const res = await PATCH(
        buildRequest({ name: 'Hacked Name' }),
        buildParams(userInOrgB.id),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('TENANT_ADMIN cannot GET a user in a different org', async () => {
      mockSessionPayload = tenantAdminSession; // org-a
      mockPrisma.user.findUnique.mockResolvedValue({
        ...userInOrgB,
        lastLoginAt: null,
        createdAt: new Date(),
        organization: { id: ORG_B, name: 'Org B' },
      });

      const res = await GET(
        {} as any,
        buildParams(userInOrgB.id),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
    });
  });

  // ---- Allowed updates for TENANT_ADMIN ------------------------------

  describe('TENANT_ADMIN allowed updates within own org', () => {
    it('can update name, email, role, isActive for same-org user', async () => {
      mockSessionPayload = tenantAdminSession;
      // First call: fetch existing user; second call: email uniqueness check
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(userInOrgA)
        .mockResolvedValueOnce(null);

      const updatedUser = {
        ...userInOrgA,
        name: 'Alice Updated',
        email: 'alice-new@org-a.com',
        role: 'TENANT_ADMIN',
        isActive: false,
        lastLoginAt: null,
        createdAt: new Date(),
        organization: { id: ORG_A, name: 'Org A' },
      };
      mockPrisma.user.update.mockResolvedValue(updatedUser);
      auditLogCreate.mockResolvedValue({});

      const res = await PATCH(
        buildRequest({
          name: 'Alice Updated',
          email: 'alice-new@org-a.com',
          role: 'TENANT_ADMIN',
          isActive: false,
        }),
        buildParams(userInOrgA.id),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.name).toBe('Alice Updated');
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('cannot promote a same-org user to PLATFORM_ADMIN', async () => {
      mockSessionPayload = tenantAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(userInOrgA);

      const res = await PATCH(
        buildRequest({ role: 'PLATFORM_ADMIN' }),
        buildParams(userInOrgA.id),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('cannot assign PLATFORM_ADMIN role');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ---- Unauthenticated / TENANT_USER guards -------------------------

  describe('access control basics', () => {
    it('unauthenticated request returns 401', async () => {
      mockSessionPayload = null;

      const res = await PATCH(
        buildRequest({ name: 'Nope' }),
        buildParams('any-id'),
      );

      expect(res.status).toBe(401);
    });

    it('TENANT_USER cannot PATCH any user', async () => {
      mockSessionPayload = {
        ...tenantAdminSession,
        role: 'TENANT_USER',
      };

      const res = await PATCH(
        buildRequest({ name: 'Nope' }),
        buildParams('any-id'),
      );

      expect(res.status).toBe(403);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});

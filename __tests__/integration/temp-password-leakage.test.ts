/**
 * Integration Tests - Temporary Password Leakage (Remediation #4)
 *
 * Tests that:
 *   1. API response never contains a plaintext temporary password
 *   2. Successful user creation returns user info without credentials
 *   3. Email is still sent (onboarding via set-password link preserved)
 *   4. No password field appears anywhere in the response payload
 *   5. Auth guards still function (unauthenticated, TENANT_USER blocked)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';

// -- Extend shared mock with models not in the shared mock ----------------
const auditLogCreate = vi.fn();
(mockPrisma.auditLog as Record<string, unknown>).create = auditLogCreate;

const userCount = vi.fn();
(mockPrisma.user as Record<string, unknown>).count = userCount;

const passwordResetTokenCreate = vi.fn();
(mockPrisma as Record<string, unknown>).passwordResetToken = {
  create: passwordResetTokenCreate,
};

// -- Session mock control ------------------------------------------------
let mockSessionPayload: Record<string, unknown> | null = null;

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => mockSessionPayload),
  verifySessionToken: vi.fn(),
  createSessionToken: vi.fn(),
}));

// -- Mock email and alerts (non-fatal, just need them not to throw) ------
const mockSendWelcomeEmail = vi.fn(async () => ({ success: true, emailId: 'mock-email-id' }));
vi.mock('@/lib/email/send', () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

vi.mock('@/lib/monitoring/alerts', () => ({
  sendNewUserAlert: vi.fn(async () => {}),
}));

// -- Import the route handler under test ---------------------------------
import { POST } from '@/app/api/admin/users/create/route';

// -- Helpers -------------------------------------------------------------
function buildRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as any;
}

// -- Fixtures ------------------------------------------------------------
const platformAdminSession = {
  sessionId: 'session-pa',
  userId: 'platform-admin-id',
  email: 'superadmin@platform.com',
  role: 'PLATFORM_ADMIN',
  organizationId: null,
  createdAt: Date.now(),
};

const tenantAdminSession = {
  sessionId: 'session-ta',
  userId: 'tenant-admin-id',
  email: 'admin@org-a.com',
  role: 'TENANT_ADMIN',
  organizationId: 'org-a',
  createdAt: Date.now(),
};

const createdUser = {
  id: 'new-user-id',
  email: 'newuser@example.com',
  name: 'New User',
  role: 'TENANT_USER',
  organizationId: 'org-a',
  isActive: true,
  mustChangePassword: true,
  organization: { id: 'org-a', name: 'Org A', maxSeats: 10 },
};

// -- Tests ---------------------------------------------------------------

describe('Temporary Password Leakage (Remediation #4)', () => {
  beforeEach(() => {
    resetMockPrisma();
    auditLogCreate.mockReset();
    userCount.mockReset();
    passwordResetTokenCreate.mockReset();
    mockSendWelcomeEmail.mockClear();
    // Re-attach extended mocks after resetMockPrisma
    (mockPrisma.auditLog as Record<string, unknown>).create = auditLogCreate;
    (mockPrisma.user as Record<string, unknown>).count = userCount;
    (mockPrisma as Record<string, unknown>).passwordResetToken = {
      create: passwordResetTokenCreate,
    };
    mockSessionPayload = null;
  });

  describe('API response must not contain plaintext password', () => {
    it('successful creation response has no temporaryPassword field', async () => {
      mockSessionPayload = platformAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(null); // no conflict
      mockPrisma.user.create.mockResolvedValue(createdUser);
      passwordResetTokenCreate.mockResolvedValue({ id: 'reset-id', token: 'reset-token' });
      auditLogCreate.mockResolvedValue({});

      const res = await POST(
        buildRequest({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'TENANT_USER',
          organizationId: 'org-a',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      // Core assertion: no password in response
      expect(body.temporaryPassword).toBeUndefined();
      expect(body.password).toBeUndefined();

      // Verify the rest of the response is intact
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe('new-user-id');
      expect(body.user.email).toBe('newuser@example.com');
      expect(body.emailSent).toBe(true);
    });

    it('no password-like field exists anywhere in the JSON response', async () => {
      mockSessionPayload = platformAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(createdUser);
      passwordResetTokenCreate.mockResolvedValue({ id: 'reset-id', token: 'reset-token' });
      auditLogCreate.mockResolvedValue({});

      const res = await POST(
        buildRequest({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'TENANT_USER',
          organizationId: 'org-a',
        }),
      );

      const body = await res.json();
      const responseString = JSON.stringify(body);

      // No field named password, temporaryPassword, tempPassword, etc.
      expect(responseString).not.toMatch(/"(temporary)?[Pp]assword"\s*:/);
      // No bcrypt hashes leaked
      expect(responseString).not.toMatch(/\$2[aby]\$/);
    });

    it('tenant admin creation also has no password in response', async () => {
      mockSessionPayload = tenantAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockPrisma.organization.findUnique.mockResolvedValue({ maxSeats: 10 });
      userCount.mockResolvedValue(3);
      passwordResetTokenCreate.mockResolvedValue({ id: 'reset-id', token: 'reset-token' });
      auditLogCreate.mockResolvedValue({});

      const res = await POST(
        buildRequest({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'TENANT_USER',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.temporaryPassword).toBeUndefined();
      expect(body.password).toBeUndefined();
      expect(body.success).toBe(true);
    });
  });

  describe('onboarding via set-password link is preserved', () => {
    it('creates a passwordResetToken for the set-password link', async () => {
      mockSessionPayload = platformAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(createdUser);
      passwordResetTokenCreate.mockResolvedValue({ id: 'reset-id', token: 'reset-token' });
      auditLogCreate.mockResolvedValue({});

      await POST(
        buildRequest({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'TENANT_USER',
          organizationId: 'org-a',
        }),
      );

      expect(passwordResetTokenCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'new-user-id',
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('welcome email is called without temporaryPassword', async () => {
      mockSessionPayload = platformAdminSession;
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(createdUser);
      passwordResetTokenCreate.mockResolvedValue({ id: 'reset-id', token: 'reset-token' });
      auditLogCreate.mockResolvedValue({});

      await POST(
        buildRequest({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'TENANT_USER',
          organizationId: 'org-a',
        }),
      );

      expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(1);
      const emailParams = mockSendWelcomeEmail.mock.calls[0][0] as Record<string, unknown>;
      // temporaryPassword must not be passed
      expect(emailParams.temporaryPassword).toBeUndefined();
      // setPasswordUrl must be present for onboarding
      expect(emailParams.setPasswordUrl).toBeDefined();
      expect(String(emailParams.setPasswordUrl)).toContain('/reset-password?token=');
    });
  });

  describe('auth guards', () => {
    it('unauthenticated request returns 401', async () => {
      mockSessionPayload = null;

      const res = await POST(
        buildRequest({ email: 'x@y.com', name: 'X', role: 'TENANT_USER' }),
      );

      expect(res.status).toBe(401);
    });

    it('TENANT_USER cannot create users', async () => {
      mockSessionPayload = {
        ...tenantAdminSession,
        role: 'TENANT_USER',
      };

      const res = await POST(
        buildRequest({ email: 'x@y.com', name: 'X', role: 'TENANT_USER' }),
      );

      expect(res.status).toBe(403);
    });
  });
});

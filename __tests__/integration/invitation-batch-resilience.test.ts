/**
 * Integration Tests - Invitation Batch Resilience (Remediation #6)
 *
 * Tests that:
 *   1. One recipient failure does not abort remaining sends
 *   2. Response includes per-recipient result matrix (ok/error per email)
 *   3. Success/failure counts are accurate
 *   4. Workshop status is updated when at least one email succeeds
 *   5. Access control is unchanged
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';

// -- Mock auth and access validation -------------------------------------
const mockUser = {
  userId: 'admin-id',
  email: 'admin@example.com',
  role: 'PLATFORM_ADMIN',
  organizationId: null,
  sessionId: 'session-id',
};
let mockAuthUser: typeof mockUser | null = mockUser;

vi.mock('@/lib/auth/get-session-user', () => ({
  getAuthenticatedUser: vi.fn(async () => mockAuthUser),
}));

vi.mock('@/lib/middleware/validate-workshop-access', () => ({
  validateWorkshopAccess: vi.fn(async () => ({ valid: true })),
}));

// -- Mock email sending --------------------------------------------------
const mockSendInvitation = vi.fn();
vi.mock('@/lib/email/send-invitation', () => ({
  sendDiscoveryInvitation: (...args: unknown[]) => mockSendInvitation(...args),
}));

// -- Import route handler ------------------------------------------------
import { POST } from '@/app/api/admin/workshops/[id]/send-invitations/route';

// -- Helpers -------------------------------------------------------------
function buildRequest(resend = false) {
  return {
    nextUrl: {
      searchParams: {
        get: (key: string) => (key === 'resend' && resend ? 'true' : null),
      },
    },
    headers: {
      get: () => 'localhost:3000',
    },
  } as any;
}

function buildParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// -- Fixtures ------------------------------------------------------------
const participant1 = {
  id: 'p1',
  email: 'alice@example.com',
  name: 'Alice',
  discoveryToken: 'token-alice',
  emailSentAt: null,
  doNotSendAgain: false,
};

const participant2 = {
  id: 'p2',
  email: 'bob@example.com',
  name: 'Bob',
  discoveryToken: 'token-bob',
  emailSentAt: null,
  doNotSendAgain: false,
};

const participant3 = {
  id: 'p3',
  email: 'carol@example.com',
  name: 'Carol',
  discoveryToken: 'token-carol',
  emailSentAt: null,
  doNotSendAgain: false,
};

const workshop = {
  id: 'ws-1',
  name: 'Test Workshop',
  description: 'A test',
  organizationId: 'org-1',
  responseDeadline: null,
  participants: [participant1, participant2, participant3],
};

// -- Tests ---------------------------------------------------------------

describe('Invitation Batch Resilience (Remediation #6)', () => {
  beforeEach(() => {
    resetMockPrisma();
    mockSendInvitation.mockReset();
    mockAuthUser = mockUser;
  });

  describe('batch continues on individual failure', () => {
    it('one recipient failure does not stop others from receiving email', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshop);
      mockPrisma.workshopParticipant.update.mockResolvedValue({});
      mockPrisma.workshop.update.mockResolvedValue({});

      // Alice: success, Bob: fails, Carol: success
      mockSendInvitation
        .mockResolvedValueOnce({ data: { id: 'resend-1' } }) // Alice
        .mockRejectedValueOnce(new Error('Mailbox full'))     // Bob
        .mockResolvedValueOnce({ data: { id: 'resend-3' } }); // Carol

      const res = await POST(buildRequest(), buildParams('ws-1'));

      expect(res.status).toBe(200);
      const body = await res.json();

      // All 3 participants were attempted
      expect(mockSendInvitation).toHaveBeenCalledTimes(3);

      // Counts are accurate
      expect(body.emailsSent).toBe(2);
      expect(body.emailsFailed).toBe(1);

      // Per-recipient results
      expect(body.results).toHaveLength(3);
      expect(body.results[0]).toMatchObject({ email: 'alice@example.com', ok: true });
      expect(body.results[1]).toMatchObject({ email: 'bob@example.com', ok: false, error: 'Mailbox full' });
      expect(body.results[2]).toMatchObject({ email: 'carol@example.com', ok: true });
    });

    it('first recipient failure does not abort the batch', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshop);
      mockPrisma.workshopParticipant.update.mockResolvedValue({});
      mockPrisma.workshop.update.mockResolvedValue({});

      // Alice: fails, Bob: success, Carol: success
      mockSendInvitation
        .mockRejectedValueOnce(new Error('Invalid address'))
        .mockResolvedValueOnce({ data: { id: 'resend-2' } })
        .mockResolvedValueOnce({ data: { id: 'resend-3' } });

      const res = await POST(buildRequest(), buildParams('ws-1'));

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(mockSendInvitation).toHaveBeenCalledTimes(3);
      expect(body.emailsSent).toBe(2);
      expect(body.emailsFailed).toBe(1);
      expect(body.results[0].ok).toBe(false);
      expect(body.results[1].ok).toBe(true);
      expect(body.results[2].ok).toBe(true);
    });

    it('all recipients fail gracefully without 500', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshop);

      mockSendInvitation
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'));

      const res = await POST(buildRequest(), buildParams('ws-1'));

      // Returns 200 with results, not 500
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.emailsSent).toBe(0);
      expect(body.emailsFailed).toBe(3);
      expect(body.success).toBe(false);
      expect(body.results.every((r: { ok: boolean }) => !r.ok)).toBe(true);
    });
  });

  describe('response includes full result matrix', () => {
    it('each result entry has email, ok status, and error when failed', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshop);
      mockPrisma.workshopParticipant.update.mockResolvedValue({});
      mockPrisma.workshop.update.mockResolvedValue({});

      mockSendInvitation
        .mockResolvedValueOnce({ data: { id: 'id-1' } })
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValueOnce({ data: { id: 'id-3' } });

      const res = await POST(buildRequest(), buildParams('ws-1'));
      const body = await res.json();

      // Successful entries have ok: true and resendId
      expect(body.results[0]).toMatchObject({ email: 'alice@example.com', ok: true });
      expect(body.results[0].resendId).toBe('id-1');

      // Failed entries have ok: false and error message
      expect(body.results[1]).toMatchObject({
        email: 'bob@example.com',
        ok: false,
        error: 'Rate limited',
      });

      // Third succeeds
      expect(body.results[2]).toMatchObject({ email: 'carol@example.com', ok: true });
    });

    it('all-success batch returns success: true with zero failures', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshop);
      mockPrisma.workshopParticipant.update.mockResolvedValue({});
      mockPrisma.workshop.update.mockResolvedValue({});

      mockSendInvitation.mockResolvedValue({ data: { id: 'ok' } });

      const res = await POST(buildRequest(), buildParams('ws-1'));
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.emailsSent).toBe(3);
      expect(body.emailsFailed).toBe(0);
      expect(body.results.every((r: { ok: boolean }) => r.ok)).toBe(true);
    });
  });

  describe('workshop status update', () => {
    it('updates workshop status when at least one email succeeds', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshop);
      mockPrisma.workshopParticipant.update.mockResolvedValue({});
      mockPrisma.workshop.update.mockResolvedValue({});

      mockSendInvitation
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({ data: { id: 'ok' } })
        .mockRejectedValueOnce(new Error('Fail'));

      await POST(buildRequest(), buildParams('ws-1'));

      expect(mockPrisma.workshop.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { status: 'DISCOVERY_SENT' },
      });
    });

    it('does not update workshop status when all emails fail', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue(workshop);

      mockSendInvitation.mockRejectedValue(new Error('All fail'));

      await POST(buildRequest(), buildParams('ws-1'));

      expect(mockPrisma.workshop.update).not.toHaveBeenCalled();
    });
  });

  describe('access control unchanged', () => {
    it('rejects unauthenticated request', async () => {
      mockAuthUser = null;

      const res = await POST(buildRequest(), buildParams('ws-1'));

      expect(res.status).toBe(401);
    });
  });
});

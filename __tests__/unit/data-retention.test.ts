/**
 * Unit Tests: Data Retention Policy Enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma: any = vi.hoisted(() => {
  const mock: any = {
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    conversationSession: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    conversationMessage: { deleteMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation((callback: any) => callback(mock));
  return mock;
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { enforceRetentionPolicy } from '@/lib/compliance/data-retention';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Data Retention Policy Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env overrides
    delete process.env.RETENTION_AUDIT_LOGS_YEARS;
    delete process.env.RETENTION_SESSIONS_YEARS;
  });

  describe('dry run mode', () => {
    it('should return counts without deleting when dryRun is true', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(5);
      mockPrisma.conversationSession.count.mockResolvedValue(2);

      const result = await enforceRetentionPolicy({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.deletedCounts.auditLogs).toBe(5);
      expect(result.deletedCounts.sessions).toBe(2);

      // Verify no deletes happened
      expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.conversationSession.deleteMany).not.toHaveBeenCalled();
    });

    it('should return zero counts when no data is past retention', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.conversationSession.count.mockResolvedValue(0);

      const result = await enforceRetentionPolicy({ dryRun: true });

      expect(result.deletedCounts.auditLogs).toBe(0);
      expect(result.deletedCounts.sessions).toBe(0);
    });
  });

  describe('actual deletion', () => {
    it('should delete expired data within a transaction', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.conversationSession.findMany.mockResolvedValue([
        { id: 'session-1' },
        { id: 'session-2' },
      ]);
      mockPrisma.conversationMessage.deleteMany.mockResolvedValue({ count: 20 });
      mockPrisma.conversationSession.deleteMany.mockResolvedValue({ count: 2 });

      const result = await enforceRetentionPolicy({ dryRun: false });

      expect(result.dryRun).toBe(false);
      expect(result.deletedCounts.auditLogs).toBe(10);
      expect(result.deletedCounts.sessions).toBe(2);

      // Verify transaction was used
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should delete messages before sessions (cascade order)', async () => {
      const callOrder: string[] = [];

      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.conversationSession.findMany.mockResolvedValue([{ id: 's1' }]);
      mockPrisma.conversationMessage.deleteMany.mockImplementation(async () => {
        callOrder.push('messages');
        return { count: 5 };
      });
      mockPrisma.conversationSession.deleteMany.mockImplementation(async () => {
        callOrder.push('sessions');
        return { count: 1 };
      });

      await enforceRetentionPolicy({ dryRun: false });

      expect(callOrder).toEqual(['messages', 'sessions']);
    });

    it('should skip session deletion when no expired sessions exist', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.conversationSession.findMany.mockResolvedValue([]);

      const result = await enforceRetentionPolicy({ dryRun: false });

      expect(result.deletedCounts.sessions).toBe(0);
      expect(mockPrisma.conversationMessage.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.conversationSession.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('configurable retention periods', () => {
    it('should respect custom retention periods from env vars', async () => {
      process.env.RETENTION_AUDIT_LOGS_YEARS = '1';
      process.env.RETENTION_SESSIONS_YEARS = '1';

      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.conversationSession.count.mockResolvedValue(25);

      const result = await enforceRetentionPolicy({ dryRun: true });

      // Verify counts are returned (the cutoff dates would differ based on env)
      expect(result.deletedCounts.auditLogs).toBe(100);
      expect(result.deletedCounts.sessions).toBe(25);

      // Verify the audit count was called with a date filter
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        })
      );
    });

    it('should fall back to defaults for invalid env values', async () => {
      process.env.RETENTION_AUDIT_LOGS_YEARS = 'invalid';
      process.env.RETENTION_SESSIONS_YEARS = '0';

      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.conversationSession.count.mockResolvedValue(0);

      // Should not throw; uses defaults
      const result = await enforceRetentionPolicy({ dryRun: true });
      expect(result.dryRun).toBe(true);
    });
  });

  describe('defaults', () => {
    it('should default to dryRun false when no options provided', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.conversationSession.findMany.mockResolvedValue([]);

      const result = await enforceRetentionPolicy();

      expect(result.dryRun).toBe(false);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});

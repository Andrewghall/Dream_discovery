/**
 * Unit Tests: DSAR Operational Log
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
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-123' }));

import { logDSARRequest, getDSARLog, getDSARSLAReport } from '@/lib/compliance/dsar-log';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DSAR Operational Log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logDSARRequest', () => {
    it('should create an audit log entry for a DSAR export request', async () => {
      const now = new Date();
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'test-nanoid-123',
        organizationId: 'compliance',
        userEmail: 'user@example.com',
        action: 'DSAR_EXPORT_INITIATED',
        resourceType: 'DSAR',
        resourceId: 'workshop-1',
        timestamp: now,
        metadata: {
          dsarType: 'export',
          dsarStatus: 'initiated',
          workshopId: 'workshop-1',
        },
        success: true,
      });

      const result = await logDSARRequest({
        type: 'export',
        email: 'user@example.com',
        workshopId: 'workshop-1',
        status: 'initiated',
      });

      expect(result.id).toBe('test-nanoid-123');
      expect(result.type).toBe('export');
      expect(result.email).toBe('user@example.com');
      expect(result.workshopId).toBe('workshop-1');
      expect(result.status).toBe('initiated');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DSAR_EXPORT_INITIATED',
          userEmail: 'user@example.com',
          resourceId: 'workshop-1',
          success: true,
        }),
      });
    });

    it('should mark failed requests with success=false', async () => {
      const now = new Date();
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'test-nanoid-123',
        timestamp: now,
        metadata: { dsarType: 'delete', dsarStatus: 'failed', workshopId: 'w1' },
      });

      await logDSARRequest({
        type: 'delete',
        email: 'user@example.com',
        workshopId: 'w1',
        status: 'failed',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
        }),
      });
    });

    it('should include custom metadata in the log entry', async () => {
      const now = new Date();
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'test-nanoid-123',
        timestamp: now,
        metadata: { dsarType: 'export', dsarStatus: 'completed', workshopId: 'w2', reason: 'audit' },
      });

      await logDSARRequest({
        type: 'export',
        email: 'admin@co.com',
        workshopId: 'w2',
        status: 'completed',
        metadata: { reason: 'audit' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            reason: 'audit',
          }),
        }),
      });
    });
  });

  describe('getDSARLog', () => {
    it('should retrieve all DSAR entries when no filters given', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'DSAR_EXPORT_INITIATED',
          userEmail: 'a@b.com',
          resourceId: 'w1',
          timestamp: new Date('2025-01-01'),
          metadata: { dsarType: 'export', dsarStatus: 'initiated' },
        },
      ]);

      const results = await getDSARLog();

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('export');
      expect(results[0].status).toBe('initiated');
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: { startsWith: 'DSAR_' },
          }),
        })
      );
    });

    it('should filter by email', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getDSARLog({ email: 'specific@user.com' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userEmail: 'specific@user.com',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-06-01');

      await getDSARLog({ fromDate, toDate });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: { gte: fromDate, lte: toDate },
          }),
        })
      );
    });
  });

  describe('getDSARSLAReport', () => {
    it('should return 100% compliance when no requests exist', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const report = await getDSARSLAReport();

      expect(report.totalRequests).toBe(0);
      expect(report.slaCompliancePercent).toBe(100);
      expect(report.slaWindowDays).toBe(30);
    });

    it('should calculate SLA compliance for mixed results', async () => {
      const initiated = new Date('2025-01-01T00:00:00Z');
      const completedOnTime = new Date('2025-01-15T00:00:00Z'); // 14 days
      const completedLate = new Date('2025-03-15T00:00:00Z');   // ~73 days

      // First call: initiated records
      mockPrisma.auditLog.findMany
        .mockResolvedValueOnce([
          {
            id: 'i1',
            action: 'DSAR_EXPORT_INITIATED',
            userEmail: 'a@b.com',
            resourceId: 'w1',
            timestamp: initiated,
            metadata: { dsarType: 'export', dsarStatus: 'initiated' },
          },
          {
            id: 'i2',
            action: 'DSAR_DELETE_INITIATED',
            userEmail: 'c@d.com',
            resourceId: 'w2',
            timestamp: initiated,
            metadata: { dsarType: 'delete', dsarStatus: 'initiated' },
          },
        ])
        // Second call: completed records
        .mockResolvedValueOnce([
          {
            id: 'c1',
            action: 'DSAR_EXPORT_COMPLETED',
            userEmail: 'a@b.com',
            resourceId: 'w1',
            timestamp: completedOnTime,
            metadata: { dsarType: 'export', dsarStatus: 'completed' },
          },
          {
            id: 'c2',
            action: 'DSAR_DELETE_COMPLETED',
            userEmail: 'c@d.com',
            resourceId: 'w2',
            timestamp: completedLate,
            metadata: { dsarType: 'delete', dsarStatus: 'completed' },
          },
        ]);

      const report = await getDSARSLAReport();

      expect(report.totalRequests).toBe(2);
      expect(report.completedWithinSLA).toBe(1);
      expect(report.completedOutsideSLA).toBe(1);
      expect(report.pending).toBe(0);
      expect(report.slaCompliancePercent).toBe(50);
    });

    it('should count pending requests (no completion record)', async () => {
      const initiated = new Date('2025-01-01T00:00:00Z');

      mockPrisma.auditLog.findMany
        .mockResolvedValueOnce([
          {
            id: 'i1',
            action: 'DSAR_EXPORT_INITIATED',
            userEmail: 'pending@user.com',
            resourceId: 'w1',
            timestamp: initiated,
            metadata: { dsarType: 'export', dsarStatus: 'initiated' },
          },
        ])
        .mockResolvedValueOnce([]); // no completions

      const report = await getDSARSLAReport();

      expect(report.totalRequests).toBe(1);
      expect(report.pending).toBe(1);
      expect(report.completedWithinSLA).toBe(0);
    });
  });
});

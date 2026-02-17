/**
 * Unit Tests - Audit Logger
 * Tests for audit logging, SQL injection prevention, and statistics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';
import {
  logAuditEvent,
  getAuditLogs,
  getAuditStatistics,
  AuditAction,
} from '@/lib/audit/audit-logger';

describe('Audit Logger', () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  const mockOrganizationId = 'test-org-id';
  const mockUserId = 'test-user-id';
  const mockUserEmail = 'test@example.com';

  describe('logAuditEvent', () => {
    it('should successfully log audit event with all fields', async () => {
      const mockAuditLog = {
        id: 'audit-log-id',
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'CREATE_WORKSHOP' as AuditAction,
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'POST',
        path: '/api/admin/workshops',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: { workshopName: 'Test Workshop' },
        timestamp: new Date(),
        success: true,
        errorMessage: null,
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await logAuditEvent({
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'CREATE_WORKSHOP',
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'POST',
        path: '/api/admin/workshops',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: { workshopName: 'Test Workshop' },
        success: true,
      });

      expect(result).toEqual(mockAuditLog);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrganizationId,
          userId: mockUserId,
          userEmail: mockUserEmail,
          action: 'CREATE_WORKSHOP',
          resourceType: 'Workshop',
          resourceId: 'workshop-id',
          method: 'POST',
          path: '/api/admin/workshops',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          metadata: { workshopName: 'Test Workshop' },
          success: true,
        }),
      });
    });

    it('should log minimal audit event (only required fields)', async () => {
      const mockAuditLog = {
        id: 'audit-log-id',
        organizationId: mockOrganizationId,
        userId: null,
        userEmail: null,
        action: 'LOGIN_SUCCESS' as AuditAction,
        resourceType: null,
        resourceId: null,
        method: null,
        path: null,
        ipAddress: null,
        userAgent: null,
        metadata: null,
        timestamp: new Date(),
        success: true,
        errorMessage: null,
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await logAuditEvent({
        organizationId: mockOrganizationId,
        action: 'LOGIN_SUCCESS',
      });

      expect(result).toEqual(mockAuditLog);
    });

    it('should log failed action with error message', async () => {
      const mockAuditLog = {
        id: 'audit-log-id',
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'DELETE_WORKSHOP' as AuditAction,
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'DELETE',
        path: '/api/admin/workshops/workshop-id',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: null,
        timestamp: new Date(),
        success: false,
        errorMessage: 'Workshop not found',
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await logAuditEvent({
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'DELETE_WORKSHOP',
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'DELETE',
        path: '/api/admin/workshops/workshop-id',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        success: false,
        errorMessage: 'Workshop not found',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Workshop not found');
    });

    it('should log all 16 audit action types', async () => {
      const actions: AuditAction[] = [
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'CREATE_WORKSHOP',
        'UPDATE_WORKSHOP',
        'DELETE_WORKSHOP',
        'CREATE_PARTICIPANT',
        'UPDATE_PARTICIPANT',
        'DELETE_PARTICIPANT',
        'SEND_INVITATION',
        'GDPR_EXPORT',
        'GDPR_DELETE',
        'CREATE_USER',
        'UPDATE_USER',
        'DELETE_USER',
        'SYSTEM_EVENT',
      ];

      for (const action of actions) {
        mockPrisma.auditLog.create.mockResolvedValueOnce({
          id: `audit-${action}`,
          organizationId: mockOrganizationId,
          userId: mockUserId,
          userEmail: mockUserEmail,
          action,
          resourceType: null,
          resourceId: null,
          method: null,
          path: null,
          ipAddress: null,
          userAgent: null,
          metadata: null,
          timestamp: new Date(),
          success: true,
          errorMessage: null,
        });

        await logAuditEvent({
          organizationId: mockOrganizationId,
          userId: mockUserId,
          userEmail: mockUserEmail,
          action,
        });
      }

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(16);
    });

    it('should handle complex metadata objects', async () => {
      const complexMetadata = {
        workshopName: 'Test Workshop',
        participants: ['user1', 'user2', 'user3'],
        settings: {
          includeRegulation: true,
          voiceEnabled: false,
          language: 'en',
        },
        nested: {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        },
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-log-id',
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'CREATE_WORKSHOP',
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'POST',
        path: '/api/admin/workshops',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: complexMetadata,
        timestamp: new Date(),
        success: true,
        errorMessage: null,
      });

      const result = await logAuditEvent({
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'CREATE_WORKSHOP',
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'POST',
        path: '/api/admin/workshops',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: complexMetadata,
      });

      expect(result.metadata).toEqual(complexMetadata);
    });
  });

  describe('getAuditLogs - SQL Injection Prevention', () => {
    it('should safely query logs with organization filter', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          organizationId: mockOrganizationId,
          action: 'CREATE_WORKSHOP',
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          organizationId: mockOrganizationId,
          action: 'UPDATE_WORKSHOP',
          timestamp: new Date(),
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await getAuditLogs({
        organizationId: mockOrganizationId,
      });

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should prevent SQL injection in organizationId filter', async () => {
      const maliciousOrgId = "test-org'; DROP TABLE audit_logs; --";

      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getAuditLogs({
        organizationId: maliciousOrgId,
      });

      // Prisma type-safe query should handle this safely
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: maliciousOrgId },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should prevent SQL injection in userId filter', async () => {
      const maliciousUserId = "test-user' OR '1'='1";

      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getAuditLogs({
        organizationId: mockOrganizationId,
        userId: maliciousUserId,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          userId: maliciousUserId,
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should prevent SQL injection in action filter', async () => {
      const maliciousAction = "CREATE_WORKSHOP'; DELETE FROM audit_logs WHERE '1'='1";

      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getAuditLogs({
        organizationId: mockOrganizationId,
        action: maliciousAction as any,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          action: maliciousAction,
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should filter by userId', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          organizationId: mockOrganizationId,
          userId: mockUserId,
          action: 'CREATE_WORKSHOP',
          timestamp: new Date(),
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      await getAuditLogs({
        organizationId: mockOrganizationId,
        userId: mockUserId,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          userId: mockUserId,
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should filter by action', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          organizationId: mockOrganizationId,
          action: 'LOGIN_SUCCESS',
          timestamp: new Date(),
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      await getAuditLogs({
        organizationId: mockOrganizationId,
        action: 'LOGIN_SUCCESS',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          action: 'LOGIN_SUCCESS',
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getAuditLogs({
        organizationId: mockOrganizationId,
        startDate,
        endDate,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should handle pagination', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getAuditLogs({
        organizationId: mockOrganizationId,
        limit: 50,
        offset: 100,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 100,
      });
    });
  });

  describe('getAuditStatistics', () => {
    it('should return statistics for organization', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(100); // total
      mockPrisma.auditLog.count.mockResolvedValueOnce(95); // successful
      mockPrisma.auditLog.count.mockResolvedValueOnce(5); // failed

      const result = await getAuditStatistics({
        organizationId: mockOrganizationId,
      });

      expect(result.totalEvents).toBe(100);
      expect(result.successfulEvents).toBe(95);
      expect(result.failedEvents).toBe(5);
      expect(result.successRate).toBe(0.95);
    });

    it('should return action breakdown', async () => {
      const mockLogs = [
        { action: 'CREATE_WORKSHOP' },
        { action: 'CREATE_WORKSHOP' },
        { action: 'CREATE_WORKSHOP' },
        { action: 'UPDATE_WORKSHOP' },
        { action: 'UPDATE_WORKSHOP' },
        { action: 'DELETE_WORKSHOP' },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await getAuditStatistics({
        organizationId: mockOrganizationId,
      });

      expect(result.actionBreakdown.CREATE_WORKSHOP).toBe(3);
      expect(result.actionBreakdown.UPDATE_WORKSHOP).toBe(2);
      expect(result.actionBreakdown.DELETE_WORKSHOP).toBe(1);
    });

    it('should handle organization with no audit logs', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await getAuditStatistics({
        organizationId: mockOrganizationId,
      });

      expect(result.totalEvents).toBe(0);
      expect(result.successfulEvents).toBe(0);
      expect(result.failedEvents).toBe(0);
      expect(result.successRate).toBe(0);
      expect(Object.keys(result.actionBreakdown).length).toBe(0);
    });

    it('should filter statistics by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrisma.auditLog.count.mockResolvedValue(50);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getAuditStatistics({
        organizationId: mockOrganizationId,
        startDate,
        endDate,
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        logAuditEvent({
          organizationId: mockOrganizationId,
          action: 'LOGIN_SUCCESS',
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle very long error messages', async () => {
      const longErrorMessage = 'Error: ' + 'x'.repeat(5000);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-log-id',
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'CREATE_WORKSHOP',
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'POST',
        path: '/api/admin/workshops',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: null,
        timestamp: new Date(),
        success: false,
        errorMessage: longErrorMessage,
      });

      const result = await logAuditEvent({
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'CREATE_WORKSHOP',
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'POST',
        path: '/api/admin/workshops',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        success: false,
        errorMessage: longErrorMessage,
      });

      expect(result.errorMessage).toBe(longErrorMessage);
    });

    it('should handle special characters in metadata', async () => {
      const specialMetadata = {
        description: "Test with quotes ' \" and special chars <>&",
        sql: "SELECT * FROM users WHERE id = '1'",
        unicode: '测试 🔒 мультиязычность',
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-log-id',
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'CREATE_WORKSHOP',
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'POST',
        path: '/api/admin/workshops',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: specialMetadata,
        timestamp: new Date(),
        success: true,
        errorMessage: null,
      });

      const result = await logAuditEvent({
        organizationId: mockOrganizationId,
        userId: mockUserId,
        userEmail: mockUserEmail,
        action: 'CREATE_WORKSHOP',
        resourceType: 'Workshop',
        resourceId: 'workshop-id',
        method: 'POST',
        path: '/api/admin/workshops',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: specialMetadata,
      });

      expect(result.metadata).toEqual(specialMetadata);
    });
  });
});

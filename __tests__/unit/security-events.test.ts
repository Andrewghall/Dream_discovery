/**
 * Unit Tests: Structured Security Event Logger
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
vi.mock('nanoid', () => ({ nanoid: () => 'sec-corr-id-123' }));

import { logSecurityEvent, getSecurityEvents } from '@/lib/compliance/security-events';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Structured Security Event Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('logSecurityEvent', () => {
    it('should log event with correlation ID and persist to audit log', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'sec-corr-id-123',
        timestamp: new Date(),
      });

      const result = await logSecurityEvent({
        type: 'LOGIN_BRUTE_FORCE',
        severity: 'critical',
        actor: 'user-123',
        resource: 'auth-endpoint',
        details: { attempts: 10 },
      });

      expect(result.correlationId).toBe('sec-corr-id-123');
      expect(result.type).toBe('LOGIN_BRUTE_FORCE');
      expect(result.severity).toBe('critical');
      expect(result.actor).toBe('user-123');
      expect(result.resource).toBe('auth-endpoint');
      expect(result.details).toEqual({ attempts: 10 });
      expect(result.timestamp).toBeDefined();

      // Should output structured JSON to console
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('sec-corr-id-123')
      );

      // Should persist to audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'sec-corr-id-123',
          action: 'SECURITY_LOGIN_BRUTE_FORCE',
          userId: 'user-123',
          resourceId: 'auth-endpoint',
        }),
      });
    });

    it('should handle events with minimal fields', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'sec-corr-id-123',
        timestamp: new Date(),
      });

      const result = await logSecurityEvent({
        type: 'HEALTH_CHECK',
        severity: 'info',
      });

      expect(result.actor).toBeNull();
      expect(result.resource).toBeNull();
      expect(result.details).toBeNull();
    });

    it('should output valid JSON to console.log', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'sec-corr-id-123',
        timestamp: new Date(),
      });

      await logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'warning',
        actor: 'ip-192.168.1.1',
      });

      const consoleSpy = console.log as ReturnType<typeof vi.fn>;
      const loggedJson = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(loggedJson);

      expect(parsed.correlationId).toBe('sec-corr-id-123');
      expect(parsed.type).toBe('RATE_LIMIT_EXCEEDED');
      expect(parsed.severity).toBe('warning');
    });

    it('should use SECURITY_ prefix for audit log action', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'sec-corr-id-123',
        timestamp: new Date(),
      });

      await logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'critical',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'SECURITY_UNAUTHORIZED_ACCESS',
        }),
      });
    });

    it('should include severity in metadata', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'sec-corr-id-123',
        timestamp: new Date(),
      });

      await logSecurityEvent({
        type: 'CONFIG_CHANGE',
        severity: 'warning',
        details: { setting: 'max_retries', oldValue: 3, newValue: 5 },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            severity: 'warning',
            correlationId: 'sec-corr-id-123',
            setting: 'max_retries',
          }),
        }),
      });
    });
  });

  describe('getSecurityEvents', () => {
    it('should retrieve all security events when no filters given', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'evt-1',
          action: 'SECURITY_RATE_LIMIT',
          userId: 'user-1',
          resourceId: '/api/login',
          timestamp: new Date('2025-06-01'),
          metadata: { severity: 'warning', correlationId: 'corr-1' },
        },
      ]);

      const events = await getSecurityEvents();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RATE_LIMIT');
      expect(events[0].severity).toBe('warning');
      expect(events[0].correlationId).toBe('corr-1');
    });

    it('should filter by event type', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getSecurityEvents({ type: 'LOGIN_FAILED' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'SECURITY_LOGIN_FAILED',
          }),
        })
      );
    });

    it('should filter by severity', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getSecurityEvents({ severity: 'critical' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            metadata: { path: ['severity'], equals: 'critical' },
          }),
        })
      );
    });

    it('should respect the limit parameter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getSecurityEvents({ limit: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should default to 100 results when no limit is specified', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await getSecurityEvents();

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });
});

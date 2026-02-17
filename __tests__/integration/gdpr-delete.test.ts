/**
 * Integration Tests - GDPR Data Deletion
 * Tests for GDPR Article 17 (Right to Erasure) compliance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';
import { createMockRequest, getResponseJSON, getResponseStatus } from '../utils/test-helpers';
import {
  mockParticipant,
  mockWorkshop,
  mockConversationSession,
  mockDataPoint,
} from '../utils/test-fixtures';
import { POST } from '@/app/api/gdpr/delete/route';

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2 }),
  getGDPRRateLimitKey: vi.fn((email, workshopId, action) => `gdpr:${action}:${email}:${workshopId}`),
}));

describe('GDPR Data Deletion Integration Tests', () => {
  beforeEach(() => {
    resetMockPrisma();
    vi.clearAllMocks();
  });

  const validEmail = 'participant@example.com';
  const validWorkshopId = 'test-workshop-id';
  const validAuthToken = 'test-discovery-token';
  const validConfirmationToken = 'confirmation-token-123';

  describe('POST /api/gdpr/delete - Request Deletion', () => {
    it('should generate confirmation token for valid deletion request', async () => {
      // Mock participant lookup with authentication
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      // Mock update with confirmation token
      mockPrisma.workshopParticipant.update.mockResolvedValue({
        ...mockParticipant,
        deletionRequestToken: validConfirmationToken,
        deletionRequestedAt: new Date(),
      } as any);

      // Mock audit log creation
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_DELETE_REQUEST',
        timestamp: new Date(),
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('confirmation');
      expect(data.confirmationToken).toBeDefined();

      // Verify confirmation token was saved
      expect(mockPrisma.workshopParticipant.update).toHaveBeenCalledWith({
        where: { id: mockParticipant.id },
        data: expect.objectContaining({
          deletionRequestToken: expect.any(String),
          deletionRequestedAt: expect.any(Date),
        }),
      });

      // Verify audit log was created
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'GDPR_DELETE_REQUEST',
          success: true,
        }),
      });
    });

    it('should reject deletion request with invalid authentication', async () => {
      // Mock participant with different token
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: 'different-token',
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: 'wrong-token',
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(401);
      expect(data.error).toContain('Invalid authentication');

      // Should not generate confirmation token
      expect(mockPrisma.workshopParticipant.update).not.toHaveBeenCalled();
    });

    it('should enforce rate limiting (3 requests per 15 minutes)', async () => {
      const { checkRateLimit } = await import('@/lib/rate-limit');

      // Mock rate limit exceeded
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 900000, // 15 minutes
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(429);
      expect(data.error).toContain('Rate limit exceeded');

      // Should not proceed to participant lookup
      expect(mockPrisma.workshopParticipant.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/gdpr/delete - Confirm Deletion', () => {
    it('should successfully delete all participant data with valid confirmation', async () => {
      // Mock participant with confirmation token
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        deletionRequestToken: validConfirmationToken,
        deletionRequestedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      // Mock session lookup
      mockPrisma.conversationSession.findMany.mockResolvedValue([
        {
          ...mockConversationSession,
          id: 'session-1',
        },
      ] as any);

      // Mock cascade deletions
      mockPrisma.conversationMessage.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.conversationInsight.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.conversationReport.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.dataPoint.deleteMany.mockResolvedValue({ count: 20 });
      mockPrisma.dataPointClassification.deleteMany.mockResolvedValue({ count: 15 });
      mockPrisma.dataPointAnnotation.deleteMany.mockResolvedValue({ count: 8 });
      mockPrisma.conversationSession.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.consentRecord.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.workshopParticipant.delete.mockResolvedValue(mockParticipant as any);

      // Mock audit log creation
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_DELETE',
        timestamp: new Date(),
      } as any);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: validConfirmationToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
      expect(data.deletedRecords).toBeDefined();

      // Verify cascade deletions occurred in correct order
      expect(mockPrisma.conversationMessage.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.conversationInsight.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.conversationReport.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.dataPoint.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.dataPointClassification.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.dataPointAnnotation.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.conversationSession.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.consentRecord.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.workshopParticipant.delete).toHaveBeenCalled();

      // Verify audit log was created
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'GDPR_DELETE',
          success: true,
        }),
      });
    });

    it('should reject deletion with invalid confirmation token', async () => {
      // Mock participant with different confirmation token
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        deletionRequestToken: 'different-confirmation-token',
        deletionRequestedAt: new Date(Date.now() - 5 * 60 * 1000),
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: 'wrong-confirmation-token',
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(401);
      expect(data.error).toContain('Invalid confirmation token');

      // Should not proceed with deletion
      expect(mockPrisma.conversationMessage.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.workshopParticipant.delete).not.toHaveBeenCalled();
    });

    it('should reject expired confirmation token (30 minutes)', async () => {
      // Mock participant with expired confirmation token
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        deletionRequestToken: validConfirmationToken,
        deletionRequestedAt: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: validConfirmationToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(401);
      expect(data.error).toContain('expired');

      // Should not proceed with deletion
      expect(mockPrisma.workshopParticipant.delete).not.toHaveBeenCalled();
    });

    it('should reject deletion without confirmation token', async () => {
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        deletionRequestToken: null,
        deletionRequestedAt: null,
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: validConfirmationToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(400);
      expect(data.error).toContain('No deletion request found');

      // Should not proceed with deletion
      expect(mockPrisma.workshopParticipant.delete).not.toHaveBeenCalled();
    });

    it('should handle cascade deletion errors gracefully', async () => {
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        deletionRequestToken: validConfirmationToken,
        deletionRequestedAt: new Date(Date.now() - 5 * 60 * 1000),
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      mockPrisma.conversationSession.findMany.mockResolvedValue([
        { id: 'session-1' },
      ] as any);

      // Mock deletion error
      mockPrisma.$transaction.mockRejectedValue(new Error('Foreign key constraint violation'));

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: validConfirmationToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });

    it('should preserve audit trail after deletion', async () => {
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        deletionRequestToken: validConfirmationToken,
        deletionRequestedAt: new Date(Date.now() - 5 * 60 * 1000),
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      mockPrisma.conversationSession.findMany.mockResolvedValue([]);
      mockPrisma.conversationMessage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.conversationInsight.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.conversationReport.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dataPoint.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dataPointClassification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dataPointAnnotation.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.conversationSession.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.consentRecord.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.workshopParticipant.delete.mockResolvedValue(mockParticipant as any);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_DELETE',
        timestamp: new Date(),
      } as any);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: validConfirmationToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);

      expect(status).toBe(200);

      // Verify audit log was created (NOT deleted)
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'GDPR_DELETE',
          organizationId: 'test-org-id',
          success: true,
        }),
      });

      // Audit logs should NOT be deleted
      expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle multiple sessions for same participant', async () => {
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        deletionRequestToken: validConfirmationToken,
        deletionRequestedAt: new Date(Date.now() - 5 * 60 * 1000),
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      // Mock multiple sessions
      mockPrisma.conversationSession.findMany.mockResolvedValue([
        { id: 'session-1' },
        { id: 'session-2' },
        { id: 'session-3' },
      ] as any);

      mockPrisma.conversationMessage.deleteMany.mockResolvedValue({ count: 30 });
      mockPrisma.conversationInsight.deleteMany.mockResolvedValue({ count: 15 });
      mockPrisma.conversationReport.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.dataPoint.deleteMany.mockResolvedValue({ count: 60 });
      mockPrisma.dataPointClassification.deleteMany.mockResolvedValue({ count: 45 });
      mockPrisma.dataPointAnnotation.deleteMany.mockResolvedValue({ count: 24 });
      mockPrisma.conversationSession.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.consentRecord.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.workshopParticipant.delete.mockResolvedValue(mockParticipant as any);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_DELETE',
        timestamp: new Date(),
      } as any);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: validConfirmationToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);
      expect(data.deletedRecords).toBeDefined();
      expect(data.deletedRecords.sessions).toBe(3);
      expect(data.deletedRecords.messages).toBe(30);
    });

    it('should reject deletion twice (idempotency check)', async () => {
      // Mock participant not found (already deleted)
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: validConfirmationToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(401);
      expect(data.error).toContain('Participant not found');

      // Should not attempt deletion
      expect(mockPrisma.workshopParticipant.delete).not.toHaveBeenCalled();
    });
  });

  describe('GDPR Compliance Verification', () => {
    it('should delete all 8 data categories required by Article 17', async () => {
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue({
        ...mockParticipant,
        email: validEmail,
        workshopId: validWorkshopId,
        discoveryToken: validAuthToken,
        deletionRequestToken: validConfirmationToken,
        deletionRequestedAt: new Date(Date.now() - 5 * 60 * 1000),
        workshop: {
          id: validWorkshopId,
          organizationId: 'test-org-id',
        },
      } as any);

      mockPrisma.conversationSession.findMany.mockResolvedValue([{ id: 'session-1' }] as any);
      mockPrisma.conversationMessage.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.conversationInsight.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.conversationReport.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.dataPoint.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.dataPointClassification.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.dataPointAnnotation.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.conversationSession.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.consentRecord.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.workshopParticipant.delete.mockResolvedValue(mockParticipant as any);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_DELETE',
        timestamp: new Date(),
      } as any);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/delete',
        body: {
          email: validEmail,
          workshopId: validWorkshopId,
          authToken: validAuthToken,
          confirmationToken: validConfirmationToken,
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);

      // GDPR Article 17 requires deletion of these categories
      const requiredDeletions = [
        'messages',
        'insights',
        'reports',
        'dataPoints',
        'classifications',
        'annotations',
        'sessions',
        'consentRecords',
      ];

      requiredDeletions.forEach((category) => {
        expect(data.deletedRecords[category]).toBeDefined();
      });
    });
  });
});

/**
 * Integration Tests - GDPR Data Export
 * Tests for GDPR Article 15 (Right to Access) compliance
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
import { POST } from '@/app/api/gdpr/export/route';

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
  getGDPRRateLimitKey: vi.fn((email, workshopId, action) => `gdpr:${action}:${email}:${workshopId}`),
}));

describe('GDPR Data Export Integration Tests', () => {
  beforeEach(() => {
    resetMockPrisma();
    vi.clearAllMocks();
  });

  const validEmail = 'participant@example.com';
  const validWorkshopId = 'test-workshop-id';
  const validAuthToken = 'test-discovery-token';

  describe('POST /api/gdpr/export', () => {
    it('should successfully export participant data with valid authentication', async () => {
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

      // Mock workshop data
      mockPrisma.workshop.findUnique.mockResolvedValue(mockWorkshop);

      // Mock sessions
      mockPrisma.conversationSession.findMany.mockResolvedValue([mockConversationSession] as any);

      // Mock messages
      mockPrisma.conversationMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          sessionId: mockConversationSession.id,
          role: 'assistant',
          content: 'Hello, how are you?',
          createdAt: new Date(),
        },
      ] as any);

      // Mock data points
      mockPrisma.dataPoint.findMany.mockResolvedValue([mockDataPoint] as any);

      // Mock insights
      mockPrisma.conversationInsight.findMany.mockResolvedValue([
        {
          id: 'insight-1',
          sessionId: mockConversationSession.id,
          participantId: mockParticipant.id,
          insightType: 'REGULATORY_IMPACT',
          content: 'Test insight',
          createdAt: new Date(),
        },
      ] as any);

      // Mock reports
      mockPrisma.conversationReport.findMany.mockResolvedValue([
        {
          id: 'report-1',
          sessionId: mockConversationSession.id,
          participantId: mockParticipant.id,
          keyInsights: ['Insight 1', 'Insight 2'],
          createdAt: new Date(),
        },
      ] as any);

      // Mock audit log creation
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_EXPORT',
        timestamp: new Date(),
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
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
      expect(data.data).toBeDefined();

      // Verify data structure includes all 5 categories
      expect(data.data.participant).toBeDefined();
      expect(data.data.workshop).toBeDefined();
      expect(data.data.sessions).toBeDefined();
      expect(data.data.messages).toBeDefined();
      expect(data.data.dataPoints).toBeDefined();
      expect(data.data.insights).toBeDefined();
      expect(data.data.reports).toBeDefined();

      // Verify audit log was created
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'GDPR_EXPORT',
          organizationId: 'test-org-id',
          success: true,
        }),
      });
    });

    it('should reject export with invalid authentication token', async () => {
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
        url: 'http://localhost:3001/api/gdpr/export',
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

      // Should not proceed to export
      expect(mockPrisma.conversationSession.findMany).not.toHaveBeenCalled();
    });

    it('should reject export for non-existent participant', async () => {
      // Mock participant not found
      mockPrisma.workshopParticipant.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
        body: {
          email: 'nonexistent@example.com',
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

      expect(status).toBe(401);
      expect(data.error).toContain('Participant not found');
    });

    it('should enforce rate limiting (5 requests per 15 minutes)', async () => {
      const { checkRateLimit } = await import('@/lib/rate-limit');

      // Mock rate limit exceeded
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 900000, // 15 minutes
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
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

    it('should handle participant with no data', async () => {
      // Mock participant with valid auth
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

      mockPrisma.workshop.findUnique.mockResolvedValue(mockWorkshop);

      // Mock empty data
      mockPrisma.conversationSession.findMany.mockResolvedValue([]);
      mockPrisma.conversationMessage.findMany.mockResolvedValue([]);
      mockPrisma.dataPoint.findMany.mockResolvedValue([]);
      mockPrisma.conversationInsight.findMany.mockResolvedValue([]);
      mockPrisma.conversationReport.findMany.mockResolvedValue([]);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_EXPORT',
        timestamp: new Date(),
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
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
      expect(data.data.sessions).toEqual([]);
      expect(data.data.messages).toEqual([]);
      expect(data.data.dataPoints).toEqual([]);
    });

    it('should include consent records in export', async () => {
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

      mockPrisma.workshop.findUnique.mockResolvedValue(mockWorkshop);
      mockPrisma.conversationSession.findMany.mockResolvedValue([]);
      mockPrisma.conversationMessage.findMany.mockResolvedValue([]);
      mockPrisma.dataPoint.findMany.mockResolvedValue([]);
      mockPrisma.conversationInsight.findMany.mockResolvedValue([]);
      mockPrisma.conversationReport.findMany.mockResolvedValue([]);

      // Mock consent records
      mockPrisma.consentRecord.findMany.mockResolvedValue([
        {
          id: 'consent-1',
          participantId: mockParticipant.id,
          workshopId: validWorkshopId,
          consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING'],
          consentVersion: 'v1.0',
          consentedAt: new Date('2024-01-01'),
          withdrawnAt: null,
        },
      ] as any);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_EXPORT',
        timestamp: new Date(),
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
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
      expect(data.data.consentRecords).toBeDefined();
      expect(data.data.consentRecords).toHaveLength(1);
      expect(data.data.consentRecords[0].consentTypes).toContain('DATA_COLLECTION');
    });

    it('should reject export with missing required fields', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
        body: {
          email: validEmail,
          // Missing workshopId and authToken
        },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await POST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should sanitize sensitive data in export', async () => {
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

      mockPrisma.workshop.findUnique.mockResolvedValue(mockWorkshop);
      mockPrisma.conversationSession.findMany.mockResolvedValue([]);
      mockPrisma.conversationMessage.findMany.mockResolvedValue([]);
      mockPrisma.dataPoint.findMany.mockResolvedValue([]);
      mockPrisma.conversationInsight.findMany.mockResolvedValue([]);
      mockPrisma.conversationReport.findMany.mockResolvedValue([]);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_EXPORT',
        timestamp: new Date(),
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
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

      // Verify sensitive fields are not included
      expect(data.data.participant.discoveryToken).toBeUndefined();
      expect(data.data.participant.password).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      // Mock participant lookup error
      mockPrisma.workshopParticipant.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
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

      expect(status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });

    it('should include export metadata (timestamp, format version)', async () => {
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

      mockPrisma.workshop.findUnique.mockResolvedValue(mockWorkshop);
      mockPrisma.conversationSession.findMany.mockResolvedValue([]);
      mockPrisma.conversationMessage.findMany.mockResolvedValue([]);
      mockPrisma.dataPoint.findMany.mockResolvedValue([]);
      mockPrisma.conversationInsight.findMany.mockResolvedValue([]);
      mockPrisma.conversationReport.findMany.mockResolvedValue([]);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_EXPORT',
        timestamp: new Date(),
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
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
      expect(data.metadata).toBeDefined();
      expect(data.metadata.exportedAt).toBeDefined();
      expect(data.metadata.format).toBe('GDPR_EXPORT_V1');
      expect(data.metadata.article).toBe('Article 15 - Right to Access');
    });
  });

  describe('GDPR Compliance Verification', () => {
    it('should include all data categories required by Article 15', async () => {
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

      mockPrisma.workshop.findUnique.mockResolvedValue(mockWorkshop);
      mockPrisma.conversationSession.findMany.mockResolvedValue([mockConversationSession] as any);
      mockPrisma.conversationMessage.findMany.mockResolvedValue([]);
      mockPrisma.dataPoint.findMany.mockResolvedValue([mockDataPoint] as any);
      mockPrisma.conversationInsight.findMany.mockResolvedValue([]);
      mockPrisma.conversationReport.findMany.mockResolvedValue([]);

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        organizationId: 'test-org-id',
        action: 'GDPR_EXPORT',
        timestamp: new Date(),
      } as any);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/gdpr/export',
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

      // GDPR Article 15 requires these data categories
      const requiredCategories = [
        'participant', // Personal data
        'workshop', // Context of processing
        'sessions', // Processing activities
        'messages', // Communication data
        'dataPoints', // Captured data
        'insights', // Derived data
        'reports', // Analytical outputs
      ];

      requiredCategories.forEach((category) => {
        expect(data.data[category]).toBeDefined();
      });
    });
  });
});

/**
 * Unit Tests - Consent Manager
 * Tests for GDPR consent recording, withdrawal, and validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';
import {
  recordConsent,
  withdrawConsent,
  getConsentStatus,
  hasValidConsent,
  getConsentStatistics,
} from '@/lib/consent/consent-manager';

describe('Consent Manager', () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  const mockParticipantId = 'test-participant-id';
  const mockWorkshopId = 'test-workshop-id';
  const mockConsentTypes = ['DATA_COLLECTION', 'AI_PROCESSING', 'AUDIO_RECORDING'];
  const mockVersion = 'v1.0';
  const mockIpAddress = '127.0.0.1';
  const mockUserAgent = 'Mozilla/5.0';

  describe('recordConsent', () => {
    it('should successfully record consent for participant', async () => {
      const mockConsentRecord = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date(),
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
        withdrawnAt: null,
      };

      mockPrisma.consentRecord.create.mockResolvedValue(mockConsentRecord);

      const result = await recordConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        version: mockVersion,
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
      });

      expect(result).toEqual(mockConsentRecord);
      expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
        data: {
          participantId: mockParticipantId,
          workshopId: mockWorkshopId,
          consentTypes: mockConsentTypes,
          consentVersion: mockVersion,
          ipAddress: mockIpAddress,
          userAgent: mockUserAgent,
          consentedAt: expect.any(Date),
        },
      });
    });

    it('should record consent with minimal data (no IP/UA)', async () => {
      const mockConsentRecord = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        withdrawnAt: null,
      };

      mockPrisma.consentRecord.create.mockResolvedValue(mockConsentRecord);

      const result = await recordConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        version: mockVersion,
      });

      expect(result).toEqual(mockConsentRecord);
      expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
        data: {
          participantId: mockParticipantId,
          workshopId: mockWorkshopId,
          consentTypes: mockConsentTypes,
          consentVersion: mockVersion,
          ipAddress: undefined,
          userAgent: undefined,
          consentedAt: expect.any(Date),
        },
      });
    });

    it('should record single consent type', async () => {
      const singleConsentType = ['DATA_COLLECTION'];

      mockPrisma.consentRecord.create.mockResolvedValue({
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: singleConsentType,
        consentVersion: mockVersion,
        consentedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        withdrawnAt: null,
      });

      await recordConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: singleConsentType,
        version: mockVersion,
      });

      expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consentTypes: singleConsentType,
          }),
        })
      );
    });
  });

  describe('withdrawConsent', () => {
    it('should successfully withdraw consent (GDPR Article 7)', async () => {
      const mockExistingConsent = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date('2024-01-01'),
        withdrawnAt: null,
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
      };

      const mockWithdrawnConsent = {
        ...mockExistingConsent,
        withdrawnAt: new Date(),
      };

      mockPrisma.consentRecord.findFirst.mockResolvedValue(mockExistingConsent);
      mockPrisma.consentRecord.update.mockResolvedValue(mockWithdrawnConsent);

      const result = await withdrawConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      expect(result).toEqual(mockWithdrawnConsent);
      expect(mockPrisma.consentRecord.findFirst).toHaveBeenCalledWith({
        where: {
          participantId: mockParticipantId,
          workshopId: mockWorkshopId,
          withdrawnAt: null,
        },
        orderBy: { consentedAt: 'desc' },
      });
      expect(mockPrisma.consentRecord.update).toHaveBeenCalledWith({
        where: { id: 'consent-id' },
        data: { withdrawnAt: expect.any(Date) },
      });
    });

    it('should return null if no active consent exists', async () => {
      mockPrisma.consentRecord.findFirst.mockResolvedValue(null);

      const result = await withdrawConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      expect(result).toBeNull();
      expect(mockPrisma.consentRecord.update).not.toHaveBeenCalled();
    });

    it('should not withdraw already withdrawn consent', async () => {
      const mockWithdrawnConsent = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date('2024-01-01'),
        withdrawnAt: new Date('2024-01-15'),
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
      };

      mockPrisma.consentRecord.findFirst.mockResolvedValue(mockWithdrawnConsent);

      const result = await withdrawConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      // Should not find any active consent (withdrawnAt: null)
      expect(result).toBeNull();
      expect(mockPrisma.consentRecord.update).not.toHaveBeenCalled();
    });
  });

  describe('getConsentStatus', () => {
    it('should return active consent status', async () => {
      const mockConsent = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date('2024-01-01'),
        withdrawnAt: null,
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
      };

      mockPrisma.consentRecord.findFirst.mockResolvedValue(mockConsent);

      const result = await getConsentStatus({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      expect(result).toEqual({
        hasConsent: true,
        consent: mockConsent,
        isWithdrawn: false,
      });
    });

    it('should return withdrawn consent status', async () => {
      const mockWithdrawnConsent = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date('2024-01-01'),
        withdrawnAt: new Date('2024-01-15'),
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
      };

      mockPrisma.consentRecord.findFirst.mockResolvedValue(mockWithdrawnConsent);

      const result = await getConsentStatus({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      expect(result).toEqual({
        hasConsent: false,
        consent: mockWithdrawnConsent,
        isWithdrawn: true,
      });
    });

    it('should return no consent status', async () => {
      mockPrisma.consentRecord.findFirst.mockResolvedValue(null);

      const result = await getConsentStatus({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      expect(result).toEqual({
        hasConsent: false,
        consent: null,
        isWithdrawn: false,
      });
    });
  });

  describe('hasValidConsent', () => {
    it('should return true for active consent', async () => {
      const mockConsent = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date('2024-01-01'),
        withdrawnAt: null,
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
      };

      mockPrisma.consentRecord.findFirst.mockResolvedValue(mockConsent);

      const result = await hasValidConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      expect(result).toBe(true);
    });

    it('should return false for withdrawn consent', async () => {
      const mockWithdrawnConsent = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date('2024-01-01'),
        withdrawnAt: new Date('2024-01-15'),
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
      };

      mockPrisma.consentRecord.findFirst.mockResolvedValue(mockWithdrawnConsent);

      const result = await hasValidConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      expect(result).toBe(false);
    });

    it('should return false when no consent exists', async () => {
      mockPrisma.consentRecord.findFirst.mockResolvedValue(null);

      const result = await hasValidConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
      });

      expect(result).toBe(false);
    });

    it('should validate specific consent types', async () => {
      const mockConsent = {
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING'],
        consentVersion: mockVersion,
        consentedAt: new Date('2024-01-01'),
        withdrawnAt: null,
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
      };

      mockPrisma.consentRecord.findFirst.mockResolvedValue(mockConsent);

      const hasDataCollection = await hasValidConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        requiredTypes: ['DATA_COLLECTION'],
      });

      const hasAudioRecording = await hasValidConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        requiredTypes: ['AUDIO_RECORDING'],
      });

      expect(hasDataCollection).toBe(true);
      expect(hasAudioRecording).toBe(false);
    });
  });

  describe('getConsentStatistics', () => {
    it('should return statistics for workshop', async () => {
      const mockStats = {
        totalConsents: 10,
        activeConsents: 8,
        withdrawnConsents: 2,
        consentRate: 0.8,
        consentTypeBreakdown: {
          DATA_COLLECTION: 10,
          AI_PROCESSING: 9,
          AUDIO_RECORDING: 7,
        },
      };

      mockPrisma.consentRecord.count.mockResolvedValueOnce(10); // total
      mockPrisma.consentRecord.count.mockResolvedValueOnce(8); // active
      mockPrisma.consentRecord.count.mockResolvedValueOnce(2); // withdrawn
      mockPrisma.consentRecord.findMany.mockResolvedValue([
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING', 'AUDIO_RECORDING'] },
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING', 'AUDIO_RECORDING'] },
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING', 'AUDIO_RECORDING'] },
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING', 'AUDIO_RECORDING'] },
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING', 'AUDIO_RECORDING'] },
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING', 'AUDIO_RECORDING'] },
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING', 'AUDIO_RECORDING'] },
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING'] },
        { consentTypes: ['DATA_COLLECTION', 'AI_PROCESSING'] },
        { consentTypes: ['DATA_COLLECTION'] },
      ]);

      const result = await getConsentStatistics({ workshopId: mockWorkshopId });

      expect(result.totalConsents).toBe(10);
      expect(result.activeConsents).toBe(8);
      expect(result.withdrawnConsents).toBe(2);
      expect(result.consentTypeBreakdown.DATA_COLLECTION).toBe(10);
      expect(result.consentTypeBreakdown.AI_PROCESSING).toBe(9);
      expect(result.consentTypeBreakdown.AUDIO_RECORDING).toBe(7);
    });

    it('should handle workshop with no consents', async () => {
      mockPrisma.consentRecord.count.mockResolvedValue(0);
      mockPrisma.consentRecord.findMany.mockResolvedValue([]);

      const result = await getConsentStatistics({ workshopId: mockWorkshopId });

      expect(result.totalConsents).toBe(0);
      expect(result.activeConsents).toBe(0);
      expect(result.withdrawnConsents).toBe(0);
      expect(result.consentRate).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.consentRecord.create.mockRejectedValue(new Error('Database error'));

      await expect(
        recordConsent({
          participantId: mockParticipantId,
          workshopId: mockWorkshopId,
          consentTypes: mockConsentTypes,
          version: mockVersion,
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle empty consent types array', async () => {
      mockPrisma.consentRecord.create.mockResolvedValue({
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: [],
        consentVersion: mockVersion,
        consentedAt: new Date(),
        withdrawnAt: null,
        ipAddress: null,
        userAgent: null,
      });

      const result = await recordConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: [],
        version: mockVersion,
      });

      expect(result.consentTypes).toEqual([]);
    });

    it('should handle very long user agent strings', async () => {
      const longUserAgent = 'Mozilla/5.0 ' + 'x'.repeat(1000);

      mockPrisma.consentRecord.create.mockResolvedValue({
        id: 'consent-id',
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        consentVersion: mockVersion,
        consentedAt: new Date(),
        withdrawnAt: null,
        ipAddress: mockIpAddress,
        userAgent: longUserAgent,
      });

      const result = await recordConsent({
        participantId: mockParticipantId,
        workshopId: mockWorkshopId,
        consentTypes: mockConsentTypes,
        version: mockVersion,
        userAgent: longUserAgent,
      });

      expect(result.userAgent).toBe(longUserAgent);
    });
  });
});

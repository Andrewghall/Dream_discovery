/**
 * GDPR Endpoint Security
 * Validates participant authentication for GDPR data requests
 */

import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export interface ValidatedParticipant {
  id: string;
  email: string;
  workshopId: string;
  organizationId: string;
}

/**
 * Validates a participant's identity for GDPR requests
 * Requires either:
 * 1. Valid discoveryToken (from invitation link)
 * 2. Email verification token sent via secure email
 */
export async function validateParticipantAuth(
  email: string,
  workshopId: string,
  authToken: string,
  request: NextRequest
): Promise<{ valid: boolean; participant?: ValidatedParticipant; error?: string }> {
  // Find participant
  const participant = await prisma.workshopParticipant.findFirst({
    where: {
      email,
      workshopId,
    },
    include: {
      workshop: {
        select: {
          id: true,
          organizationId: true,
        },
      },
    },
  });

  if (!participant) {
    return { valid: false, error: 'Participant not found' };
  }

  // Validate auth token matches discoveryToken
  // In production, you could also support time-limited email verification tokens
  if (authToken !== participant.discoveryToken) {
    return { valid: false, error: 'Invalid authentication token' };
  }

  return {
    valid: true,
    participant: {
      id: participant.id,
      email: participant.email,
      workshopId: participant.workshopId,
      organizationId: participant.workshop.organizationId,
    },
  };
}

/**
 * Rate limit key for GDPR endpoints
 * Per participant per endpoint to prevent abuse
 */
export function getGDPRRateLimitKey(email: string, workshopId: string, endpoint: string): string {
  return `gdpr:${endpoint}:${workshopId}:${email}`;
}

/**
 * Workshop access validation
 *
 * Access levels match the workshop list API:
 *
 *   PLATFORM_ADMIN  → blocked (GDPR — workshops are tenant-owned data)
 *   TENANT_ADMIN    → any workshop in their organisation
 *   TENANT_USER     → only workshops they personally created
 */

import { prisma } from '@/lib/prisma';

export interface WorkshopAccessValidation {
  valid: boolean;
  workshop?: {
    id: string;
    organizationId: string;
  };
  error?: string;
}

/**
 * Validates that a user can access a workshop.
 *
 *   PLATFORM_ADMIN  → always denied (GDPR)
 *   TENANT_ADMIN    → any workshop in their org (matches the workshop list API)
 *   TENANT_USER     → only workshops they personally created
 *
 * @param workshopId Workshop ID to access
 * @param userOrganizationId User's organization ID
 * @param userRole User's role
 * @param userId User's ID (required for TENANT_USER ownership check)
 */
export async function validateWorkshopAccess(
  workshopId: string,
  userOrganizationId: string | null,
  userRole: string,
  userId?: string
): Promise<WorkshopAccessValidation> {
  // PLATFORM_ADMIN: blocked for all workshop content (GDPR — workshops are tenant-owned)
  if (userRole === 'PLATFORM_ADMIN') {
    return { valid: false, error: 'Platform administrators cannot access workshop content' };
  }

  // TENANT_ADMIN: org-wide access — matches workshop list API behaviour
  if (userRole === 'TENANT_ADMIN') {
    if (!userOrganizationId) {
      return { valid: false, error: 'Organization ID required' };
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, organizationId: true, createdById: true },
    });

    if (!workshop) {
      return { valid: false, error: 'Workshop not found' };
    }

    // Org boundary only — admins can access any workshop in their org
    if (workshop.organizationId !== userOrganizationId) {
      return { valid: false, error: 'Access denied' };
    }

    return { valid: true, workshop };
  }

  // TENANT_USER: personal ownership — only the workshop creator
  if (userRole === 'TENANT_USER') {
    if (!userOrganizationId || !userId) {
      return { valid: false, error: 'Organization and user ID required' };
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, organizationId: true, createdById: true },
    });

    if (!workshop) {
      return { valid: false, error: 'Workshop not found' };
    }

    // Org boundary
    if (workshop.organizationId !== userOrganizationId) {
      return { valid: false, error: 'Access denied' };
    }

    // Personal ownership
    if (workshop.createdById !== userId) {
      return { valid: false, error: 'Access denied' };
    }

    return { valid: true, workshop };
  }

  return { valid: false, error: 'Invalid user role' };
}

/**
 * Validates that a user can access a participant
 * Enforces organization-level isolation through workshop relationship
 */
export async function validateParticipantAccess(
  participantId: string,
  userOrganizationId: string | null,
  userRole: string
): Promise<WorkshopAccessValidation> {
  const participant = await prisma.workshopParticipant.findUnique({
    where: { id: participantId },
    select: {
      workshopId: true,
      workshop: {
        select: { id: true, organizationId: true },
      },
    },
  });

  if (!participant) {
    return { valid: false, error: 'Participant not found' };
  }

  return validateWorkshopAccess(
    participant.workshopId,
    userOrganizationId,
    userRole
  );
}

/**
 * Extracts user session from request headers/cookies
 * Returns null if no valid session found
 *
 * Note: This should be called AFTER middleware validation
 * Middleware ensures the session is valid and JWT is verified
 */
export function getUserFromSession(sessionCookie: string | undefined): {
  userId: string;
  organizationId: string | null;
  role: string;
} | null {
  if (!sessionCookie) {
    return null;
  }

  try {
    // Session is now a JWT, but we still need to parse it
    // In a real scenario, we'd verify the JWT here
    // For now, we trust the middleware has already verified it
    // and we can safely decode (this is just a helper)

    // Import jwt verification from session.ts in real usage
    // For this helper, we'll assume middleware already validated

    return null; // Placeholder - real implementation would decode JWT
  } catch (error) {
    return null;
  }
}

/**
 * Workshop access validation
 *
 *   PLATFORM_ADMIN  → blocked (GDPR — workshops are tenant-owned data)
 *   TENANT_ADMIN    → only workshops they personally created (same as TENANT_USER)
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
 *   TENANT_ADMIN    → only workshops they personally created
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

  // TENANT_ADMIN and TENANT_USER: personal ownership — only the workshop creator
  if (userRole === 'TENANT_ADMIN' || userRole === 'TENANT_USER') {
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

    // Personal ownership — access is granted to whoever created the workshop
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

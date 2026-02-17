/**
 * Organization-scoped workshop access validation
 * Prevents cross-organization data access
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
 * Validates that a user can access a workshop
 * Enforces organization-level isolation
 *
 * @param workshopId Workshop ID to access
 * @param userOrganizationId User's organization ID (null for platform admins)
 * @param userRole User's role (PLATFORM_ADMIN or TENANT_ADMIN)
 * @returns Validation result with workshop data or error
 */
export async function validateWorkshopAccess(
  workshopId: string,
  userOrganizationId: string | null,
  userRole: string
): Promise<WorkshopAccessValidation> {
  // Platform admins can access all workshops
  if (userRole === 'PLATFORM_ADMIN') {
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, organizationId: true },
    });

    if (!workshop) {
      return { valid: false, error: 'Workshop not found' };
    }

    return { valid: true, workshop };
  }

  // Tenant admins can only access workshops in their organization
  if (userRole === 'TENANT_ADMIN') {
    if (!userOrganizationId) {
      return { valid: false, error: 'Organization ID required for tenant access' };
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, organizationId: true },
    });

    if (!workshop) {
      return { valid: false, error: 'Workshop not found' };
    }

    if (workshop.organizationId !== userOrganizationId) {
      return { valid: false, error: 'Access denied: Workshop belongs to different organization' };
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

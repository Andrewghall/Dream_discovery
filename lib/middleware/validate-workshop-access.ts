/**
 * Workshop access validation
 *
 *   PLATFORM_ADMIN  → can access any workshop (cross-org super-admin)
 *   TENANT_ADMIN    → can access any workshop in their own organisation
 *   TENANT_USER     → can only access workshops they personally created
 */

import { prisma } from '@/lib/prisma';

export interface WorkshopAccessValidation {
  valid: boolean;
  workshop?: {
    id: string;
    organizationId: string;
  };
  error?: string;
  /** True when the accessed workshop is a platform-level example (cross-org, read-only) */
  isExample?: boolean;
}

/**
 * Validates that a user can access a workshop.
 *
 *   PLATFORM_ADMIN  → can access any workshop (cross-org super-admin)
 *   TENANT_ADMIN    → org-scoped: any workshop in their organisation
 *   TENANT_USER     → ownership-scoped: only workshops they created
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
  if (userRole === 'PLATFORM_ADMIN') {
    // Super-admin: universal read access across all organisations
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, organizationId: true, isExample: true },
    });
    if (!workshop) {
      return { valid: false, error: 'Workshop not found' };
    }
    return { valid: true, workshop, isExample: workshop.isExample };
  }

  // ── Example workshop fast-path ─────────────────────────────────────────────
  // isExample workshops are global read-only demo workshops visible to any
  // authenticated user, regardless of organisation.  Writes are blocked at the
  // route level (PATCH returns 403 exampleImmutable).
  const workshopBase = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true, organizationId: true, createdById: true, isExample: true },
  });
  if (!workshopBase) {
    return { valid: false, error: 'Workshop not found' };
  }
  if (workshopBase.isExample) {
    return { valid: true, workshop: workshopBase, isExample: true };
  }

  if (userRole === 'TENANT_ADMIN') {
    // Org-scoped: any workshop within the admin's organisation
    if (!userOrganizationId) {
      return { valid: false, error: 'Organization ID required' };
    }
    if (workshopBase.organizationId !== userOrganizationId) {
      return { valid: false, error: 'Workshop belongs to a different organization' };
    }
    return { valid: true, workshop: workshopBase };
  }

  if (userRole === 'TENANT_USER') {
    // Ownership-scoped: only workshops the user personally created OR shares
    if (!userOrganizationId || !userId) {
      return { valid: false, error: 'Organization and user ID required' };
    }
    if (workshopBase.organizationId !== userOrganizationId) {
      return { valid: false, error: 'Workshop belongs to a different organization' };
    }
    if (workshopBase.createdById !== userId) {
      // Check for explicit share
      const share = await prisma.workshopShare.findUnique({
        where: { workshopId_userId: { workshopId, userId } },
        select: { id: true },
      });
      if (!share) {
        return { valid: false, error: 'You do not own this workshop' };
      }
    }
    return { valid: true, workshop: workshopBase };
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

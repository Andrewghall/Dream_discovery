/**
 * Organization Context Middleware
 *
 * Sets the organization ID in the database session for RLS enforcement
 * CRITICAL: This ensures users can only access data from their organization
 */

import { prisma } from '@/lib/prisma';

export async function setOrganizationContext(organizationId: string) {
  // Set the organization ID in PostgreSQL session variable
  // This is used by RLS policies to filter data
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_org_id = '${organizationId.replace(/'/g, "''")}'`
  );
}

export async function clearOrganizationContext() {
  await prisma.$executeRawUnsafe(`RESET app.current_org_id`);
}

/**
 * Validates that a resource belongs to the specified organization
 * Use this as an additional security layer on top of RLS
 */
export async function validateOrganizationAccess(
  organizationId: string,
  resourceType: 'workshop' | 'user' | 'participant' | 'session',
  resourceId: string
): Promise<boolean> {
  try {
    let resource: any;

    switch (resourceType) {
      case 'workshop':
        resource = await prisma.workshop.findUnique({
          where: { id: resourceId },
          select: { organizationId: true },
        });
        break;

      case 'user':
        resource = await prisma.user.findUnique({
          where: { id: resourceId },
          select: { organizationId: true },
        });
        break;

      case 'participant':
        resource = await prisma.workshopParticipant.findUnique({
          where: { id: resourceId },
          include: { workshop: { select: { organizationId: true } } },
        });
        if (resource) {
          return resource.workshop.organizationId === organizationId;
        }
        break;

      case 'session':
        resource = await prisma.conversationSession.findUnique({
          where: { id: resourceId },
          include: { workshop: { select: { organizationId: true } } },
        });
        if (resource) {
          return resource.workshop.organizationId === organizationId;
        }
        break;
    }

    if (!resource) {
      return false;
    }

    return resource.organizationId === organizationId;
  } catch (error) {
    console.error('Organization validation error:', error);
    return false;
  }
}

/**
 * Get organization ID for a given user email
 * Used during authentication
 */
export async function getOrganizationIdForUser(
  userEmail: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { organizationId: true },
  });

  return user?.organizationId || null;
}

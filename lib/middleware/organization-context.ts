/**
 * Organization Context Middleware
 *
 * ⚠️  DEPRECATED — setOrganizationContext / clearOrganizationContext are NOT
 *     called from any API route.  Prisma connects with the Supabase service-role
 *     key, which bypasses RLS entirely.  Organization isolation is enforced at the
 *     application layer via validateWorkshopAccess() in
 *     lib/middleware/validate-workshop-access.ts.
 *
 *     Do NOT rely on these functions for security.  They are retained only to
 *     avoid breaking imports if any future code references them.
 */

import { prisma } from '@/lib/prisma';

/** @deprecated Not used — Prisma bypasses RLS.  See file header. */
export async function setOrganizationContext(organizationId: string) {
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_org_id = '${organizationId.replace(/'/g, "''")}'`
  );
}

/** @deprecated Not used — Prisma bypasses RLS.  See file header. */
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

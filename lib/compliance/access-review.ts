/**
 * Access Review Helper
 *
 * Generates a least-privilege access review report listing all users
 * with their roles, last login, and organization membership.
 *
 * Flags users who:
 *   - Have not logged in for 90+ days
 *   - Hold the PLATFORM_ADMIN role
 *   - Have no organization assigned
 */

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccessReviewEntry {
  userId: string;
  email: string;
  name: string;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export type AccessReviewFlagType =
  | 'INACTIVE_USER'
  | 'PLATFORM_ADMIN'
  | 'NO_ORGANIZATION';

export interface AccessReviewFlag {
  userId: string;
  email: string;
  flagType: AccessReviewFlagType;
  description: string;
}

export interface AccessReviewReport {
  generatedAt: Date;
  users: AccessReviewEntry[];
  flags: AccessReviewFlag[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INACTIVE_THRESHOLD_DAYS = 90;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generate a least-privilege access review report.
 *
 * Queries all users and produces:
 *   1. A list of every user with role, org, and last login info
 *   2. A list of flags highlighting potential access concerns
 */
export async function generateAccessReview(): Promise<AccessReviewReport> {
  const generatedAt = new Date();

  const users = await prisma.user.findMany({
    include: {
      organization: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const inactiveThreshold = new Date();
  inactiveThreshold.setDate(inactiveThreshold.getDate() - INACTIVE_THRESHOLD_DAYS);

  const entries: AccessReviewEntry[] = [];
  const flags: AccessReviewFlag[] = [];

  for (const user of users) {
    const entry: AccessReviewEntry = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.name ?? null,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
    entries.push(entry);

    // Flag: inactive user (no login in 90+ days)
    if (
      !user.lastLoginAt ||
      user.lastLoginAt < inactiveThreshold
    ) {
      flags.push({
        userId: user.id,
        email: user.email,
        flagType: 'INACTIVE_USER',
        description: user.lastLoginAt
          ? `User has not logged in since ${user.lastLoginAt.toISOString()}`
          : 'User has never logged in',
      });
    }

    // Flag: platform admin
    if (user.role === 'PLATFORM_ADMIN') {
      flags.push({
        userId: user.id,
        email: user.email,
        flagType: 'PLATFORM_ADMIN',
        description: 'User holds PLATFORM_ADMIN role; verify this is still required',
      });
    }

    // Flag: no organization
    if (!user.organizationId) {
      flags.push({
        userId: user.id,
        email: user.email,
        flagType: 'NO_ORGANIZATION',
        description: 'User is not assigned to any organization',
      });
    }
  }

  return {
    generatedAt,
    users: entries,
    flags,
  };
}

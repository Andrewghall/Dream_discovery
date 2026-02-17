/**
 * Extract authenticated user from the unified session cookie in API routes
 */

import { cookies } from 'next/headers';
import { verifySessionToken, type SessionPayload } from './session';

export interface SessionUser {
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
  sessionId: string;
}

async function getUserFromSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return null;
    }

    const payload = await verifySessionToken(sessionCookie.value);

    if (!payload) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
      sessionId: payload.sessionId,
    };
  } catch (error) {
    console.error('Error getting user from session:', error);
    return null;
  }
}

/**
 * Get authenticated user — works for all roles (PLATFORM_ADMIN, TENANT_ADMIN, TENANT_USER)
 */
export async function getAdminUser(): Promise<SessionUser | null> {
  return getUserFromSession();
}

/**
 * @deprecated Use getAdminUser() or getAuthenticatedUser() — all roles now share one cookie
 */
export async function getTenantUser(): Promise<SessionUser | null> {
  return getUserFromSession();
}

/**
 * Get authenticated user from the session cookie
 */
export async function getAuthenticatedUser(): Promise<SessionUser | null> {
  return getUserFromSession();
}

/**
 * Require authenticated user or throw 401
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

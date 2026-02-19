import { NextResponse } from 'next/server';
import { getSession, type SessionPayload } from './session';

/**
 * Require authentication for an API route.
 * Returns the session if valid, or a 401 NextResponse if not.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const session = auth; // SessionPayload
 */
export async function requireAuth(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

/**
 * Require platform admin role.
 * Returns 403 for non-platform-admin users.
 */
export async function requirePlatformAdmin(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return session;
}

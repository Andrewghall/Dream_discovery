/**
 * Secure Session Management with JWT + DB state
 * Uses HMAC-SHA256 signing to prevent tampering.
 * Non-platform-admin sessions are also validated against the DB
 * (exists, not revoked, not expired) so that logout-all / password-reset
 * revocation takes effect immediately.
 */

import * as jose from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export interface SessionPayload {
  sessionId: string;
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
  createdAt: number;
  /** Set when a PLATFORM_ADMIN has entered a tenant workspace via support access. */
  impersonatedBy?: string;
  [key: string]: unknown;
}

// Get secret from environment (32+ character secret)
const getSecret = (): Uint8Array => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
};

/**
 * Create a signed JWT session token
 * @param payload Session data
 * @returns Signed JWT string
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getSecret();

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('dream-discovery')
    .setAudience('admin')
    .setExpirationTime('24h') // 24 hour expiration
    .sign(secret);

  return jwt;
}

/**
 * Verify and decode a JWT session token (signature + expiry only).
 * Does NOT check DB session state. Use verifySessionWithDB() when
 * you need revocation-aware verification.
 * @param token JWT string
 * @returns Decoded session payload or null if invalid
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecret();

    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: 'dream-discovery',
      audience: 'admin',
    });

    return payload as SessionPayload;
  } catch (error) {
    // Token is invalid, expired, or tampered with
    console.error('Session token verification failed:', error);
    return null;
  }
}

/**
 * Verify a JWT AND check DB session state for all roles including PLATFORM_ADMIN.
 *
 * The DB Session row must:
 *   - exist
 *   - not be revoked (revokedAt IS NULL)
 *   - not be expired  (expiresAt > now)
 *
 * @param token JWT string
 * @returns Decoded session payload or null if invalid/revoked/expired
 */
export async function verifySessionWithDB(token: string): Promise<SessionPayload | null> {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Support/impersonation sessions: scoped JWT derived from a valid PLATFORM_ADMIN
  // session — no DB session row exists for these. JWT signature already proves validity.
  if (payload.impersonatedBy) {
    return payload;
  }

  // All roles (including PLATFORM_ADMIN): verify DB session state
  try {
    const dbSession = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!dbSession) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('DB session verification failed — rejecting session to maintain revocation guarantees:', error);
    // Fail closed: return null so revoked/expired sessions are not accepted during DB outages.
    // Trade-off: active users are logged out during outages. Correct security posture.
    return null;
  }
}

/**
 * Check if a session token is expired
 * @param token JWT string
 * @returns true if expired, false otherwise
 */
export async function isSessionExpired(token: string): Promise<boolean> {
  const payload = await verifySessionToken(token);
  return payload === null;
}

/**
 * Get the current session from the request cookies (server-side, App Router only).
 * Reads from the unified 'session' cookie used by all roles.
 * @returns SessionPayload or null if not authenticated
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    // Single unified session cookie -- all roles use the same cookie name
    const sessionCookie = cookieStore.get('session');
    if (sessionCookie?.value) {
      const payload = await verifySessionToken(sessionCookie.value);
      if (payload) return payload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Refresh a session token (create new JWT with same data but extended expiration)
 * @param token Current JWT string
 * @returns New JWT string or null if current token is invalid
 */
export async function refreshSessionToken(token: string): Promise<string | null> {
  const payload = await verifySessionWithDB(token);
  if (!payload) {
    return null;
  }

  // Create new token with same data
  return createSessionToken({
    sessionId: payload.sessionId,
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
    createdAt: payload.createdAt,
  });
}

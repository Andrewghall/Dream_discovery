/**
 * Secure Session Management with JWT
 * Uses HMAC-SHA256 signing to prevent tampering
 */

import * as jose from 'jose';
import { cookies } from 'next/headers';

export interface SessionPayload {
  sessionId: string;
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
  createdAt: number;
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
 * Verify and decode a JWT session token
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
    // Single unified session cookie — all roles use the same cookie name
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
  const payload = await verifySessionToken(token);
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

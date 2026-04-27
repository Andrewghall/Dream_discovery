// MFA challenge-token helpers — extracted from app/api/auth/login/route.ts so
// they can be imported by other routes (e.g. mfa-verify) without breaking
// Next.js' rule that route files only export HTTP method handlers.

import { jwtVerify } from 'jose';

/**
 * Verify a short-lived MFA challenge token issued after a successful password
 * login. Returns the userId if valid, null otherwise.
 */
export async function verifyMfaChallengeToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? process.env.AUTH_SECRET ?? ''
    );
    const { payload } = await jwtVerify(token, secret, {
      audience: 'mfa-challenge',
      issuer: 'dream-discovery',
    });
    return typeof payload.userId === 'string' ? payload.userId : null;
  } catch {
    return null;
  }
}

/**
 * Verify a short-lived MFA enrolment token issued when MFA is required but
 * the user has not yet enrolled. Returns the userId if valid, null otherwise.
 */
export async function verifyMfaEnrolmentToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? process.env.AUTH_SECRET ?? ''
    );
    const { payload } = await jwtVerify(token, secret, {
      audience: 'mfa-enrolment',
      issuer: 'dream-discovery',
    });
    return typeof payload.userId === 'string' ? payload.userId : null;
  } catch {
    return null;
  }
}

/**
 * Shared JWT verification for token-authenticated capture routes.
 *
 * Mobile field capture devices have no admin session — they carry only a
 * signed JWT capture token. This utility validates it and returns the
 * embedded workshopId.
 */

import * as jose from 'jose';

function getCaptureSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('FATAL: SESSION_SECRET or AUTH_SECRET must be set. Refusing to use a fallback secret.');
  }
  return new TextEncoder().encode(secret);
}

export type CaptureTokenPayload =
  | { valid: true; workshopId: string }
  | { valid: false };

export async function verifyCaptureToken(token: string): Promise<CaptureTokenPayload> {
  try {
    const result = await jose.jwtVerify(token, getCaptureSecret(), {
      issuer: 'dream-capture',
      audience: 'mobile-capture',
    });

    const workshopId = result.payload.workshopId as string | undefined;
    if (!workshopId) return { valid: false };

    return { valid: true, workshopId };
  } catch {
    return { valid: false };
  }
}

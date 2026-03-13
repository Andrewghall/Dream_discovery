/**
 * Shared JWT verification for token-authenticated capture routes.
 *
 * Mobile field capture devices have no admin session — they carry only a
 * signed JWT capture token. This utility validates it and returns the
 * embedded workshopId.
 */

import * as jose from 'jose';

const _captureSecret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
if (!_captureSecret) {
  throw new Error(
    '[capture-token-auth] SESSION_SECRET or AUTH_SECRET must be set. ' +
    'Refusing to start with a predictable fallback secret.'
  );
}
const CAPTURE_TOKEN_SECRET = new TextEncoder().encode(_captureSecret);

export type CaptureTokenPayload =
  | { valid: true; workshopId: string }
  | { valid: false };

export async function verifyCaptureToken(token: string): Promise<CaptureTokenPayload> {
  try {
    const result = await jose.jwtVerify(token, CAPTURE_TOKEN_SECRET, {
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

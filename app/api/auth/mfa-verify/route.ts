/**
 * POST /api/auth/mfa-verify
 *
 * Second factor of the two-step login flow.
 * Called after /api/auth/login returns { mfaRequired: true, mfaToken }.
 *
 * Body: { mfaToken: string, totpCode: string }
 *
 * Flow:
 *   1. Verify mfaToken (audience 'mfa-challenge', 5-min expiry, HS256)
 *   2. Load user + encrypted TOTP secret
 *   3. Decrypt secret + verify TOTP code
 *   4. Create full DB-backed session + set cookie
 *   5. Return { success: true, redirectTo: '/admin' }
 *
 * The mfaToken is single-use in practice because it expires in 5 minutes and
 * a successful verify issues a real session immediately. There is no state stored
 * server-side for the challenge — expiry + HMAC integrity is sufficient.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { createSessionToken, type SessionPayload } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { decryptTotpSecret, verifyTotp } from '@/lib/auth/mfa';
import { verifyMfaChallengeToken } from '@/app/api/auth/login/route';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const VerifySchema = z.object({
  mfaToken: z.string().min(1),
  totpCode: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

function getIpAddress(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    ((request as unknown as Record<string, unknown>).ip as string | undefined) ||
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  const ipAddress = getIpAddress(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const rawBody = await request.json().catch(() => null);
  const parsed = VerifySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { mfaToken, totpCode } = parsed.data;

  // Verify challenge token
  const userId = await verifyMfaChallengeToken(mfaToken);
  if (!userId) {
    return NextResponse.json(
      { error: 'MFA challenge expired or invalid. Please log in again.' },
      { status: 401 }
    );
  }

  // Load user with TOTP secret
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Account not found or inactive.' }, { status: 403 });
  }

  if (!user.totpEnabled || !user.totpSecret) {
    return NextResponse.json(
      { error: 'MFA is not enrolled on this account.' },
      { status: 400 }
    );
  }

  // Decrypt and verify TOTP
  let plaintextSecret: string;
  try {
    plaintextSecret = decryptTotpSecret(user.totpSecret);
  } catch {
    console.error('[mfa-verify] Failed to decrypt TOTP secret for user', userId);
    return NextResponse.json(
      { error: 'MFA verification failed. Please contact support.' },
      { status: 500 }
    );
  }

  if (!verifyTotp(totpCode, plaintextSecret)) {
    logAuditEvent({
      organizationId: user.organizationId ?? 'unknown',
      userId: user.id,
      userEmail: user.email,
      action: 'MFA_VERIFY_FAILED',
      resourceType: 'session',
      metadata: { reason: 'invalid_totp' },
      ipAddress,
      userAgent,
      success: false,
    }).catch(err => console.error('[audit] mfa_verify_failed:', err));

    return NextResponse.json(
      { error: 'Invalid authentication code. Please try again.' },
      { status: 401 }
    );
  }

  // TOTP valid - create full session
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sessionPayload: SessionPayload = {
    sessionId: nanoid(),
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: Date.now(),
  };

  const jwt = await createSessionToken(sessionPayload);

  await prisma.session.create({
    data: {
      id: sessionPayload.sessionId,
      userId: user.id,
      token: jwt,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  try {
    const cookieStore = await cookies();
    if (cookieStore && typeof cookieStore.set === 'function') {
      cookieStore.set('session', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
        path: '/',
      });
    }
  } catch {
    // Cookie store may not be available in test contexts
  }

  logAuditEvent({
    organizationId: user.organizationId ?? 'unknown',
    userId: user.id,
    userEmail: user.email,
    action: 'LOGIN_SUCCESS',
    resourceType: 'session',
    metadata: { role: user.role, mfaVerified: true },
    ipAddress,
    userAgent,
    success: true,
  }).catch(err => console.error('[audit] login_mfa_success:', err));

  return NextResponse.json({
    success: true,
    redirectTo: '/admin',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
    },
  });
}

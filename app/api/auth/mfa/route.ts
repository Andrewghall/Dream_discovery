/**
 * MFA (TOTP) Enrolment and Verification API
 *
 * GET  /api/auth/mfa  — Begin enrolment: generate secret, return otpauth:// URI
 * POST /api/auth/mfa  — Complete enrolment: verify first token, activate TOTP
 * DELETE /api/auth/mfa — Remove TOTP from account (PLATFORM_ADMIN only, for support)
 *
 * Two authentication paths:
 *   A. Normal (settings page): requires session cookie
 *   B. Enrolment-during-login: accepts Authorization: Bearer <enrolmentToken>
 *      — issued by /api/auth/login when MFA is required but the user hasn't enrolled
 *      — POST also completes the login (issues session cookie + returns redirectTo)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSessionToken, type SessionPayload } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotp,
  buildTotpUri,
  requiresMfa,
} from '@/lib/auth/mfa';
import { verifyMfaEnrolmentToken } from '@/lib/auth/mfa-challenge';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const VerifyTokenSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Token must be exactly 6 digits'),
  // The unencrypted secret is passed back from the client during enrolment
  // so the server can verify it before persisting. This is safe because
  // the secret is only valid once it's confirmed with a correct TOTP token.
  secret: z.string().min(16).max(64),
  // Optional: present when calling from the enrolment-during-login path.
  enrolmentToken: z.string().optional(),
});

/** Extract enrolment token from Authorization: Bearer header */
function getEnrolmentToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

// ── GET — begin enrolment ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Accept either a session cookie (settings page) or a Bearer enrolment token (login flow)
  const enrolmentBearerToken = getEnrolmentToken(request);
  let userId: string | null = null;

  if (enrolmentBearerToken) {
    userId = await verifyMfaEnrolmentToken(enrolmentBearerToken);
    if (!userId) {
      return NextResponse.json(
        { error: 'Enrolment token expired or invalid. Please log in again.' },
        { status: 401 }
      );
    }
  } else {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.userId || session.userId === 'admin') {
      return NextResponse.json(
        { error: 'TOTP enrolment is not available for environment-variable admin accounts' },
        { status: 400 }
      );
    }
    userId = session.userId;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabled: true },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (user.totpEnabled) {
    return NextResponse.json(
      { error: 'MFA is already enabled. Disable it first before re-enrolling.' },
      { status: 409 }
    );
  }

  // Generate a fresh secret for this enrolment session.
  // The secret is NOT saved yet — only saved after the user verifies their first token (POST).
  const secret = generateTotpSecret();
  const uri = buildTotpUri(secret, user.email);

  return NextResponse.json({ secret, uri });
}

// ── POST — verify first token and activate MFA ────────────────────────────────
export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const rawBody = await request.json().catch(() => null);
  const parsed = VerifyTokenSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { token, secret, enrolmentToken } = parsed.data;

  // Resolve identity: enrolment token (login flow) takes priority over session cookie
  let userId: string | null = null;
  let isEnrolmentPath = false;

  if (enrolmentToken) {
    userId = await verifyMfaEnrolmentToken(enrolmentToken);
    if (!userId) {
      return NextResponse.json(
        { error: 'Enrolment token expired or invalid. Please log in again.' },
        { status: 401 }
      );
    }
    isEnrolmentPath = true;
  } else {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.userId || session.userId === 'admin') {
      return NextResponse.json(
        { error: 'TOTP enrolment is not available for environment-variable admin accounts' },
        { status: 400 }
      );
    }
    userId = session.userId;
  }

  // Verify the TOTP code against the client-held secret before persisting
  if (!verifyTotp(token, secret)) {
    return NextResponse.json(
      { error: 'Invalid token. Check your authenticator app and try again.' },
      { status: 400 }
    );
  }

  // Activate MFA — encrypt and persist the secret
  const encryptedSecret = encryptTotpSecret(secret);
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: encryptedSecret,
      totpEnabled: true,
      totpVerifiedAt: new Date(),
    },
    include: { organization: true },
  });

  // Enrolment-during-login path: TOTP is now active and the code verified,
  // so we can complete the login — issue a full mfaVerified session immediately.
  if (isEnrolmentPath) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const sessionPayload: SessionPayload = {
      sessionId: nanoid(),
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: Date.now(),
      mfaVerified: true,
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
    } catch { /* test context */ }

    logAuditEvent({
      organizationId: user.organizationId ?? 'unknown',
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN_SUCCESS',
      resourceType: 'session',
      metadata: { role: user.role, mfaVerified: true, firstEnrolment: true },
      ipAddress,
      userAgent,
      success: true,
    }).catch(err => console.error('[audit] mfa_enrol_login:', err));

    return NextResponse.json({
      success: true,
      enrolled: true,
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

  return NextResponse.json({ success: true, message: 'MFA has been enabled on your account.' });
}

// ── DELETE — disable MFA (admin override only) ────────────────────────────────
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only PLATFORM_ADMIN can remove MFA from any account.
  // Regular users cannot disable their own MFA via API (prevents social-engineering bypass).
  if (session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json(
      { error: 'Only platform administrators can remove MFA from an account' },
      { status: 403 }
    );
  }

  const { userId } = await request.json().catch(() => ({})) as { userId?: string };
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, totpEnabled: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: null,
      totpEnabled: false,
      totpVerifiedAt: null,
    },
  });

  return NextResponse.json({ success: true, message: 'MFA has been removed from the account.' });
}

// ── PATCH — verify a TOTP challenge during login (called from login flow) ──────
// This is not a separate endpoint — TOTP verification during login is handled
// inline in app/api/auth/login/route.ts once MFA_REQUIRED flag is enabled.
// The verify function is exported from lib/auth/mfa.ts for reuse there.

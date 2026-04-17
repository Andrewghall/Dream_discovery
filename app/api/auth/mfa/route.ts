/**
 * MFA (TOTP) Enrolment and Verification API
 *
 * GET  /api/auth/mfa  — Begin enrolment: generate secret, return otpauth:// URI + QR data
 * POST /api/auth/mfa  — Complete enrolment: verify first token, activate TOTP on account
 * DELETE /api/auth/mfa — Remove TOTP from account (PLATFORM_ADMIN only, for support)
 *
 * Called from the admin settings page during MFA setup flow.
 * Requires an authenticated session. Cannot be used by unauthenticated clients.
 *
 * Flow:
 *   1. User opens Settings > Security > Enable MFA
 *   2. Frontend calls GET /api/auth/mfa → receives { uri, secret } → shows QR code
 *   3. User scans QR code in their authenticator app
 *   4. User enters the 6-digit token from the app
 *   5. Frontend calls POST /api/auth/mfa { token } → server verifies and activates MFA
 *   6. Subsequent logins require a TOTP challenge after password auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotp,
  buildTotpUri,
  requiresMfa,
} from '@/lib/auth/mfa';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const VerifyTokenSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Token must be exactly 6 digits'),
  // The unencrypted secret is passed back from the client during enrolment
  // so the server can verify it before persisting. This is safe because
  // the secret is only valid once it's confirmed with a correct TOTP token.
  secret: z.string().min(16).max(64),
});

// ── GET — begin enrolment ──────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.userId || session.userId === 'admin') {
    return NextResponse.json(
      { error: 'TOTP enrolment is not available for environment-variable admin accounts' },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, totpEnabled: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

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

  return NextResponse.json({
    secret,
    uri,
    // qrDataUrl would normally be generated here using a QR library.
    // For now return the raw URI and let the frontend use a QR library.
    instructions: [
      '1. Open your authenticator app (Google Authenticator, Authy, 1Password, etc.)',
      '2. Scan the QR code or enter the secret manually',
      '3. Enter the 6-digit code from the app to complete enrolment',
    ],
  });
}

// ── POST — verify first token and activate MFA ────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.userId || session.userId === 'admin') {
    return NextResponse.json(
      { error: 'TOTP enrolment is not available for environment-variable admin accounts' },
      { status: 400 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = VerifyTokenSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { token, secret } = parsed.data;

  // Verify the token against the secret before activating MFA
  if (!verifyTotp(token, secret)) {
    return NextResponse.json(
      { error: 'Invalid token. Check your authenticator app and try again.' },
      { status: 400 }
    );
  }

  // Token is valid — encrypt and persist the secret, mark MFA as enabled
  const encryptedSecret = encryptTotpSecret(secret);

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      totpSecret: encryptedSecret,
      totpEnabled: true,
      totpVerifiedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    message: 'MFA has been enabled on your account.',
  });
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

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { authLimiter } from '@/lib/rate-limit';
import { createSessionToken, type SessionPayload } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { isMfaRequired, requiresMfa, decryptTotpSecret, verifyTotp } from '@/lib/auth/mfa';
import { SignJWT, jwtVerify } from 'jose';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

const TENANT_ROLES = ['TENANT_ADMIN', 'TENANT_USER'];

// ── MFA challenge token helpers ───────────────────────────────────────────────
// A short-lived (5 min) JWT issued after password success when TOTP is required.
// Audience 'mfa-challenge' distinguishes it from full session tokens.
// The client must POST it to /api/auth/mfa-verify with the TOTP code to get a
// real session cookie. This prevents a session being issued before MFA is passed.

async function createMfaChallengeToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.SESSION_SECRET ?? process.env.AUTH_SECRET ?? ''
  );
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('mfa-challenge')
    .setIssuer('dream-discovery')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

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
 * Short-lived token (15 min) issued when MFA is required but the user has not
 * enrolled yet. Allows GET /api/auth/mfa (generate secret) and POST /api/auth/mfa
 * (activate + complete login) without a full session cookie.
 */
async function createMfaEnrolmentToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.SESSION_SECRET ?? process.env.AUTH_SECRET ?? ''
  );
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('mfa-enrolment')
    .setIssuer('dream-discovery')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

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

function getIpAddress(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    (request as any).ip ||
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  const ipAddress = getIpAddress(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Rate limit per email address
    const rl = await authLimiter.check(5, `login:${email.toLowerCase().trim()}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': Math.ceil((rl.reset - Date.now()) / 1000).toString() },
        }
      );
    }

    // --- Platform Admin: check env vars, no database needed ---
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminUsername && email.toLowerCase().trim() === adminUsername.toLowerCase()) {
      // ADMIN_PASSWORD must be a bcrypt hash (starts with $2).
      // Plaintext passwords are not accepted - hash with bcrypt before setting the env var.
      const isAdminValid = adminPassword && adminPassword.startsWith('$2')
        ? await bcrypt.compare(password, adminPassword)
        : false;

      if (!isAdminValid) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      // When MFA enforcement is active, the environment-backed admin has no TOTP capability
      // and must not bypass the MFA gate. Block this path entirely and require a DB admin
      // account that can complete TOTP enrolment.
      if (isMfaRequired()) {
        return NextResponse.json(
          {
            error: 'Environment admin access is disabled while MFA enforcement is active. ' +
              'Use a database admin account with MFA enrolled.',
          },
          { status: 403 }
        );
      }

      // Valid admin - create JWT session backed by DB
      const adminExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const sessionPayload: SessionPayload = {
        sessionId: nanoid(),
        userId: 'admin',
        email: adminUsername,
        role: 'PLATFORM_ADMIN',
        organizationId: null,
        createdAt: Date.now(),
      };

      const jwt = await createSessionToken(sessionPayload);

      // DB session MUST be persisted before issuing the JWT.
      // Without a revocable session row, the PLATFORM_ADMIN cannot be logged out
      // via session revocation — defeating the entire revocability guarantee.
      // Fail closed: if the write fails, do NOT set the cookie or return success.
      try {
        await prisma.session.create({
          data: {
            id: sessionPayload.sessionId,
            userId: null,
            token: jwt,
            userAgent,
            ipAddress,
            expiresAt: adminExpiresAt,
          },
        });
      } catch (dbErr) {
        console.error('[login] PLATFORM_ADMIN session persistence failed — login refused:', dbErr);
        return NextResponse.json(
          { error: 'Authentication service error. Please try again.' },
          { status: 500 },
        );
      }

      // Cookie is set only after DB row is confirmed
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

      logAuditEvent({ organizationId: 'platform', action: 'LOGIN_SUCCESS', resourceType: 'session', metadata: { role: 'PLATFORM_ADMIN', email: adminUsername }, ipAddress, userAgent, success: true }).catch(err => console.error('[audit] login:', err));

      return NextResponse.json({ success: true, redirectTo: '/admin', user: { id: 'admin', email: adminUsername, name: 'Admin', role: 'PLATFORM_ADMIN' } });
    }

    // --- Tenant users: look up in database ---
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { organization: true },
    });

    // User not found
    if (!user) {
      await prisma.loginAttempt.create({
        data: {
          email: email.toLowerCase().trim(),
          success: false,
          ipAddress,
          userAgent,
          failureReason: 'User not found',
        },
      });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check if account is locked (lock still active)
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await prisma.loginAttempt.create({
        data: {
          email: email.toLowerCase().trim(),
          success: false,
          ipAddress,
          userAgent,
          failureReason: 'Account locked',
        },
      });
      return NextResponse.json(
        { error: `Account is locked. Try again in ${minutesRemaining} minutes.` },
        { status: 403 }
      );
    }

    // Check if account is inactive
    if (!user.isActive) {
      await prisma.loginAttempt.create({
        data: {
          email: email.toLowerCase().trim(),
          success: false,
          ipAddress,
          userAgent,
          failureReason: 'Account inactive',
        },
      });
      return NextResponse.json(
        { error: 'Account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    if (TENANT_ROLES.includes(user.role) && !user.organizationId) {
      return NextResponse.json(
        { error: 'Your account is not assigned to an organisation. Please contact support.' },
        { status: 403 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const failedCount = user.failedLoginCount + 1;
      const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
            : null,
        },
      });

      await prisma.loginAttempt.create({
        data: {
          email: email.toLowerCase().trim(),
          success: false,
          ipAddress,
          userAgent,
          failureReason: shouldLock ? 'Account locked' : 'Invalid credentials',
        },
      });

      if (shouldLock) {
        logAuditEvent({ organizationId: user.organizationId ?? 'unknown', userId: user.id, userEmail: user.email, action: 'LOGIN_FAILED', resourceType: 'session', metadata: { reason: 'account_locked', failedAttempts: failedCount }, ipAddress, userAgent, success: false }).catch(err => console.error('[audit] login_failed:', err));
        return NextResponse.json(
          { error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.` },
          { status: 401 }
        );
      }

      logAuditEvent({ organizationId: user.organizationId ?? 'unknown', userId: user.id, userEmail: user.email, action: 'LOGIN_FAILED', resourceType: 'session', metadata: { reason: 'invalid_password', failedAttempts: failedCount }, ipAddress, userAgent, success: false }).catch(err => console.error('[audit] login_failed:', err));
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful tenant login - reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // MFA challenge gate
    // When MFA_REQUIRED=true and this role requires MFA, we must not issue a full
    // session until TOTP is verified. Instead issue a short-lived challenge token.
    if (isMfaRequired() && requiresMfa(user.role)) {
      if (!user.totpEnabled) {
        // User hasn't enrolled TOTP yet. Issue a short-lived enrolment token so they
        // can complete setup in this same login flow without needing a full session.
        // The enrolment token is accepted by GET + POST /api/auth/mfa in lieu of a cookie.
        const enrolmentToken = await createMfaEnrolmentToken(user.id);
        logAuditEvent({
          organizationId: user.organizationId ?? 'unknown',
          userId: user.id,
          userEmail: user.email,
          action: 'MFA_CHALLENGE_ISSUED',
          resourceType: 'session',
          metadata: { role: user.role, enrolment: true },
          ipAddress,
          userAgent,
          success: true,
        }).catch(err => console.error('[audit] mfa_enrolment_issued:', err));
        return NextResponse.json({ mfaRequired: true, mfaEnrolmentRequired: true, enrolmentToken });
      }

      // Issue a 5-minute challenge token - no session cookie yet.
      const mfaToken = await createMfaChallengeToken(user.id);
      logAuditEvent({
        organizationId: user.organizationId ?? 'unknown',
        userId: user.id,
        userEmail: user.email,
        action: 'MFA_CHALLENGE_ISSUED',
        resourceType: 'session',
        metadata: { role: user.role },
        ipAddress,
        userAgent,
        success: true,
      }).catch(err => console.error('[audit] mfa_challenge:', err));

      return NextResponse.json({ mfaRequired: true, mfaToken });
    }

    // If user must change password, generate a reset token and redirect there instead of logging in
    if (user.mustChangePassword) {
      const resetToken = nanoid(48);
      await prisma.passwordResetToken.create({
        data: {
          id: nanoid(),
          token: resetToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      return NextResponse.json({
        success: true,
        mustChangePassword: true,
        redirectTo: `/reset-password?token=${resetToken}`,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    }

    // Create JWT session token first
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const sessionPayload: SessionPayload = {
      sessionId: nanoid(),
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: Date.now(),
    };

    const jwt = await createSessionToken(sessionPayload);

    // Create DB-backed session using the JWT as the token
    // so logout-all / password-reset revocation works
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

    const redirectTo = '/admin';

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

    logAuditEvent({ organizationId: user.organizationId ?? 'unknown', userId: user.id, userEmail: user.email, action: 'LOGIN_SUCCESS', resourceType: 'session', metadata: { role: user.role }, ipAddress, userAgent, success: true }).catch(err => console.error('[audit] login:', err));

    return NextResponse.json({
      success: true,
      redirectTo,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organization: user.organization },
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An error occurred during login' }, { status: 500 });
  }
}

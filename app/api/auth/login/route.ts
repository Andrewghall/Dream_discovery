import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { authLimiter } from '@/lib/rate-limit';
import { createSessionToken, type SessionPayload } from '@/lib/auth/session';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

const TENANT_ROLES = ['TENANT_ADMIN', 'TENANT_USER'];

function getIpAddress(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for') ||
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

      // Store session in DB so it can be revoked (e.g. forced logout, security incident)
      // userId is null because PLATFORM_ADMIN has no User table row
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
      } catch {
        // Non-fatal in test environments; production DB must have the migration applied
      }

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
        return NextResponse.json(
          { error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.` },
          { status: 401 }
        );
      }

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful tenant login - reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

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

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

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
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
      // Use bcrypt.compare for admin password — the env var ADMIN_PASSWORD must be a bcrypt hash.
      // Falls back to plain-text comparison if the env value doesn't look like a bcrypt hash (starts with $2).
      const isAdminValid = adminPassword
        ? adminPassword.startsWith('$2')
          ? await bcrypt.compare(password, adminPassword)
          : password === adminPassword
        : false;

      if (!isAdminValid) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      // Valid admin — create JWT session without DB
      const sessionPayload: SessionPayload = {
        sessionId: nanoid(),
        userId: 'admin',
        email: adminUsername,
        role: 'PLATFORM_ADMIN',
        organizationId: null,
        createdAt: Date.now(),
      };

      const jwt = await createSessionToken(sessionPayload);
      const cookieStore = await cookies();
      cookieStore.set('session', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
        path: '/',
      });

      return NextResponse.json({ success: true, redirectTo: '/admin', user: { id: 'admin', email: adminUsername, name: 'Admin', role: 'PLATFORM_ADMIN' } });
    }

    // --- Tenant users: look up in database ---
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { organization: true },
    });

    // Check if account is locked
    if (user?.lockedUntil && new Date() < user.lockedUntil) {
      const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account locked. Try again in ${minutesRemaining} minutes.` },
        { status: 429 }
      );
    }

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
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

      if (shouldLock) {
        return NextResponse.json(
          { error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.` },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Successful tenant login — reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const sessionPayload: SessionPayload = {
      sessionId: nanoid(),
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: Date.now(),
    };

    const jwt = await createSessionToken(sessionPayload);
    const redirectTo = '/admin';

    const cookieStore = await cookies();
    cookieStore.set('session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

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

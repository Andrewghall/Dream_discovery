import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { authLimiter } from '@/lib/rate-limit';
import { createSessionToken, type SessionPayload } from '@/lib/auth/session';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

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

    // Rate limit per email address (not per IP) so one account can't block others
    const rl = await authLimiter.check(5, `tenant-login:${email.toLowerCase().trim()}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': Math.ceil((rl.reset - Date.now()) / 1000).toString() },
        }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { organization: true },
    });

    // Check if account is locked
    if (user?.lockedUntil && new Date() < user.lockedUntil) {
      await logLoginAttempt(user.id, email, ipAddress, userAgent, false, 'Account locked');

      const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account locked. Try again in ${minutesRemaining} minutes.` },
        { status: 429 }
      );
    }

    // Check if user exists and is active
    if (!user || !user.isActive) {
      await logLoginAttempt(null, email, ipAddress, userAgent, false, 'User not found or inactive');
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // CRITICAL: Only allow TENANT_ADMIN and TENANT_USER roles to login here
    if (user.role !== 'TENANT_ADMIN' && user.role !== 'TENANT_USER') {
      await logLoginAttempt(user.id, email, ipAddress, userAgent, false, 'Not a tenant user');
      return NextResponse.json(
        { error: 'Invalid credentials. Please use the platform admin login.' },
        { status: 403 }
      );
    }

    // CRITICAL: Tenant users MUST have an organization
    if (!user.organizationId || !user.organization) {
      await logLoginAttempt(user.id, email, ipAddress, userAgent, false, 'No organization assigned');
      return NextResponse.json(
        { error: 'Your account is not assigned to an organization. Please contact support.' },
        { status: 403 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      // Increment failed login count
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

      await logLoginAttempt(user.id, email, ipAddress, userAgent, false, 'Invalid password');

      if (shouldLock) {
        return NextResponse.json(
          { error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.` },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Successful login - reset failed attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await logLoginAttempt(user.id, email, ipAddress, userAgent, true, null);

    // Create secure session token
    const sessionToken = nanoid(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store session in database
    const session = await prisma.session.create({
      data: {
        id: nanoid(),
        userId: user.id,
        token: sessionToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    const sessionPayload: SessionPayload = {
      sessionId: session.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: Date.now(),
    };

    // Create signed JWT session token
    const jwt = await createSessionToken(sessionPayload);

    // Set cookie with JWT
    const cookieStore = await cookies();
    cookieStore.set('session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
    });
  } catch (error) {
    console.error('Tenant login error:', error);
    await logLoginAttempt(null, 'unknown', ipAddress, userAgent, false, 'Server error');

    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

async function logLoginAttempt(
  userId: string | null,
  email: string,
  ipAddress: string,
  userAgent: string,
  success: boolean,
  failureReason: string | null
) {
  try {
    await prisma.loginAttempt.create({
      data: {
        id: nanoid(),
        userId,
        email: email.toLowerCase().trim(),
        ipAddress,
        userAgent,
        success,
        failureReason,
      },
    });
  } catch (error) {
    console.error('Failed to log login attempt:', error);
  }
}


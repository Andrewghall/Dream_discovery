import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { authLimiter } from '@/lib/rate-limit';
import { createExecSessionToken, type ExecSessionPayload } from '@/lib/auth/exec-session';

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const { email, password } = await request.json() as { email?: string; password?: string };

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit per email
    const rl = await authLimiter.check(5, `exec-login:${normalizedEmail}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now()) / 1000).toString() } }
      );
    }

    const licence = await prisma.execLicence.findUnique({
      where: { email: normalizedEmail },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!licence || !licence.isActive || licence.revokedAt) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, licence.hashedPassword);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Update last login
    await prisma.execLicence.update({
      where: { id: licence.id },
      data: { lastLoginAt: new Date() },
    });

    // Create DB session row
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await prisma.session.create({
      data: {
        id: nanoid(),
        execLicenceId: licence.id,
        token: nanoid(32),
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    const payload: ExecSessionPayload = {
      sessionId: session.id,
      execLicenceId: licence.id,
      execEmail: licence.email,
      execOrgId: licence.organizationId,
      name: licence.name,
      isExec: true,
      createdAt: Date.now(),
    };

    const jwt = await createExecSessionToken(payload);

    const cookieStore = await cookies();
    cookieStore.set('exec-session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      name: licence.name,
      orgName: licence.organization.name,
    });
  } catch (error) {
    console.error('Exec login error:', error);
    return NextResponse.json({ error: 'An error occurred during login' }, { status: 500 });
  }
}

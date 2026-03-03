import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { sendWelcomeEmail } from '@/lib/email/send';
import { sendNewUserAlert } from '@/lib/monitoring/alerts';
import { getSession } from '@/lib/auth/session';

function generateTemporaryPassword(): string {
  const words = ['Dream', 'Discovery', 'Platform', 'Secure', 'Admin', 'Access'];
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(Math.random() * 999);
  const special = '!@#$%^&*'[Math.floor(Math.random() * 8)];
  return `${word1}${word2}${number}${special}`;
}

export async function POST(request: NextRequest) {
  try {
    // --- Auth check ---
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TENANT_USER cannot create users
    if (session.role === 'TENANT_USER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isPlatformAdmin = session.role === 'PLATFORM_ADMIN';
    const isTenantAdmin = session.role === 'TENANT_ADMIN';

    const { email, name, role, organizationId: bodyOrgId } = await request.json();

    // Validation
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Email, name, and role are required' }, { status: 400 });
    }

    // Tenant admins can only create TENANT_ADMIN or TENANT_USER in their own org
    if (isTenantAdmin) {
      if (role === 'PLATFORM_ADMIN') {
        return NextResponse.json({ error: 'You cannot create a Platform Admin' }, { status: 403 });
      }
      if (!session.organizationId) {
        return NextResponse.json({ error: 'No organization associated with your account' }, { status: 403 });
      }
    }

    // Resolve the org to use
    const organizationId = isTenantAdmin
      ? session.organizationId! // always their own org
      : bodyOrgId || null;

    if ((role === 'TENANT_ADMIN' || role === 'TENANT_USER') && !organizationId) {
      return NextResponse.json({ error: 'Organization is required for tenant users' }, { status: 400 });
    }

    // Seat limit check for tenant admins
    if (isTenantAdmin && organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { maxSeats: true },
      });
      const currentCount = await prisma.user.count({
        where: { organizationId },
      });
      if (org && currentCount >= org.maxSeats) {
        return NextResponse.json(
          { error: `Seat limit reached (${currentCount}/${org.maxSeats}). Contact admin@ethenta.com to increase your limit.` },
          { status: 403 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create user with mustChangePassword flag
    const user = await prisma.user.create({
      data: {
        id: nanoid(),
        email: email.toLowerCase().trim(),
        name,
        password: hashedPassword,
        mustChangePassword: true,
        role: role as 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER',
        organizationId: (role === 'TENANT_ADMIN' || role === 'TENANT_USER') ? organizationId : null,
        isActive: true,
      },
      include: { organization: true },
    });

    // Create a password-reset token so the welcome email can link directly to "Set Password"
    const resetToken = nanoid(48);
    await prisma.passwordResetToken.create({
      data: {
        id: nanoid(),
        token: resetToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          id: nanoid(),
          organizationId: organizationId || 'platform',
          userId: session.userId,
          userEmail: session.email,
          action: 'USER_CREATED',
          resourceType: 'User',
          resourceId: user.id,
          method: 'POST',
          path: '/api/admin/users/create',
          metadata: { targetEmail: user.email, targetRole: user.role },
          success: true,
        },
      });
    } catch { /* non-fatal */ }

    // Send welcome email with password-set link
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const loginUrl = `${baseUrl}${role === 'PLATFORM_ADMIN' ? '/login' : '/tenant/login'}`;
      const setPasswordUrl = `${baseUrl}/reset-password?token=${resetToken}`;
      const emailResult = await sendWelcomeEmail({
        to: user.email,
        userName: user.name.split(' ')[0],
        userEmail: user.email,
        loginUrl,
        setPasswordUrl,
        role: user.role,
        organizationName: user.organization?.name,
        maxSeats: user.organization?.maxSeats ?? undefined,
      });
      emailSent = true;
    } catch (err: any) {
      emailError = err?.message || String(err);
      console.error('[create] Failed to send welcome email:', emailError);
    }

    // Alert platform admin
    try {
      await sendNewUserAlert({
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        createdBy: session.email,
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      emailSent,
      emailError,
    });
  } catch (error) {
    console.error('User creation error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

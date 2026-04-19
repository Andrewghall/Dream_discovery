import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email/send';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { CreateOrganisationSchema, zodError } from '@/lib/validation/schemas';

function generateTemporaryPassword(): string {
  const words = ['Dream', 'Discovery', 'Platform', 'Secure', 'Admin', 'Access'];
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(Math.random() * 999);
  const special = '!@#$%^&*'[Math.floor(Math.random() * 8)];
  return `${word1}${word2}${number}${special}`;
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const session = auth;

    // TENANT_USER cannot access organization management
    if (session.role !== 'PLATFORM_ADMIN' && session.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // TENANT_ADMIN can only see their own org
    if (session.role === 'TENANT_ADMIN') {
      if (!session.organizationId) {
        return NextResponse.json({ organizations: [] });
      }
      const organization = await prisma.organization.findUnique({
        where: { id: session.organizationId },
      });
      return NextResponse.json({ organizations: organization ? [organization] : [] });
    }

    // PLATFORM_ADMIN sees all real (non-system) orgs.
    // System orgs are platform-owned (e.g. Jo Air demo org) — they hold
    // example workshops visible to every tenant but are not real tenants
    // and must not appear in this client-facing list.
    // Fallback: if is_system column doesn't exist yet (migration pending),
    // return all orgs rather than silently returning nothing.
    let organizations;
    try {
      organizations = await prisma.organization.findMany({
        where: { isSystem: false },
        orderBy: { name: 'asc' },
      });
    } catch {
      organizations = await prisma.organization.findMany({
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const session = auth;

    if (session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const orgParsed = CreateOrganisationSchema.safeParse(rawBody);
    if (!orgParsed.success) return zodError(orgParsed.error);

    const { name, primaryColor, secondaryColor, maxSeats, billingEmail, adminName } = orgParsed.data;
    // logoUrl not in schema (it's a URL from a file upload flow, validated separately)
    const logoUrl = (rawBody as Record<string, unknown>)?.logoUrl as string | undefined;

    // Create the organisation
    const organization = await prisma.organization.create({
      data: {
        name,
        logoUrl: logoUrl?.trim() || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        maxSeats: maxSeats ?? 5,
        billingEmail: billingEmail || null,
        adminName: adminName || null,
      },
    });

    // Auto-create TENANT_ADMIN user and send welcome email if admin email provided
    let emailSent = false;
    let emailError: string | null = null;
    let adminUser = null;
    let temporaryPassword: string | null = null;

    if (billingEmail) {
      try {
        // Check if user already exists (billingEmail is already lowercase/trimmed by Zod)
        const existing = await prisma.user.findUnique({ where: { email: billingEmail } });

        if (existing) {
          if (existing.organizationId && existing.organizationId !== organization.id) {
            // User already belongs to a different org — do NOT silently reassign
            adminUser = existing;
            emailError = `User ${billingEmail} already belongs to another organisation. Reassign them manually via the Users page if needed.`;
          } else if (!existing.organizationId) {
            // Unlinked user — link them to this new org
            await prisma.user.update({
              where: { id: existing.id },
              data: { organizationId: organization.id, role: 'TENANT_ADMIN' },
            });
            adminUser = existing;
            emailError = 'Existing user linked to this organisation (no email sent — user already has credentials)';
          } else {
            // User already belongs to THIS org — nothing to do
            adminUser = existing;
            emailError = 'User already belongs to this organisation';
          }
        } else {
          // Create new TENANT_ADMIN user
          temporaryPassword = generateTemporaryPassword();
          const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

          adminUser = await prisma.user.create({
            data: {
              id: nanoid(),
              email: billingEmail.trim().toLowerCase(),
              name: adminName?.trim() || name.trim(),
              password: hashedPassword,
              role: 'TENANT_ADMIN',
              organizationId: organization.id,
              isActive: true,
            },
          });

          // Generate a set-password token so the welcome email button goes
          // directly to the reset-password form rather than the login page.
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dream.ethenta.com';
          const setPasswordToken = crypto.randomBytes(32).toString('hex');
          await prisma.passwordResetToken.create({
            data: {
              id: nanoid(),
              userId: adminUser.id,
              token: setPasswordToken,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
          });
          const loginUrl = `${appUrl}/tenant/login`;
          const setPasswordUrl = `${appUrl}/reset-password?token=${setPasswordToken}`;

          console.log('[org/create] Sending welcome email to', billingEmail.trim());
          await sendWelcomeEmail({
            to: billingEmail.trim(),
            userName: (adminName?.trim() || name.trim()).split(' ')[0],
            userEmail: billingEmail.trim(),
            temporaryPassword,
            loginUrl,
            setPasswordUrl,
            role: 'TENANT_ADMIN',
            organizationName: name.trim(),
            maxSeats: maxSeats ?? 5,
          });
          emailSent = true;
          console.log('[org/create] Welcome email sent OK');
        }
      } catch (err: any) {
        emailError = err?.message || String(err);
        console.error('[org/create] Failed to create admin user or send email:', emailError);
      }
    }

    return NextResponse.json({
      organization,
      adminUser: adminUser ? { id: adminUser.id, email: adminUser.email } : null,
      temporaryPassword,
      emailSent,
      emailError,
    });
  } catch (error: any) {
    console.error('Failed to create organization:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ error: error?.message || 'Failed to create organization' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const session = auth;

    // Only PLATFORM_ADMIN or TENANT_ADMIN (for their own org) can update
    if (session.role !== 'PLATFORM_ADMIN' && session.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, name, logoUrl, primaryColor, secondaryColor, maxSeats, billingEmail, adminName } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // TENANT_ADMIN can only update their own org
    if (session.role === 'TENANT_ADMIN' && id !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...(name?.trim() && { name: name.trim() }),
        logoUrl: logoUrl?.trim() || null,
        primaryColor: primaryColor?.trim() || null,
        secondaryColor: secondaryColor?.trim() || null,
        ...(maxSeats !== undefined && { maxSeats: parseInt(maxSeats, 10) }),
        billingEmail: billingEmail?.trim() || null,
        adminName: adminName?.trim() || null,
      },
    });

    return NextResponse.json({ organization });
  } catch (error: any) {
    console.error('Failed to update organization:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ error: error?.message || 'Failed to update organization' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const session = auth;

    if (session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // Hard block: system orgs hold example/demo data and must never be deleted
    const target = await prisma.organization.findUnique({ where: { id }, select: { isSystem: true } });
    if (target?.isSystem) {
      return NextResponse.json({ error: 'System organisations cannot be deleted.' }, { status: 403 });
    }

    // Count related records for the response summary
    const userCount = await prisma.user.count({ where: { organizationId: id } });
    const workshopCount = await prisma.workshop.count({ where: { organizationId: id } });

    // Get all workshop IDs for this org so we can delete children first
    const workshops = await prisma.workshop.findMany({
      where: { organizationId: id },
      select: { id: true },
    });
    const workshopIds = workshops.map(w => w.id);

    // Delete everything in dependency order (explicit: belt-and-suspenders regardless of DB cascade state)
    if (workshopIds.length > 0) {
      // Diagnostic / capture module (Sales)
      const captureSessions = await prisma.captureSession.findMany({
        where: { workshopId: { in: workshopIds } },
        select: { id: true },
      });
      const captureSessionIds = captureSessions.map(cs => cs.id);
      if (captureSessionIds.length > 0) {
        await prisma.captureSegment.deleteMany({ where: { captureSessionId: { in: captureSessionIds } } });
      }
      await prisma.captureSession.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.finding.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.diagnosticSynthesis.deleteMany({ where: { workshopId: { in: workshopIds } } });

      // Core workshop data
      await prisma.workshopScratchpad.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.liveSessionVersion.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.liveWorkshopSnapshot.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.workshopEventOutbox.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.workshopShare.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.discoveryTheme.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.conversationReport.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.conversationInsight.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.conversationSession.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.workshopParticipant.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.dataPoint.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.rawTranscriptEntry.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.workshop.deleteMany({ where: { id: { in: workshopIds } } });
    }

    // Delete org users — get IDs first to avoid nested-filter issues in deleteMany
    if (userCount > 0) {
      const orgUsers = await prisma.user.findMany({
        where: { organizationId: id },
        select: { id: true },
      });
      const orgUserIds = orgUsers.map(u => u.id);
      if (orgUserIds.length > 0) {
        await prisma.session.deleteMany({ where: { userId: { in: orgUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: orgUserIds } } });
      }
    }

    // Delete audit logs for this org
    await prisma.auditLog.deleteMany({ where: { organizationId: id } });

    // Finally delete the org itself
    await prisma.organization.delete({ where: { id } });

    return NextResponse.json({ success: true, removedUsers: userCount, removedWorkshops: workshopCount });
  } catch (error: any) {
    console.error('Failed to delete organization:', error?.message);
    return NextResponse.json({ error: error?.message || 'Failed to delete organization' }, { status: 500 });
  }
}

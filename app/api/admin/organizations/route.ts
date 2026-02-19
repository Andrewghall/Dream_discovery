import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email/send';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

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

    const organizations = await prisma.organization.findMany({
      orderBy: {
        name: 'asc',
      },
    });

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

    const { name, logoUrl, primaryColor, secondaryColor, maxSeats, billingEmail, adminName } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    const seats = maxSeats ? parseInt(maxSeats, 10) : 5;

    // Create the organisation
    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        logoUrl: logoUrl?.trim() || null,
        primaryColor: primaryColor?.trim() || null,
        secondaryColor: secondaryColor?.trim() || null,
        maxSeats: seats,
        billingEmail: billingEmail?.trim() || null,
        adminName: adminName?.trim() || null,
      },
    });

    // Auto-create TENANT_ADMIN user and send welcome email if admin email provided
    let emailSent = false;
    let emailError: string | null = null;
    let adminUser = null;
    let temporaryPassword: string | null = null;

    if (billingEmail?.trim()) {
      try {
        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email: billingEmail.trim().toLowerCase() } });

        if (existing) {
          // Link existing user to this org if unlinked
          if (!existing.organizationId) {
            await prisma.user.update({
              where: { id: existing.id },
              data: { organizationId: organization.id, role: 'TENANT_ADMIN' },
            });
          }
          adminUser = existing;
          emailError = 'User already exists — org linked but no email sent (user already has credentials)';
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

          // Send welcome email with credentials
          const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tenant/login`;
          console.log('[org/create] Sending welcome email to', billingEmail.trim());
          await sendWelcomeEmail({
            to: billingEmail.trim(),
            userName: (adminName?.trim() || name.trim()).split(' ')[0],
            userEmail: billingEmail.trim(),
            temporaryPassword,
            loginUrl,
            role: 'TENANT_ADMIN',
            organizationName: name.trim(),
            maxSeats: seats,
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

    const { id, name, logoUrl, primaryColor, secondaryColor, maxSeats, billingEmail, adminName } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
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

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
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

    // Delete everything in dependency order (children first, then workshops, then org)
    if (workshopIds.length > 0) {
      await prisma.workshopScratchpad.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.liveWorkshopSnapshot.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.discoveryTheme.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.conversationReport.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.conversationInsight.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.conversationSession.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.workshopParticipant.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.dataPoint.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.transcriptChunk.deleteMany({ where: { workshopId: { in: workshopIds } } });
      await prisma.workshop.deleteMany({ where: { id: { in: workshopIds } } });
    }

    // Delete org users (non-platform-admin accounts belong to the org)
    if (userCount > 0) {
      await prisma.session.deleteMany({
        where: { user: { organizationId: id } },
      });
      await prisma.user.deleteMany({
        where: { organizationId: id },
      });
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

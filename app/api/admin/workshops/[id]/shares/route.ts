import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/workshops/[id]/shares
 * List all users this workshop is shared with.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: workshopId } = await context.params;
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const shares = await prisma.workshopShare.findMany({
      where: { workshopId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      shares: shares.map((s) => ({
        id: s.id,
        userId: s.user.id,
        userName: s.user.name,
        userEmail: s.user.email,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching shares:', error);
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 });
  }
}

/**
 * POST /api/admin/workshops/[id]/shares
 * Share a workshop with another user in the same organisation.
 * Body: { email: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: workshopId } = await context.params;
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find the workshop to get the organisation
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { organizationId: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    // Find the target user — must be in the same organisation
    const targetUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        organizationId: workshop.organizationId,
        isActive: true,
      },
      select: { id: true, name: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found in your organisation. They must have an active account.' },
        { status: 404 }
      );
    }

    // Don't share with yourself
    if (targetUser.id === user.userId) {
      return NextResponse.json({ error: 'You already have access to this workshop' }, { status: 400 });
    }

    // Create share (upsert to avoid duplicates)
    const share = await prisma.workshopShare.upsert({
      where: {
        workshopId_userId: { workshopId, userId: targetUser.id },
      },
      update: {},
      create: {
        workshopId,
        userId: targetUser.id,
        sharedById: user.userId,
      },
    });

    return NextResponse.json({
      share: {
        id: share.id,
        userId: targetUser.id,
        userName: targetUser.name,
        userEmail: targetUser.email,
      },
    });
  } catch (error) {
    console.error('Error sharing workshop:', error);
    return NextResponse.json({ error: 'Failed to share workshop' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/workshops/[id]/shares
 * Remove a share. Body: { shareId: string }
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: workshopId } = await context.params;
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const body = await request.json();
    const { shareId } = body;

    if (!shareId) {
      return NextResponse.json({ error: 'shareId is required' }, { status: 400 });
    }

    await prisma.workshopShare.delete({
      where: { id: shareId, workshopId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing share:', error);
    return NextResponse.json({ error: 'Failed to remove share' }, { status: 500 });
  }
}

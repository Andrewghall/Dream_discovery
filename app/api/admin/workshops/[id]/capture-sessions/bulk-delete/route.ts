/**
 * POST /api/admin/workshops/[id]/capture-sessions/bulk-delete
 *
 * Bulk-delete capture sessions and their associated findings.
 * Segments cascade automatically via the Prisma schema (onDelete: Cascade).
 * Findings are explicitly deleted first (schema uses onDelete: SetNull by
 * default, so we do it manually to ensure clean removal from the knowledge base).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const body = await request.json();
    const { sessionIds } = body as { sessionIds: unknown };

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: 'sessionIds must be a non-empty array' }, { status: 400 });
    }

    // Validate all requested sessions belong to this workshop
    const found = await prisma.captureSession.findMany({
      where: { id: { in: sessionIds as string[] }, workshopId },
      select: { id: true },
    });

    if (found.length !== sessionIds.length) {
      return NextResponse.json(
        { error: 'One or more session IDs not found or do not belong to this workshop' },
        { status: 404 }
      );
    }

    // Delete findings first (avoid orphan knowledge data), then sessions
    // (Segments cascade automatically via Prisma onDelete: Cascade)
    await prisma.$transaction([
      prisma.finding.deleteMany({ where: { captureSessionId: { in: sessionIds as string[] } } }),
      prisma.captureSession.deleteMany({ where: { id: { in: sessionIds as string[] } } }),
    ]);

    return NextResponse.json({ deleted: sessionIds.length });
  } catch (error) {
    console.error('Error bulk-deleting capture sessions:', error);
    return NextResponse.json({ error: 'Failed to delete sessions' }, { status: 500 });
  }
}

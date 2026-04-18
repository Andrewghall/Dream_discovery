/**
 * GET    /api/admin/workshops/[id]/findings/[findingId] - Get finding
 * PATCH  /api/admin/workshops/[id]/findings/[findingId] - Update finding
 * DELETE /api/admin/workshops/[id]/findings/[findingId] - Delete finding
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { PatchFindingSchema, zodError } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const { id: workshopId, findingId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const finding = await prisma.finding.findUnique({ where: { id: findingId } });
    if (!finding || finding.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    return NextResponse.json({ finding });
  } catch (error) {
    console.error('Error fetching finding:', error);
    return NextResponse.json({ error: 'Failed to fetch finding' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const { id: workshopId, findingId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const existing = await prisma.finding.findUnique({ where: { id: findingId } });
    if (!existing || existing.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = PatchFindingSchema.safeParse(rawBody);
    if (!parsed.success) return zodError(parsed.error);

    const updateData: Record<string, unknown> = {};
    const body = parsed.data;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.severityScore !== undefined) updateData.severityScore = body.severityScore;
    if (body.confidenceScore !== undefined) updateData.confidenceScore = body.confidenceScore;
    if (body.frequencyCount !== undefined) updateData.frequencyCount = body.frequencyCount;
    if (body.supportingQuotes !== undefined) updateData.supportingQuotes = body.supportingQuotes;
    if (body.isVerified !== undefined) updateData.isVerified = body.isVerified;
    if (body.isFlagged !== undefined) updateData.isFlagged = body.isFlagged;

    const finding = await prisma.finding.update({
      where: { id: findingId },
      data: updateData,
    });

    return NextResponse.json({ finding });
  } catch (error) {
    console.error('Error updating finding:', error);
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const { id: workshopId, findingId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const existing = await prisma.finding.findUnique({ where: { id: findingId } });
    if (!existing || existing.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    await prisma.finding.delete({ where: { id: findingId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting finding:', error);
    return NextResponse.json({ error: 'Failed to delete finding' }, { status: 500 });
  }
}

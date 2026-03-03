/**
 * GET    /api/admin/workshops/[id]/findings/[findingId] - Get finding
 * PATCH  /api/admin/workshops/[id]/findings/[findingId] - Update finding
 * DELETE /api/admin/workshops/[id]/findings/[findingId] - Delete finding
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

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

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.title === 'string') updateData.title = body.title;
    if (typeof body.description === 'string') updateData.description = body.description;
    if (typeof body.severityScore === 'number') updateData.severityScore = body.severityScore;
    if (typeof body.confidenceScore === 'number') updateData.confidenceScore = body.confidenceScore;
    if (typeof body.frequencyCount === 'number') updateData.frequencyCount = body.frequencyCount;
    if (Array.isArray(body.roleCoverage)) updateData.roleCoverage = body.roleCoverage;
    if (typeof body.lens === 'string') updateData.lens = body.lens;
    if (typeof body.type === 'string') updateData.type = body.type;

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

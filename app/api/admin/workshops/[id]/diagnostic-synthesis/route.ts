/**
 * GET  /api/admin/workshops/[id]/diagnostic-synthesis - Get current synthesis
 * POST /api/admin/workshops/[id]/diagnostic-synthesis - Trigger synthesis
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runIncrementalSynthesis, runStreamComparison } from '@/lib/field-discovery/synthesis-engine';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const synthesis = await prisma.diagnosticSynthesis.findUnique({
      where: { workshopId },
    });

    if (!synthesis) {
      return NextResponse.json({ synthesis: null });
    }

    return NextResponse.json({ synthesis });
  } catch (error) {
    console.error('Error fetching diagnostic synthesis:', error);
    return NextResponse.json({ error: 'Failed to fetch diagnostic synthesis' }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    // Run both synthesis operations
    await runIncrementalSynthesis(workshopId);
    await runStreamComparison(workshopId);

    const synthesis = await prisma.diagnosticSynthesis.findUnique({
      where: { workshopId },
    });

    return NextResponse.json({ synthesis });
  } catch (error) {
    console.error('Error running diagnostic synthesis:', error);
    return NextResponse.json({ error: 'Failed to run diagnostic synthesis' }, { status: 500 });
  }
}

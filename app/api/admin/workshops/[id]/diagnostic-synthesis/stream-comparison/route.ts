/**
 * GET /api/admin/workshops/[id]/diagnostic-synthesis/stream-comparison
 *
 * Returns the stream comparison data (Stream A vs Stream B per lens).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

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
      select: { streamComparison: true, version: true, updatedAt: true },
    });

    if (!synthesis || !synthesis.streamComparison) {
      return NextResponse.json({ streamComparison: null });
    }

    return NextResponse.json({
      streamComparison: synthesis.streamComparison,
      version: synthesis.version,
      updatedAt: synthesis.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching stream comparison:', error);
    return NextResponse.json({ error: 'Failed to fetch stream comparison' }, { status: 500 });
  }
}

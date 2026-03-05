import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const dynamic = 'force-dynamic';

function isMissingTable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('live_session_versions') &&
    (msg.includes('does not exist') || msg.includes('42P01') || msg.toLowerCase().includes('relation'))
  );
}

/**
 * GET /api/admin/workshops/[id]/live/session-versions/[versionId]
 * Fetch a single version with full payload (for recall/restore).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: workshopId, versionId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const version = await (prisma as any).liveSessionVersion.findFirst({
      where: { id: versionId, workshopId },
    });

    if (!version) {
      return NextResponse.json({ ok: false, error: 'Version not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, version });
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { ok: false, error: 'Session versions table not yet available.' },
        { status: 409 }
      );
    }
    console.error('Error fetching session version:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch session version' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/workshops/[id]/live/session-versions/[versionId]
 * Update the label (bookmark a version).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: workshopId, versionId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body.label !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing label field' }, { status: 400 });
    }

    const existing = await (prisma as any).liveSessionVersion.findFirst({
      where: { id: versionId, workshopId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Version not found' }, { status: 404 });
    }

    await (prisma as any).liveSessionVersion.update({
      where: { id: versionId },
      data: { label: body.label || null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { ok: false, error: 'Session versions table not yet available.' },
        { status: 409 }
      );
    }
    console.error('Error updating session version label:', error);
    return NextResponse.json({ ok: false, error: 'Failed to update label' }, { status: 500 });
  }
}

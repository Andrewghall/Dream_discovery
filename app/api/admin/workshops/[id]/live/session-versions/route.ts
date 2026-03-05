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
 * GET /api/admin/workshops/[id]/live/session-versions
 * List saved session versions (metadata only, no payload).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

    const [versions, total] = await Promise.all([
      (prisma as any).liveSessionVersion.findMany({
        where: { workshopId },
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          dialoguePhase: true,
          label: true,
          sizeBytes: true,
          createdAt: true,
        },
        take: limit,
      }),
      (prisma as any).liveSessionVersion.count({ where: { workshopId } }),
    ]);

    return NextResponse.json({ ok: true, versions, total });
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { ok: false, error: 'Session versions table not yet available. Apply the migration and redeploy.' },
        { status: 409 }
      );
    }
    console.error('Error listing session versions:', error);
    return NextResponse.json({ ok: false, error: 'Failed to list session versions' }, { status: 500 });
  }
}

/**
 * POST /api/admin/workshops/[id]/live/session-versions
 * Create a new session version. Auto-increments version number.
 * Prunes old versions beyond MAX_VERSIONS_PER_WORKSHOP.
 */
const MAX_VERSIONS_PER_WORKSHOP = 50;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const { dialoguePhase, payload } = body;
    if (!dialoguePhase || !payload) {
      return NextResponse.json({ ok: false, error: 'Missing dialoguePhase or payload' }, { status: 400 });
    }

    // Compute next version number
    const agg = await (prisma as any).liveSessionVersion.aggregate({
      where: { workshopId },
      _max: { version: true },
    });
    const nextVersion = ((agg._max?.version as number) ?? 0) + 1;

    // Measure payload size
    const payloadStr = JSON.stringify(payload);
    const sizeBytes = Buffer.byteLength(payloadStr, 'utf8');

    // Create the version
    const created = await (prisma as any).liveSessionVersion.create({
      data: {
        workshopId,
        version: nextVersion,
        dialoguePhase,
        payload,
        sizeBytes,
      },
      select: { id: true, version: true, createdAt: true },
    });

    // Prune old versions beyond limit
    const count = await (prisma as any).liveSessionVersion.count({ where: { workshopId } });
    if (count > MAX_VERSIONS_PER_WORKSHOP) {
      const excess = count - MAX_VERSIONS_PER_WORKSHOP;
      const oldest = await (prisma as any).liveSessionVersion.findMany({
        where: { workshopId },
        orderBy: { version: 'asc' },
        select: { id: true },
        take: excess,
      });
      if (oldest.length > 0) {
        await (prisma as any).liveSessionVersion.deleteMany({
          where: { id: { in: oldest.map((r: { id: string }) => r.id) } },
        });
      }
    }

    return NextResponse.json({ ok: true, version: created });
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { ok: false, error: 'Session versions table not yet available. Apply the migration and redeploy.' },
        { status: 409 }
      );
    }
    console.error('Error creating session version:', error);
    return NextResponse.json({ ok: false, error: 'Failed to create session version' }, { status: 500 });
  }
}

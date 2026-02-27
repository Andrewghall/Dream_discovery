import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

/**
 * GET /api/workshops/[id]/events/poll?after=<ISO>&types=pad.generated,agent.conversation&limit=100
 *
 * Cursor-based polling endpoint for the event outbox.
 * Returns events newer than `after`, optionally filtered by `types`.
 *
 * This is the durable delivery mechanism for events that originate
 * inside `after()` callbacks on Vercel serverless — where in-memory
 * SSE cannot cross isolate boundaries.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    // ── Auth: prevent unauthenticated access to workshop events ──
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const after = request.nextUrl.searchParams.get('after') || new Date(0).toISOString();
    const typesParam = request.nextUrl.searchParams.get('types') || '';
    const limit = Math.min(200, parseInt(request.nextUrl.searchParams.get('limit') || '100', 10));

    const types = typesParam ? typesParam.split(',').filter(Boolean) : undefined;

    const events = await (prisma as any).workshopEventOutbox.findMany({
      where: {
        workshopId,
        createdAt: { gt: new Date(after) },
        ...(types ? { type: { in: types } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      events: events.map((e: any) => ({
        id: e.id,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[EventPoll] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to poll events',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

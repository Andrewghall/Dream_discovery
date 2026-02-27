import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

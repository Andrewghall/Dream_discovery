import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/cron/outbox-cleanup
 *
 * Deletes WorkshopEventOutbox rows older than 24 hours.
 * Must be called by a cron job with CRON_SECRET auth.
 *
 * Add to vercel.json:
 *   { "path": "/api/cron/outbox-cleanup", "schedule": "0 * * * *" }
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000);

    const result = await (prisma as any).workshopEventOutbox.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      cutoff: cutoff.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OutboxCleanup] Error:', error);
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// This endpoint should be called by a cron job (e.g., Vercel Cron, Railway Cron)
// Or you can call it manually: GET /api/cron/cleanup-sessions

export async function GET() {
  try {
    const now = new Date();

    // Delete expired sessions
    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: now,
            },
          },
          {
            revokedAt: {
              not: null,
            },
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.count} expired/revoked sessions`,
      deletedCount: result.count,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Session cleanup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clean up sessions',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { checkFailedLoginPatterns } from '@/lib/monitoring/alerts';

/**
 * Cron job to check for security issues and send alerts
 *
 * This should be called periodically (every 15 minutes) by:
 * - Vercel Cron (if deployed on Vercel)
 * - External cron service (e.g., cron-job.org)
 * - Manual trigger for testing
 *
 * Authorization: Simple secret token to prevent abuse
 */
export async function GET(request: NextRequest) {
  try {
    // Simple authorization check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET || 'change-me-in-production';

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for failed login patterns
    await checkFailedLoginPatterns();

    return NextResponse.json({
      success: true,
      message: 'Security check completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Security check failed:', error);
    return NextResponse.json(
      {
        error: 'Security check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

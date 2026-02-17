import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Check environment variables
    const checks = {
      database: true,
      env: {
        databaseUrl: !!process.env.DATABASE_URL,
        resendApiKey: !!process.env.RESEND_API_KEY,
        nextPublicAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      },
    };

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

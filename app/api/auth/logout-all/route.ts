import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifySessionToken } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    let userId: string | null = null;

    if (sessionCookie?.value) {
      try {
        const payload = await verifySessionToken(sessionCookie.value);
        userId = payload?.userId ?? null;
      } catch {}
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Revoke all sessions for this user in the database
    await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Clear the session cookie
    cookieStore.delete('session');

    return NextResponse.json({
      success: true,
      message: 'All sessions revoked successfully',
    });
  } catch (error) {
    console.error('Logout all error:', error);
    return NextResponse.json(
      { error: 'Failed to logout from all devices' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const callerSession = await getSession();
    if (!callerSession) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Look up the session to revoke and verify ownership
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Only allow revoking your own sessions, unless you're a PLATFORM_ADMIN
    if (callerSession.role !== 'PLATFORM_ADMIN' && targetSession.userId !== callerSession.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Revoke the session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Session revocation error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}

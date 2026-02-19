import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    const session = await getSession();

    return NextResponse.json({
      hasCookie: !!sessionCookie?.value,
      cookieLength: sessionCookie?.value?.length || 0,
      session: session
        ? {
            role: session.role,
            email: session.email,
            userId: session.userId,
            organizationId: session.organizationId,
            createdAt: session.createdAt,
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
}

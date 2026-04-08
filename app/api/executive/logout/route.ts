import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getExecSession } from '@/lib/auth/exec-session';

export async function POST() {
  try {
    const session = await getExecSession();
    if (session) {
      await prisma.session.updateMany({
        where: { id: session.sessionId },
        data: { revokedAt: new Date() },
      });
    }
  } catch {
    // always clear cookie
  }

  const cookieStore = await cookies();
  cookieStore.delete('exec-session');

  return NextResponse.json({ success: true });
}

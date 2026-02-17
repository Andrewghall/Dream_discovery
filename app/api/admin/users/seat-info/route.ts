import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session || !session.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [org, used] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { maxSeats: true },
    }),
    prisma.user.count({
      where: { organizationId: session.organizationId },
    }),
  ]);

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  return NextResponse.json({ used, max: org.maxSeats });
}

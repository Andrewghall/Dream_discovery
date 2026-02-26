import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { isDeveloperEmail } from '@/lib/auth/is-developer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Look up user name and org logo from DB
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      organization: {
        select: { name: true, logoUrl: true, primaryColor: true },
      },
    },
  });

  return NextResponse.json({
    userId: session.userId,
    email: session.email,
    role: session.role,
    organizationId: session.organizationId,
    name: user?.name || null,
    orgName: user?.organization?.name || null,
    orgLogoUrl: user?.organization?.logoUrl || null,
    orgPrimaryColor: user?.organization?.primaryColor || null,
    isDeveloper: isDeveloperEmail(session.email),
  });
}

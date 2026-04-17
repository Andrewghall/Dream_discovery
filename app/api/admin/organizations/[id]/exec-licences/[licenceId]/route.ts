import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { PatchExecLicenceSchema, zodError } from '@/lib/validation/schemas';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; licenceId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId, licenceId } = await params;
  const rawBody = await request.json().catch(() => null);
  const parsed = PatchExecLicenceSchema.safeParse(rawBody);
  if (!parsed.success) return zodError(parsed.error);
  const { action } = parsed.data;

  const licence = await prisma.execLicence.findFirst({
    where: { id: licenceId, organizationId: orgId },
    select: { id: true },
  });
  if (!licence) return NextResponse.json({ error: 'Licence not found' }, { status: 404 });

  if (action === 'revoke') {
    const now = new Date();
    await prisma.execLicence.update({
      where: { id: licenceId },
      data: { isActive: false, revokedAt: now },
    });
    // Immediately invalidate all live exec sessions for this licence
    await prisma.session.updateMany({
      where: { execLicenceId: licenceId, revokedAt: null },
      data: { revokedAt: now },
    });
  } else {
    await prisma.execLicence.update({
      where: { id: licenceId },
      data: { isActive: true, revokedAt: null },
    });
  }

  return NextResponse.json({ success: true });
}

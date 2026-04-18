import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { SetCommercialPasswordSchema, zodError } from '@/lib/validation/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }
    const rawBody = await request.json().catch(() => null);
    const parsed = SetCommercialPasswordSchema.safeParse(rawBody);
    if (!parsed.success) return zodError(parsed.error);
    const { password } = parsed.data;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update or create scratchpad with commercial password
    const scratchpad = await prisma.workshopScratchpad.upsert({
      where: { workshopId },
      update: {
        commercialPassword: hashedPassword,
        updatedAt: new Date(),
      },
      create: {
        workshopId,
        commercialPassword: hashedPassword,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Commercial password set successfully',
    });
  } catch (error) {
    console.error('Failed to set commercial password:', error);
    return NextResponse.json(
      { error: 'Failed to set commercial password' },
      { status: 500 }
    );
  }
}

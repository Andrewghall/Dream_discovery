import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { CreateExecLicenceSchema, zodError } from '@/lib/validation/schemas';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId } = await params;

  const licences = await prisma.execLicence.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      title: true,
      isActive: true,
      lastLoginAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ licences });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId } = await params;
  const rawBody = await request.json().catch(() => null);
  const licParsed = CreateExecLicenceSchema.safeParse(rawBody);
  if (!licParsed.success) return zodError(licParsed.error);

  const { name, email: normalizedEmail, title } = licParsed.data;

  // Verify org exists
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // Check email not already in use
  const existing = await prisma.execLicence.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: 'A licence with this email already exists' }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  const licence = await prisma.execLicence.create({
    data: {
      id: nanoid(),
      organizationId: orgId,
      email: normalizedEmail,
      hashedPassword,
      name,
      title: title || null,
    },
    select: { id: true, email: true, name: true, title: true, createdAt: true },
  });

  // Return temp password ONCE — never stored in plaintext
  return NextResponse.json({ licence, tempPassword }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // TENANT_ADMIN can only view users in their org; TENANT_USER cannot manage users
  if (session.role === 'TENANT_USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Tenant admins can only see users in their own org
  if (session.role === 'TENANT_ADMIN' && user.organizationId !== session.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.role === 'TENANT_USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { name, email, role, organizationId, isActive } = await request.json();

  // Fetch existing user to check org permissions and log changes
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, organizationId: true, isActive: true },
  });

  if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Tenant admins can only edit users in their own org
  if (session.role === 'TENANT_ADMIN' && existing.organizationId !== session.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Tenant admins cannot promote anyone to PLATFORM_ADMIN
  if (session.role === 'TENANT_ADMIN' && role === 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden: cannot assign PLATFORM_ADMIN role' }, { status: 403 });
  }

  // Check email uniqueness if changing
  if (email && email.toLowerCase().trim() !== existing.email) {
    const conflict = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (conflict) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(email?.trim() && { email: email.toLowerCase().trim() }),
      ...(role && { role }),
      ...(organizationId !== undefined && { organizationId: organizationId || null }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  });

  // Write audit log entry
  try {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (name?.trim() && name.trim() !== existing.name) changes.name = { from: existing.name, to: name.trim() };
    if (email?.trim() && email.toLowerCase().trim() !== existing.email) changes.email = { from: existing.email, to: email.toLowerCase().trim() };
    if (role && role !== existing.role) changes.role = { from: existing.role, to: role };
    if (isActive !== undefined && isActive !== existing.isActive) changes.isActive = { from: existing.isActive, to: isActive };

    await prisma.auditLog.create({
      data: {
        id: nanoid(),
        organizationId: session.organizationId || updatedUser.organizationId || 'platform',
        userId: session.userId,
        userEmail: session.email,
        action: 'USER_UPDATED',
        resourceType: 'User',
        resourceId: id,
        method: 'PATCH',
        path: `/api/admin/users/${id}`,
        metadata: { changes, targetEmail: updatedUser.email } as any,
        success: true,
      },
    });
  } catch (auditErr) {
    console.error('Audit log failed:', auditErr);
    // Don't fail the request if audit logging fails
  }

  return NextResponse.json({ user: updatedUser });
}

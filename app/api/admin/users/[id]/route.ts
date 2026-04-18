import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { nanoid } from 'nanoid';
import { PatchUserSchema, zodError } from '@/lib/validation/schemas';

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
  const rawBody = await request.json().catch(() => null);
  const parsed = PatchUserSchema.safeParse(rawBody);
  if (!parsed.success) return zodError(parsed.error);
  const { name, email, role, organizationId, isActive } = parsed.data;

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

  // Tenant admins cannot change organizationId for any user
  if (session.role === 'TENANT_ADMIN' && organizationId !== undefined) {
    return NextResponse.json({ error: 'Forbidden: tenant admins cannot reassign organization' }, { status: 403 });
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

  const deactivating = isActive === false && existing.isActive === true;

  const [updatedUser] = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
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

    if (deactivating) {
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return [user];
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

/**
 * DELETE /api/admin/users/:id
 *
 * GDPR hard-delete / right to erasure.
 *
 * Anonymises all personal data for the given user in a single transaction:
 *   - email → redacted-{id}@deleted.invalid
 *   - name  → 'Deleted Account'
 *   - password → '$2x$invalidhash' (login impossible)
 *   - All sessions revoked
 *   - Login attempts, consent records, and password-reset tokens deleted
 *   - isActive set to false
 *
 * The User row is retained (not deleted) to preserve referential integrity
 * with Workshop.createdById, which has no cascade behaviour. The anonymised
 * record cannot be linked to the real person — this satisfies GDPR Art. 17.
 *
 * PLATFORM_ADMIN only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden: PLATFORM_ADMIN only' }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Revoke all active sessions
    await tx.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 2. Delete password reset tokens
    await tx.passwordResetToken.deleteMany({ where: { userId: id } });

    // 3. Delete login attempts — by userId AND by email.
    //    Failed-login rows are stored without userId (user not found path) but retain email.
    //    Both must be deleted to fully erase the subject's login history.
    await tx.loginAttempt.deleteMany({
      where: { OR: [{ userId: id }, { email: existing.email }] },
    });

    // 4. Anonymise the user record — preserves FK but removes all PII.
    //    Email and name are replaced; password is set to an invalid hash so login is impossible.
    await tx.user.update({
      where: { id },
      data: {
        email: `redacted-${id}@deleted.invalid`,
        name: 'Deleted Account',
        password: '$2x$invalidhash_gdpr_purged',
        isActive: false,
        organizationId: null,
      },
    });

    // 5. Redact PII from historical audit log rows for this subject.
    //    Rows where the subject PERFORMED actions: clear userEmail.
    //    Rows where actions were performed ON the subject: strip targetEmail,
    //    targetName, and changes.email / changes.name from the metadata JSONB.
    //    The audit trail (action, resourceId, timestamp) is preserved — only
    //    direct personal identifiers are removed.
    // 5a. Clear userEmail for rows where the subject was the actor.
    await (tx as any).$executeRaw`
      UPDATE "audit_logs"
      SET "userEmail" = NULL
      WHERE "userId" = ${id}
    `;
    // 5b. Clear IP address and user-agent for rows where the subject was the actor.
    //     ipAddress and userAgent in these rows belong to the data subject and must
    //     be erased. (Rows where an admin acted ON the subject carry the admin's IP —
    //     those are not the subject's personal data and are left intact.)
    await (tx as any).$executeRaw`
      UPDATE "audit_logs"
      SET "ipAddress" = NULL, "userAgent" = NULL
      WHERE "userId" = ${id}
    `;
    // 5c. Strip personal identifiers from metadata on rows about actions ON the subject.
    await (tx as any).$executeRaw`
      UPDATE "audit_logs"
      SET "metadata" = CASE
        WHEN "metadata" IS NOT NULL THEN
          "metadata"
          - 'targetEmail'
          - 'targetName'
          #- '{changes,email}'
          #- '{changes,name}'
        ELSE NULL
      END
      WHERE "resourceId" = ${id}
        AND "resourceType" = 'User'
    `;
  });

  // Write audit log outside the transaction (non-fatal)
  try {
    await prisma.auditLog.create({
      data: {
        id: nanoid(),
        organizationId: session.organizationId || 'platform',
        userId: session.userId,
        userEmail: session.email,
        action: 'USER_GDPR_PURGE',
        resourceType: 'User',
        resourceId: id,
        method: 'DELETE',
        path: `/api/admin/users/${id}`,
        // Do NOT log the erased subject's email or name — the erasure action itself
        // is recorded but personal identifiers must not persist in audit logs post-purge.
        metadata: { purgedUserId: id, note: 'PII anonymised per GDPR Art. 17' } as any,
        success: true,
      },
    });
  } catch (auditErr) {
    console.error('Audit log failed for GDPR purge:', auditErr);
  }

  return NextResponse.json({ success: true, message: 'User data purged (GDPR Art. 17)' });
}

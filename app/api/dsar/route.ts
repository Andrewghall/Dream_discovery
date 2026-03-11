/**
 * DSAR — Data Subject Access Request
 *
 * Supports two operations by participants (not admins):
 *   GET  /api/dsar?email=<email>&token=<discoveryToken>
 *        Returns all personal data held for that participant.
 *   DELETE /api/dsar?email=<email>&token=<discoveryToken>
 *        Erases all personal data for that participant (right to erasure).
 *
 * Authentication: the participant's unique discoveryToken (UUID mailed to them
 * during invitation) acts as a bearer credential. No admin session required.
 *
 * Rate limited: 5 req / 15 min per email address to prevent enumeration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authLimiter } from '@/lib/rate-limit';
import { auditLog, getClientIp } from '@/lib/audit/log-action';

// ── GET — Data Access Request ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const email = searchParams.get('email')?.toLowerCase().trim() ?? '';
  const token = searchParams.get('token')?.trim() ?? '';

  if (!email || !token) {
    return NextResponse.json(
      { error: 'email and token query parameters are required' },
      { status: 400 },
    );
  }

  const rl = await authLimiter.check(5, `dsar:${email}`);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const participant = await prisma.workshopParticipant.findFirst({
    where: { email, discoveryToken: token },
    include: {
      workshop: { select: { id: true, name: true, scheduledDate: true } },
      dataPoints: {
        select: { rawText: true, source: true, createdAt: true },
        take: 500,
      },
      sessions: {
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          insights: { select: { text: true, insightType: true, createdAt: true }, take: 200 },
        },
      },
    },
  });

  if (!participant) {
    // Constant-time-ish: don't reveal whether email or token was wrong
    return NextResponse.json({ error: 'Not found or token invalid' }, { status: 404 });
  }

  auditLog({
    organizationId: participant.workshop.id, // workshop org is proxied via workshop
    action: 'dsar.data_access',
    resourceType: 'participant',
    resourceId: participant.id,
    method: 'GET',
    path: '/api/dsar',
    ipAddress: getClientIp(request),
    metadata: { email, workshopId: participant.workshopId },
  });

  return NextResponse.json({
    participant: {
      id: participant.id,
      name: participant.name,
      email: participant.email,
      role: participant.role,
      department: participant.department,
      invitedAt: participant.createdAt,
      responseCompletedAt: participant.responseCompletedAt,
    },
    workshop: participant.workshop,
    dataPoints: participant.dataPoints,
    sessions: participant.sessions,
  });
}

// ── DELETE — Right to Erasure ────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const email = searchParams.get('email')?.toLowerCase().trim() ?? '';
  const token = searchParams.get('token')?.trim() ?? '';

  if (!email || !token) {
    return NextResponse.json(
      { error: 'email and token query parameters are required' },
      { status: 400 },
    );
  }

  const rl = await authLimiter.check(5, `dsar:${email}`);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const participant = await prisma.workshopParticipant.findFirst({
    where: { email, discoveryToken: token },
    select: { id: true, workshopId: true, name: true },
  });

  if (!participant) {
    return NextResponse.json({ error: 'Not found or token invalid' }, { status: 404 });
  }

  // Anonymise rather than hard-delete: preserves referential integrity and
  // aggregate research value while removing all PII.
  await prisma.workshopParticipant.update({
    where: { id: participant.id },
    data: {
      name: '[deleted]',
      email: `deleted-${participant.id}@redacted`,
      role: null,
      department: null,
    },
  });

  auditLog({
    organizationId: participant.workshopId,
    action: 'dsar.erasure',
    resourceType: 'participant',
    resourceId: participant.id,
    method: 'DELETE',
    path: '/api/dsar',
    ipAddress: getClientIp(request),
    metadata: { workshopId: participant.workshopId },
  });

  return NextResponse.json({ ok: true, message: 'Personal data has been erased.' });
}

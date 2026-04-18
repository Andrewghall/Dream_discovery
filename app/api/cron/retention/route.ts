/**
 * GET /api/cron/retention
 *
 * Data retention cron job — runs the approved retention schedule for DREAM Discovery.
 *
 * Retention schedule (ISO 27001 A.8.3, GDPR Art.5(1)(e) storage limitation):
 *
 *   | Data type                  | Retention period | Action after expiry      |
 *   |----------------------------|-----------------|--------------------------|
 *   | Login attempt logs         | 90 days          | Hard delete              |
 *   | Expired/revoked sessions   | 0 days           | Hard delete (immediate)  |
 *   | Password reset tokens      | 7 days           | Hard delete              |
 *   | Analytics events           | 730 days (2 yr)  | Hard delete              |
 *   | Audit logs                 | 730 days (2 yr)  | Hard delete              |
 *   | Withdrawn consent records  | 90 days          | Hard delete (withdrawn)  |
 *
 * Workshop data, participant records, transcript chunks, and scratchpad outputs are
 * NOT deleted by this cron job. They are subject to the contractual retention agreed
 * with each tenant organisation and must be deleted via the admin panel or a
 * tenant-specific deletion request following the subject access request (SAR) process.
 *
 * Authorization: Bearer token from CRON_SECRET environment variable.
 * Schedule: Run daily at 02:00 UTC (configure in vercel.json or cron provider).
 *
 * Audit entry: this job writes its own audit record on completion so the log is
 * self-describing and the deletion cannot be confused with a manual bulk delete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Retention periods in milliseconds
const RETENTION = {
  loginAttempts:         90 * 24 * 60 * 60 * 1000, // 90 days
  passwordResetTokens:    7 * 24 * 60 * 60 * 1000, // 7 days
  analyticsEvents:      730 * 24 * 60 * 60 * 1000, // 2 years
  auditLogs:            730 * 24 * 60 * 60 * 1000, // 2 years
  withdrawnConsent:      90 * 24 * 60 * 60 * 1000, // 90 days after withdrawal
} as const;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: Record<string, number> = {};
  const errors: Record<string, string> = {};

  // ── 1. Login attempt logs (90 days) ───────────────────────────────────────
  try {
    const cutoff = new Date(now.getTime() - RETENTION.loginAttempts);
    const deleted = await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    results.loginAttempts = deleted.count;
  } catch (error) {
    errors.loginAttempts = error instanceof Error ? error.message : String(error);
    console.error('[retention] loginAttempts error:', errors.loginAttempts);
  }

  // ── 2. Expired and revoked sessions (immediate) ───────────────────────────
  try {
    const deleted = await prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { not: null } },
        ],
      },
    });
    results.expiredSessions = deleted.count;
  } catch (error) {
    errors.expiredSessions = error instanceof Error ? error.message : String(error);
    console.error('[retention] expiredSessions error:', errors.expiredSessions);
  }

  // ── 3. Used/expired password reset tokens (7 days) ────────────────────────
  try {
    const cutoff = new Date(now.getTime() - RETENTION.passwordResetTokens);
    const deleted = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { usedAt: { not: null, lt: cutoff } },
          { expiresAt: { lt: cutoff } },
        ],
      },
    });
    results.passwordResetTokens = deleted.count;
  } catch (error) {
    errors.passwordResetTokens = error instanceof Error ? error.message : String(error);
    console.error('[retention] passwordResetTokens error:', errors.passwordResetTokens);
  }

  // ── 4. Analytics events (2 years) ─────────────────────────────────────────
  try {
    const cutoff = new Date(now.getTime() - RETENTION.analyticsEvents);
    const deleted = await prisma.analyticsEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    results.analyticsEvents = deleted.count;
  } catch (error) {
    errors.analyticsEvents = error instanceof Error ? error.message : String(error);
    console.error('[retention] analyticsEvents error:', errors.analyticsEvents);
  }

  // ── 5. Audit logs (2 years) ────────────────────────────────────────────────
  // NOTE: Audit logs are normally append-only. This deletion is the ONLY
  // authorised mechanism for removing audit logs, and only when they have
  // exceeded the 2-year retention period. Deletion here is itself audit-logged.
  try {
    const cutoff = new Date(now.getTime() - RETENTION.auditLogs);
    const deleted = await prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    results.auditLogs = deleted.count;
  } catch (error) {
    errors.auditLogs = error instanceof Error ? error.message : String(error);
    console.error('[retention] auditLogs error:', errors.auditLogs);
  }

  // ── 6. Withdrawn consent records (90 days after withdrawal) ───────────────
  try {
    const cutoff = new Date(now.getTime() - RETENTION.withdrawnConsent);
    const deleted = await prisma.consentRecord.deleteMany({
      where: {
        granted: false,
        withdrawnAt: { not: null, lt: cutoff },
      },
    });
    results.withdrawnConsentRecords = deleted.count;
  } catch (error) {
    errors.withdrawnConsentRecords = error instanceof Error ? error.message : String(error);
    console.error('[retention] withdrawnConsentRecords error:', errors.withdrawnConsentRecords);
  }

  // ── Self-audit entry ───────────────────────────────────────────────────────
  // Write a PLATFORM_ADMIN-level audit record so the deletion is traceable.
  try {
    await prisma.auditLog.create({
      data: {
        id: `retention-${now.getTime()}`,
        organizationId: 'PLATFORM',
        userId: null,
        userEmail: 'cron@system',
        action: 'data_retention.purge',
        resourceType: 'retention_job',
        method: 'GET',
        path: '/api/cron/retention',
        success: Object.keys(errors).length === 0,
        metadata: { results, errors, runAt: now.toISOString() },
        timestamp: now,
      },
    });
  } catch (auditError) {
    console.error('[retention] failed to write audit entry:', auditError);
  }

  const hasErrors = Object.keys(errors).length > 0;
  return NextResponse.json(
    {
      success: !hasErrors,
      runAt: now.toISOString(),
      deleted: results,
      ...(hasErrors ? { errors } : {}),
    },
    { status: hasErrors ? 500 : 200 }
  );
}

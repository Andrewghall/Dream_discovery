/**
 * Data Retention Policy Enforcement
 *
 * Scans for data past configurable retention periods and deletes or archives.
 * Retention periods are configurable via environment variables.
 *
 * Default retention periods:
 *   - Audit logs: 7 years
 *   - Conversation sessions: 2 years
 */

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getRetentionYears(envVar: string, defaultYears: number): number {
  const value = process.env[envVar];
  if (value !== undefined) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultYears;
}

function getCutoffDate(years: number): Date {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return cutoff;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetentionResult {
  deletedCounts: {
    auditLogs: number;
    sessions: number;
  };
  dryRun: boolean;
}

export interface RetentionOptions {
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Enforce the data retention policy by scanning for records past their
 * retention period and deleting them (or reporting what would be deleted
 * in dry-run mode).
 *
 * Sessions are only deleted when the session is past the retention window.
 * Orphaned sessions (where participant has been deleted) are also eligible.
 *
 * All deletes happen inside a Prisma transaction for atomicity.
 */
export async function enforceRetentionPolicy(
  options: RetentionOptions = {}
): Promise<RetentionResult> {
  const dryRun = options.dryRun ?? false;

  const auditLogYears = getRetentionYears('RETENTION_AUDIT_LOGS_YEARS', 7);
  const sessionYears = getRetentionYears('RETENTION_SESSIONS_YEARS', 2);

  const auditCutoff = getCutoffDate(auditLogYears);
  const sessionCutoff = getCutoffDate(sessionYears);

  if (dryRun) {
    // Count what would be deleted without actually deleting
    const auditLogCount = await prisma.auditLog.count({
      where: { timestamp: { lt: auditCutoff } },
    });

    // Sessions past retention window
    const sessionCount = await prisma.conversationSession.count({
      where: { createdAt: { lt: sessionCutoff } },
    });

    return {
      deletedCounts: {
        auditLogs: auditLogCount,
        sessions: sessionCount,
      },
      dryRun: true,
    };
  }

  // Execute deletes in a transaction
  const result = await prisma.$transaction(async (tx: any) => {
    // 1. Delete expired audit logs
    const auditResult = await tx.auditLog.deleteMany({
      where: { timestamp: { lt: auditCutoff } },
    });

    // 2. For sessions: find expired ones, delete their messages first, then sessions
    const expiredSessions = await tx.conversationSession.findMany({
      where: { createdAt: { lt: sessionCutoff } },
      select: { id: true },
    });

    let sessionsDeleted = 0;
    if (expiredSessions.length > 0) {
      const sessionIds = expiredSessions.map((s: { id: string }) => s.id);

      // Delete cascade: messages first
      await tx.conversationMessage.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      const sessionResult = await tx.conversationSession.deleteMany({
        where: { id: { in: sessionIds } },
      });

      sessionsDeleted = sessionResult.count;
    }

    return {
      deletedCounts: {
        auditLogs: auditResult.count,
        sessions: sessionsDeleted,
      },
      dryRun: false,
    };
  });

  return result;
}

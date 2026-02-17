/**
 * Audit Logger for GDPR/ISO 27001 Compliance
 *
 * Logs all admin actions for security auditing and compliance
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export type AuditAction =
  | 'CREATE_WORKSHOP'
  | 'UPDATE_WORKSHOP'
  | 'DELETE_WORKSHOP'
  | 'VIEW_WORKSHOP'
  | 'VIEW_PARTICIPANT'
  | 'DELETE_PARTICIPANT'
  | 'VIEW_CONVERSATION'
  | 'EXPORT_DATA'
  | 'DELETE_DATA'
  | 'CREATE_USER'
  | 'DELETE_USER'
  | 'UPDATE_SCRATCHPAD'
  | 'PUBLISH_SCRATCHPAD'
  | 'LOGIN'
  | 'LOGOUT'
  | 'FAILED_LOGIN';

export type AuditResourceType =
  | 'Workshop'
  | 'Participant'
  | 'Session'
  | 'User'
  | 'Scratchpad'
  | 'DataPoint';

export interface AuditLogEntry {
  organizationId: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  method?: string;
  path?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Log an admin action to the audit trail
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  // Only log if audit logging is enabled
  if (process.env.ENABLE_AUDIT_LOGGING !== 'true') {
    return;
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO audit_logs (
        "id",
        "organizationId",
        "userId",
        "userEmail",
        "action",
        "resourceType",
        "resourceId",
        "method",
        "path",
        "ipAddress",
        "userAgent",
        "metadata",
        "timestamp",
        "success",
        "errorMessage"
      ) VALUES (
        ${nanoid()},
        ${entry.organizationId},
        ${entry.userId || null},
        ${entry.userEmail || null},
        ${entry.action},
        ${entry.resourceType || null},
        ${entry.resourceId || null},
        ${entry.method || null},
        ${entry.path || null},
        ${entry.ipAddress || null},
        ${entry.userAgent || null},
        ${entry.metadata ? JSON.stringify(entry.metadata) : null}::jsonb,
        NOW(),
        ${entry.success ?? true},
        ${entry.errorMessage || null}
      )
    `;
  } catch (error) {
    // Don't fail the request if audit logging fails
    // But log to console for monitoring
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Query audit logs for a specific organization
 * Uses parameterized queries to prevent SQL injection
 */
export async function getAuditLogs(
  organizationId: string,
  options?: {
    userId?: string;
    action?: AuditAction;
    resourceType?: AuditResourceType;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  // Use Prisma's findMany with proper typing instead of raw SQL
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  const where: any = {
    organizationId,
  };

  if (options?.userId) {
    where.userId = options.userId;
  }
  if (options?.action) {
    where.action = options.action;
  }
  if (options?.resourceType) {
    where.resourceType = options.resourceType;
  }
  if (options?.resourceId) {
    where.resourceId = options.resourceId;
  }
  if (options?.startDate || options?.endDate) {
    where.timestamp = {};
    if (options.startDate) {
      where.timestamp.gte = options.startDate;
    }
    if (options.endDate) {
      where.timestamp.lte = options.endDate;
    }
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: {
      timestamp: 'desc',
    },
    take: limit,
    skip: offset,
  });
}

/**
 * Get audit log statistics for an organization
 */
export async function getAuditStats(organizationId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.$queryRaw`
    SELECT
      "action",
      COUNT(*) as count,
      COUNT(CASE WHEN "success" = false THEN 1 END) as failed_count
    FROM audit_logs
    WHERE "organizationId" = ${organizationId}
      AND "timestamp" >= ${startDate}
    GROUP BY "action"
    ORDER BY count DESC
  `;
}

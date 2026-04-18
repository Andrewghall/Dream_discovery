/**
 * Audit Logger for GDPR/ISO 27001 Compliance
 *
 * Logs all admin actions for security auditing and compliance.
 * Uses Prisma Client queries (not raw SQL) for type-safe,
 * injection-resistant database access.
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'CREATE_WORKSHOP'
  | 'UPDATE_WORKSHOP'
  | 'DELETE_WORKSHOP'
  | 'CREATE_PARTICIPANT'
  | 'UPDATE_PARTICIPANT'
  | 'DELETE_PARTICIPANT'
  | 'SEND_INVITATION'
  | 'UPLOAD_EVIDENCE'
  | 'DELETE_EVIDENCE'
  | 'UPDATE_OUTPUT'
  | 'PUBLISH_OUTPUT'
  | 'GDPR_EXPORT'
  | 'GDPR_DELETE'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'SYSTEM_EVENT'
  // Legacy action names kept for backward compatibility
  | 'VIEW_WORKSHOP'
  | 'VIEW_PARTICIPANT'
  | 'VIEW_CONVERSATION'
  | 'EXPORT_DATA'
  | 'DELETE_DATA'
  | 'UPDATE_SCRATCHPAD'
  | 'PUBLISH_SCRATCHPAD'
  | 'LOGIN'
  | 'FAILED_LOGIN'
  | 'MFA_CHALLENGE_ISSUED'
  | 'MFA_VERIFY_FAILED';

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
  resourceType?: AuditResourceType | string;
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
 * Log an admin action to the audit trail.
 *
 * Uses prisma.auditLog.create for type-safe parameterised writes.
 * Errors are propagated to the caller so upstream code can handle
 * them appropriately (fail-safe at the route handler level, not here).
 */
export async function logAuditEvent(entry: AuditLogEntry) {
  const record = await prisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: entry.organizationId,
      userId: entry.userId ?? null,
      userEmail: entry.userEmail ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      method: entry.method ?? null,
      path: entry.path ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      metadata: entry.metadata ?? undefined,
      success: entry.success ?? true,
      errorMessage: entry.errorMessage ?? null,
    },
  });

  return record;
}

/**
 * Query audit logs for a specific organization.
 * Uses Prisma findMany with parameterised filters to prevent SQL injection.
 */
export async function getAuditLogs(options: {
  organizationId: string;
  userId?: string;
  action?: AuditAction | string;
  resourceType?: AuditResourceType | string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const where: Record<string, any> = {
    organizationId: options.organizationId,
  };

  if (options.userId !== undefined) {
    where.userId = options.userId;
  }
  if (options.action !== undefined) {
    where.action = options.action;
  }
  if (options.resourceType !== undefined) {
    where.resourceType = options.resourceType;
  }
  if (options.resourceId !== undefined) {
    where.resourceId = options.resourceId;
  }
  if (options.startDate || options.endDate) {
    where.timestamp = {} as Record<string, Date>;
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
 * Get audit log statistics for an organization.
 *
 * Returns total, successful, and failed event counts plus a per-action
 * breakdown. Uses three prisma.auditLog.count calls for the headline
 * numbers and a findMany to derive the action breakdown.
 */
export async function getAuditStatistics(options: {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const baseWhere: Record<string, any> = {
    organizationId: options.organizationId,
  };

  if (options.startDate || options.endDate) {
    baseWhere.timestamp = {} as Record<string, Date>;
    if (options.startDate) {
      baseWhere.timestamp.gte = options.startDate;
    }
    if (options.endDate) {
      baseWhere.timestamp.lte = options.endDate;
    }
  }

  // Three count queries for headline stats
  const totalEvents = await prisma.auditLog.count({
    where: { ...baseWhere },
  });

  const successfulEvents = await prisma.auditLog.count({
    where: { ...baseWhere, success: true },
  });

  const failedEvents = await prisma.auditLog.count({
    where: { ...baseWhere, success: false },
  });

  // Action breakdown from a findMany selecting only the action field
  const logs = (await prisma.auditLog.findMany({
    where: { ...baseWhere },
    select: { action: true },
  })) || [];

  const actionBreakdown: Record<string, number> = {};
  for (const log of logs) {
    const action = (log as any).action as string;
    actionBreakdown[action] = (actionBreakdown[action] || 0) + 1;
  }

  const successRate = totalEvents > 0 ? successfulEvents / totalEvents : 0;

  return {
    totalEvents,
    successfulEvents,
    failedEvents,
    successRate,
    actionBreakdown,
  };
}

// Backward-compatible alias -- some callers may still reference getAuditStats
export const getAuditStats = getAuditStatistics;

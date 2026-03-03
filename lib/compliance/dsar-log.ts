/**
 * DSAR (Data Subject Access Request) Operational Log
 *
 * Tracks GDPR Data Subject Access Requests for compliance reporting.
 * Logs requests to the audit log with a DSAR_ action prefix.
 * Provides SLA compliance reporting against the 30-day GDPR window.
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DSARType = 'export' | 'delete';
export type DSARStatus = 'initiated' | 'completed' | 'failed';

export interface DSARRequestParams {
  type: DSARType;
  email: string;
  workshopId: string;
  status: DSARStatus;
  metadata?: Record<string, unknown>;
}

export interface DSARLogEntry {
  id: string;
  type: string;
  email: string;
  workshopId: string;
  status: string;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
}

export interface DSARQueryOptions {
  email?: string;
  type?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface DSARSLAReport {
  totalRequests: number;
  completedWithinSLA: number;
  completedOutsideSLA: number;
  pending: number;
  slaCompliancePercent: number;
  slaWindowDays: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DSAR_ACTION_PREFIX = 'DSAR_';
const DSAR_SLA_DAYS = 30;
const DSAR_ORG_ID = 'compliance';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Log a GDPR Data Subject Access Request to the audit log.
 */
export async function logDSARRequest(params: DSARRequestParams): Promise<DSARLogEntry> {
  const { type, email, workshopId, status, metadata } = params;

  const action = `${DSAR_ACTION_PREFIX}${type.toUpperCase()}_${status.toUpperCase()}`;

  const record = await prisma.auditLog.create({
    data: {
      id: nanoid(),
      organizationId: DSAR_ORG_ID,
      userEmail: email,
      action,
      resourceType: 'DSAR',
      resourceId: workshopId,
      metadata: {
        dsarType: type,
        dsarStatus: status,
        workshopId,
        ...(metadata ?? {}),
      } as any,
      success: status !== 'failed',
    },
  });

  return {
    id: record.id,
    type,
    email,
    workshopId,
    status,
    timestamp: record.timestamp,
    metadata: record.metadata as Record<string, unknown> | null,
  };
}

/**
 * Retrieve DSAR log entries with optional filters.
 */
export async function getDSARLog(options: DSARQueryOptions = {}): Promise<DSARLogEntry[]> {
  const where: Record<string, unknown> = {
    action: { startsWith: DSAR_ACTION_PREFIX },
  };

  if (options.email) {
    where.userEmail = options.email;
  }

  if (options.type) {
    where.action = {
      startsWith: `${DSAR_ACTION_PREFIX}${options.type.toUpperCase()}`,
    };
  }

  if (options.fromDate || options.toDate) {
    const timestampFilter: Record<string, Date> = {};
    if (options.fromDate) {
      timestampFilter.gte = options.fromDate;
    }
    if (options.toDate) {
      timestampFilter.lte = options.toDate;
    }
    where.timestamp = timestampFilter;
  }

  const records = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
  });

  return records.map((r: {
    id: string;
    action: string;
    userEmail: string | null;
    resourceId: string | null;
    timestamp: Date;
    metadata: unknown;
  }) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return {
      id: r.id,
      type: (meta?.dsarType as string) ?? 'unknown',
      email: r.userEmail ?? '',
      workshopId: r.resourceId ?? '',
      status: (meta?.dsarStatus as string) ?? 'unknown',
      timestamp: r.timestamp,
      metadata: meta,
    };
  });
}

/**
 * Generate an SLA compliance report for DSAR requests.
 *
 * GDPR requires responses within 30 calendar days.
 * This report shows what percentage of requests were fulfilled on time.
 */
export async function getDSARSLAReport(): Promise<DSARSLAReport> {
  // Get all initiation events
  const initiatedRecords = await prisma.auditLog.findMany({
    where: {
      action: { startsWith: DSAR_ACTION_PREFIX },
      metadata: { path: ['dsarStatus'], equals: 'initiated' },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Get all completion events
  const completedRecords = await prisma.auditLog.findMany({
    where: {
      action: { startsWith: DSAR_ACTION_PREFIX },
      metadata: { path: ['dsarStatus'], equals: 'completed' },
    },
    orderBy: { timestamp: 'asc' },
  });

  const totalRequests = initiatedRecords.length;

  if (totalRequests === 0) {
    return {
      totalRequests: 0,
      completedWithinSLA: 0,
      completedOutsideSLA: 0,
      pending: 0,
      slaCompliancePercent: 100,
      slaWindowDays: DSAR_SLA_DAYS,
    };
  }

  // Build a map of email+workshopId to completion time
  const completionMap = new Map<string, Date>();
  for (const rec of completedRecords) {
    const meta = rec.metadata as Record<string, unknown> | null;
    const key = `${rec.userEmail}:${rec.resourceId}`;
    if (!completionMap.has(key)) {
      completionMap.set(key, rec.timestamp);
    }
  }

  let completedWithinSLA = 0;
  let completedOutsideSLA = 0;
  let pending = 0;

  const slaMs = DSAR_SLA_DAYS * 24 * 60 * 60 * 1000;

  for (const initiated of initiatedRecords) {
    const key = `${initiated.userEmail}:${initiated.resourceId}`;
    const completedAt = completionMap.get(key);

    if (!completedAt) {
      pending++;
    } else {
      const elapsed = completedAt.getTime() - initiated.timestamp.getTime();
      if (elapsed <= slaMs) {
        completedWithinSLA++;
      } else {
        completedOutsideSLA++;
      }
    }
  }

  const totalCompleted = completedWithinSLA + completedOutsideSLA;
  const slaCompliancePercent =
    totalCompleted > 0
      ? Math.round((completedWithinSLA / totalCompleted) * 100)
      : totalRequests === pending
        ? 100
        : 0;

  return {
    totalRequests,
    completedWithinSLA,
    completedOutsideSLA,
    pending,
    slaCompliancePercent,
    slaWindowDays: DSAR_SLA_DAYS,
  };
}

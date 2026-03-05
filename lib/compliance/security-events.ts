/**
 * Structured Security Event Logger
 *
 * Logs structured security events with correlation IDs for traceability.
 * Events are output as JSON to console.log and persisted to the audit log
 * with a SECURITY_ action prefix.
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecuritySeverity = 'info' | 'warning' | 'critical';

export interface SecurityEventInput {
  type: string;
  severity: SecuritySeverity;
  actor?: string;
  resource?: string;
  details?: Record<string, unknown>;
}

export interface SecurityEventRecord {
  correlationId: string;
  timestamp: string;
  type: string;
  severity: SecuritySeverity;
  actor: string | null;
  resource: string | null;
  details: Record<string, unknown> | null;
}

export interface SecurityEventQueryOptions {
  type?: string;
  severity?: string;
  fromDate?: Date;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECURITY_ACTION_PREFIX = 'SECURITY_';
const SECURITY_ORG_ID = 'security';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Log a structured security event.
 *
 * 1. Generates a correlation ID (nanoid) for traceability.
 * 2. Outputs the event as structured JSON to console.log.
 * 3. Persists the event to the audit log table.
 */
export async function logSecurityEvent(
  event: SecurityEventInput
): Promise<SecurityEventRecord> {
  const correlationId = nanoid();
  const timestamp = new Date().toISOString();

  const record: SecurityEventRecord = {
    correlationId,
    timestamp,
    type: event.type,
    severity: event.severity,
    actor: event.actor ?? null,
    resource: event.resource ?? null,
    details: event.details ?? null,
  };

  // Output structured JSON to console
  console.log(JSON.stringify(record));

  // Persist to audit log
  await prisma.auditLog.create({
    data: {
      id: correlationId,
      organizationId: SECURITY_ORG_ID,
      userId: event.actor ?? null,
      action: `${SECURITY_ACTION_PREFIX}${event.type}`,
      resourceType: 'SecurityEvent',
      resourceId: event.resource ?? null,
      metadata: {
        severity: event.severity,
        correlationId,
        ...(event.details ?? {}),
      } as any,
      success: true,
    },
  });

  return record;
}

/**
 * Retrieve security events from the audit log with optional filters.
 */
export async function getSecurityEvents(
  options: SecurityEventQueryOptions = {}
): Promise<SecurityEventRecord[]> {
  const where: Record<string, unknown> = {
    action: { startsWith: SECURITY_ACTION_PREFIX },
  };

  if (options.type) {
    where.action = `${SECURITY_ACTION_PREFIX}${options.type}`;
  }

  if (options.severity) {
    where.metadata = { path: ['severity'], equals: options.severity };
  }

  if (options.fromDate) {
    where.timestamp = { gte: options.fromDate };
  }

  const records = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: options.limit ?? 100,
  });

  return records.map((r: {
    id: string;
    action: string;
    userId: string | null;
    resourceId: string | null;
    timestamp: Date;
    metadata: unknown;
  }) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return {
      correlationId: (meta?.correlationId as string) ?? r.id,
      timestamp: r.timestamp.toISOString(),
      type: r.action.replace(SECURITY_ACTION_PREFIX, ''),
      severity: (meta?.severity as SecuritySeverity) ?? 'info',
      actor: r.userId,
      resource: r.resourceId,
      details: meta,
    };
  });
}

/**
 * Audit log helper — fire-and-forget writes to the AuditLog table.
 *
 * Used for GDPR/ISO 27001 compliance. Failures are non-fatal (logged
 * to stderr but never propagate to the caller).
 */

import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';

export interface AuditEntry {
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  method?: string | null;
  path?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  success?: boolean;
  errorMessage?: string | null;
}

/**
 * Write an audit log entry.
 * Fire-and-forget: never throws, never awaited in hot paths.
 */
export function auditLog(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        id: nanoid(),
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
        metadata: entry.metadata ? (entry.metadata as any) : undefined,
        success: entry.success ?? true,
        errorMessage: entry.errorMessage ?? null,
      },
    })
    .catch((err) => {
      console.error('[AuditLog] Write failed (non-fatal):', err);
    });
}

/**
 * Extract IP address from a Next.js request, respecting proxy headers.
 */
export function getClientIp(request: { headers: { get: (h: string) => string | null } }): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  );
}

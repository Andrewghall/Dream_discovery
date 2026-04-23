import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { normalizeRenderDomain } from '@/lib/live/semantic-unit-domain-projection';

export const dynamic = 'force-dynamic';

const DomainEntrySchema = z.object({
  domain: z.string().min(1),
  relevance: z.number().finite().min(0),
  reasoning: z.string().default(''),
});

const SaveDomainFeedbackSchema = z.object({
  renderNodeId: z.string().min(1),
  text: z.string().min(1),
  originalDomains: z.array(DomainEntrySchema),
  correctedDomains: z.array(DomainEntrySchema).min(1),
});

function normalizeDomains(domains: Array<{ domain: string; relevance: number; reasoning: string }>) {
  const sanitized = domains.map((domain) => ({
    domain: normalizeRenderDomain(domain.domain),
    relevance: Math.max(0, domain.relevance),
    reasoning: domain.reasoning ?? '',
  }));
  const total = sanitized.reduce((sum, domain) => sum + domain.relevance, 0);
  if (total <= 0) return sanitized;
  return sanitized.map((domain) => ({
    ...domain,
    relevance: domain.relevance / total,
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: auth.organizationId ?? undefined,
        action: 'SYSTEM_EVENT',
        resourceType: 'workshop',
        resourceId: workshopId,
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
      select: {
        id: true,
        timestamp: true,
        metadata: true,
      },
    });

    const feedback = logs
      .map((log) => {
        const metadata = (log.metadata ?? {}) as Record<string, unknown>;
        if (metadata.kind !== 'DOMAIN_CORRECTION_FEEDBACK') return null;
        const text = typeof metadata.text === 'string' ? metadata.text : '';
        const correctedDomains = Array.isArray(metadata.correctedDomains)
          ? normalizeDomains(metadata.correctedDomains as Array<{ domain: string; relevance: number; reasoning: string }>)
          : [];
        if (!text || correctedDomains.length === 0) return null;
        return {
          id: log.id,
          savedAt: log.timestamp,
          text,
          correctedDomains,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('[domain-feedback:get] Failed to load domain feedback', error);
    return NextResponse.json({ error: 'Failed to load domain feedback' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = SaveDomainFeedbackSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid domain feedback payload' }, { status: 400 });
    }

    const body = parsed.data;
    const originalDomains = normalizeDomains(body.originalDomains);
    const correctedDomains = normalizeDomains(body.correctedDomains);

    await logAuditEvent({
      organizationId: auth.organizationId,
      userId: auth.userId ?? undefined,
      userEmail: auth.email ?? undefined,
      action: 'SYSTEM_EVENT',
      resourceType: 'workshop',
      resourceId: workshopId,
      method: request.method,
      path: request.nextUrl.pathname,
      success: true,
      metadata: {
        kind: 'DOMAIN_CORRECTION_FEEDBACK',
        workshopId,
        renderNodeId: body.renderNodeId,
        text: body.text,
        originalDomains,
        correctedDomains,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[domain-feedback:post] Failed to save domain feedback', error);
    return NextResponse.json({ error: 'Failed to save domain feedback' }, { status: 500 });
  }
}

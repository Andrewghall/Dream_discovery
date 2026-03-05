/**
 * POST /api/admin/workshops/:id/metrics/validate
 *
 * Dry-run validation endpoint. Validates a CSV upload payload against
 * the workshop's domain pack metricReferences without storing anything.
 * Returns validation result (errors/warnings/summary) so the UI can
 * preview before committing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { getDomainPack } from '@/lib/domain-packs/registry';
import { CsvUploadPayloadSchema } from '@/lib/historical-metrics/types';
import { validateAndNormalize } from '@/lib/historical-metrics/validate-csv';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workshopId } = await params;

    // -- Auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(
      workshopId,
      user.organizationId,
      user.role,
      user.userId,
    );
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // -- Load workshop to get domain pack
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { domainPack: true },
    });
    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }
    if (!workshop.domainPack) {
      return NextResponse.json(
        { error: 'Workshop does not have a domain pack assigned. Historical metrics require a domain pack.' },
        { status: 400 },
      );
    }

    // -- Resolve domain pack
    const pack = getDomainPack(workshop.domainPack);
    if (!pack) {
      return NextResponse.json(
        { error: `Domain pack "${workshop.domainPack}" not found in registry` },
        { status: 400 },
      );
    }
    if (!pack.metricReferences || pack.metricReferences.length === 0) {
      return NextResponse.json(
        { error: `Domain pack "${pack.label}" has no metric definitions` },
        { status: 400 },
      );
    }

    // -- Parse request body
    const body = await request.json();
    const payloadResult = CsvUploadPayloadSchema.safeParse(body);
    if (!payloadResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid upload payload',
          issues: payloadResult.error.issues,
        },
        { status: 400 },
      );
    }
    const payload = payloadResult.data;

    // -- Validate and normalize
    const result = validateAndNormalize({
      rows: payload.rows,
      columnMapping: payload.columnMapping,
      periodColumn: payload.periodColumn,
      granularity: payload.granularity,
      metricReferences: pack.metricReferences,
    });

    return NextResponse.json({
      ok: true,
      validation: result,
    });
  } catch (err) {
    console.error('[metrics/validate] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

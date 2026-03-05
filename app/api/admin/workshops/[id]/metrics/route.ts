/**
 * /api/admin/workshops/:id/metrics
 *
 * POST -- Upload validated CSV data and store as historicalMetrics JSON.
 *         Merges with existing data if present. Returns 422 if validation fails.
 * GET  -- Retrieve the current historicalMetrics for the workshop.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { getDomainPack } from '@/lib/domain-packs/registry';
import {
  CsvUploadPayloadSchema,
  readHistoricalMetricsFromJson,
  type HistoricalMetricsData,
  type UploadSource,
} from '@/lib/historical-metrics/types';
import { validateAndNormalize } from '@/lib/historical-metrics/validate-csv';
import { mergeMetricSeries } from '@/lib/historical-metrics/merge-series';

export const dynamic = 'force-dynamic';

// ============================================================
// POST -- Upload + Store
// ============================================================

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

    // -- Load workshop
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        domainPack: true,
        historicalMetrics: true,
      },
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

    if (!result.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Validation failed -- no valid data could be extracted',
          validation: result,
        },
        { status: 422 },
      );
    }

    // -- Build upload source record
    const source: UploadSource = {
      id: nanoid(12),
      filename: payload.filename,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.userId,
      rowCount: payload.rows.length,
      granularity: payload.granularity,
      columnMapping: payload.columnMapping,
    };

    // -- Merge with existing data
    const existing = readHistoricalMetricsFromJson(workshop.historicalMetrics);

    const mergedSeries = existing
      ? mergeMetricSeries(existing.series, result.series)
      : result.series;

    const mergedSources = existing
      ? [...existing.sources, source]
      : [source];

    const historicalMetrics: HistoricalMetricsData = {
      version: 1,
      domainPack: workshop.domainPack,
      sources: mergedSources,
      series: mergedSeries,
      lastUpdatedAt: new Date().toISOString(),
    };

    // -- Persist
    await prisma.workshop.update({
      where: { id: workshopId },
      data: { historicalMetrics: historicalMetrics as any },
    });

    return NextResponse.json({
      ok: true,
      sourceId: source.id,
      validation: result,
      totalSources: mergedSources.length,
      totalMetrics: mergedSeries.length,
    });
  } catch (err) {
    console.error('[metrics/upload] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ============================================================
// GET -- Retrieve
// ============================================================

export async function GET(
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

    // -- Load
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { historicalMetrics: true },
    });
    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    const data = readHistoricalMetricsFromJson(workshop.historicalMetrics);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[metrics/get] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

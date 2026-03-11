/**
 * GET/PATCH /api/admin/workshops/[id]/report-layout
 *
 * Dedicated endpoint for reading and updating just the report layout section
 * of the workshop's reportSummary — without touching other fields.
 *
 * Used by the cross-page "Add to Report" toggle system so any output page
 * can flip a section on/off without needing the full reportSummary loaded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { defaultReportLayout } from '@/lib/output-intelligence/types';
import type { ReportLayout, ReportSummary } from '@/lib/output-intelligence/types';

export const runtime = 'nodejs';

// ── GET — return current layout ────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { reportSummary: true },
  });

  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

  const summary = workshop.reportSummary as ReportSummary | null;
  const layout: ReportLayout = summary?.layout ?? defaultReportLayout();

  return NextResponse.json({ layout });
}

// ── PATCH — merge layout into existing reportSummary ──────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const body = await request.json().catch(() => null) as { layout: ReportLayout } | null;
  if (!body?.layout) {
    return NextResponse.json({ error: 'layout is required' }, { status: 400 });
  }

  // Load existing reportSummary, replace only the layout field
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { reportSummary: true },
  });

  const existing = (workshop?.reportSummary ?? {}) as Partial<ReportSummary>;
  const updated: ReportSummary = { ...existing, layout: body.layout } as ReportSummary;

  await prisma.workshop.update({
    where: { id: workshopId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { reportSummary: updated as any },
  });

  return NextResponse.json({ ok: true });
}

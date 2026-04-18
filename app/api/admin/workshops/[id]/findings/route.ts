/**
 * GET  /api/admin/workshops/[id]/findings - List findings with filters
 * POST /api/admin/workshops/[id]/findings - Create a finding
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import type { FindingType, SourceStream } from '@prisma/client';
import { CreateFindingSchema, zodError } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const url = request.nextUrl;
    const sourceStream = url.searchParams.get('sourceStream') as SourceStream | null;
    const lens = url.searchParams.get('lens');
    const type = url.searchParams.get('type') as FindingType | null;

    const where: Record<string, unknown> = { workshopId };
    if (sourceStream) where.sourceStream = sourceStream;
    if (lens) where.lens = lens;
    if (type) where.type = type;

    const findings = await prisma.finding.findMany({
      where,
      orderBy: [
        { severityScore: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(
      { findings, count: findings.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error listing findings:', error);
    return NextResponse.json({ error: 'Failed to list findings' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const rawBody = await request.json().catch(() => null);
    const parsed = CreateFindingSchema.safeParse(rawBody);
    if (!parsed.success) return zodError(parsed.error);
    const {
      sourceStream, lens, type, title, description,
      severityScore, frequencyCount, roleCoverage,
      supportingQuotes, confidenceScore, captureSessionId,
    } = parsed.data;

    const finding = await prisma.finding.create({
      data: {
        workshopId,
        captureSessionId: captureSessionId ?? null,
        sourceStream: sourceStream as SourceStream,
        lens,
        type: type as FindingType,
        title,
        description,
        severityScore: severityScore ?? null,
        frequencyCount: frequencyCount ?? 1,
        roleCoverage: (roleCoverage ?? []) as unknown as string[],
        supportingQuotes: supportingQuotes as any ?? undefined,
        confidenceScore: confidenceScore ?? null,
      },
    });

    return NextResponse.json({ finding }, { status: 201 });
  } catch (error) {
    console.error('Error creating finding:', error);
    return NextResponse.json({ error: 'Failed to create finding' }, { status: 500 });
  }
}

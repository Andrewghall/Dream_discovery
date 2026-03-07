/**
 * POST /api/admin/workshops/[id]/findings/import-csv
 *
 * Accepts a CSV file upload (multipart/form-data), runs the CSV analysis
 * agent over it, and persists the extracted findings as STREAM_B discoveries.
 *
 * Form fields:
 *   file     - the CSV file (required)
 *   context  - optional plain-text description to help the agent understand
 *              what the data represents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { analyseCsvAndExtractFindings } from '@/lib/field-discovery/csv-analysis-agent';
import { prisma } from '@/lib/prisma';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';

export const dynamic = 'force-dynamic';

// CSV files can be large — allow up to 5 MB
export const maxDuration = 120; // seconds (Vercel Pro limit)

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workshopId } = await params;

    // Auth
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(
      workshopId,
      user.organizationId,
      user.role,
      user.userId,
    );
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const context = (formData.get('context') as string | null) ?? '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 });
    }

    if (file.size > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_CSV_BYTES / 1024 / 1024} MB)` },
        { status: 413 },
      );
    }

    const csvText = await file.text();

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    // Load blueprint lenses for this workshop
    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId }, select: { blueprint: true } });
    const bp = readBlueprintFromJson(workshop?.blueprint);
    const lensNames = bp?.lenses?.map((l) => l.name) ?? [];

    // Run the agent
    const result = await analyseCsvAndExtractFindings({
      workshopId,
      csvText,
      fileName: file.name,
      userContext: context || undefined,
      lensNames,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[import-csv] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyse CSV' },
      { status: 500 },
    );
  }
}

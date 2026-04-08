/**
 * app/api/admin/workshops/[id]/evidence/synthesise/route.ts
 *
 * POST — Run cross-document synthesis across all ready evidence documents.
 *
 * Requires at least 2 ready evidence documents.
 * Persists the result to Workshop.evidenceSynthesis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runCrossDocSynthesis } from '@/lib/evidence/cross-doc-synthesis-agent';
import type { NormalisedEvidenceDocument } from '@/lib/evidence/types';

export const maxDuration = 120;

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

    const rawDocs = await prisma.evidenceDocument.findMany({
      where: { workshopId, status: 'ready' },
    });

    if (rawDocs.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 ready evidence documents for cross-document synthesis.' },
        { status: 400 }
      );
    }

    const docs: NormalisedEvidenceDocument[] = rawDocs.map(d => ({
      id: d.id,
      workshopId: d.workshopId,
      originalFileName: d.originalFileName,
      mimeType: d.mimeType,
      fileSizeBytes: d.fileSizeBytes,
      storageKey: d.storageKey,
      status: d.status as NormalisedEvidenceDocument['status'],
      errorMessage: d.errorMessage ?? undefined,
      sourceCategory: (d.sourceCategory as NormalisedEvidenceDocument['sourceCategory']) ?? 'other',
      summary: d.summary ?? '',
      timeframeFrom: d.timeframeFrom ?? undefined,
      timeframeTo: d.timeframeTo ?? undefined,
      findings: ((d.findings as unknown) as NormalisedEvidenceDocument['findings']) ?? [],
      metrics: ((d.metrics as unknown) as NormalisedEvidenceDocument['metrics']) ?? [],
      excerpts: (d.excerpts as string[]) ?? [],
      signalDirection: (d.signalDirection as NormalisedEvidenceDocument['signalDirection']) ?? 'mixed',
      confidence: d.confidence ?? 0.5,
      relevantLenses: (d.relevantLenses as string[]) ?? [],
      relevantActors: (d.relevantActors as string[]) ?? [],
      relevantJourneyStages: (d.relevantJourneyStages as string[]) ?? [],
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));

    const synthesis = await runCrossDocSynthesis(docs);

    await prisma.workshop.update({
      where: { id: workshopId },
      data: { evidenceSynthesis: synthesis as object },
    });

    return NextResponse.json({ synthesis });
  } catch (err) {
    console.error('[evidence] Synthesis error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Synthesis failed' },
      { status: 500 }
    );
  }
}

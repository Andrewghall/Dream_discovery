/**
 * app/api/admin/workshops/[id]/evidence/cross-validate/route.ts
 *
 * POST — Trigger cross-validation of ALL ready evidence documents
 *        against workshop discovery signals.
 *
 * Can be called:
 *   - After all uploads complete ("Run Cross-Validation" button)
 *   - After synthesis is updated
 *   - Automatically when a new document becomes 'ready'
 *
 * Stores the result in every EvidenceDocument.crossValidation for the workshop
 * (the result is workshop-level, not per-document).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runCrossValidation, buildDiscoverySnapshot } from '@/lib/evidence/cross-validation-agent';
import type { WorkshopDiscoveryFallback } from '@/lib/evidence/cross-validation-agent';
import type { NormalisedEvidenceDocument } from '@/lib/evidence/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;
    // Note: this route is workshop-level (not per-document)
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Fetch workshop + scratchpad for discovery signals.
    // We also fetch discoverAnalysis and themes as a fallback so cross-validation
    // can run after prep/discover synthesis even if OI synthesis hasn't run yet.
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        name: true,
        clientName: true,
        discoverAnalysis: true,
        themes: { select: { themeLabel: true, themeDescription: true } },
        scratchpad: { select: { v2Output: true } },
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    // Fetch all ready evidence documents
    const rawDocs = await prisma.evidenceDocument.findMany({
      where: { workshopId, status: 'ready' },
    });

    if (rawDocs.length === 0) {
      return NextResponse.json({ error: 'No ready evidence documents to validate' }, { status: 400 });
    }

    // Shape docs for the agent
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v2Output = workshop.scratchpad?.v2Output as Record<string, any> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const discoverAnalysis = workshop.discoverAnalysis as Record<string, any> | null;
    const workshopThemes = workshop.themes ?? [];

    // Fail-fast: cross-validation against an empty snapshot produces meaningless results.
    // Accept any non-empty signal from EITHER OI synthesis (v2Output) OR prep/discover synthesis
    // (discoverAnalysis + themes on the workshop record). Users should not need to run full OI
    // synthesis before cross-validating — prep synthesis is sufficient.
    const discover = v2Output?.discover ?? {};
    const constraints = v2Output?.constraints ?? {};
    const hasDiscoveryFromV2 =
      v2Output && (
        (Array.isArray(discover.truths) && discover.truths.length > 0) ||
        (Array.isArray(discover.discoverAnalysis?.alignment?.themes) && discover.discoverAnalysis.alignment.themes.length > 0) ||
        (Array.isArray(discover.discoverAnalysis?.themes) && discover.discoverAnalysis.themes.length > 0) ||
        (Array.isArray(discover.discoveryValidation?.confirmedIssues) && discover.discoveryValidation.confirmedIssues.length > 0) ||
        (Array.isArray(constraints.workshopConstraints) && constraints.workshopConstraints.length > 0) ||
        (Array.isArray(discover.rootCauseIntelligence?.rootCauses) && discover.rootCauseIntelligence.rootCauses.length > 0)
      );
    // Fallback: prep/discover synthesis written to workshop.discoverAnalysis or workshop.themes
    const hasDiscoveryFromFallback =
      (Array.isArray(discoverAnalysis?.alignment?.themes) && discoverAnalysis!.alignment.themes.length > 0) ||
      (Array.isArray(discoverAnalysis?.themes) && discoverAnalysis!.themes.length > 0) ||
      (Array.isArray(discoverAnalysis?.tensions) && discoverAnalysis!.tensions.length > 0) ||
      (Array.isArray(discoverAnalysis?.constraints) && discoverAnalysis!.constraints.length > 0) ||
      workshopThemes.length > 0;

    const hasDiscovery = hasDiscoveryFromV2 || hasDiscoveryFromFallback;

    if (!hasDiscovery) {
      return NextResponse.json(
        { error: 'No discovery findings available for cross-validation. Run discovery synthesis first.' },
        { status: 422 }
      );
    }

    const clientName =
      v2Output?.discover?.discoverAnalysis?.executiveSummary?.clientName ??
      workshop.clientName ??
      workshop.name;

    const fallback: WorkshopDiscoveryFallback = {
      discoverAnalysis,
      themes: workshopThemes,
    };

    const discovery = buildDiscoverySnapshot(workshop.name, clientName, v2Output, fallback);

    // Run cross-validation
    const result = await runCrossValidation(discovery, docs);

    // Persist result to all ready documents for this workshop
    await prisma.evidenceDocument.updateMany({
      where: { workshopId, status: 'ready' },
      data: { crossValidation: result as object },
    });

    return NextResponse.json({ crossValidation: result });
  } catch (err) {
    console.error('[evidence] Cross-validation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cross-validation failed' },
      { status: 500 }
    );
  }
}

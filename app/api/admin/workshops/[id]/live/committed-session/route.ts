import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { splitDeterministicSemanticUnits } from '@/lib/ethentaflow/deterministic-splitter';

export const dynamic = 'force-dynamic';

function toMs(value: bigint | number | null | undefined): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return 0;
}

function toDialoguePhase(value: string | null | undefined): 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null {
  if (value === 'REIMAGINE' || value === 'CONSTRAINTS' || value === 'DEFINE_APPROACH') return value;
  return null;
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

    const rows = await prisma.dataPoint.findMany({
      // Cognitive guidance must only restore genuine live-session hemisphere state.
      // Discovery questionnaire answers are also persisted as MANUAL data points,
      // but they belong to the discovery synthesis path and must not hydrate the
      // live cognitive-guidance hemisphere.
      where: {
        workshopId,
        source: 'SPEECH',
      },
      orderBy: { createdAt: 'asc' },
      include: {
        classification: true,
        annotation: true,
        agenticAnalysis: true,
      },
      take: 500,
    });

    const hemisphereNodes = Object.fromEntries(rows.map((row) => {
      const semanticUnits = splitDeterministicSemanticUnits(row.rawText).units;
      const domains = Array.isArray(row.agenticAnalysis?.domains)
        ? row.agenticAnalysis.domains as Array<{ domain: string; relevance: number; reasoning: string }>
        : [];
      const themes = Array.isArray(row.agenticAnalysis?.themes)
        ? row.agenticAnalysis.themes as Array<{ label: string; category: string; confidence: number; reasoning: string }>
        : [];
      const actors = Array.isArray(row.agenticAnalysis?.actors)
        ? row.agenticAnalysis.actors as Array<{
            name: string;
            role: string;
            interactions: Array<{
              withActor: string;
              action: string;
              sentiment: string;
              context: string;
            }>;
          }>
        : [];

      return [row.id, {
        dataPointId: row.id,
        createdAtMs: row.createdAt.getTime(),
        rawText: row.rawText,
        semanticUnits,
        dataPointSource: String(row.source ?? ''),
        speakerId: row.speakerId ?? null,
        dialoguePhase: toDialoguePhase(row.annotation?.dialoguePhase ?? null),
        intent: row.annotation?.intent ?? null,
        themeId: null,
        themeLabel: null,
        domainLearningSource: null,
        ethentaflowConfidence: null,
        transcriptChunk: {
          speakerId: row.speakerId ?? null,
          startTimeMs: toMs(row.startTimeMs),
          endTimeMs: toMs(row.endTimeMs),
          confidence: null,
          source: String(row.source ?? ''),
        },
        classification: row.classification ? {
          primaryType: row.classification.primaryType,
          confidence: row.classification.confidence ?? 0,
          keywords: row.classification.keywords ?? [],
          suggestedArea: row.classification.suggestedArea ?? null,
          updatedAt: row.classification.updatedAt.toISOString(),
        } : null,
        agenticAnalysis: row.agenticAnalysis ? {
          domains,
          themes,
          actors,
          semanticMeaning: row.agenticAnalysis.semanticMeaning,
          sentimentTone: row.agenticAnalysis.sentimentTone,
          overallConfidence: row.agenticAnalysis.overallConfidence,
        } : null,
      }];
    }));

    return NextResponse.json({
      ok: true,
      hemisphereNodes,
      count: rows.length,
    });
  } catch (error) {
    console.error('[committed-session:get] Failed to restore committed session', error);
    return NextResponse.json({ error: 'Failed to restore committed session' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { synthesizeThemesAgentically } from '@/lib/agents/workshop-analyst-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/workshops/[id]/synthesize
 *
 * Synthesizes all agentic analyses for a workshop into a comprehensive report.
 * This aggregates individual utterance analyses using GPT-4o to create:
 * - Domain-organized themes
 * - Category-organized insights (aspirations, constraints, enablers, opportunities)
 * - Cross-domain patterns
 * - Evidence quotes linked to speakers
 * - Confidence scores and uncertainties
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    console.log('[Workshop Synthesis] Starting synthesis for:', workshopId);

    // 1. Fetch all datapoints with their agentic analyses and transcript chunks
    const dataPoints = await prisma.dataPoint.findMany({
      where: {
        workshopId,
      },
      include: {
        agenticAnalysis: true,
        transcriptChunk: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`[Workshop Synthesis] Found ${dataPoints.length} datapoints`);

    if (dataPoints.length === 0) {
      return NextResponse.json({
        error: 'No datapoints found for this workshop',
      }, { status: 404 });
    }

    // 2. Filter to only datapoints with agentic analysis
    const analyzedDataPoints = dataPoints.filter(dp => dp.agenticAnalysis);

    console.log(`[Workshop Synthesis] ${analyzedDataPoints.length} have agentic analysis`);

    if (analyzedDataPoints.length === 0) {
      return NextResponse.json({
        error: 'No agentic analyses found for this workshop. Ensure analysis has completed.',
      }, { status: 404 });
    }

    // 3. Get workshop context for synthesis
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        name: true,
        description: true,
        businessContext: true,
      },
    });

    if (!workshop) {
      return NextResponse.json({
        error: 'Workshop not found',
      }, { status: 404 });
    }

    // 4. Prepare utterances for synthesis
    const utterances = analyzedDataPoints.map(dp => ({
      id: dp.id,
      text: dp.rawText,
      speaker: dp.speakerId || 'unknown',
      analysis: dp.agenticAnalysis as never,
    }));

    console.log('[Workshop Synthesis] Calling synthesizeThemesAgentically with', utterances.length, 'utterances');

    // 5. Call synthesis function with proper parameters
    const synthesis = await synthesizeThemesAgentically({
      utterances,
      workshopGoal: workshop.businessContext || workshop.description || workshop.name,
      currentPhase: 'REIMAGINE', // Default phase; could be derived from annotations
    });

    console.log('[Workshop Synthesis] Synthesis complete');

    // 5. Store synthesis result in workshop metadata or return it
    // For now, we'll return it. Could cache in database later.

    return NextResponse.json({
      success: true,
      workshopId,
      utteranceCount: utterances.length,
      synthesis,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Workshop Synthesis] Error:', error);

    return NextResponse.json({
      error: 'Failed to synthesize workshop',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

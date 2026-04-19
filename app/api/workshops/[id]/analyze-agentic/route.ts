import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import {
  analyzeUtteranceAgentically,
  AgenticContext,
  AgenticAnalysis,
} from '@/lib/agents/workshop-analyst-agent';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/workshops/[id]/analyze-agentic
 *
 * Runs true agentic analysis on a new utterance using an autonomous AI agent
 * that builds contextual understanding without hardcoded keyword patterns.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const body = (await request.json()) as {
      utteranceId: string;
      text: string;
      speaker: string | null;
      currentPhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';
    };

    if (!body.utteranceId || !body.text) {
      return NextResponse.json(
        { error: 'Missing utteranceId or text' },
        { status: 400 }
      );
    }

    // Get workshop context
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        name: true,
        description: true,
        businessContext: true,
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    // Build agent context from recent raw transcript entries
    const recentTranscripts = await prisma.rawTranscriptEntry.findMany({
      where: { workshopId },
      orderBy: [{ sequence: 'desc' }],
      take: 20,
      select: {
        id: true,
        text: true,
        speakerId: true,
        createdAt: true,
      },
    });

    // Get emerging themes from prior data points
    const existingThemes = await prisma.dataPointClassification.findMany({
      where: {
        dataPoint: { workshopId },
      },
      select: {
        keywords: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Aggregate theme occurrences
    const themeMap = new Map<string, { count: number; lastSeen: Date }>();
    for (const cls of existingThemes) {
      for (const keyword of cls.keywords || []) {
        const existing = themeMap.get(keyword);
        if (!existing || cls.createdAt > existing.lastSeen) {
          themeMap.set(keyword, {
            count: (existing?.count || 0) + 1,
            lastSeen: cls.createdAt,
          });
        }
      }
    }

    const emergingThemes = Array.from(themeMap.entries())
      .filter(([, data]) => data.count >= 2) // Only themes mentioned 2+ times
      .slice(0, 10) // Top 10
      .map(([label, data]) => ({
        label,
        occurrences: data.count,
        lastSeen: data.lastSeen.toISOString(),
      }));

    // Build context for the agent
    const agenticContext: AgenticContext = {
      workshopGoal: workshop.businessContext || workshop.description || workshop.name,
      currentPhase: body.currentPhase,
      recentUtterances: recentTranscripts.reverse().map((t) => ({
        id: t.id,
        speaker: t.speakerId,
        text: t.text,
        // TODO: Retrieve prior agentic analysis from database if exists
      })),
      emergingThemes,
    };

    // Run the agentic analysis
    const analysis: AgenticAnalysis = await analyzeUtteranceAgentically({
      utterance: body.text,
      speaker: body.speaker,
      utteranceId: body.utteranceId,
      context: agenticContext,
    });

    // Store the analysis
    // TODO: Create a new table for agentic analysis results
    // For now, we'll return it and let the caller decide what to do

    return NextResponse.json({
      ok: true,
      analysis,
      metadata: {
        utteranceId: body.utteranceId,
        analyzedAt: new Date().toISOString(),
        agentModel: 'gpt-4o-mini',
        contextUtterances: recentTranscripts.length,
        emergingThemesConsidered: emergingThemes.length,
      },
    });
  } catch (error) {
    console.error('Agentic analysis failed:', error);
    return NextResponse.json(
      {
        error: 'Agentic analysis failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

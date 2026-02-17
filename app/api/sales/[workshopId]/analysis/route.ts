import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { emitSalesEvent } from '@/lib/sales/sales-events';
import type { SalesIntelligence, CoachingPrompt, TopicDetection, PlanCoverageItem } from '@/lib/sales/sales-analysis';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch the latest agentic analysis results for a sales call.
 * The analysis route is now a READER of agentic results (stored by the
 * transcript route's async agentic analysis), not a generator.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { organizationId: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the most recent agentic analyses for this call
    const recentAnalyses = await prisma.agenticAnalysis.findMany({
      where: {
        dataPoint: { workshopId },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        dataPoint: {
          select: { rawText: true, speakerId: true },
        },
      },
    });

    if (recentAnalyses.length === 0) {
      return NextResponse.json({
        intelligence: {
          customerIntent: 'neutral',
          emotionalTone: 'neutral',
          toneTrend: 'stable',
          topicsDetected: [],
          coachingPrompts: [],
          planCoverage: [],
        } as SalesIntelligence,
      });
    }

    // Build a composite SalesIntelligence from the most recent agentic analyses
    const latest = recentAnalyses[0];
    const intelligence = buildIntelligenceFromAgenticResults(recentAnalyses);

    return NextResponse.json({ intelligence });
  } catch (error) {
    console.error('Sales analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

/**
 * POST: Still supported for backward compatibility — triggers a fresh analysis read.
 * The actual agentic analysis happens in the transcript route; this just reads results.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { meetingPlan: true, organizationId: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the most recent agentic analyses
    const recentAnalyses = await prisma.agenticAnalysis.findMany({
      where: {
        dataPoint: { workshopId },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        dataPoint: {
          select: { rawText: true, speakerId: true },
        },
      },
    });

    const intelligence = buildIntelligenceFromAgenticResults(recentAnalyses);

    // Emit the intelligence update via SSE
    emitSalesEvent(workshopId, {
      type: 'intelligence.update',
      payload: intelligence as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ intelligence });
  } catch (error) {
    console.error('Sales analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helper: Build SalesIntelligence from stored agentic analyses
// ---------------------------------------------------------------------------

type AgenticAnalysisRow = {
  id: string;
  semanticMeaning: string;
  speakerIntent: string;
  temporalFocus: string;
  sentimentTone: string;
  domains: unknown;
  themes: unknown;
  connections: unknown;
  overallConfidence: number;
  uncertainties: string[];
  createdAt: Date;
  dataPoint: { rawText: string; speakerId: string | null };
};

function buildIntelligenceFromAgenticResults(
  analyses: AgenticAnalysisRow[]
): SalesIntelligence {
  if (analyses.length === 0) {
    return {
      customerIntent: 'neutral',
      emotionalTone: 'neutral',
      toneTrend: 'stable',
      topicsDetected: [],
      coachingPrompts: [],
      planCoverage: [],
    };
  }

  const latest = analyses[0];
  const domains = Array.isArray(latest.domains) ? latest.domains as Array<{ domain: string; relevance: number; reasoning: string }> : [];
  const themes = Array.isArray(latest.themes) ? latest.themes as Array<{ label: string; category: string; confidence: number; reasoning: string }> : [];

  // Determine customer intent from domains
  const buyingSignal = domains.find(d => d.domain === 'BuyingSignal');
  const objection = domains.find(d => d.domain === 'ObjectionHandling');
  let customerIntent: SalesIntelligence['customerIntent'] = 'neutral';

  if (buyingSignal && buyingSignal.relevance > 0.6) customerIntent = 'ready_to_buy';
  else if (objection && objection.relevance > 0.6) customerIntent = 'objecting';
  else if (latest.sentimentTone === 'positive') customerIntent = 'interested';
  else if (latest.sentimentTone === 'concerned') customerIntent = 'hesitant';
  else if (latest.sentimentTone === 'critical') customerIntent = 'objecting';
  else customerIntent = 'exploring';

  // Determine tone trend from recent analyses
  let toneTrend: SalesIntelligence['toneTrend'] = 'stable';
  if (analyses.length >= 3) {
    const recentTones = analyses.slice(0, 3).map(a => a.sentimentTone);
    const toneScores: Record<string, number> = { positive: 3, neutral: 2, concerned: 1, critical: 0 };
    const scores = recentTones.map(t => toneScores[t] ?? 2);
    if (scores[0] > scores[2]) toneTrend = 'improving';
    else if (scores[0] < scores[2]) toneTrend = 'declining';
  }

  // Build topics from themes across recent analyses
  const topicsDetected: TopicDetection[] = [];
  const seenTopics = new Set<string>();
  for (const analysis of analyses.slice(0, 5)) {
    const analysisThemes = Array.isArray(analysis.themes) ? analysis.themes as Array<{ label: string; category: string; reasoning: string }> : [];
    for (const theme of analysisThemes) {
      if (!seenTopics.has(theme.label)) {
        seenTopics.add(theme.label);
        topicsDetected.push({
          topic: theme.label,
          category: mapCategoryToTopicCategory(theme.category),
          evidence: theme.reasoning,
        });
      }
    }
  }

  // Build coaching prompts from recent analyses that have coaching moments stored
  // (The coaching moments are stored in the domains/themes JSON, not as separate fields)
  const coachingPrompts: CoachingPrompt[] = [];

  // Check if there are uncovered plan items that should generate coaching prompts
  // This is a read-only view, so we just surface what the agent found
  for (const analysis of analyses.slice(0, 3)) {
    const analysisDomains = Array.isArray(analysis.domains) ? analysis.domains as Array<{ domain: string; relevance: number; reasoning: string }> : [];
    for (const domain of analysisDomains) {
      if (domain.domain === 'ObjectionHandling' && domain.relevance > 0.5) {
        coachingPrompts.push({
          id: `cp-${analysis.id}`,
          message: `Objection detected: ${domain.reasoning}`,
          priority: domain.relevance > 0.7 ? 'high' : 'medium',
          source: 'live',
        });
      }
      if (domain.domain === 'BuyingSignal' && domain.relevance > 0.5) {
        coachingPrompts.push({
          id: `cp-bs-${analysis.id}`,
          message: `Buying signal: ${domain.reasoning}`,
          priority: 'high',
          source: 'live',
        });
      }
    }
  }

  // Build plan coverage from all analyses
  const planCoverage: PlanCoverageItem[] = [];
  // Plan coverage items would be accumulated from the analysis metadata
  // The transcript route stores these as part of the agentic analysis

  return {
    customerIntent,
    emotionalTone: latest.sentimentTone as SalesIntelligence['emotionalTone'],
    toneTrend,
    topicsDetected: topicsDetected.slice(0, 10),
    coachingPrompts: coachingPrompts.slice(0, 5),
    planCoverage,
  };
}

function mapCategoryToTopicCategory(
  category: string
): TopicDetection['category'] {
  switch (category) {
    case 'aspiration': return 'needs';
    case 'constraint': return 'objection';
    case 'enabler': return 'buying_signal';
    case 'opportunity': return 'buying_signal';
    case 'risk': return 'competition';
    default: return 'other';
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { nanoid } from 'nanoid';
import { emitSalesEvent } from '@/lib/sales/sales-events';
import {
  analyzeSalesUtteranceAgentically,
  extractPlanCoverageItems,
  inferCallPhase,
  type SalesAgenticAnalysis,
  type SalesAgenticContext,
} from '@/lib/agents/sales-call-agent';
import type { MeetingPlan } from '@/lib/sales/sales-analysis';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const t_serverReceived = Date.now();

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;

    // Verify the workshop exists and belongs to the caller's org
    const workshopAuth = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { organizationId: true },
    });

    if (!workshopAuth) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshopAuth.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { speakerId, startTime, endTime, text, rawText, confidence, source, slmMetadata, traceId } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // Dedup check
    const existing = await prisma.transcriptChunk.findFirst({
      where: { workshopId, speakerId, startTimeMs: startTime, endTimeMs: endTime, text },
      include: { dataPoint: true },
    });

    if (existing?.dataPoint) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        transcriptChunkId: existing.id,
        dataPointId: existing.dataPoint.id,
      });
    }

    // Create transcript chunk + data point (sync — must complete before response)
    const chunkId = nanoid();
    const dpId = nanoid();

    await prisma.$transaction([
      prisma.transcriptChunk.create({
        data: {
          id: chunkId,
          workshopId,
          speakerId: speakerId || null,
          startTimeMs: startTime || 0,
          endTimeMs: endTime || 0,
          text: text.trim(),
          confidence: confidence ?? null,
          source: source === 'whisper' ? 'WHISPER' : 'DEEPGRAM',
          metadata: { rawText, slmMetadata },
        },
      }),
      prisma.dataPoint.create({
        data: {
          id: dpId,
          workshopId,
          transcriptChunkId: chunkId,
          rawText: text.trim(),
          source: 'SPEECH',
          speakerId: speakerId || null,
        },
      }),
    ]);

    const t_dbWriteComplete = Date.now();

    // Emit SSE event for live UI (transcript chunk is saved)
    const t_sseEmitted = Date.now();
    emitSalesEvent(workshopId, {
      type: 'transcript.new',
      payload: {
        id: chunkId,
        dataPointId: dpId,
        speakerId: speakerId || null,
        text: text.trim(),
        startTime,
        endTime,
        confidence,
        emotionalTone: slmMetadata?.emotionalTone || null,
        // Pipeline diagnostics — only included when a developer sends a traceId
        ...(traceId ? {
          _serverTimings: {
            traceId,
            t_serverReceived,
            t_dbWriteComplete,
            t_sseEmitted,
          },
        } : {}),
      },
    });

    // -----------------------------------------------------------------------
    // Run agentic analysis asynchronously (don't block the HTTP response)
    // Same pattern as DREAM's workshop transcript route
    // -----------------------------------------------------------------------
    void (async () => {
      try {
        // Fetch workshop context + meeting plan
        const workshop = await prisma.workshop.findUnique({
          where: { id: workshopId },
          select: {
            meetingPlan: true,
            createdAt: true,
          },
        });

        if (!workshop) return;

        const meetingPlan = (workshop.meetingPlan as MeetingPlan) || null;

        // Fetch recent transcript chunks with their agentic analyses
        const recentDataPoints = await prisma.dataPoint.findMany({
          where: { workshopId },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            rawText: true,
            speakerId: true,
            agenticAnalysis: true,
          },
        });

        // Build recent utterances with prior analyses (chronological order)
        const recentUtterances: SalesAgenticContext['recentUtterances'] = recentDataPoints
          .reverse()
          .map((dp) => ({
            id: dp.id,
            speaker: dp.speakerId,
            text: dp.rawText,
            priorAnalysis: dp.agenticAnalysis
              ? (parseSalesAnalysis(dp.agenticAnalysis) ?? undefined)
              : undefined,
          }));

        // Aggregate emerging themes from prior agentic analyses
        const themeMap = new Map<string, { count: number; lastSeen: string }>();
        for (const dp of recentDataPoints) {
          if (!dp.agenticAnalysis) continue;
          const analysis = parseSalesAnalysis(dp.agenticAnalysis);
          if (!analysis) continue;
          for (const theme of analysis.themes) {
            const existing = themeMap.get(theme.label);
            themeMap.set(theme.label, {
              count: (existing?.count || 0) + 1,
              lastSeen: dp.id,
            });
          }
        }

        const emergingThemes = Array.from(themeMap.entries())
          .filter(([, data]) => data.count >= 2)
          .slice(0, 10)
          .map(([label, data]) => ({
            label,
            occurrences: data.count,
            lastSeen: data.lastSeen,
          }));

        // Track active objections from prior analyses
        const activeObjections: SalesAgenticContext['activeObjections'] = [];
        for (const dp of recentDataPoints) {
          if (!dp.agenticAnalysis) continue;
          const analysis = parseSalesAnalysis(dp.agenticAnalysis);
          if (!analysis) continue;
          for (const domain of analysis.domains) {
            if (domain.domain === 'ObjectionHandling' && domain.relevance > 0.5) {
              // Check if this objection was resolved by a later utterance
              const resolved = analysis.connections.some(c => c.type === 'resolves');
              activeObjections.push({
                objection: analysis.interpretation.semanticMeaning,
                raisedAt: dp.id,
                resolved,
              });
            }
          }
        }

        // Build plan coverage state
        const planCoverageState = meetingPlan
          ? extractPlanCoverageItems(meetingPlan)
          : [];

        // Update coverage from prior analyses
        for (const dp of recentDataPoints) {
          if (!dp.agenticAnalysis) continue;
          const analysis = parseSalesAnalysis(dp.agenticAnalysis);
          if (!analysis) continue;
          for (const coverage of analysis.planCoverage) {
            if (coverage.covered) {
              const match = planCoverageState.find(
                (p) => p.item === coverage.item || p.item.includes(coverage.item) || coverage.item.includes(p.item)
              );
              if (match) match.covered = true;
            }
          }
        }

        // Infer call phase
        const callDurationMs = (endTime || 0) - (workshop.createdAt?.getTime() || 0);
        const recentAnalyses = recentDataPoints
          .filter((dp) => dp.agenticAnalysis)
          .map((dp) => parseSalesAnalysis(dp.agenticAnalysis)!)
          .filter(Boolean);
        const callPhase = inferCallPhase(callDurationMs, recentDataPoints.length, recentAnalyses);

        // Build the full agentic context
        const agenticContext: SalesAgenticContext = {
          meetingPlan,
          callPhase,
          callDurationMs,
          recentUtterances,
          emergingThemes,
          activeObjections,
          planCoverageState,
        };

        // Run agentic analysis
        const analysis = await analyzeSalesUtteranceAgentically({
          utterance: text.trim(),
          speaker: speakerId || null,
          utteranceId: dpId,
          context: agenticContext,
        });

        // Store the analysis in the existing AgenticAnalysis table
        await prisma.agenticAnalysis.create({
          data: {
            dataPointId: dpId,
            semanticMeaning: analysis.interpretation.semanticMeaning,
            speakerIntent: analysis.interpretation.speakerIntent,
            temporalFocus: analysis.interpretation.temporalFocus,
            sentimentTone: analysis.interpretation.sentimentTone,
            domains: JSON.parse(JSON.stringify(analysis.domains)),
            themes: JSON.parse(JSON.stringify(analysis.themes)),
            connections: JSON.parse(JSON.stringify(analysis.connections)),
            overallConfidence: analysis.overallConfidence,
            uncertainties: analysis.uncertainties,
            agentModel: 'gpt-4o-mini',
            analysisVersion: 'sales-1.0',
          },
        });

        // Emit real-time event with intelligence for live coaching UI
        emitSalesEvent(workshopId, {
          type: 'intelligence.update',
          payload: {
            dataPointId: dpId,
            analysis: analysis as unknown as Record<string, unknown>,
            // Also emit a SalesIntelligence-compatible shape for the existing UI
            customerIntent: mapSentimentToIntent(analysis),
            emotionalTone: analysis.interpretation.sentimentTone,
            toneTrend: 'stable', // Would need trend tracking over time
            coachingPrompts: analysis.coachingMoment
              ? [{
                  id: `cp-${Date.now()}`,
                  message: analysis.coachingMoment.prompt,
                  priority: analysis.coachingMoment.priority,
                  source: analysis.coachingMoment.planReference ? 'plan' : 'live',
                }]
              : [],
            planCoverage: analysis.planCoverage,
            topicsDetected: analysis.themes.map((t) => ({
              topic: t.label,
              category: mapThemeCategoryToTopic(t.category),
              evidence: t.reasoning,
            })),
          },
        });
      } catch (error) {
        // Don't fail transcript ingestion if agentic analysis fails
        console.error('Sales agentic analysis failed (non-blocking):', error);
      }
    })();

    return NextResponse.json({
      success: true,
      transcriptChunkId: chunkId,
      dataPointId: dpId,
    });
  } catch (error) {
    console.error('Sales transcript error:', error);
    return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a stored agentic analysis (from JSON in DB) into SalesAgenticAnalysis
 */
function parseSalesAnalysis(raw: unknown): SalesAgenticAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;

  // The AgenticAnalysis model stores fields flat, so we need to reconstruct
  const record = raw as Record<string, unknown>;

  // If it's already a full SalesAgenticAnalysis (from JSON field), return as-is
  if (record.interpretation && record.domains) {
    return raw as SalesAgenticAnalysis;
  }

  // If it's from the Prisma AgenticAnalysis model (flat fields)
  if (record.semanticMeaning) {
    return {
      interpretation: {
        semanticMeaning: (record.semanticMeaning as string) || '',
        speakerIntent: (record.speakerIntent as string) || '',
        temporalFocus: (record.temporalFocus as string as SalesAgenticAnalysis['interpretation']['temporalFocus']) || 'present',
        sentimentTone: (record.sentimentTone as string as SalesAgenticAnalysis['interpretation']['sentimentTone']) || 'neutral',
      },
      domains: Array.isArray(record.domains) ? record.domains : [],
      themes: Array.isArray(record.themes) ? record.themes : [],
      connections: Array.isArray(record.connections) ? record.connections : [],
      coachingMoment: null,
      planCoverage: [],
      overallConfidence: typeof record.overallConfidence === 'number' ? record.overallConfidence : 0.5,
      uncertainties: Array.isArray(record.uncertainties) ? record.uncertainties : [],
    };
  }

  return null;
}

/**
 * Map agentic sentiment/domain analysis to the SalesIntelligence customerIntent shape
 */
function mapSentimentToIntent(
  analysis: SalesAgenticAnalysis
): string {
  const buyingSignal = analysis.domains.find(d => d.domain === 'BuyingSignal');
  const objection = analysis.domains.find(d => d.domain === 'ObjectionHandling');
  const customerIntent = analysis.domains.find(d => d.domain === 'CustomerIntent');

  if (buyingSignal && buyingSignal.relevance > 0.6) return 'ready_to_buy';
  if (objection && objection.relevance > 0.6) return 'objecting';

  const tone = analysis.interpretation.sentimentTone;
  if (tone === 'positive') return 'interested';
  if (tone === 'concerned') return 'hesitant';
  if (tone === 'critical') return 'objecting';

  if (customerIntent && customerIntent.relevance > 0.5) return 'exploring';

  return 'neutral';
}

/**
 * Map theme categories to the TopicDetection categories the UI expects
 */
function mapThemeCategoryToTopic(
  category: 'aspiration' | 'constraint' | 'enabler' | 'opportunity' | 'risk'
): string {
  switch (category) {
    case 'aspiration': return 'needs';
    case 'constraint': return 'objection';
    case 'enabler': return 'buying_signal';
    case 'opportunity': return 'buying_signal';
    case 'risk': return 'competition';
    default: return 'other';
  }
}

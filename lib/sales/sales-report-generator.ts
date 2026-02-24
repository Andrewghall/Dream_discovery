import { prisma } from '@/lib/prisma';
import type { MeetingPlan } from './sales-analysis';
import {
  synthesizeSalesCallAgentically,
  type SalesAgenticAnalysis,
  type SalesCallSynthesis,
} from '@/lib/agents/sales-call-agent';

/**
 * Sales Report Generator — Agentic Version
 *
 * Instead of making a single-shot OpenAI call on the raw transcript,
 * this generator leverages the per-utterance agentic analyses that were
 * already produced in real-time during the call, then runs a GPT-4o
 * synthesis pass across all of them to produce a comprehensive report.
 *
 * The result is dramatically better because:
 * 1. Each utterance was already analysed with full conversational context
 * 2. The synthesis has access to every per-utterance analysis (domains, themes, connections)
 * 3. GPT-4o is used for synthesis (stronger reasoning than GPT-4o-mini)
 * 4. Evidence is tracked per-utterance, not guessed from raw text
 */

export interface SalesReportData {
  meetingSummary: {
    customerName: string;
    opportunityName: string;
    date: string;
    duration: string;
    speakers: string[];
    dealStage: string;
  };
  keyDiscussionPoints: Array<{ topic: string; summary: string; category: string }>;
  customerNeeds: Array<{ need: string; evidence: string; priority: string }>;
  solutionsDiscussed: Array<{ solution: string; customerReaction: string }>;
  objectionsAndConcerns: Array<{ objection: string; howHandled: string; resolved: boolean }>;
  opportunityAssessment: {
    dealHealth: 'Hot' | 'Warm' | 'Cool' | 'Cold';
    reasoning: string;
    confidenceScore: number;
  };
  actions: Array<{
    action: string;
    owner: string;
    deadline: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    source: string;
  }>;
  decisionTimeline: string;
  competitiveIntelligence: Array<{ competitor: string; context: string }>;
  toneAnalysis: {
    overallTone: string;
    keyShifts: Array<{ moment: string; fromTone: string; toTone: string }>;
  };
  coachingNotes: string[];
  planVsActual: {
    objectivesCovered: Array<{ objective: string; covered: boolean; evidence?: string }>;
    questionsCovered: Array<{ question: string; asked: boolean; answer?: string }>;
    unexpectedTopics: string[];
    missedItems: string[];
  };
}

export async function generateSalesReport(workshopId: string): Promise<SalesReportData> {
  // Fetch workshop + all data points with their agentic analyses
  const [workshop, dataPoints, chunks] = await Promise.all([
    prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { name: true, meetingPlan: true, createdAt: true },
    }),
    prisma.dataPoint.findMany({
      where: { workshopId },
      orderBy: { createdAt: 'asc' },
      include: {
        agenticAnalysis: true,
        transcriptChunk: {
          select: { startTimeMs: true, endTimeMs: true },
        },
      },
    }),
    prisma.transcriptChunk.findMany({
      where: { workshopId },
      orderBy: { createdAt: 'asc' },
      select: { text: true, speakerId: true, startTimeMs: true, endTimeMs: true },
    }),
  ]);

  if (!workshop || chunks.length === 0) {
    throw new Error('No transcript data found');
  }

  const meetingPlan = (workshop.meetingPlan as MeetingPlan) || {};
  const speakers = [...new Set(chunks.map((c) => c.speakerId).filter(Boolean))] as string[];
  const totalDurationMs = chunks.length > 0
    ? Number(chunks[chunks.length - 1].endTimeMs - chunks[0].startTimeMs)
    : 0;
  const durationMins = Math.round(totalDurationMs / 60000);

  // Filter data points that have agentic analysis
  const analyzedDataPoints = dataPoints.filter(dp => dp.agenticAnalysis);

  if (analyzedDataPoints.length > 0) {
    // --- AGENTIC SYNTHESIS PATH (preferred) ---
    // Use the per-utterance agentic analyses + GPT-4o synthesis
    const utterances = analyzedDataPoints.map(dp => ({
      id: dp.id,
      text: dp.rawText,
      speaker: dp.speakerId || null,
      analysis: reconstructAnalysis(dp.agenticAnalysis!),
    }));

    const synthesis = await synthesizeSalesCallAgentically({
      utterances,
      meetingPlan,
      callDurationMs: totalDurationMs,
    });

    // Map synthesis to SalesReportData
    const report = mapSynthesisToReport(synthesis, {
      customerName: meetingPlan.customerName || 'Unknown',
      opportunityName: meetingPlan.opportunityName || workshop.name,
      date: workshop.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      duration: `${durationMins} minutes`,
      speakers,
      dealStage: meetingPlan.dealStage || 'Unknown',
    });

    // Save to workshop
    await prisma.workshop.update({
      where: { id: workshopId },
      data: {
        salesReport: JSON.parse(JSON.stringify(report)),
        salesActions: JSON.parse(JSON.stringify(report.actions)),
        status: 'COMPLETED',
      },
    });

    return report;
  } else {
    // --- FALLBACK: No agentic analyses available ---
    // This can happen if the call was recorded before the agentic upgrade,
    // or if all agentic analyses failed. Fall back to basic synthesis.
    throw new Error(
      'No agentic analyses found for this call. The call may have been recorded before the agentic upgrade was deployed. Please re-process the transcript.'
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reconstruct a SalesAgenticAnalysis from the flat Prisma AgenticAnalysis model
 */
function reconstructAnalysis(dbAnalysis: {
  semanticMeaning: string;
  speakerIntent: string;
  temporalFocus: string;
  sentimentTone: string;
  domains: unknown;
  themes: unknown;
  connections: unknown;
  overallConfidence: number;
  uncertainties: string[];
}): SalesAgenticAnalysis {
  return {
    interpretation: {
      semanticMeaning: dbAnalysis.semanticMeaning,
      speakerIntent: dbAnalysis.speakerIntent,
      temporalFocus: dbAnalysis.temporalFocus as SalesAgenticAnalysis['interpretation']['temporalFocus'],
      sentimentTone: dbAnalysis.sentimentTone as SalesAgenticAnalysis['interpretation']['sentimentTone'],
    },
    domains: Array.isArray(dbAnalysis.domains) ? dbAnalysis.domains as SalesAgenticAnalysis['domains'] : [],
    themes: Array.isArray(dbAnalysis.themes) ? dbAnalysis.themes as SalesAgenticAnalysis['themes'] : [],
    connections: Array.isArray(dbAnalysis.connections) ? dbAnalysis.connections as SalesAgenticAnalysis['connections'] : [],
    coachingMoment: null,
    planCoverage: [],
    overallConfidence: dbAnalysis.overallConfidence,
    uncertainties: dbAnalysis.uncertainties,
  };
}

/**
 * Map the agentic synthesis output to the SalesReportData shape the UI expects
 */
function mapSynthesisToReport(
  synthesis: SalesCallSynthesis,
  meetingSummary: SalesReportData['meetingSummary']
): SalesReportData {
  return {
    meetingSummary,
    keyDiscussionPoints: synthesis.keyDiscussionPoints || [],
    customerNeeds: synthesis.customerNeeds || [],
    solutionsDiscussed: synthesis.solutionsDiscussed || [],
    objectionsAndConcerns: synthesis.objectionsAndConcerns || [],
    opportunityAssessment: synthesis.opportunityAssessment || {
      dealHealth: 'Warm',
      reasoning: 'Insufficient data for assessment',
      confidenceScore: 50,
    },
    actions: synthesis.actions || [],
    decisionTimeline: synthesis.decisionTimeline || 'Not discussed',
    competitiveIntelligence: synthesis.competitiveIntelligence || [],
    toneAnalysis: synthesis.toneAnalysis || { overallTone: 'Neutral', keyShifts: [] },
    coachingNotes: synthesis.coachingNotes || [],
    planVsActual: synthesis.planVsActual || {
      objectivesCovered: [],
      questionsCovered: [],
      unexpectedTopics: [],
      missedItems: [],
    },
  };
}

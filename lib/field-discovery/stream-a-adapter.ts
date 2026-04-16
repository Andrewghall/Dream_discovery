/**
 * Stream A Adapter
 *
 * Converts existing Discovery data (ConversationInsight, DataPointClassification,
 * AgenticAnalysis) into Finding records with sourceStream = STREAM_A.
 *
 * This is an idempotent operation - running it multiple times will not
 * create duplicate findings.
 */

import { prisma } from '@/lib/prisma';
import type { FindingType, SourceStream } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamASyncResult {
  workshopId: string;
  findingsCreated: number;
  findingsSkipped: number;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

const INSIGHT_TYPE_TO_FINDING: Record<string, FindingType> = {
  CHALLENGE: 'CONSTRAINT',
  CONSTRAINT: 'CONSTRAINT',
  VISION: 'OPPORTUNITY',
  ACTUAL_JOB: 'OPPORTUNITY',
  WHAT_WORKS: 'OPPORTUNITY',
  BELIEF: 'RISK',
  RATING: 'RISK',
};

const CATEGORY_TO_LENS: Record<string, string> = {
  BUSINESS: 'Operations',
  TECHNOLOGY: 'Technology',
  PEOPLE: 'People',
  CUSTOMER: 'Customer',
  REGULATION: 'Risk/Compliance',
  COMMERCIAL: 'Commercial',
  PARTNERS: 'Partners',
};

const DATA_POINT_TYPE_TO_FINDING: Record<string, FindingType> = {
  VISIONARY: 'OPPORTUNITY',
  OPPORTUNITY: 'OPPORTUNITY',
  CONSTRAINT: 'CONSTRAINT',
  RISK: 'RISK',
  ENABLER: 'OPPORTUNITY',
  ACTION: 'OPPORTUNITY',
  QUESTION: 'RISK',
  INSIGHT: 'OPPORTUNITY',
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Sync existing Discovery data into Findings with STREAM_A source.
 * Idempotent: checks for existing STREAM_A findings before creating.
 */
export async function syncStreamAFindings(workshopId: string): Promise<StreamASyncResult> {
  // Check how many STREAM_A findings already exist
  const existingCount = await prisma.finding.count({
    where: { workshopId, sourceStream: 'STREAM_A' },
  });

  // If we already have findings, skip (idempotent guard)
  if (existingCount > 0) {
    return { workshopId, findingsCreated: 0, findingsSkipped: existingCount };
  }

  let created = 0;

  // 1. Convert ConversationInsights to Findings
  const insights = await prisma.conversationInsight.findMany({
    where: { workshopId },
    include: {
      participant: { select: { role: true } },
    },
  });

  for (const insight of insights) {
    const findingType = INSIGHT_TYPE_TO_FINDING[insight.insightType];
    if (!findingType) continue;

    const lens = insight.category ? CATEGORY_TO_LENS[insight.category] : 'Operations';
    if (!lens) continue;

    await prisma.finding.create({
      data: {
        workshopId,
        sourceStream: 'STREAM_A' as SourceStream,
        lens,
        type: findingType,
        title: insight.text.slice(0, 80),
        description: insight.text,
        severityScore: insight.severity ?? 5,
        frequencyCount: 1,
        roleCoverage: insight.participant?.role ? [insight.participant.role] : [],
        supportingQuotes: [{ text: insight.text, source: 'discovery_insight' }] as any,
        confidenceScore: insight.confidence,
      },
    });
    created++;
  }

  // 2. Convert classified DataPoints to Findings
  const dataPoints = await prisma.dataPoint.findMany({
    where: { workshopId },
    include: {
      classification: true,
      agenticAnalysis: true,
      participant: { select: { role: true } },
    },
  });

  for (const dp of dataPoints) {
    if (!dp.classification) continue;

    const findingType = DATA_POINT_TYPE_TO_FINDING[dp.classification.primaryType];
    if (!findingType) continue;

    // Determine lens from agentic analysis domains or classification area
    let lens = 'Operations';
    if (dp.agenticAnalysis?.domains) {
      const domains = dp.agenticAnalysis.domains as Array<{ domain: string }>;
      if (domains.length > 0) {
        const domainName = domains[0].domain;
        // Map domain names to lens names
        if (domainName.toLowerCase().includes('people') || domainName.toLowerCase().includes('human')) lens = 'People';
        else if (domainName.toLowerCase().includes('customer')) lens = 'Customer';
        else if (domainName.toLowerCase().includes('tech')) lens = 'Technology';
        else if (domainName.toLowerCase().includes('regulat') || domainName.toLowerCase().includes('compliance')) lens = 'Risk/Compliance';
        else if (domainName.toLowerCase().includes('commerci') || domainName.toLowerCase().includes('revenue') || domainName.toLowerCase().includes('pric')) lens = 'Commercial';
        else if (domainName.toLowerCase().includes('partner') || domainName.toLowerCase().includes('supplier') || domainName.toLowerCase().includes('vendor')) lens = 'Partners';
        else lens = 'Operations';
      }
    } else if (dp.classification.suggestedArea) {
      const area = dp.classification.suggestedArea.toLowerCase();
      if (area.includes('people') || area.includes('hr') || area.includes('staff')) lens = 'People';
      else if (area.includes('customer') || area.includes('client')) lens = 'Customer';
      else if (area.includes('tech') || area.includes('system') || area.includes('digital')) lens = 'Technology';
      else if (area.includes('regulat') || area.includes('compliance') || area.includes('risk')) lens = 'Risk/Compliance';
      else if (area.includes('commerci') || area.includes('revenue') || area.includes('pric')) lens = 'Commercial';
      else if (area.includes('partner') || area.includes('supplier') || area.includes('vendor')) lens = 'Partners';
    }

    await prisma.finding.create({
      data: {
        workshopId,
        sourceStream: 'STREAM_A' as SourceStream,
        lens,
        type: findingType,
        title: dp.rawText.slice(0, 80),
        description: dp.rawText,
        severityScore: dp.agenticAnalysis?.overallConfidence
          ? Math.round(dp.agenticAnalysis.overallConfidence * 10)
          : 5,
        frequencyCount: 1,
        roleCoverage: dp.participant?.role ? [dp.participant.role] : [],
        supportingQuotes: [{ text: dp.rawText, source: 'data_point' }] as any,
        confidenceScore: dp.classification.confidence ?? 0.7,
      },
    });
    created++;
  }

  return { workshopId, findingsCreated: created, findingsSkipped: 0 };
}

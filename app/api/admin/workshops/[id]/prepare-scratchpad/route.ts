import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

type OrderedSection = {
  domain: string;
  content: Array<{
    type: 'aspiration' | 'constraint' | 'enabler' | 'opportunity' | 'risk';
    text: string;
    sourceId?: string;
    confidence?: number;
  }>;
};

type ScratchpadContent = {
  workshopId: string;
  workshopName: string | null;
  generatedAt: string;
  sections: OrderedSection[];
  metadata: {
    totalDataPoints: number;
    reportCount: number;
    agenticAnalysisCount: number;
  };
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeArray<T>(value: unknown, mapper: (v: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Verify workshop exists and is completed
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        id: true,
        name: true,
        businessContext: true,
        status: true
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (workshop.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Workshop must be completed before preparing scratchpad content' },
        { status: 400 }
      );
    }

    // OPTIMIZATION: Fetch data points with select (only needed fields) and pagination
    // Limit to 1000 most recent data points to prevent memory issues
    const dataPoints = await prisma.dataPoint.findMany({
      where: { workshopId },
      select: {
        id: true,
        rawText: true,
        createdAt: true,
        agenticAnalysis: {
          select: {
            semanticMeaning: true,
            speakerIntent: true,
            temporalFocus: true,
            sentimentTone: true,
            domains: true,
            themes: true,
            overallConfidence: true,
          },
        },
        classification: {
          select: {
            primaryType: true,
            keywords: true,
            confidence: true,
            suggestedArea: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to prevent memory exhaustion
    });

    // Fetch conversation reports for additional context (limit to 50 most recent)
    const reports = await prisma.conversationReport.findMany({
      where: { workshopId },
      select: {
        executiveSummary: true,
        keyInsights: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch live workshop snapshot if available
    let liveSnapshot = null;
    try {
      liveSnapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
        where: { workshopId },
        orderBy: { createdAt: 'desc' },
        select: { payload: true },
      });
    } catch {
      // Ignore if table doesn't exist
    }

    const agenticAnalysisCount = dataPoints.filter((dp) => dp.agenticAnalysis).length;

    // Build context for AI agent
    const contextParts: string[] = [];

    if (workshop.name) {
      contextParts.push(`Workshop: ${workshop.name}`);
    }

    if (workshop.businessContext) {
      contextParts.push(`Business Context: ${workshop.businessContext}`);
    }

    // Add agentic analyses
    const agenticInsights: string[] = [];
    for (const dp of dataPoints) {
      if (dp.agenticAnalysis) {
        const analysis = dp.agenticAnalysis;
        agenticInsights.push(
          `[${dp.id}] ${dp.rawText}\n` +
          `  Meaning: ${analysis.semanticMeaning}\n` +
          `  Intent: ${analysis.speakerIntent}\n` +
          `  Tone: ${analysis.sentimentTone}\n` +
          `  Domains: ${JSON.stringify(analysis.domains)}\n` +
          `  Themes: ${JSON.stringify(analysis.themes)}`
        );
      } else if (dp.classification) {
        agenticInsights.push(
          `[${dp.id}] ${dp.rawText}\n` +
          `  Type: ${dp.classification.primaryType}\n` +
          `  Area: ${dp.classification.suggestedArea || 'unknown'}`
        );
      } else {
        agenticInsights.push(`[${dp.id}] ${dp.rawText}`);
      }
    }

    if (agenticInsights.length > 0) {
      contextParts.push(`Data Points with Analysis:\n${agenticInsights.join('\n\n')}`);
    }

    // Add report summaries
    if (reports.length > 0) {
      const summaries = reports.map((r) => safeString(r.executiveSummary)).filter(Boolean);
      if (summaries.length > 0) {
        contextParts.push(`Discovery Summaries:\n${summaries.join('\n\n')}`);
      }
    }

    // Add live snapshot data
    if (liveSnapshot?.payload) {
      const payload = liveSnapshot.payload as any;
      if (payload.synthesisByDomain) {
        contextParts.push(`Live Workshop Synthesis:\n${JSON.stringify(payload.synthesisByDomain, null, 2)}`);
      }
    }

    const fullContext = contextParts.join('\n\n---\n\n');

    if (!process.env.OPENAI_API_KEY) {
      // Fallback: basic organization by classification
      const sections: OrderedSection[] = [
        { domain: 'People', content: [] },
        { domain: 'Customer', content: [] },
        { domain: 'Technology', content: [] },
        { domain: 'Regulation', content: [] },
        { domain: 'Organisation', content: [] },
      ];

      for (const dp of dataPoints) {
        const domain = dp.classification?.suggestedArea || 'Organisation';
        const section = sections.find((s) => s.domain === domain) || sections[4];

        section.content.push({
          type: dp.classification?.primaryType.toLowerCase() as any || 'opportunity',
          text: dp.rawText,
          sourceId: dp.id,
        });
      }

      const result: ScratchpadContent = {
        workshopId,
        workshopName: workshop.name,
        generatedAt: new Date().toISOString(),
        sections,
        metadata: {
          totalDataPoints: dataPoints.length,
          reportCount: reports.length,
          agenticAnalysisCount,
        },
      };

      return NextResponse.json({ orderedContent: result });
    }

    // Use AI to intelligently organize content
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You are an expert workshop facilitator organizing workshop content for a scratchpad.

Your task is to:
1. Analyze all workshop data points and their agentic analyses
2. Organize them into the five domains: People, Customer, Technology, Regulation, Organisation
3. Categorize each item as: aspiration, constraint, enabler, opportunity, or risk
4. Order items within each domain by logical flow and importance
5. Ensure coherent narrative progression within each domain

Return ONLY valid JSON with this schema:
{
  "sections": [
    {
      "domain": "People" | "Customer" | "Technology" | "Regulation" | "Organisation",
      "content": [
        {
          "type": "aspiration" | "constraint" | "enabler" | "opportunity" | "risk",
          "text": "The organized, refined text ready for the scratchpad",
          "sourceId": "original data point ID",
          "confidence": 0.0-1.0
        }
      ]
    }
  ]
}

Guidelines:
- Group related ideas together
- Remove duplicates or merge similar items
- Clean up the text while preserving meaning
- Order by: aspirations → opportunities → enablers → constraints → risks
- Ensure each domain tells a coherent story`,
        },
        {
          role: 'user',
          content: `Workshop content to organize:\n\n${fullContext}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed: { sections?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const sections = safeArray(parsed.sections, (s) => {
      if (!s || typeof s !== 'object') return null;
      const sec = s as Record<string, unknown>;
      const domain = safeString(sec.domain);
      if (!domain) return null;

      const content = safeArray(sec.content, (c) => {
        if (!c || typeof c !== 'object') return null;
        const item = c as Record<string, unknown>;
        return {
          type: safeString(item.type) as any || 'opportunity',
          text: safeString(item.text),
          sourceId: safeString(item.sourceId) || undefined,
          confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
        };
      });

      return { domain, content };
    });

    const result: ScratchpadContent = {
      workshopId,
      workshopName: workshop.name,
      generatedAt: new Date().toISOString(),
      sections,
      metadata: {
        totalDataPoints: dataPoints.length,
        reportCount: reports.length,
        agenticAnalysisCount,
      },
    };

    // Create or update scratchpad in database
    const existingScratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
    });

    if (existingScratchpad) {
      // Update existing scratchpad with new content
      await prisma.workshopScratchpad.update({
        where: { workshopId },
        data: {
          discoveryOutput: result,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new scratchpad
      await prisma.workshopScratchpad.create({
        data: {
          workshopId,
          discoveryOutput: result,
          status: 'DRAFT',
        },
      });
    }

    return NextResponse.json({ orderedContent: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare scratchpad content';
    console.error('Failed to prepare scratchpad:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

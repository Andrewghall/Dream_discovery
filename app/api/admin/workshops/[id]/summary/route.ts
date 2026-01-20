import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

type SummaryLens = {
  People: string;
  Customer: string;
  Technology: string;
  Regulation: string;
  Organisation: string;
};

type WorkshopSummary = {
  workshopId: string;
  workshopName: string | null;
  generatedAt: string;
  visionStatement: string;
  executiveSummary: string;
  lenses: SummaryLens;
  sources: {
    liveSnapshotId?: string | null;
    reportCount: number;
    dataPointCount: number;
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

function extractLivePayloadStrings(payload: unknown): string[] {
  const rec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  if (!rec) return [];

  const utterances = safeArray(rec.utterances, (u) => {
    if (!u || typeof u !== 'object') return null;
    const text = safeString((u as Record<string, unknown>).rawText);
    return text || null;
  });

  const interpreted = safeArray(rec.interpreted, (u) => {
    if (!u || typeof u !== 'object') return null;
    const text = safeString((u as Record<string, unknown>).rawText);
    return text || null;
  });

  const synthesisByDomain = rec.synthesisByDomain && typeof rec.synthesisByDomain === 'object'
    ? (rec.synthesisByDomain as Record<string, unknown>)
    : null;

  const synthesisLines: string[] = [];
  if (synthesisByDomain) {
    for (const [domain, value] of Object.entries(synthesisByDomain)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      const asArray = (key: string) =>
        safeArray(v[key], (x) => {
          if (!x || typeof x !== 'object') return null;
          const label = safeString((x as Record<string, unknown>).label);
          return label ? `${domain}: ${label}` : null;
        });
      synthesisLines.push(...asArray('aspirations'));
      synthesisLines.push(...asArray('constraints'));
      synthesisLines.push(...asArray('enablers'));
      synthesisLines.push(...asArray('opportunities'));
    }
  }

  const pressurePoints = safeArray(rec.pressurePoints, (p) => {
    if (!p || typeof p !== 'object') return null;
    const fromDomain = safeString((p as Record<string, unknown>).fromDomain);
    const toDomain = safeString((p as Record<string, unknown>).toDomain);
    return fromDomain && toDomain ? `Pressure: ${fromDomain} → ${toDomain}` : null;
  });

  return [...utterances, ...interpreted, ...synthesisLines, ...pressurePoints];
}

function buildSummaryText(params: {
  workshopName: string | null;
  businessContext: string | null;
  reportSummaries: string[];
  reportInsights: string[];
  dataPointTexts: string[];
  liveTexts: string[];
}): string {
  const parts: string[] = [];
  if (params.workshopName) parts.push(`Workshop: ${params.workshopName}`);
  if (params.businessContext) parts.push(`Business context: ${params.businessContext}`);
  if (params.reportSummaries.length) {
    parts.push('Discovery executive summaries:');
    parts.push(params.reportSummaries.map((s) => `- ${s}`).join('\n'));
  }
  if (params.reportInsights.length) {
    parts.push('Discovery key insights:');
    parts.push(params.reportInsights.map((s) => `- ${s}`).join('\n'));
  }
  if (params.liveTexts.length) {
    parts.push('Live workshop signals:');
    parts.push(params.liveTexts.map((s) => `- ${s}`).join('\n'));
  }
  if (params.dataPointTexts.length) {
    parts.push('Raw datapoints:');
    parts.push(params.dataPointTexts.map((s) => `- ${s}`).join('\n'));
  }
  return parts.join('\n\n').trim();
}

function fallbackSummary(workshopId: string, workshopName: string | null): WorkshopSummary {
  const vision = 'Agentic vision unavailable. Enable OPENAI_API_KEY to generate a full vision narrative.';
  const exec = 'Agentic executive summary unavailable. Enable OPENAI_API_KEY to generate a summary.';
  const lenses: SummaryLens = {
    People: vision,
    Customer: vision,
    Technology: vision,
    Regulation: vision,
    Organisation: vision,
  };
  return {
    workshopId,
    workshopName,
    generatedAt: new Date().toISOString(),
    visionStatement: vision,
    executiveSummary: exec,
    lenses,
    sources: { reportCount: 0, dataPointCount: 0 },
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, name: true, businessContext: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    const reports = await prisma.conversationReport.findMany({
      where: { workshopId },
      select: {
        executiveSummary: true,
        keyInsights: true,
      },
    });

    const dataPoints = await prisma.dataPoint.findMany({
      where: { workshopId },
      select: { rawText: true },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });

    let liveSnapshotId: string | null = null;
    let liveTexts: string[] = [];

    try {
      const latest = await (prisma as any).liveWorkshopSnapshot.findFirst({
        where: { workshopId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, payload: true },
      });
      if (latest) {
        liveSnapshotId = latest.id;
        liveTexts = extractLivePayloadStrings(latest.payload);
      }
    } catch {
      // ignore missing snapshots table
    }

    const reportSummaries = reports.map((r) => safeString(r.executiveSummary)).filter(Boolean);
    const reportInsights = reports.flatMap((r) =>
      safeArray(r.keyInsights, (x) => {
        if (!x || typeof x !== 'object') return null;
        const title = safeString((x as Record<string, unknown>).title);
        const insight = safeString((x as Record<string, unknown>).insight);
        if (!title && !insight) return null;
        return title && insight ? `${title}: ${insight}` : title || insight;
      })
    );
    const dataPointTexts = dataPoints.map((d) => safeString(d.rawText)).filter(Boolean);

    const notes = buildSummaryText({
      workshopName: workshop.name,
      businessContext: workshop.businessContext,
      reportSummaries,
      reportInsights,
      dataPointTexts,
      liveTexts,
    });

    if (!process.env.OPENAI_API_KEY) {
      const fallback = fallbackSummary(workshopId, workshop.name);
      fallback.sources.reportCount = reports.length;
      fallback.sources.dataPointCount = dataPoints.length;
      fallback.sources.liveSnapshotId = liveSnapshotId;
      return NextResponse.json({ summary: fallback });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are an executive strategist writing a corporate future-state vision narrative. Produce a full vision statement, an executive summary, and a domain lens across People, Customer, Technology, Regulation, and Organisation. Use only the supplied source material. Write in confident, board-level language with concrete imagery. Do not add recommendations or implementation steps. Return ONLY valid JSON with this schema:\n\n{\n  "visionStatement": string,\n  "executiveSummary": string,\n  "lenses": {\n    "People": string,\n    "Customer": string,\n    "Technology": string,\n    "Regulation": string,\n    "Organisation": string\n  }\n}',
        },
        {
          role: 'user',
          content: `Source material (verbatim):\n\n${notes}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed: { visionStatement?: unknown; executiveSummary?: unknown; lenses?: unknown } = {};
    try {
      parsed = JSON.parse(raw) as { visionStatement?: unknown; executiveSummary?: unknown; lenses?: unknown };
    } catch {
      parsed = {};
    }

    const lenses = parsed.lenses && typeof parsed.lenses === 'object'
      ? (parsed.lenses as Record<string, unknown>)
      : {};

    const summary: WorkshopSummary = {
      workshopId,
      workshopName: workshop.name ?? null,
      generatedAt: new Date().toISOString(),
      visionStatement: safeString(parsed.visionStatement) || 'Agentic synthesis unavailable (invalid model response).',
      executiveSummary: safeString(parsed.executiveSummary) || 'Agentic synthesis unavailable (invalid model response).',
      lenses: {
        People: safeString(lenses.People) || 'Agentic synthesis unavailable (invalid model response).',
        Customer: safeString(lenses.Customer) || 'Agentic synthesis unavailable (invalid model response).',
        Technology: safeString(lenses.Technology) || 'Agentic synthesis unavailable (invalid model response).',
        Regulation: safeString(lenses.Regulation) || 'Agentic synthesis unavailable (invalid model response).',
        Organisation: safeString(lenses.Organisation) || 'Agentic synthesis unavailable (invalid model response).',
      },
      sources: {
        liveSnapshotId,
        reportCount: reports.length,
        dataPointCount: dataPoints.length,
      },
    };

    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate workshop summary';
    console.error('Failed to generate workshop summary:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

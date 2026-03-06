import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

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

// ── GET: Return cached summary (no GPT call) ─────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { discoverySummary: true },
    });
    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    if (workshop.discoverySummary) {
      return NextResponse.json({ summary: workshop.discoverySummary });
    }

    return NextResponse.json({ summary: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: Generate summary via GPT and cache it ───────────────

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, name: true, businessContext: true },
    });
    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    const reports = await prisma.conversationReport.findMany({
      where: { workshopId },
      select: { executiveSummary: true, keyInsights: true },
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
    } catch { /* ignore */ }

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
            'You are a discovery analyst synthesising verbatim feedback from employees and stakeholders who completed an AI-guided discovery interview. Your job is to faithfully reflect what participants actually said — their real challenges, frustrations, pain points, and aspirations. This is NOT a corporate vision or future-state narrative. It is a 360-degree organisational health view grounded entirely in what the people who work here told you.\n\nRules:\n- Ground every sentence in the source material. Never invent, project, or aspirationalise beyond what participants said.\n- Write in clear, direct language that reflects the voices of front-line staff, managers, and leadership equally — not board-level corporate language.\n- The "visionStatement" field should be a 2-3 sentence synthesis of the dominant challenges and opportunities participants raised, framed as what the organisation most needs to address — not a future aspiration.\n- The "executiveSummary" field should summarise the key patterns, tensions and themes across all participant responses — what people consistently said, where views diverge, and what the data suggests about organisational health.\n- Each lens (People, Customer, Technology, Regulation, Organisation) should summarise what participants said about that domain — specific pain points, systemic issues, and where things are working.\n- Never use phrases like "we envision", "we will achieve", "our organisation will" or any aspirational future-tense framing. Write in the present tense about what participants reported.\n\nReturn ONLY valid JSON with this schema:\n{\n  "visionStatement": string,\n  "executiveSummary": string,\n  "lenses": {\n    "People": string,\n    "Customer": string,\n    "Technology": string,\n    "Regulation": string,\n    "Organisation": string\n  }\n}',
        },
        {
          role: 'user',
          content: `Discovery interview source material (${reportSummaries.length} participant reports, ${dataPointTexts.length} data points):\n\n${notes}`,
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
      visionStatement: safeString(parsed.visionStatement) || 'Agentic synthesis unavailable.',
      executiveSummary: safeString(parsed.executiveSummary) || 'Agentic synthesis unavailable.',
      lenses: {
        People: safeString(lenses.People) || 'Agentic synthesis unavailable.',
        Customer: safeString(lenses.Customer) || 'Agentic synthesis unavailable.',
        Technology: safeString(lenses.Technology) || 'Agentic synthesis unavailable.',
        Regulation: safeString(lenses.Regulation) || 'Agentic synthesis unavailable.',
        Organisation: safeString(lenses.Organisation) || 'Agentic synthesis unavailable.',
      },
      sources: {
        liveSnapshotId,
        reportCount: reports.length,
        dataPointCount: dataPoints.length,
      },
    };

    // Cache to DB
    await prisma.workshop.update({
      where: { id: workshopId },
      data: { discoverySummary: JSON.parse(JSON.stringify(summary)) },
    });

    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate workshop summary';
    console.error('Failed to generate workshop summary:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

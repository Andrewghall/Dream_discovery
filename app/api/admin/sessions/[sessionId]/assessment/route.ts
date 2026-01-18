import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { InsightCategory, InsightType } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function safeInsightType(value: unknown): InsightType | null {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!s) return null;
  if ((Object.values(InsightType) as string[]).includes(s)) return s as InsightType;
  return null;
}

function safeInsightCategory(value: unknown): InsightCategory | null {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!s) return null;
  if ((Object.values(InsightCategory) as string[]).includes(s)) return s as InsightCategory;
  return null;
}

function safeConfidence(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

type ReportApiResponse = {
  sessionId: string;
  status: string;
  executiveSummary: string;
  tone: string | null;
  feedback: string;
  inputQuality?: unknown;
  keyInsights?: unknown;
  phaseInsights?: unknown;
  wordCloudThemes?: unknown;
  qaPairs?: Array<{ phase: string | null; question: string; answer: string; createdAt: string; tag: string | null }>;
};

type IncomingAssessmentBody = {
  reportPayload?: ReportApiResponse;
};

type ExtractedConversationInsight = {
  insightType: string;
  category: string | null;
  text: string;
  severity: number | null;
  impact: string | null;
  confidence: number | null;
  evidence: string[];
};

async function extractConversationInsights(params: {
  qaPairs: Array<{ phase: string | null; question: string; answer: string }>;
}): Promise<ExtractedConversationInsight[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  const compact = params.qaPairs
    .slice(0, 40)
    .map((qa, idx) => {
      const p = qa.phase ? `[${qa.phase}] ` : '';
      return `${idx + 1}. ${p}${qa.question}\nA: ${qa.answer}`;
    })
    .join('\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          'You are extracting structured, evidence-based insights from discovery interview answers.\n\nReturn ONLY valid JSON with this schema:\n{\n  "insights": [\n    {\n      "insightType": "ACTUAL_JOB"|"WHAT_WORKS"|"CHALLENGE"|"CONSTRAINT"|"VISION"|"BELIEF"|"RATING",\n      "category": null|"BUSINESS"|"TECHNOLOGY"|"PEOPLE"|"CUSTOMER"|"REGULATION",\n      "text": string,\n      "severity": null|1|2|3|4|5,\n      "impact": null|string,\n      "confidence": null|number (0.0-1.0),\n      "evidence": string[] (1-4 verbatim quotes from the answers)\n    }\n  ]\n}\n\nRules:\n- Only include insights supported by evidence quotes copied verbatim from the answers.\n- If you cannot quote evidence, do not include the insight.\n- Keep 6-14 insights.\n- Avoid duplicates.',
      },
      { role: 'user', content: `Answers (source of truth):\n\n${compact}` },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseJson<{ insights: ExtractedConversationInsight[] }>(raw);
  const list = parsed && Array.isArray(parsed.insights) ? parsed.insights : [];
  return list;
}

async function generateReportPayload(request: NextRequest, sessionId: string): Promise<ReportApiResponse> {
  const url = new URL('/api/conversation/report', request.nextUrl.origin);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('skipEmail', '1');

  const auth = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  const r = await fetch(url.toString(), {
    cache: 'no-store',
    headers:
      auth || cookie
        ? {
            ...(auth ? { authorization: auth } : {}),
            ...(cookie ? { cookie } : {}),
          }
        : undefined,
  });
  const raw = (await r.json().catch(() => null)) as (ReportApiResponse & { error?: unknown; details?: unknown }) | null;
  if (!r.ok || !raw || !raw.executiveSummary) {
    const details =
      raw && typeof raw.details === 'string' && raw.details.trim()
        ? raw.details
        : raw && typeof raw.error === 'string' && raw.error.trim()
          ? raw.error
          : raw
            ? JSON.stringify(raw)
            : 'No response body';

    throw new Error(`Report API failed (${r.status}): ${details}`);
  }
  return raw;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const report = await (prisma as any).conversationReport.findUnique({ where: { sessionId } });
    const insights = await prisma.conversationInsight.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ ok: true, report, insights }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch assessment';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const force = request.nextUrl.searchParams.get('force') === '1';
    const includeInsights = request.nextUrl.searchParams.get('insights') === '1';

    const body = (await request.json().catch(() => null)) as IncomingAssessmentBody | null;

    if (!force) {
      const existing = await (prisma as any).conversationReport.findUnique({ where: { sessionId } });
      if (existing) {
        const insights = await prisma.conversationInsight.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
        return NextResponse.json({ ok: true, report: existing, insights, reused: true }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      select: { id: true, workshopId: true, participantId: true },
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    const payload = body?.reportPayload?.executiveSummary
      ? body.reportPayload
      : await generateReportPayload(request, sessionId);

    const qaPairsForInsights =
      includeInsights && Array.isArray(payload.qaPairs)
        ? payload.qaPairs.map((q) => ({ phase: q.phase ?? null, question: q.question, answer: q.answer }))
        : [];

    const extracted = includeInsights ? await extractConversationInsights({ qaPairs: qaPairsForInsights }) : [];

    const insightRows = extracted
      .map((ins) => {
        const it = safeInsightType(ins.insightType);
        const cat = safeInsightCategory(ins.category);
        const text = (ins.text || '').trim();
        const evidence = Array.isArray(ins.evidence)
          ? ins.evidence
              .filter((e) => typeof e === 'string' && e.trim())
              .map((e) => e.trim())
              .slice(0, 4)
          : [];

        if (!it || !text || evidence.length === 0) return null;

        const severity = typeof ins.severity === 'number' && Number.isFinite(ins.severity)
          ? Math.max(1, Math.min(5, Math.round(ins.severity)))
          : null;

        const confidence = safeConfidence(ins.confidence);

        return {
          sessionId: session.id,
          workshopId: session.workshopId,
          participantId: session.participantId,
          insightType: it,
          category: cat,
          text,
          severity,
          impact: typeof ins.impact === 'string' ? ins.impact.trim() || null : null,
          sourceMessageIds: [],
          confidence: confidence ?? 0.8,
        };
      })
      .filter(Boolean) as Array<{
        sessionId: string;
        workshopId: string;
        participantId: string;
        insightType: InsightType;
        category: InsightCategory | null;
        text: string;
        severity: number | null;
        impact: string | null;
        sourceMessageIds: string[];
        confidence: number;
      }>;

    const txOps: any[] = [];
    txOps.push(
      (prisma as any).conversationReport.upsert({
        where: { sessionId: session.id },
        create: {
          sessionId: session.id,
          workshopId: session.workshopId,
          participantId: session.participantId,
          executiveSummary: payload.executiveSummary,
          tone: payload.tone,
          feedback: payload.feedback,
          inputQuality: payload.inputQuality ?? undefined,
          keyInsights: payload.keyInsights ?? undefined,
          phaseInsights: payload.phaseInsights ?? undefined,
          wordCloudThemes: payload.wordCloudThemes ?? undefined,
          modelVersion: 'assessment-v1',
        },
        update: {
          executiveSummary: payload.executiveSummary,
          tone: payload.tone,
          feedback: payload.feedback,
          inputQuality: payload.inputQuality ?? undefined,
          keyInsights: payload.keyInsights ?? undefined,
          phaseInsights: payload.phaseInsights ?? undefined,
          wordCloudThemes: payload.wordCloudThemes ?? undefined,
          modelVersion: 'assessment-v1',
        },
      })
    );

    if (includeInsights) {
      txOps.push(prisma.conversationInsight.deleteMany({ where: { sessionId: session.id } }));
      if (insightRows.length > 0) {
        txOps.push(prisma.conversationInsight.createMany({ data: insightRows }));
      }
      txOps.push(
        prisma.conversationInsight.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'asc' },
        })
      );
    }

    const txResults = await prisma.$transaction(txOps);
    const report = txResults[0];
    const insights = includeInsights
      ? (txResults[txResults.length - 1] as unknown[])
      : await prisma.conversationInsight.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: 'asc' } });

    return NextResponse.json(
      { ok: true, report, insights, reused: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate assessment';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';

type ReimagineDomain = 'PEOPLE' | 'ORGANISATION' | 'CUSTOMER' | 'TECHNOLOGY' | 'REGULATION';
type ReimagineLabel = 'ASPIRATION' | 'DREAM' | 'CONSTRAINT' | 'FRICTION' | 'IDEA' | 'ASSUMPTION';
type ReimagineOrientation = 'CURRENT' | 'FUTURE' | 'TRANSITION' | 'ENABLING_REQUIREMENT';
type ReimaginePressureType = 'DEPENDS_ON' | 'CONSTRAINS' | 'BLOCKS';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SummaryDomainKey = 'People' | 'Organisation' | 'Technology' | 'Customer' | 'Regulation';

type SummaryDomainBlock = {
  futureState: string;
  wantsToBeAbleToDo: string[];
  believesMustChange: string[];
};

type SummaryContent = {
  generatedAt: string;
  organisationTheyDescribed: Record<SummaryDomainKey, SummaryDomainBlock>;
  keyPressurePoints: string[];
  dependencyMap: string[];
};

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function toDomainKey(d: ReimagineDomain): SummaryDomainKey {
  if (d === 'PEOPLE') return 'People';
  if (d === 'ORGANISATION') return 'Organisation';
  if (d === 'TECHNOLOGY') return 'Technology';
  if (d === 'CUSTOMER') return 'Customer';
  return 'Regulation';
}

function dedupe(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const t = (x || '').trim().replace(/\s+/g, ' ');
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

function pickTopIntentSentences(params: {
  signals: Array<{
    intentSentence: string | null;
    labels: ReimagineLabel[];
    domains: ReimagineDomain[];
    orientation: ReimagineOrientation | null;
    orientationConfidence: number | null;
  }>;
  domain: ReimagineDomain;
  wantLabels: ReimagineLabel[];
  wantOrientations: ReimagineOrientation[];
  limit: number;
}): string[] {
  const scored = params.signals
    .filter((s) => s.intentSentence && s.domains.includes(params.domain))
    .filter((s) => (s.orientation ? params.wantOrientations.includes(s.orientation) : false))
    .filter((s) => s.labels.some((l) => params.wantLabels.includes(l)))
    .map((s) => ({
      text: String(s.intentSentence || '').trim(),
      score: clamp01(typeof s.orientationConfidence === 'number' ? s.orientationConfidence : 0.5) + (s.labels.includes('DREAM') ? 0.15 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  return dedupe(scored.map((x) => x.text)).slice(0, params.limit);
}

function pressureSentence(edge: { fromDomain: ReimagineDomain; toDomain: ReimagineDomain; pressureType: ReimaginePressureType }): string {
  const from = toDomainKey(edge.fromDomain);
  const to = toDomainKey(edge.toDomain);
  const t = edge.pressureType;
  if (t === 'DEPENDS_ON') return `${from} ambition depends on ${to} enablement.`;
  if (t === 'CONSTRAINS') return `${to} constraints limit ${from} ambition.`;
  return `${to} blocks progress in ${from}.`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });

    const useOpenAI = request.nextUrl.searchParams.get('useOpenAI') !== '0';

    const signals = await (prisma as any).reimagineSignal.findMany({
      where: { workshopId, intentSentence: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        intentSentence: true,
        labels: true,
        domains: true,
        orientation: true,
        orientationConfidence: true,
        pressureEdges: true,
      },
      take: 1200,
    }) as Array<{
      id: string;
      intentSentence: string | null;
      labels: ReimagineLabel[];
      domains: ReimagineDomain[];
      orientation: ReimagineOrientation | null;
      orientationConfidence: number | null;
      pressureEdges: unknown;
    }>;

    const edges = await (prisma as any).reimaginePressureEdge.findMany({
      where: { workshopId },
      orderBy: [{ supportCount: 'desc' }, { lastSeenAt: 'desc' }],
      select: { fromDomain: true, toDomain: true, pressureType: true, supportCount: true },
      take: 20,
    }) as Array<{
      fromDomain: ReimagineDomain;
      toDomain: ReimagineDomain;
      pressureType: ReimaginePressureType;
      supportCount: number;
    }>;

    const topEdges = edges.filter((e: { supportCount: number }) => (e.supportCount || 0) >= 2).slice(0, 8);

    const minSignals = 6;
    if (useOpenAI && signals.length < minSignals) {
      return NextResponse.json(
        {
          ok: false,
          error: `Not enough Reimagine signals yet (${signals.length}/${minSignals}). Capture more utterances, then retry.`,
          counts: { signals: signals.length, edges: edges.length },
        },
        { status: 400 }
      );
    }

    const base: SummaryContent = {
      generatedAt: new Date().toISOString(),
      organisationTheyDescribed: {
        People: { futureState: '', wantsToBeAbleToDo: [], believesMustChange: [] },
        Organisation: { futureState: '', wantsToBeAbleToDo: [], believesMustChange: [] },
        Technology: { futureState: '', wantsToBeAbleToDo: [], believesMustChange: [] },
        Customer: { futureState: '', wantsToBeAbleToDo: [], believesMustChange: [] },
        Regulation: { futureState: '', wantsToBeAbleToDo: [], believesMustChange: [] },
      },
      keyPressurePoints: dedupe(topEdges.map((e) => pressureSentence(e))).slice(0, 5),
      dependencyMap: dedupe(topEdges.map((e) => pressureSentence(e))).slice(0, 8),
    };

    if (!useOpenAI || !env.OPENAI_API_KEY) {
      const saved = await (prisma as any).reimagineSummary.create({
        data: { workshopId, content: base, modelVersion: 'reimagine-summary-rules-v0' },
        select: { id: true, createdAt: true, content: true },
      }) as { id: string; createdAt: Date; content: unknown };
      return NextResponse.json({ ok: true, workshopId, summaryId: saved.id, content: saved.content });
    }

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const domainBlocks: Array<{ domain: ReimagineDomain; key: SummaryDomainKey }> = [
      { domain: 'PEOPLE', key: 'People' },
      { domain: 'ORGANISATION', key: 'Organisation' },
      { domain: 'TECHNOLOGY', key: 'Technology' },
      { domain: 'CUSTOMER', key: 'Customer' },
      { domain: 'REGULATION', key: 'Regulation' },
    ];

    const domainInputs = domainBlocks.map(({ domain, key }) => {
      const future = pickTopIntentSentences({
        signals,
        domain,
        wantLabels: ['ASPIRATION', 'DREAM', 'IDEA'],
        wantOrientations: ['FUTURE', 'ENABLING_REQUIREMENT'],
        limit: 18,
      });
      const constraints = pickTopIntentSentences({
        signals,
        domain,
        wantLabels: ['CONSTRAINT', 'FRICTION', 'ASSUMPTION'],
        wantOrientations: ['CURRENT', 'TRANSITION'],
        limit: 14,
      });
      return { domain: key, futureSignals: future, constraintSignals: constraints };
    });

    const input = {
      workshop: {
        id: workshopId,
        includeRegulation: Boolean(workshop.includeRegulation),
      },
      domains: domainInputs,
      pressureSignals: topEdges.map((e: { fromDomain: ReimagineDomain; toDomain: ReimagineDomain; pressureType: ReimaginePressureType; supportCount: number }) => ({
        fromDomain: toDomainKey(e.fromDomain),
        toDomain: toDomainKey(e.toDomain),
        pressureType: e.pressureType,
        supportCount: e.supportCount,
      })),
      counts: {
        totalSignals: signals.length,
      },
    };

    const system =
      'You are generating a Reimagine future-state narrative for a DREAM workshop.\n\n' +
      'Hard rules:\n' +
      '- Never invent facts. Only use what is in the provided signals.\n' +
      '- Never suggest solutions, initiatives, tools, vendors, or products.\n' +
      '- Do not mention AI, models, prompts, or transcripts.\n' +
      '- Output must be narrative, not analytical.\n\n' +
      'Return strict JSON matching this schema:\n' +
      '{\n' +
      '  "organisationTheyDescribed": {\n' +
      '    "People": {"futureState": string, "wantsToBeAbleToDo": string[], "believesMustChange": string[]},\n' +
      '    "Organisation": {"futureState": string, "wantsToBeAbleToDo": string[], "believesMustChange": string[]},\n' +
      '    "Technology": {"futureState": string, "wantsToBeAbleToDo": string[], "believesMustChange": string[]},\n' +
      '    "Customer": {"futureState": string, "wantsToBeAbleToDo": string[], "believesMustChange": string[]},\n' +
      '    "Regulation": {"futureState": string, "wantsToBeAbleToDo": string[], "believesMustChange": string[]}\n' +
      '  },\n' +
      '  "keyPressurePoints": string[] (3-5 items),\n' +
      '  "dependencyMap": string[] (3-6 items)\n' +
      '}';

    const user =
      'Use only the provided signals.\n' +
      'Write as if you are reflecting back the organisation the team described if constraints were removed.\n' +
      'Avoid generic filler. Use capability/ways-of-operating language.\n\n' +
      'INPUT:\n' +
      JSON.stringify(input);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.25,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeParseJson<{
      organisationTheyDescribed?: Record<string, unknown>;
      keyPressurePoints?: unknown;
      dependencyMap?: unknown;
    }>(raw);

    const org = parsed && parsed.organisationTheyDescribed && typeof parsed.organisationTheyDescribed === 'object' ? parsed.organisationTheyDescribed : null;

    const block = (k: SummaryDomainKey): SummaryDomainBlock => {
      const rec = org && (org as any)[k] && typeof (org as any)[k] === 'object' ? (org as any)[k] : null;
      const futureState = rec && typeof rec.futureState === 'string' ? rec.futureState.trim() : '';
      const wantsToBeAbleToDo = rec && Array.isArray(rec.wantsToBeAbleToDo) ? rec.wantsToBeAbleToDo.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 6) : [];
      const believesMustChange = rec && Array.isArray(rec.believesMustChange) ? rec.believesMustChange.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 6) : [];
      return { futureState, wantsToBeAbleToDo, believesMustChange };
    };

    const keyPressurePoints = parsed && Array.isArray(parsed.keyPressurePoints)
      ? parsed.keyPressurePoints.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 5)
      : base.keyPressurePoints;

    const dependencyMap = parsed && Array.isArray(parsed.dependencyMap)
      ? parsed.dependencyMap.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 6)
      : base.dependencyMap;

    const content: SummaryContent = {
      generatedAt: new Date().toISOString(),
      organisationTheyDescribed: {
        People: block('People'),
        Organisation: block('Organisation'),
        Technology: block('Technology'),
        Customer: block('Customer'),
        Regulation: block('Regulation'),
      },
      keyPressurePoints: dedupe(keyPressurePoints),
      dependencyMap: dedupe(dependencyMap),
    };

    const saved = await (prisma as any).reimagineSummary.create({
      data: {
        workshopId,
        content,
        modelVersion: 'reimagine-summary-v1',
      },
      select: { id: true, content: true },
    }) as { id: string; content: unknown };

    return NextResponse.json({ ok: true, workshopId, summaryId: saved.id, content: saved.content });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate Reimagine summary';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

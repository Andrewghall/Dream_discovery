import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { prisma } from '@/lib/prisma';
import { buildDependencySynthesis, type DependencySynthesis, type DimensionMedians, type Focus } from '@/lib/insight-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type AssumptionsResponse = {
  ok: boolean;
  source: 'openai' | 'rules';
  synthesis: DependencySynthesis;
  error?: string;
};

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function isBoardSafe(text: string): boolean {
  const t = text.toLowerCase();
  const banned = ['feel', 'frustrat', 'motivat', 'happy', 'sad', 'angry', 'blame', 'lazy', 'resistan', 'culture'];
  return !banned.some((b) => t.includes(b));
}

function hasDataReference(text: string): boolean {
  return /\d/.test(text);
}

function normalise(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function deDup(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const t = normalise(x);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function pickFromProvided(params: {
  provided: DependencySynthesis;
  proposed: DependencySynthesis;
}): DependencySynthesis {
  const allowed = new Set<string>([...params.provided.primary, ...params.provided.supporting, ...params.provided.evidence].map((s) => normalise(s)));
  const clean = (xs: string[]) => deDup(xs).map((x) => normalise(x)).filter((x) => allowed.has(x));
  return {
    primary: clean(params.proposed.primary).slice(0, 2),
    supporting: clean(params.proposed.supporting).slice(0, 3),
    evidence: clean(params.proposed.evidence).slice(0, 5),
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });

    const body = (await request.json().catch(() => null)) as { focus?: Focus; dimensions?: DimensionMedians[] } | null;

    const focus = (body?.focus || 'MASTER') as Focus;
    const dimensions = Array.isArray(body?.dimensions) ? body!.dimensions! : [];

    if (!dimensions.length) {
      return NextResponse.json({ ok: false, error: 'Missing dimensions' }, { status: 400 });
    }

    const deterministic = buildDependencySynthesis({ focus, dimensions });

    if (!process.env.OPENAI_API_KEY) {
      const resp: AssumptionsResponse = {
        ok: true,
        source: 'rules',
        synthesis: deterministic,
        error: 'Summary assumptions unavailable',
      };
      return NextResponse.json(resp);
    }

    const system =
      'You are a discovery synthesis assistant.\n\n' +
      'Task: select and order pre-written insight statements for an executive audience.\n\n' +
      'Non-negotiable rules:\n' +
      '- You MUST NOT invent or rewrite content. You may ONLY select from the provided statements.\n' +
      '- You MUST NOT add new numbers, claims, or recommendations.\n' +
      '- Use plain business English. Avoid AI terminology. Avoid psychological language.\n\n' +
      'Return ONLY valid JSON with schema:\n' +
      '{ "primary": string[] (max 2), "supporting": string[] (max 3), "evidence": string[] (max 5) }';

    const user = {
      focus,
      dimensions,
      provided: deterministic,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content:
            'Select and order the best statements from provided.primary/provided.supporting/provided.evidence. Return JSON only.\n\nINPUT:\n' +
            JSON.stringify(user),
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    const parsed = safeParseJson<DependencySynthesis>(raw);
    const proposed: DependencySynthesis | null =
      parsed &&
      Array.isArray((parsed as any).primary) &&
      Array.isArray((parsed as any).supporting) &&
      Array.isArray((parsed as any).evidence)
        ? {
            primary: (parsed as any).primary,
            supporting: (parsed as any).supporting,
            evidence: (parsed as any).evidence,
          }
        : null;

    if (!proposed) {
      const resp: AssumptionsResponse = { ok: true, source: 'rules', synthesis: deterministic, error: 'Summary assumptions unavailable' };
      return NextResponse.json(resp);
    }

    const picked = pickFromProvided({ provided: deterministic, proposed });
    const validateNarrative = (t: string) => isBoardSafe(t);
    const validateEvidence = (t: string) => isBoardSafe(t) && hasDataReference(t);
    const valid =
      picked.primary.length >= 1 &&
      picked.primary.length <= 2 &&
      picked.supporting.length >= 1 &&
      picked.supporting.length <= 3 &&
      picked.evidence.length <= 5 &&
      picked.primary.every(validateNarrative) &&
      picked.supporting.every(validateNarrative) &&
      picked.evidence.every(validateEvidence);

    if (!valid) {
      const resp: AssumptionsResponse = { ok: true, source: 'rules', synthesis: deterministic, error: 'Summary assumptions unavailable' };
      return NextResponse.json(resp);
    }

    const resp: AssumptionsResponse = { ok: true, source: 'openai', synthesis: picked };
    return NextResponse.json(resp);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate assumptions';
    const fallback: DependencySynthesis = {
      primary: ['Summary assumptions unavailable.'],
      supporting: [],
      evidence: [],
    };
    return NextResponse.json({ ok: true, source: 'rules', synthesis: fallback, error: message } satisfies AssumptionsResponse);
  }
}

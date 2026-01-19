import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { prisma } from '@/lib/prisma';
import { computeInsightFeatures, buildRuleBackedBullets, type DimensionMedians } from '@/lib/insight-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Focus = 'MASTER' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

type AgentBullet = {
  text: string;
  drivers: string[];
};

type AssumptionsResponse = {
  ok: boolean;
  source: 'openai' | 'rules';
  bullets: AgentBullet[];
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

function normaliseBullet(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });

    const body = (await request.json().catch(() => null)) as {
      focus?: Focus;
      dimensions?: DimensionMedians[];
    } | null;

    const focus = (body?.focus || 'MASTER') as Focus;
    const dimensions = Array.isArray(body?.dimensions) ? body!.dimensions! : [];

    if (!dimensions.length) {
      return NextResponse.json({ ok: false, error: 'Missing dimensions' }, { status: 400 });
    }

    const features = computeInsightFeatures(dimensions);
    const rule = buildRuleBackedBullets({ focus, dimensions, features });

    const ruleBullets: AgentBullet[] = rule
      .slice(0, 6)
      .map((b) => ({ text: normaliseBullet(b.text), drivers: b.drivers }));

    if (!process.env.OPENAI_API_KEY) {
      const resp: AssumptionsResponse = { ok: true, source: 'rules', bullets: ruleBullets, error: 'OpenAI not configured' };
      return NextResponse.json(resp);
    }

    const system =
      'You generate board-ready summary assumptions from numeric capability spider data.\n\n' +
      'Non-negotiable rules:\n' +
      '- Do not invent facts or numbers. Use only the supplied medians and features.\n' +
      '- Every bullet must reference the specific data pattern driving it (gap, imbalance, bottleneck, stagnation, dependency).\n' +
      '- No psychological interpretation (avoid "feel", "motivation", "culture").\n' +
      '- 4 to 6 bullets only. Each bullet must include at least one number from the medians/features.\n' +
      '- Keep each bullet concise (<= 180 characters).\n\n' +
      'Return ONLY valid JSON with schema:\n' +
      '{ "bullets": [ { "text": string, "drivers": string[] } ] }\n\n' +
      'Drivers must be plain identifiers referencing the provided features (e.g. "gap_to_target:Customer", "stagnation:Organisation", "dependency:customer_requires_tech_enablement").';

    const user = {
      focus,
      dimensions,
      features,
      ruleCandidates: rule,
      requiredDimensions: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'],
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content:
            'Use the input JSON as the sole source of truth. Produce bullets ordered from highest-signal to lowest-signal. Return JSON only.\n\nINPUT:\n' +
            JSON.stringify(user),
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    const parsed = safeParseJson<{ bullets: AgentBullet[] }>(raw);
    const bullets = parsed && Array.isArray(parsed.bullets) ? parsed.bullets : null;

    if (!bullets || bullets.length < 4 || bullets.length > 6) {
      const resp: AssumptionsResponse = { ok: true, source: 'rules', bullets: ruleBullets, error: 'OpenAI output invalid' };
      return NextResponse.json(resp);
    }

    const cleaned: AgentBullet[] = bullets
      .map((b) => ({
        text: normaliseBullet(String(b.text || '')),
        drivers: Array.isArray(b.drivers) ? b.drivers.map((x) => String(x || '').trim()).filter(Boolean) : [],
      }))
      .filter((b) => b.text && b.drivers.length > 0)
      .slice(0, 6);

    const valid =
      cleaned.length >= 4 &&
      cleaned.every((b) => isBoardSafe(b.text) && hasDataReference(b.text) && b.text.length <= 180);

    if (!valid) {
      const resp: AssumptionsResponse = { ok: true, source: 'rules', bullets: ruleBullets, error: 'OpenAI bullets failed validation' };
      return NextResponse.json(resp);
    }

    const resp: AssumptionsResponse = { ok: true, source: 'openai', bullets: cleaned };
    return NextResponse.json(resp);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate assumptions';
    return NextResponse.json({ ok: true, source: 'rules', bullets: [], error: message } satisfies AssumptionsResponse);
  }
}

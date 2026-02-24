import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// ── Helpers ──────────────────────────────────────────────────────────

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Normalise actor name: trim, capitalise first letter, lowercase rest */
function normaliseActorName(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// ── Actor aggregation types ──────────────────────────────────────────

type ActorInteraction = {
  withActor: string;
  action: string;
  sentiment: string;
  context: string;
  utteranceText: string;
};

type AggregatedActor = {
  mentions: number;
  roles: Set<string>;
  domains: Set<string>;
  sentiments: string[];
  interactions: ActorInteraction[];
};

// ── Extract actors from a single AgenticAnalysis record ─────────────

function extractActorsFromAnalysis(
  analysis: {
    actors?: unknown;
    domains?: unknown;
    sentimentTone?: string;
  },
  utteranceText: string,
  actorMap: Map<string, AggregatedActor>,
) {
  const actors = safeArray(analysis.actors);
  const domains = safeArray(analysis.domains);
  const domainNames: string[] = domains
    .filter((d): d is Record<string, unknown> => d != null && typeof d === 'object' && !Array.isArray(d))
    .map((d) => typeof d.domain === 'string' ? d.domain.trim() : '')
    .filter(Boolean);

  for (const rawActor of actors) {
    if (!rawActor || typeof rawActor !== 'object' || Array.isArray(rawActor)) continue;
    const a = rawActor as Record<string, unknown>;

    const name = normaliseActorName(typeof a.name === 'string' ? a.name : '');
    if (!name) continue;

    const role = typeof a.role === 'string' ? a.role.trim() : '';
    const interactions = safeArray(a.interactions);

    let entry = actorMap.get(name);
    if (!entry) {
      entry = { mentions: 0, roles: new Set(), domains: new Set(), sentiments: [], interactions: [] };
      actorMap.set(name, entry);
    }

    entry.mentions += 1;
    if (role) entry.roles.add(role);
    for (const d of domainNames) entry.domains.add(d);
    if (analysis.sentimentTone) entry.sentiments.push(analysis.sentimentTone);

    for (const rawInt of interactions) {
      if (!rawInt || typeof rawInt !== 'object' || Array.isArray(rawInt)) continue;
      const inter = rawInt as Record<string, unknown>;
      entry.interactions.push({
        withActor: normaliseActorName(typeof inter.withActor === 'string' ? inter.withActor : ''),
        action: typeof inter.action === 'string' ? inter.action.trim() : '',
        sentiment: typeof inter.sentiment === 'string' ? inter.sentiment.trim() : '',
        context: typeof inter.context === 'string' ? inter.context.trim() : '',
        utteranceText,
      });
    }
  }
}

// ── GPT journey synthesis ────────────────────────────────────────────

async function synthesiseJourney(
  actorMap: Map<string, AggregatedActor>,
): Promise<{ journey: unknown; actors: unknown[] }> {
  // Build a summary of all interactions for the prompt
  const actorSummaries: string[] = [];
  for (const [name, data] of actorMap) {
    const roles = [...data.roles].join(', ') || 'unknown';
    const domains = [...data.domains].join(', ') || 'unknown';
    const sentimentCounts: Record<string, number> = {};
    for (const s of data.sentiments) {
      sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
    }

    const interactionLines = data.interactions
      .filter((i) => i.withActor && i.action)
      .map((i) => `  - ${i.action} with ${i.withActor} [${i.sentiment || 'neutral'}]: "${i.context || i.utteranceText}"`)
      .slice(0, 15)
      .join('\n');

    actorSummaries.push(
      `Actor: ${name} (mentions: ${data.mentions}, roles: ${roles}, domains: ${domains})\n` +
      `Sentiments: ${JSON.stringify(sentimentCounts)}\n` +
      `Interactions:\n${interactionLines || '  (none)'}`,
    );
  }

  const userPrompt = `Here are the actors and their interactions extracted from a workshop:\n\n${actorSummaries.join('\n\n')}\n\nSynthesise a customer journey flow and actor profiles from this data.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You are a business process analyst. Given actor interactions from a workshop, synthesise a customer journey flow.\n\n' +
          'Return strict JSON with this schema:\n' +
          '{\n' +
          '  "journey": {\n' +
          '    "centralActor": "<string: the main actor the journey revolves around>",\n' +
          '    "steps": [\n' +
          '      {\n' +
          '        "order": <number>,\n' +
          '        "action": "<string>",\n' +
          '        "channel": "<string or null>",\n' +
          '        "actors": ["<string>", ...],\n' +
          '        "sentiment": "<string>",\n' +
          '        "insights": ["<string>", ...],\n' +
          '        "painPoints": ["<string>", ...]\n' +
          '      }\n' +
          '    ]\n' +
          '  },\n' +
          '  "actors": [\n' +
          '    {\n' +
          '      "name": "<string>",\n' +
          '      "role": "<string>",\n' +
          '      "mentionCount": <number>,\n' +
          '      "domains": ["<string>", ...],\n' +
          '      "sentimentBreakdown": {"<sentiment>": <count>, ...},\n' +
          '      "keyInteractions": [\n' +
          '        {\n' +
          '          "withActor": "<string>",\n' +
          '          "frequency": <number>,\n' +
          '          "primaryAction": "<string>",\n' +
          '          "primarySentiment": "<string>"\n' +
          '        }\n' +
          '      ]\n' +
          '    }\n' +
          '  ]\n' +
          '}',
      },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
  const parsed = safeParseJson<{ journey?: unknown; actors?: unknown[] }>(raw);

  return {
    journey: parsed?.journey ?? null,
    actors: safeArray(parsed?.actors),
  };
}

// ── GET handler ──────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }
    const snapshotId = request.nextUrl.searchParams.get('snapshotId');

    const actorMap = new Map<string, AggregatedActor>();

    if (snapshotId) {
      // ── Path A: load actors from a snapshot's payload ──────────
      const snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
        where: {
          id: snapshotId,
          workshopId,
        },
      });

      if (!snapshot) {
        return NextResponse.json(
          { ok: false, error: 'Snapshot not found' },
          { status: 404 },
        );
      }

      const payload = snapshot.payload as Record<string, unknown> | null;
      const nodesById = payload?.nodesById;

      if (nodesById && typeof nodesById === 'object' && !Array.isArray(nodesById)) {
        for (const node of Object.values(nodesById as Record<string, unknown>)) {
          if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
          const n = node as Record<string, unknown>;
          const analysis = n.agenticAnalysis;
          if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) continue;

          const utteranceText = typeof n.rawText === 'string' ? n.rawText : '';
          extractActorsFromAnalysis(
            analysis as { actors?: unknown; domains?: unknown; sentimentTone?: string },
            utteranceText,
            actorMap,
          );
        }
      }
    } else {
      // ── Path B: load all AgenticAnalysis records for the workshop ──
      const analyses = await prisma.agenticAnalysis.findMany({
        where: { dataPoint: { workshopId } },
        include: { dataPoint: { select: { rawText: true, speakerId: true } } },
        orderBy: { createdAt: 'asc' },
      });

      for (const record of analyses) {
        const utteranceText = record.dataPoint?.rawText || '';
        extractActorsFromAnalysis(
          {
            actors: record.actors,
            domains: record.domains,
            sentimentTone: record.sentimentTone,
          },
          utteranceText,
          actorMap,
        );
      }
    }

    // ── No actors found at all ───────────────────────────────────
    if (actorMap.size === 0) {
      return NextResponse.json({
        ok: true,
        journey: null,
        actors: [],
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Synthesise journey via GPT-4o-mini ───────────────────────
    const { journey, actors } = await synthesiseJourney(actorMap);

    return NextResponse.json({
      ok: true,
      journey,
      actors,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error synthesising actor journeys:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to synthesise actor journeys' },
      { status: 500 },
    );
  }
}

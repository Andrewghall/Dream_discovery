/**
 * POST /api/admin/workshops/[id]/journey/regenerate
 *
 * Uses GPT-4o to generate a fresh LiveJourneyData from the session's
 * hemisphere nodes and the workshop blueprint (stages, actors, lenses).
 *
 * Returns: { liveJourney: LiveJourneyData }
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import type {
  LiveJourneyData,
  LiveJourneyInteraction,
  LiveJourneyActor,
} from '@/lib/cognitive-guidance/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Helpers ────────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try to extract JSON object/array from surrounding text
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

type RawNode = {
  rawText?: string;
  classification?: {
    primaryType?: string;
    confidence?: number;
    keywords?: string[];
    suggestedArea?: string;
  };
  agenticAnalysis?: {
    domains?: Array<{ domain: string; relevance: number }>;
    actors?: Array<{ name: string; role: string }>;
    semanticMeaning?: string;
    sentimentTone?: string;
  };
  dialoguePhase?: string;
};

// ── Route handler ──────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  // Auth
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  // ── Load workshop + blueprint ──────────────────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true, name: true, blueprint: true, prepResearch: true },
  });
  if (!workshop) {
    return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
  }

  const blueprint = workshop.blueprint ? readBlueprintFromJson(workshop.blueprint) : null;

  // ── Load latest LiveSessionVersion ────────────────────────────────
  const version = await (prisma as any).liveSessionVersion.findFirst({
    where: { workshopId },
    orderBy: { createdAt: 'desc' },
    select: { payload: true },
  });

  // Also try snapshot as fallback for node data
  const snapshot = !version
    ? await (prisma as any).liveWorkshopSnapshot.findFirst({
        where: { workshopId },
        orderBy: { createdAt: 'desc' },
        select: { payload: true },
      })
    : null;

  const versionPayload = version?.payload as Record<string, unknown> | null;
  const snapshotPayload = snapshot?.payload as Record<string, unknown> | null;

  // Extract CogNodes from version payload (array of [id, node] tuples)
  const cogNodesRaw: RawNode[] = [];
  if (versionPayload?.cogNodes && Array.isArray(versionPayload.cogNodes)) {
    for (const entry of versionPayload.cogNodes) {
      if (Array.isArray(entry) && entry.length === 2) {
        cogNodesRaw.push(entry[1] as RawNode);
      }
    }
  }

  // Fallback: extract from snapshot nodesById
  if (cogNodesRaw.length === 0 && snapshotPayload) {
    const nodesById = (snapshotPayload.nodesById ?? snapshotPayload.nodes) as Record<string, RawNode> | null;
    if (nodesById && typeof nodesById === 'object') {
      cogNodesRaw.push(...Object.values(nodesById));
    }
  }

  // ── Sample top nodes by confidence ───────────────────────────────
  const sorted = cogNodesRaw
    .filter(n => n.rawText && n.rawText.trim().length > 10)
    .sort((a, b) => (b.classification?.confidence ?? 0) - (a.classification?.confidence ?? 0))
    .slice(0, 200);

  const nodesSummary = sorted
    .map(n => {
      const domain = n.agenticAnalysis?.domains?.[0]?.domain || n.classification?.suggestedArea || '';
      const phase = n.dialoguePhase || '';
      const sentiment = n.agenticAnalysis?.sentimentTone || 'neutral';
      const type = n.classification?.primaryType || '';
      return `[${phase}|${domain}|${type}|${sentiment}] ${(n.rawText || '').slice(0, 200)}`;
    })
    .join('\n');

  // ── Build context from blueprint / prep ──────────────────────────
  const stages: string[] =
    blueprint?.journeyStages?.map((s: { name: string }) => s.name) ??
    (versionPayload?.liveJourney as any)?.stages ??
    ['Booking & Pre-trip', 'Check-in & Departure', 'Disruption & Real-time', 'In-flight Experience', 'Arrival & Baggage', 'Post-trip & Recovery', 'Loyalty & Retention'];

  // Blueprint doesn't carry actors — pull from the saved session journey or start empty
  const blueprintActors: LiveJourneyActor[] =
    (versionPayload?.liveJourney as any)?.actors ??
    [];

  const lensNames: string[] =
    blueprint?.lenses?.map((l: { name: string }) => l.name) ??
    ['Customer', 'People', 'Operations', 'Technology', 'Regulation', 'Organisation'];

  const companyName = workshop.name || 'the client';

  // Prep research context for richer output
  let prepContext = '';
  if (workshop.prepResearch && typeof workshop.prepResearch === 'object') {
    const r = workshop.prepResearch as Record<string, unknown>;
    const parts: string[] = [];
    if (r.companyOverview) parts.push(String(r.companyOverview).slice(0, 300));
    if (r.industryContext) parts.push(String(r.industryContext).slice(0, 200));
    prepContext = parts.join(' ');
  }

  const stagesList = stages.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const actorsList = blueprintActors.length > 0
    ? blueprintActors.map(a => `- ${a.name} (${a.role})`).join('\n')
    : '- Passenger\n- Contact Centre Agent\n- Manager';
  const lensesList = lensNames.join(', ');

  const nowMs = Date.now();

  // ── Call GPT-4o ──────────────────────────────────────────────────
  const systemPrompt = `You are a journey mapping expert helping analyse a workshop transcript for ${companyName}.
${prepContext ? `Context: ${prepContext}` : ''}

Your job is to generate a rich LiveJourneyData object from the workshop evidence.

Journey stages (use these exact stage names):
${stagesList}

Key actors to consider (include all relevant ones, add others if evidenced):
${actorsList}

Workshop lenses: ${lensesList}

Return ONLY valid JSON matching this exact schema:
{
  "stages": string[],        // use the stage list above verbatim
  "actors": [{ "name": string, "role": string, "mentionCount": number }],
  "interactions": [{
    "id": string,            // unique short id e.g. "i_001"
    "actor": string,         // must match an actor name
    "stage": string,         // must match a stage name
    "action": string,        // 2-3 sentences describing what happens
    "context": string,       // 1 sentence: why this matters
    "sentiment": "positive" | "neutral" | "concerned" | "critical",
    "businessIntensity": number,   // 0.0-1.0
    "customerIntensity": number,   // 0.0-1.0
    "aiAgencyNow": "human" | "assisted" | "autonomous",
    "aiAgencyFuture": "human" | "assisted" | "autonomous",
    "isPainPoint": boolean,
    "isMomentOfTruth": boolean,
    "sourceNodeIds": [],
    "addedBy": "ai",
    "createdAtMs": ${nowMs}
  }]
}

Rules:
- Generate 30–50 meaningful interactions spread across ALL stages and ALL actors — sparse coverage is not acceptable
- Base interactions ONLY on evidence from the transcript nodes below
- Mark pain points (isPainPoint: true) where frustration or failure is evident
- Mark moments of truth (isMomentOfTruth: true) for pivotal experience moments
- Sentiment must reflect the transcript tone: critical for serious failures, concerned for friction, positive for wins
- businessIntensity 0.0 = low effort/cost, 1.0 = high effort/cost for the business
- customerIntensity 0.0 = seamless for customer, 1.0 = high friction/delight for customer
- aiAgencyFuture should be "assisted" or "autonomous" where AI could help
- Return ONLY the JSON object, no markdown, no explanation`;

  const userPrompt = `Workshop transcript nodes (${sorted.length} of ${cogNodesRaw.length} total, top by confidence):\n\n${nodesSummary || 'No detailed node data available — generate interactions based on the actor and stage context.'}`;

  let liveJourney: LiveJourneyData;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    const parsed = safeParseJson<{
      stages?: string[];
      actors?: Array<{ name: string; role: string; mentionCount?: number }>;
      interactions?: Array<Record<string, unknown>>;
    }>(raw);

    if (!parsed?.interactions?.length) {
      return NextResponse.json(
        { error: 'AI did not return valid interaction data. Try again.' },
        { status: 502 },
      );
    }

    // Normalise and validate interactions
    const validActorNames = new Set(
      (parsed.actors ?? blueprintActors).map(a => a.name),
    );
    const validStageNames = new Set(parsed.stages ?? stages);

    const interactions: LiveJourneyInteraction[] = (parsed.interactions ?? [])
      .filter(i => typeof i === 'object' && i !== null)
      .map((raw, idx) => {
        const actor = typeof raw.actor === 'string' && validActorNames.has(raw.actor)
          ? raw.actor
          : Array.from(validActorNames)[0] ?? 'Unknown';
        const stage = typeof raw.stage === 'string' && validStageNames.has(raw.stage)
          ? raw.stage
          : Array.from(validStageNames)[0] ?? 'Unknown';

        return {
          id: typeof raw.id === 'string' ? raw.id : `ai_${nanoid(6)}_${idx}`,
          actor,
          stage,
          action: typeof raw.action === 'string' ? raw.action : '',
          context: typeof raw.context === 'string' ? raw.context : '',
          sentiment: (['positive', 'neutral', 'concerned', 'critical'].includes(raw.sentiment as string)
            ? raw.sentiment
            : 'neutral') as LiveJourneyInteraction['sentiment'],
          businessIntensity: typeof raw.businessIntensity === 'number'
            ? Math.min(1, Math.max(0, raw.businessIntensity)) : 0.5,
          customerIntensity: typeof raw.customerIntensity === 'number'
            ? Math.min(1, Math.max(0, raw.customerIntensity)) : 0.5,
          aiAgencyNow: (['human', 'assisted', 'autonomous'].includes(raw.aiAgencyNow as string)
            ? raw.aiAgencyNow : 'human') as LiveJourneyInteraction['aiAgencyNow'],
          aiAgencyFuture: (['human', 'assisted', 'autonomous'].includes(raw.aiAgencyFuture as string)
            ? raw.aiAgencyFuture : 'assisted') as LiveJourneyInteraction['aiAgencyFuture'],
          isPainPoint: raw.isPainPoint === true,
          isMomentOfTruth: raw.isMomentOfTruth === true,
          sourceNodeIds: [],
          addedBy: 'ai',
          createdAtMs: nowMs,
        };
      });

    const actors: LiveJourneyActor[] = (parsed.actors ?? blueprintActors).map(a => ({
      name: a.name,
      role: a.role,
      mentionCount: typeof (a as any).mentionCount === 'number' ? (a as any).mentionCount : 0,
    }));

    liveJourney = {
      stages: (parsed.stages ?? stages),
      actors,
      interactions,
    };
  } catch (err) {
    console.error('Journey regeneration failed:', err);
    return NextResponse.json(
      { error: 'AI journey generation failed. Please try again.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ liveJourney });
}

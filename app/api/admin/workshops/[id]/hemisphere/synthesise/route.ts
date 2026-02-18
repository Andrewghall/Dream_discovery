/**
 * Hemisphere → Scratchpad AI Synthesis
 *
 * POST /api/admin/workshops/[id]/hemisphere/synthesise
 *
 * Takes a snapshot's node data, aggregates by domain/type/phase/actor,
 * calls GPT-4o to produce structured content for each scratchpad tab,
 * then upserts into WorkshopScratchpad.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const maxDuration = 120; // AI synthesis can take a while

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Types ──────────────────────────────────────────────────────────────

type SnapshotNode = {
  rawText: string;
  speakerId?: string;
  dialoguePhase?: string;
  classification?: {
    primaryType?: string;
    confidence?: number;
    keywords?: string[];
    suggestedArea?: string;
  };
  agenticAnalysis?: {
    domains?: Array<{ domain: string; relevance: number; reasoning: string }>;
    themes?: Array<{ label: string; category: string; confidence: number; reasoning: string }>;
    actors?: Array<{
      name: string;
      role: string;
      interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }>;
    }>;
    semanticMeaning?: string;
    sentimentTone?: string;
    overallConfidence?: number;
  };
};

type DomainBucket = {
  aspirations: string[];
  constraints: string[];
  enablers: string[];
  opportunities: string[];
  actions: string[];
  questions: string[];
};

// ── Helpers ────────────────────────────────────────────────────────────

function safeStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function aggregateNodes(nodesById: Record<string, SnapshotNode>) {
  const byDomain: Record<string, DomainBucket> = {};
  const byPhase: Record<string, SnapshotNode[]> = {
    REIMAGINE: [],
    CONSTRAINTS: [],
    DEFINE_APPROACH: [],
  };
  const allActors: Map<string, { role: string; mentions: number; interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }> }> = new Map();
  const allKeywords: Map<string, number> = new Map();
  let totalNodes = 0;

  for (const node of Object.values(nodesById)) {
    if (!node || !node.rawText) continue;
    totalNodes++;

    const phase = safeStr(node.dialoguePhase) || 'REIMAGINE';
    if (byPhase[phase]) byPhase[phase].push(node);

    const primaryType = safeStr(node.classification?.primaryType).toUpperCase();

    // Keywords
    if (Array.isArray(node.classification?.keywords)) {
      for (const kw of node.classification!.keywords) {
        const k = safeStr(kw).toLowerCase();
        if (k) allKeywords.set(k, (allKeywords.get(k) || 0) + 1);
      }
    }

    // Domains
    const domains = Array.isArray(node.agenticAnalysis?.domains) ? node.agenticAnalysis!.domains : [];
    for (const d of domains) {
      const domain = safeStr(d.domain);
      if (!domain) continue;
      if (!byDomain[domain]) byDomain[domain] = { aspirations: [], constraints: [], enablers: [], opportunities: [], actions: [], questions: [] };
      const bucket = byDomain[domain];

      if (['VISIONARY', 'OPPORTUNITY'].includes(primaryType)) {
        bucket.aspirations.push(node.rawText);
        if (primaryType === 'OPPORTUNITY') bucket.opportunities.push(node.rawText);
      } else if (['CONSTRAINT', 'RISK'].includes(primaryType)) {
        bucket.constraints.push(node.rawText);
      } else if (primaryType === 'ENABLER') {
        bucket.enablers.push(node.rawText);
      } else if (primaryType === 'ACTION') {
        bucket.actions.push(node.rawText);
      } else if (primaryType === 'QUESTION') {
        bucket.questions.push(node.rawText);
      } else {
        // INSIGHT etc — put in aspirations if reimagine phase, constraints if constraint phase
        if (phase === 'REIMAGINE') bucket.aspirations.push(node.rawText);
        else if (phase === 'CONSTRAINTS') bucket.constraints.push(node.rawText);
        else bucket.actions.push(node.rawText);
      }
    }

    // Actors
    if (Array.isArray(node.agenticAnalysis?.actors)) {
      for (const actor of node.agenticAnalysis!.actors) {
        const name = safeStr(actor.name).toLowerCase();
        if (!name) continue;
        const existing = allActors.get(name) || { role: safeStr(actor.role), mentions: 0, interactions: [] };
        existing.mentions++;
        if (Array.isArray(actor.interactions)) {
          existing.interactions.push(...actor.interactions);
        }
        allActors.set(name, existing);
      }
    }
  }

  // Top keywords (word cloud data)
  const topKeywords = [...allKeywords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }));

  // Top actors sorted by mentions
  const topActors = [...allActors.entries()]
    .sort((a, b) => b[1].mentions - a[1].mentions)
    .slice(0, 20)
    .map(([name, data]) => ({ name, ...data }));

  return { byDomain, byPhase, topKeywords, topActors, totalNodes };
}

function domainSummary(byDomain: Record<string, DomainBucket>, maxPerBucket = 15): string {
  const lines: string[] = [];
  for (const [domain, bucket] of Object.entries(byDomain)) {
    lines.push(`\n## ${domain}`);
    if (bucket.aspirations.length) lines.push(`Aspirations (${bucket.aspirations.length}):\n${bucket.aspirations.slice(0, maxPerBucket).map(t => `- ${t}`).join('\n')}`);
    if (bucket.constraints.length) lines.push(`Constraints (${bucket.constraints.length}):\n${bucket.constraints.slice(0, maxPerBucket).map(t => `- ${t}`).join('\n')}`);
    if (bucket.enablers.length) lines.push(`Enablers (${bucket.enablers.length}):\n${bucket.enablers.slice(0, maxPerBucket).map(t => `- ${t}`).join('\n')}`);
    if (bucket.opportunities.length) lines.push(`Opportunities (${bucket.opportunities.length}):\n${bucket.opportunities.slice(0, maxPerBucket).map(t => `- ${t}`).join('\n')}`);
    if (bucket.actions.length) lines.push(`Actions (${bucket.actions.length}):\n${bucket.actions.slice(0, maxPerBucket).map(t => `- ${t}`).join('\n')}`);
  }
  return lines.join('\n');
}

function actorSummary(topActors: Array<{ name: string; role: string; mentions: number; interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }> }>): string {
  return topActors.map(a => {
    const topInteractions = a.interactions.slice(0, 5).map(i => `  - ${i.action} with ${i.withActor} (${i.sentiment}): ${i.context}`).join('\n');
    return `- ${a.name} (${a.role}, ${a.mentions} mentions)\n${topInteractions}`;
  }).join('\n');
}

// ── GPT Prompts ────────────────────────────────────────────────────────

function buildSynthesisPrompt(workshopName: string, data: ReturnType<typeof aggregateNodes>): string {
  const domainText = domainSummary(data.byDomain);
  const actorText = actorSummary(data.topActors);
  const keywordText = data.topKeywords.slice(0, 30).map(k => `${k.word} (${k.count})`).join(', ');

  return `You are a senior strategy consultant writing a comprehensive workshop output report. This is a premium deliverable (clients pay £10,000+ for this). Write with executive authority, evidence-grounded insight, and strategic clarity.

Workshop: "${workshopName}"
Total data points analysed: ${data.totalNodes}
Phases covered: ${Object.entries(data.byPhase).filter(([, v]) => v.length > 0).map(([k, v]) => `${k} (${v.length} utterances)`).join(', ')}

Return ONLY valid JSON with this exact schema — every field is a string unless marked otherwise:

{
  "execSummary": {
    "visionStatement": "string — 2-3 sentence vision anchored in evidence",
    "strategicContext": "string — 2-3 paragraphs on business context and why this matters",
    "keyFindings": ["string array — 5-8 bullet-point findings with evidence"]
  },
  "discoveryOutput": {
    "strategicThemes": [
      { "domain": "string", "theme": "string", "evidence": "string", "severity": "HIGH|MEDIUM|LOW", "type": "ASPIRATION|CONSTRAINT|ENABLER|OPPORTUNITY" }
    ],
    "designPrinciples": ["string array — 4-6 design principles derived from the workshop"]
  },
  "reimagineContent": {
    "futureStateVision": "string — 2 paragraphs describing the aspirational future state",
    "domainAspirations": {
      "People": { "vision": "string", "keyThemes": ["string array"] },
      "Operations": { "vision": "string", "keyThemes": ["string array"] },
      "Customer": { "vision": "string", "keyThemes": ["string array"] },
      "Technology": { "vision": "string", "keyThemes": ["string array"] },
      "Regulation": { "vision": "string", "keyThemes": ["string array"] }
    }
  },
  "constraintsContent": {
    "overview": "string — 1-2 paragraphs summarising the constraint landscape",
    "riskMatrix": [
      { "constraint": "string", "domain": "string", "impact": "HIGH|MEDIUM|LOW", "urgency": "HIGH|MEDIUM|LOW", "evidence": "string" }
    ],
    "pressurePoints": [
      { "from": "string domain", "to": "string domain", "description": "string" }
    ]
  },
  "potentialSolution": {
    "overview": "string — 1-2 paragraphs on the proposed solution approach",
    "enablers": [
      { "title": "string", "domain": "string", "priority": "HIGH|MEDIUM|LOW", "description": "string", "dependencies": ["string array"] }
    ],
    "implementationPath": [
      { "phase": "string (e.g. Phase 1: Quick Wins)", "timeframe": "string", "actions": ["string array"], "outcomes": ["string array"] }
    ]
  },
  "commercialContent": {
    "investmentSummary": "string — overview of investment areas",
    "deliveryPhases": [
      { "name": "string", "duration": "string", "focus": "string", "deliverables": ["string array"] }
    ],
    "whatGetsBuilt": ["string array — concrete outputs/capabilities"]
  },
  "customerJourney": {
    "stages": ["string array — journey stage names in order"],
    "actors": [
      { "name": "string", "role": "string" }
    ],
    "interactions": [
      { "actor": "string", "stage": "string", "action": "string", "sentiment": "positive|neutral|concerned|critical", "context": "string", "isPainPoint": false, "isMomentOfTruth": false }
    ],
    "painPointSummary": "string — narrative summary of key pain points",
    "momentOfTruthSummary": "string — narrative on critical moments"
  },
  "summaryContent": {
    "executiveRecommendations": ["string array — 5-8 key recommendations"],
    "immediateActions": ["string array — actions for next 30 days"],
    "thirtyDayPlan": "string",
    "sixtyDayPlan": "string",
    "ninetyDayPlan": "string",
    "closingStatement": "string — powerful closing paragraph"
  }
}

Rules:
- Use ONLY the source material below. Do not invent facts.
- Write in confident, board-level language suitable for C-suite audiences.
- Ground every finding in evidence from the workshop data.
- For the customer journey: create 6-8 stages, 5-8 actors, and 15-25 interactions across the grid.
- Mark 3-5 interactions as pain points and 2-3 as moments of truth.
- The risk matrix should have 8-12 items.
- The enablers list should have 6-10 items.
- The implementation path should have 3-4 phases.

─── DOMAIN ANALYSIS ───
${domainText}

─── TOP ACTORS & INTERACTIONS ───
${actorText}

─── TOP KEYWORDS ───
${keywordText}`;
}

// ── Main Handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const body = await request.json().catch(() => ({}));
    const snapshotId = typeof body.snapshotId === 'string' ? body.snapshotId : null;

    // 1. Get workshop
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true, name: true, organizationId: true },
    });
    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    // 2. Get snapshot
    let snapshot: { id: string; payload: unknown } | null = null;
    if (snapshotId) {
      snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
        where: { id: snapshotId, workshopId },
        select: { id: true, payload: true },
      });
    }
    if (!snapshot) {
      // Fallback: latest snapshot
      snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
        where: { workshopId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, payload: true },
      });
    }
    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshot found. Save a live session snapshot first.' }, { status: 400 });
    }

    // 3. Extract nodes from snapshot payload
    const payload = snapshot.payload as Record<string, unknown> | null;
    const rawNodes = (payload && typeof payload === 'object')
      ? (payload.nodesById ?? payload.nodes)
      : null;
    if (!rawNodes || typeof rawNodes !== 'object') {
      return NextResponse.json({ error: 'Snapshot has no node data' }, { status: 400 });
    }

    // 4. Aggregate
    const aggregated = aggregateNodes(rawNodes as Record<string, SnapshotNode>);
    if (aggregated.totalNodes === 0) {
      return NextResponse.json({ error: 'Snapshot has no analysable data' }, { status: 400 });
    }

    // 5. Call GPT-4o
    const prompt = buildSynthesisPrompt(workshop.name || 'Workshop', aggregated);
    console.log(`[synthesise] Calling GPT-4o for workshop ${workshopId} (${aggregated.totalNodes} nodes)...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    let synthesised: Record<string, unknown>;
    try {
      synthesised = JSON.parse(raw);
    } catch {
      console.error('[synthesise] Failed to parse GPT response:', raw.slice(0, 500));
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    // 6. Upsert scratchpad
    const existing = await prisma.workshopScratchpad.findUnique({ where: { workshopId } });

    const jsonOrNull = (v: unknown) => (v && typeof v === 'object' ? v as Prisma.InputJsonValue : Prisma.DbNull);

    const scratchpadData = {
      execSummary: jsonOrNull(synthesised.execSummary),
      discoveryOutput: jsonOrNull(synthesised.discoveryOutput),
      reimagineContent: jsonOrNull(synthesised.reimagineContent),
      constraintsContent: jsonOrNull(synthesised.constraintsContent),
      potentialSolution: jsonOrNull(synthesised.potentialSolution),
      commercialContent: jsonOrNull(synthesised.commercialContent),
      customerJourney: jsonOrNull(synthesised.customerJourney),
      summaryContent: jsonOrNull(synthesised.summaryContent),
      generatedFromSnapshot: snapshot.id,
    };

    let scratchpad;
    if (existing) {
      scratchpad = await prisma.workshopScratchpad.update({
        where: { workshopId },
        data: { ...scratchpadData, updatedAt: new Date() },
      });
    } else {
      scratchpad = await prisma.workshopScratchpad.create({
        data: { workshopId, ...scratchpadData, status: 'DRAFT' },
      });
    }

    console.log(`[synthesise] ✓ Scratchpad ${existing ? 'updated' : 'created'} for workshop ${workshopId}`);

    return NextResponse.json({
      ok: true,
      scratchpadId: scratchpad.id,
      workshopId,
      snapshotId: snapshot.id,
      nodesProcessed: aggregated.totalNodes,
    });
  } catch (error) {
    console.error('[synthesise] Error:', error);
    return NextResponse.json({ error: 'Synthesis failed' }, { status: 500 });
  }
}

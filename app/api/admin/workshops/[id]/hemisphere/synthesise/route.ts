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
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

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
  let transformationalCount = 0;

  for (const node of Object.values(nodesById)) {
    if (!node || !node.rawText) continue;
    totalNodes++;

    const phase = safeStr(node.dialoguePhase) || 'REIMAGINE';
    if (byPhase[phase]) byPhase[phase].push(node);

    const primaryType = safeStr(node.classification?.primaryType).toUpperCase();

    // Count visionary/opportunity nodes for transformational ideas metric
    if (['VISIONARY', 'OPPORTUNITY'].includes(primaryType)) {
      transformationalCount++;
    }

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

  return { byDomain, byPhase, topKeywords, topActors, totalNodes, transformationalCount };
}

function domainSummary(byDomain: Record<string, DomainBucket>, maxPerBucket = 8): string {
  const trunc = (s: string) => s.length > 150 ? s.slice(0, 147) + '...' : s;
  const lines: string[] = [];
  for (const [domain, bucket] of Object.entries(byDomain)) {
    lines.push(`\n## ${domain}`);
    if (bucket.aspirations.length) lines.push(`Aspirations (${bucket.aspirations.length}):\n${bucket.aspirations.slice(0, maxPerBucket).map(t => `- ${trunc(t)}`).join('\n')}`);
    if (bucket.constraints.length) lines.push(`Constraints (${bucket.constraints.length}):\n${bucket.constraints.slice(0, maxPerBucket).map(t => `- ${trunc(t)}`).join('\n')}`);
    if (bucket.enablers.length) lines.push(`Enablers (${bucket.enablers.length}):\n${bucket.enablers.slice(0, maxPerBucket).map(t => `- ${trunc(t)}`).join('\n')}`);
    if (bucket.opportunities.length) lines.push(`Opportunities (${bucket.opportunities.length}):\n${bucket.opportunities.slice(0, maxPerBucket).map(t => `- ${trunc(t)}`).join('\n')}`);
    if (bucket.actions.length) lines.push(`Actions (${bucket.actions.length}):\n${bucket.actions.slice(0, maxPerBucket).map(t => `- ${trunc(t)}`).join('\n')}`);
  }
  return lines.join('\n');
}

function actorSummary(topActors: Array<{ name: string; role: string; mentions: number; interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }> }>): string {
  return topActors.slice(0, 12).map(a => {
    const topInteractions = a.interactions.slice(0, 3).map(i => `  - ${i.action} with ${i.withActor} (${i.sentiment})`).join('\n');
    return `- ${a.name} (${a.role}, ${a.mentions} mentions)\n${topInteractions}`;
  }).join('\n');
}

// ── GPT Prompts ────────────────────────────────────────────────────────

function buildSynthesisPrompt(workshopName: string, data: ReturnType<typeof aggregateNodes>): string {
  const domainText = domainSummary(data.byDomain);
  const actorText = actorSummary(data.topActors);
  const keywordText = data.topKeywords.slice(0, 30).map(k => `${k.word} (${k.count})`).join(', ');
  const domainNames = Object.keys(data.byDomain);
  const domainColors = ['blue', 'purple', 'green', 'orange', 'indigo', 'pink'];
  const domainIcons: Record<string, string> = {
    'customer': '👤', 'people': '👥', 'operations': '⚙️', 'technology': '💻',
    'regulation': '📋', 'default': '🔍',
  };

  return `You are a senior strategy consultant writing a comprehensive workshop output report. This is a premium deliverable (clients pay £10,000+ for this). Write with executive authority, evidence-grounded insight, and strategic clarity.

Workshop: "${workshopName}"
Total data points analysed: ${data.totalNodes}
Domains identified: ${domainNames.join(', ')}
Phases covered: ${Object.entries(data.byPhase).filter(([, v]) => v.length > 0).map(([k, v]) => `${k} (${v.length} utterances)`).join(', ')}

Return ONLY valid JSON. Follow this EXACT schema precisely — the UI components depend on these exact property names and structures:

{
  "execSummary": {
    "overview": "string — 3-5 sentence executive overview of the workshop findings and strategic direction",
    "metrics": {
      "participantsEngaged": ${data.topActors.length},
      "domainsExplored": ${domainNames.length},
      "insightsGenerated": ${data.totalNodes},
      "transformationalIdeas": ${data.transformationalCount}
    },
    "keyFindings": [
      {
        "title": "string — concise finding title",
        "description": "string — 2-3 sentence explanation grounded in evidence",
        "impact": "Critical or High or Transformational"
      }
    ]
  },
  "discoveryOutput": {
    "_aiSummary": "string — 3-5 sentence PROFOUND executive synthesis of the discovery findings. Go beyond restating findings — identify the deeper strategic implications, non-obvious connections, and the 'so what' a CEO would care about. Write with McKinsey-partner precision.",
    "participants": ${JSON.stringify(data.topActors.slice(0, 8).map(a => a.name))},
    "totalUtterances": ${data.totalNodes},
    "sections": [
${domainNames.map((dn, i) => {
  const bucket = data.byDomain[dn];
  const total = (bucket?.aspirations?.length || 0) + (bucket?.constraints?.length || 0) + (bucket?.enablers?.length || 0) + (bucket?.opportunities?.length || 0) + (bucket?.actions?.length || 0);
  const icon = domainIcons[dn.toLowerCase()] || domainIcons['default'];
  return `      {
        "domain": "${dn}",
        "icon": "${icon}",
        "color": "${domainColors[i % domainColors.length]}",
        "utteranceCount": ${total},
        "topThemes": ["generate 3-5 top theme labels for ${dn}"],
        "wordCloud": [{"word": "string", "size": 1-4}],
        "quotes": [{"text": "representative quote from the data", "author": "speaker role"}],
        "sentiment": {"concerned": 0-100, "neutral": 0-100, "optimistic": 0-100},
        "consensusLevel": 0-100
      }`;
}).join(',\n')}
    ]
  },
  "reimagineContent": {
    "_aiSummary": "string — 3-5 sentence executive synthesis of the reimagine vision. Capture the transformational shifts identified, why they matter, and the strategic imperative they create. Be profound, not generic.",
    "reimagineContent": {
      "title": "string — compelling title for the reimagine output",
      "description": "string — 2-3 sentence overview of what the reimagine session revealed",
      "subtitle": "string — supporting subtitle about what was explored",
      "supportingSection": {
        "title": "string — title for the core insight section",
        "description": "string — 1-2 sentence description",
        "points": ["4-6 key insight points as strings"]
      },
      "accordionSections": [
        {"title": "string", "description": "string", "points": ["3-5 points"]},
        {"title": "string", "description": "string", "points": ["3-5 points"]}
      ],
      "journeyMapping": {"title": "Customer Journey Mapping"},
      "primaryThemes": [
        {"title": "string — theme name", "weighting": "string — e.g. Mentioned by 85% of participants", "badge": "PRIMARY or CRITICAL", "description": "string — 2-3 sentence explanation of this theme and its significance", "details": ["3-4 supporting detail points for this theme"]}
      ],
      "shiftOne": {
        "title": "string — first key strategic shift",
        "description": "string — 2-3 sentence explanation",
        "details": ["3-4 supporting detail points"]
      },
      "supportingThemes": [
        {"title": "string", "weighting": "string", "badge": "SUPPORTING or EMERGING", "description": "string — 2-3 sentence explanation of this supporting theme", "details": ["3-4 supporting detail points"]}
      ],
      "shiftTwo": {
        "title": "string — second key strategic shift",
        "description": "string — 2-3 sentence explanation",
        "details": ["3-4 supporting detail points"]
      },
      "horizonVision": {
        "title": "Horizon Vision Alignment",
        "columns": [
          {"title": "Horizon 1: Foundation (Months 1-6)", "points": ["3-5 initiative points"]},
          {"title": "Horizon 2: Transformation (Months 6-18)", "points": ["3-5 initiative points"]}
        ]
      }
    }
  },
  "constraintsContent": {
    "_aiSummary": "string — 3-5 sentence executive synthesis of the constraint landscape. Which constraints are truly blocking vs manageable? What does the mitigation picture look like? What must be resolved first?",
    "regulatory": [
      {"title": "string", "description": "string — 1-2 sentences", "impact": "Critical or High or Medium or Low", "mitigation": "string — mitigation strategy"}
    ],
    "technical": [
      {"title": "string", "description": "string", "impact": "Critical or High or Medium or Low", "mitigation": "string"}
    ],
    "commercial": [
      {"title": "string", "description": "string", "impact": "Critical or High or Medium or Low", "mitigation": "string"}
    ],
    "organizational": [
      {"title": "string", "description": "string", "impact": "Critical or High or Medium or Low", "mitigation": "string"}
    ]
  },
  "potentialSolution": {
    "_aiSummary": "string — 3-5 sentence executive synthesis of the solution thesis. What makes this approach compelling? How does it address the core constraints? What is the implementation logic?",
    "overview": "string — 1-2 paragraphs on the proposed solution approach",
    "enablers": [
      {"title": "string", "domain": "string", "priority": "HIGH or MEDIUM or LOW", "description": "string", "dependencies": ["string array"]}
    ],
    "implementationPath": [
      {"phase": "string e.g. Phase 1: Quick Wins", "timeframe": "string", "actions": ["string array"], "outcomes": ["string array"]}
    ]
  },
  "commercialContent": {
    "_aiSummary": "string — 3-5 sentence executive synthesis of the investment case. Frame the ROI narrative, the phasing logic, and the risk-adjusted value proposition.",
    "investmentSummary": {
      "totalInvestment": "string — e.g. £1.8M",
      "fiveYearROI": "string — e.g. 340%",
      "paybackPeriod": "string — e.g. 14 months",
      "annualSavings": "string — e.g. £2.1M by Year 2"
    },
    "deliveryPhases": [
      {"phase": "string — e.g. Phase 1: Foundation", "duration": "string — e.g. Months 1-4", "investment": "string — e.g. £450K", "scope": ["3-5 scope items"], "outcomes": ["2-4 expected outcomes"]}
    ],
    "riskAssessment": [
      {"risk": "string", "probability": "High or Medium or Low", "impact": "Critical or High or Medium", "mitigation": "string"}
    ]
  },
  "customerJourney": {
    "_aiSummary": "string — 3-5 sentence executive synthesis of customer journey insights. Where do the critical pain points cluster? What are the moments of truth? What does this mean for transformation priorities?",
    "stages": ["6-8 journey stage names in order"],
    "actors": [{"name": "string", "role": "string"}],
    "interactions": [
      {"actor": "string (must match an actor name)", "stage": "string (must match a stage name)", "action": "string", "sentiment": "positive or neutral or concerned or critical", "context": "string", "isPainPoint": false, "isMomentOfTruth": false}
    ],
    "painPointSummary": "string — narrative summary of key pain points",
    "momentOfTruthSummary": "string — narrative on critical moments"
  },
  "summaryContent": {
    "_aiSummary": "string — 3-5 sentence final synthesis pulling together the entire workshop narrative arc from discovery through to recommended next steps. This is the concluding executive insight.",
    "keyFindings": [
      {"category": "string — e.g. Customer Impact", "findings": ["3-5 findings in this category"]}
    ],
    "recommendedNextSteps": [
      {"step": "string — step title", "timeframe": "string — e.g. Week 1-2", "owner": "string — e.g. Head of Operations", "actions": ["2-4 specific actions"]}
    ],
    "successMetrics": [
      {"metric": "string — metric name", "baseline": "string — current state", "target": "string — target state", "measurement": "string — how to measure"}
    ]
  }
}

CRITICAL RULES:
- Use ONLY the source material below. Do not invent facts.
- Be CONCISE. Keep descriptions to 1-2 sentences. Do NOT write essays.
- Write in confident, board-level language suitable for C-suite audiences.
- _aiSummary fields: These are EXECUTIVE INSIGHT summaries shown at the top of each output page. They must be PROFOUND — go beyond restating findings. Identify deeper strategic implications, non-obvious connections between themes, and the "so what" that a CEO would care about. Reference specific evidence from the data. Write with McKinsey-partner precision. Every sentence must carry weight. NEVER use generic consulting filler.
- execSummary.keyFindings: 5-7 findings. metrics values must be NUMBERS not strings.
- discoveryOutput.sections: exactly ${domainNames.length} sections. Each needs 8-10 wordCloud items (size 1-4). Sentiment MUST sum to 100.
- reimagineContent: 3-4 primaryThemes and 2-3 supportingThemes.
- constraintsContent: 2-3 items per category.
- potentialSolution.enablers: 5-8 items. implementationPath: 3 phases.
- commercialContent.deliveryPhases: 3 phases. riskAssessment: 3-5 risks.
- customerJourney: 6 stages, 5-6 actors, 15-20 interactions. Mark 3-4 as isPainPoint:true, 2 as isMomentOfTruth:true.
- summaryContent.keyFindings: 3-4 categories. recommendedNextSteps: 3 steps. successMetrics: 4 metrics.

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
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }
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
    console.log(`[synthesise] Prompt length: ${prompt.length} chars. Calling GPT-4o for workshop ${workshopId} (${aggregated.totalNodes} nodes)...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 12000,
      response_format: { type: 'json_object' },
    });
    console.log(`[synthesise] GPT responded. Usage: ${JSON.stringify(completion.usage)}`);

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

    // 5b. Force-overwrite metrics with real computed values (GPT may hallucinate them)
    if (synthesised.execSummary && typeof synthesised.execSummary === 'object') {
      const es = synthesised.execSummary as Record<string, unknown>;
      if (!es.metrics || typeof es.metrics !== 'object') es.metrics = {};
      const m = es.metrics as Record<string, unknown>;
      m.participantsEngaged = aggregated.topActors.length;
      m.domainsExplored = Object.keys(aggregated.byDomain).length;
      m.insightsGenerated = aggregated.totalNodes;
      m.transformationalIdeas = aggregated.transformationalCount;
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

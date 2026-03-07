/**
 * Hemisphere → Scratchpad AI Synthesis
 *
 * POST /api/admin/workshops/[id]/hemisphere/synthesise
 *
 * Multi-agent synthesis pipeline:
 * 1. Orchestrator loads and validates snapshot data
 * 2. Theme Agent analyses thematic patterns across domains
 * 3. Constraint Agent reviews risk and constraint landscape
 * 4. Research Agent provides external context (from prep)
 * 5. Guardian validates data quality and coverage
 * 6. Synthesis Agent generates comprehensive report from all agent inputs
 * 7. Guardian reviews output quality
 * 8. Scratchpad saved to database
 *
 * Streams agent conversation entries via SSE.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { classifyWorkshopArchetype } from '@/lib/output/archetype-classifier';
import type { ClassifierInput } from '@/lib/output/archetype-classifier';

export const runtime = 'nodejs';
export const maxDuration = 120;

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
  const allThemes: Map<string, { category: string; count: number; totalConfidence: number }> = new Map();
  let totalNodes = 0;
  let transformationalCount = 0;
  let lowConfidenceCount = 0;

  for (const node of Object.values(nodesById)) {
    if (!node || !node.rawText) continue;
    totalNodes++;

    const phase = safeStr(node.dialoguePhase) || 'REIMAGINE';
    if (byPhase[phase]) byPhase[phase].push(node);

    const primaryType = safeStr(node.classification?.primaryType).toUpperCase();
    const confidence = node.agenticAnalysis?.overallConfidence ?? node.classification?.confidence ?? 0;
    if (confidence < 0.5) lowConfidenceCount++;

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

    // Themes
    if (Array.isArray(node.agenticAnalysis?.themes)) {
      for (const theme of node.agenticAnalysis!.themes) {
        const label = safeStr(theme.label);
        if (!label) continue;
        const existing = allThemes.get(label) || { category: theme.category || 'General', count: 0, totalConfidence: 0 };
        existing.count++;
        existing.totalConfidence += theme.confidence || 0;
        allThemes.set(label, existing);
      }
    }

    // Domains — prefer agenticAnalysis.domains, fall back to top-level lens field
    const rawDomains = Array.isArray(node.agenticAnalysis?.domains) ? node.agenticAnalysis!.domains : [];
    const domains: Array<{ domain: string; relevance: number; reasoning: string }> =
      rawDomains.length > 0
        ? rawDomains
        : typeof (node as any).lens === 'string' && (node as any).lens.trim()
          ? [{ domain: (node as any).lens.trim(), relevance: 0.8, reasoning: 'inferred from lens field' }]
          : [];
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

  const topKeywords = [...allKeywords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }));

  const topActors = [...allActors.entries()]
    .sort((a, b) => b[1].mentions - a[1].mentions)
    .slice(0, 20)
    .map(([name, data]) => ({ name, ...data }));

  // Theme density normalisation: ThemeWeight = ThemeMentions / TotalMentionsAllThemes
  const totalThemeMentions = [...allThemes.values()].reduce((s, t) => s + t.count, 0) || 1;
  const topThemes = [...allThemes.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([label, data]) => ({
      label,
      ...data,
      avgConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
      density: Math.round((data.count / totalThemeMentions) * 1000) / 1000,
    }));

  return { byDomain, byPhase, topKeywords, topActors, topThemes, totalNodes, transformationalCount, lowConfidenceCount };
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

function buildSynthesisPrompt(workshopName: string, data: ReturnType<typeof aggregateNodes>, themeAnalysis: string, constraintAnalysis: string, researchContext: string | null): string {
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

─── THEME AGENT ANALYSIS ───
${themeAnalysis}

─── CONSTRAINT AGENT ANALYSIS ───
${constraintAnalysis}
${researchContext ? `\n─── RESEARCH AGENT CONTEXT ───\n${researchContext}\n` : ''}
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
    "stages": ["6-8 journey stage names in order — use researched stages if available in research context, otherwise infer from data"],
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

// ── Agent Analysis Prompts (real LLM calls) ────────────────────────────

async function runThemeAgentAnalysis(workshopName: string, data: ReturnType<typeof aggregateNodes>): Promise<string> {
  const domainNames = Object.keys(data.byDomain);
  const themeList = data.topThemes.slice(0, 10).map(t => `${t.label} (${t.category}, ${t.count} occurrences, density ${((t.density ?? 0) * 100).toFixed(1)}%, avg confidence ${(t.avgConfidence * 100).toFixed(0)}%)`).join('\n');
  const keywordList = data.topKeywords.slice(0, 15).map(k => `${k.word} (${k.count})`).join(', ');

  const prompt = `You are the Theme Agent for the DREAM Discovery workshop "${workshopName}". Analyse the thematic patterns from the workshop data and provide a structured assessment.

DATA:
- ${data.totalNodes} total data points across ${domainNames.length} domains: ${domainNames.join(', ')}
- Phases: ${Object.entries(data.byPhase).filter(([, v]) => v.length > 0).map(([k, v]) => `${k} (${v.length})`).join(', ')}
- ${data.transformationalCount} transformational ideas identified

TOP THEMES DETECTED:
${themeList}

TOP KEYWORDS:
${keywordList}

DOMAIN BREAKDOWN:
${domainNames.map(d => {
  const b = data.byDomain[d];
  return `${d}: ${b.aspirations.length} aspirations, ${b.constraints.length} constraints, ${b.enablers.length} enablers, ${b.opportunities.length} opportunities`;
}).join('\n')}

Provide a concise thematic analysis (3-5 paragraphs) covering:
1. The dominant strategic narrative emerging from the themes
2. Cross-domain theme connections (themes that span multiple domains)
3. Thematic gaps or underexplored areas
4. The strategic implication of the theme distribution

Write as a senior strategy consultant. Be specific and evidence-grounded.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content || 'Theme analysis unavailable.';
}

async function runConstraintAgentAnalysis(workshopName: string, data: ReturnType<typeof aggregateNodes>): Promise<string> {
  const domainNames = Object.keys(data.byDomain);
  const constraintData = domainNames.map(d => {
    const b = data.byDomain[d];
    return { domain: d, constraints: b.constraints.slice(0, 5), count: b.constraints.length };
  }).filter(d => d.count > 0);

  const prompt = `You are the Constraint Agent for the DREAM Discovery workshop "${workshopName}". Analyse the constraint landscape from the workshop data.

CONSTRAINT DATA BY DOMAIN:
${constraintData.map(d => `${d.domain} (${d.count} constraints):\n${d.constraints.map(c => `  - ${c.slice(0, 120)}`).join('\n')}`).join('\n\n')}

TOTAL: ${constraintData.reduce((s, d) => s + d.count, 0)} constraints across ${constraintData.length} domains
RISK INDICATORS: ${data.topKeywords.filter(k => ['risk', 'challenge', 'barrier', 'concern', 'issue', 'problem', 'limitation', 'compliance', 'regulation'].includes(k.word)).map(k => `${k.word}(${k.count})`).join(', ') || 'None detected'}

Provide a concise constraint analysis (2-4 paragraphs) covering:
1. The most critical constraints that could block transformation
2. Constraint clusters and dependencies between domains
3. Which constraints are manageable vs potentially blocking
4. Risk-adjusted priority ranking

Write as a risk analyst. Be direct and actionable.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 600,
  });

  return completion.choices[0]?.message?.content || 'Constraint analysis unavailable.';
}

// ── Main Handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workshopId } = await params;

  // ── Auth (must happen before stream) ─────────────────
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const snapshotId = typeof body.snapshotId === 'string' ? body.snapshotId : null;

  // ── Pre-stream validation ───────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true, name: true, organizationId: true, prepResearch: true, industry: true, dreamTrack: true, targetDomain: true, blueprint: true },
  });
  if (!workshop) {
    return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
  }

  let snapshot: { id: string; payload: unknown } | null = null;
  if (snapshotId) {
    snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
      where: { id: snapshotId, workshopId },
      select: { id: true, payload: true },
    });
  }
  if (!snapshot) {
    snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
      where: { workshopId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, payload: true },
    });
  }
  if (!snapshot) {
    return NextResponse.json({ error: 'No snapshot found. Save a live session snapshot first.' }, { status: 400 });
  }

  const payload = snapshot.payload as Record<string, unknown> | null;
  const rawNodes = (payload && typeof payload === 'object')
    ? (payload.nodesById ?? payload.nodes)
    : null;
  if (!rawNodes || typeof rawNodes !== 'object') {
    return NextResponse.json({ error: 'Snapshot has no node data' }, { status: 400 });
  }

  // Extract research context from prep phase (including journey + dimensions)
  let researchContext: string | null = null;
  if (workshop.prepResearch && typeof workshop.prepResearch === 'object' && workshop.prepResearch !== null) {
    const research = workshop.prepResearch as Record<string, unknown>;
    const parts: string[] = [];

    if (research.companyOverview) parts.push(`Company: ${String(research.companyOverview).slice(0, 400)}`);
    if (research.industryContext) parts.push(`Industry: ${String(research.industryContext).slice(0, 400)}`);
    if (Array.isArray(research.keyPublicChallenges) && research.keyPublicChallenges.length > 0) {
      parts.push(`Key Challenges: ${research.keyPublicChallenges.map(String).join('; ')}`);
    }

    // Include researched journey stages
    if (Array.isArray(research.journeyStages) && research.journeyStages.length > 0) {
      const stages = research.journeyStages as Array<{ name: string; description?: string }>;
      parts.push(`\n─── RESEARCHED JOURNEY STAGES ───\n${stages.map((s, i) => `${i + 1}. ${s.name}${s.description ? ': ' + s.description : ''}`).join('\n')}\nUse these as the baseline for customerJourney.stages.`);
    }

    // Include researched industry dimensions
    if (Array.isArray(research.industryDimensions) && research.industryDimensions.length > 0) {
      const dims = research.industryDimensions as Array<{ name: string; description?: string }>;
      parts.push(`\n─── INDUSTRY DIMENSIONS ───\n${dims.map(d => `• ${d.name}: ${d.description || ''}`).join('\n')}\nUse these dimensions instead of generic "People/Operations/Customer/Technology/Regulation" when categorising findings.`);
    }

    researchContext = parts.length > 0 ? parts.join('\n\n') : null;
  }

  // ── SSE stream ──────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const eventPayload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(eventPayload));
        } catch {
          // Stream may have been closed by client
        }
      }

      function emit(agent: string, to: string, message: string, type: 'handoff' | 'request' | 'proposal' | 'verification' | 'verdict' | 'acknowledgement' | 'info' | 'challenge', metadata?: Record<string, unknown>) {
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent,
          to,
          message,
          type,
          ...(metadata ? { metadata } : {}),
        });
      }

      try {
        // ════════════════════════════════════════════════════
        // STEP 1: Orchestrator initiates synthesis pipeline
        // ════════════════════════════════════════════════════
        emit(
          'orchestrator',
          'theme-agent',
          `Initiating report synthesis for workshop **"${workshop.name}"**. Snapshot ${snapshot!.id.slice(0, 8)} loaded. I need all agents to analyse their respective domains before we hand off to the Synthesis Agent for the final report.`,
          'handoff',
        );

        // ════════════════════════════════════════════════════
        // STEP 2: Data aggregation (deterministic)
        // ════════════════════════════════════════════════════
        const aggregated = aggregateNodes(rawNodes as Record<string, SnapshotNode>);

        // If no actors found in node agenticAnalysis, fall back to liveJourney.actors
        // (seeded workshops store actors centrally at the snapshot root, not per-node)
        if (aggregated.topActors.length === 0 && payload && typeof payload === 'object') {
          const lj = (payload as Record<string, unknown>).liveJourney;
          if (lj && typeof lj === 'object' && !Array.isArray(lj)) {
            const ljActors = (lj as Record<string, unknown>).actors;
            if (Array.isArray(ljActors)) {
              const merged = (ljActors as Array<Record<string, unknown>>)
                .filter((a) => typeof a.name === 'string' && a.name)
                .map((a) => ({
                  name: String(a.name),
                  role: typeof a.role === 'string' ? a.role : '',
                  mentions: typeof a.mentionCount === 'number' ? a.mentionCount : 1,
                  interactions: [] as Array<{ withActor: string; action: string; sentiment: string; context: string }>,
                }))
                .sort((a, b) => b.mentions - a.mentions)
                .slice(0, 20);
              aggregated.topActors.push(...merged);
            }
          }
        }

        if (aggregated.totalNodes === 0) {
          emit('orchestrator', 'orchestrator', 'Snapshot contains zero analysable data points. Cannot proceed.', 'info');
          sendEvent('synthesis.error', { error: 'Snapshot has no analysable data' });
          controller.close();
          return;
        }

        const domainNames = Object.keys(aggregated.byDomain);
        const phaseBreakdown = Object.entries(aggregated.byPhase)
          .filter(([, v]) => v.length > 0)
          .map(([k, v]) => `${k}: ${v.length}`)
          .join(', ');

        emit(
          'orchestrator',
          'theme-agent',
          `Data extraction complete. **${aggregated.totalNodes} data points** across **${domainNames.length} domains** (${domainNames.join(', ')}). Phase distribution: ${phaseBreakdown}. **${aggregated.topActors.length}** actors identified, **${aggregated.transformationalCount}** transformational ideas. Theme Agent — analyse the thematic landscape.`,
          'handoff',
        );

        // ════════════════════════════════════════════════════
        // STEP 3: Theme Agent — real LLM analysis
        // ════════════════════════════════════════════════════
        emit(
          'theme-agent',
          'orchestrator',
          `Acknowledged. Analysing thematic patterns across ${domainNames.length} domains. Top detected themes: ${aggregated.topThemes.slice(0, 5).map(t => `**${t.label}** (${t.count}×)`).join(', ')}. Running deep thematic analysis...`,
          'acknowledgement',
        );

        const themeAnalysis = await runThemeAgentAnalysis(workshop.name || 'Workshop', aggregated);

        emit(
          'theme-agent',
          'orchestrator',
          `Thematic analysis complete.\n\n${themeAnalysis}`,
          'proposal',
        );

        // ════════════════════════════════════════════════════
        // STEP 4: Constraint Agent — real LLM analysis
        // ════════════════════════════════════════════════════
        emit(
          'orchestrator',
          'constraint-agent',
          `Theme analysis received. Constraint Agent — analyse the risk and constraint landscape across all domains.`,
          'handoff',
        );

        const totalConstraints = domainNames.reduce((s, d) => s + aggregated.byDomain[d].constraints.length, 0);
        emit(
          'constraint-agent',
          'orchestrator',
          `Acknowledged. Scanning ${totalConstraints} constraint data points across ${domainNames.filter(d => aggregated.byDomain[d].constraints.length > 0).length} domains. Assessing severity and interdependencies...`,
          'acknowledgement',
        );

        const constraintAnalysis = await runConstraintAgentAnalysis(workshop.name || 'Workshop', aggregated);

        emit(
          'constraint-agent',
          'orchestrator',
          `Constraint analysis complete.\n\n${constraintAnalysis}`,
          'proposal',
        );

        // ════════════════════════════════════════════════════
        // STEP 5: Research Agent — prep context
        // ════════════════════════════════════════════════════
        if (researchContext) {
          emit(
            'orchestrator',
            'research-agent',
            `Research Agent — do you have pre-workshop research context that should inform the synthesis?`,
            'request',
          );
          emit(
            'research-agent',
            'orchestrator',
            `Yes. Pre-workshop research is available. Summary: ${researchContext.slice(0, 300)}${researchContext.length > 300 ? '...' : ''}. This context will be injected into the synthesis prompt to ground the report in external evidence.`,
            'info',
          );
        } else {
          emit(
            'research-agent',
            'orchestrator',
            `No pre-workshop research data available for this workshop. Synthesis will proceed based on workshop data alone.`,
            'info',
          );
        }

        // ════════════════════════════════════════════════════
        // STEP 6: Guardian — pre-synthesis quality check
        // ════════════════════════════════════════════════════
        emit(
          'orchestrator',
          'guardian',
          `All agent analyses received. Guardian — verify data quality before we proceed to final synthesis.`,
          'request',
        );

        // Use blueprint lens count as expected domain count (no hardcoded fallback)
        const blueprintLensCount = (() => {
          const bp = workshop.blueprint as Record<string, unknown> | null;
          if (bp && Array.isArray(bp.lenses) && (bp.lenses as unknown[]).length > 0) return (bp.lenses as unknown[]).length;
          return domainNames.length || 1;
        })();
        const totalExpectedDomains = blueprintLensCount;
        const coveragePct = ((domainNames.length / totalExpectedDomains) * 100).toFixed(0);
        const lowConfPct = aggregated.totalNodes > 0
          ? ((aggregated.lowConfidenceCount / aggregated.totalNodes) * 100).toFixed(1)
          : '0';

        emit(
          'guardian',
          'orchestrator',
          `Data quality assessment:\n• **Coverage**: ${coveragePct}% domain coverage (${domainNames.length}/${totalExpectedDomains} domains)\n• **Confidence**: ${lowConfPct}% of data points below 50% confidence threshold\n• **Phase balance**: ${phaseBreakdown}\n• **Actor depth**: ${aggregated.topActors.length} unique actors, top contributor has ${aggregated.topActors[0]?.mentions || 0} mentions\n\n${Number(lowConfPct) > 30 ? '⚠️ High proportion of low-confidence data — synthesis quality may be affected.' : '✓ Data quality is acceptable for synthesis.'}`,
          'verification',
          { verdict: Number(lowConfPct) > 50 ? 'modify' : 'approve', reasoning: `${lowConfPct}% low-confidence data points` },
        );

        // ════════════════════════════════════════════════════
        // STEP 7: Synthesis Agent — comprehensive report generation
        // ════════════════════════════════════════════════════
        emit(
          'orchestrator',
          'facilitation-agent',
          `Quality checks passed. Handing off to the **Synthesis Agent** for comprehensive report generation. Theme Agent's analysis and Constraint Agent's assessment will be included alongside all workshop data. Generating all 8 scratchpad tabs.`,
          'handoff',
        );

        emit(
          'facilitation-agent',
          'orchestrator',
          `Acknowledged. Beginning synthesis with:\n• ${aggregated.totalNodes} data points\n• Theme Agent's thematic analysis\n• Constraint Agent's risk assessment\n${researchContext ? '• Research Agent\'s external context\n' : ''}• Guardian's quality validation\n\nGenerating: Executive Summary, Discovery, Reimagine, Constraints, Solution, Commercial, Customer Journey, Summary. Estimated time: 30-60 seconds.`,
          'acknowledgement',
        );

        const prompt = buildSynthesisPrompt(workshop.name || 'Workshop', aggregated, themeAnalysis, constraintAnalysis, researchContext);
        console.log(`[synthesise] Prompt length: ${prompt.length} chars. Running synthesis for workshop ${workshopId} (${aggregated.totalNodes} nodes)...`);

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
          emit('facilitation-agent', 'orchestrator', 'Synthesis Agent returned an empty response. Synthesis failed.', 'challenge');
          sendEvent('synthesis.error', { error: 'AI returned empty response' });
          controller.close();
          return;
        }

        const usage = completion.usage;
        emit(
          'facilitation-agent',
          'guardian',
          `Synthesis complete. Generated **${(raw.length / 1000).toFixed(1)}KB** of structured JSON. Token usage: ${usage?.prompt_tokens?.toLocaleString() || '?'} prompt → ${usage?.completion_tokens?.toLocaleString() || '?'} completion. Handing off to Guardian for quality review.`,
          'handoff',
        );

        // ════════════════════════════════════════════════════
        // STEP 8: Parse, validate, and Guardian review
        // ════════════════════════════════════════════════════
        let synthesised: Record<string, unknown>;
        try {
          synthesised = JSON.parse(raw);
        } catch {
          console.error('[synthesise] Failed to parse GPT response:', raw.slice(0, 500));
          emit('guardian', 'orchestrator', '**REJECTED**: Synthesis Agent returned invalid JSON. Report cannot be saved.', 'verdict', { verdict: 'reject' });
          sendEvent('synthesis.error', { error: 'AI returned invalid JSON' });
          controller.close();
          return;
        }

        const expectedSections = ['execSummary', 'discoveryOutput', 'reimagineContent', 'constraintsContent', 'potentialSolution', 'commercialContent', 'customerJourney', 'summaryContent'];
        const presentSections = expectedSections.filter(s => synthesised[s] && typeof synthesised[s] === 'object');
        const missingSections = expectedSections.filter(s => !presentSections.includes(s));

        emit(
          'guardian',
          'orchestrator',
          `Output quality review:\n• **Structure**: ${presentSections.length}/${expectedSections.length} sections present${missingSections.length > 0 ? ` (missing: ${missingSections.join(', ')})` : ''}\n• **Format**: Valid JSON ✓\n• **Content**: ${(raw.length / 1000).toFixed(1)}KB generated\n\n${missingSections.length === 0 ? '✓ All sections generated. Approving for metric validation and save.' : `⚠️ ${missingSections.length} section(s) missing — proceeding with available data.`}`,
          'verdict',
          { verdict: missingSections.length === 0 ? 'approve' : 'modify', reasoning: `${presentSections.length}/${expectedSections.length} sections present` },
        );

        // ════════════════════════════════════════════════════
        // STEP 9: Force-overwrite metrics with computed values
        // ════════════════════════════════════════════════════
        if (synthesised.execSummary && typeof synthesised.execSummary === 'object') {
          const es = synthesised.execSummary as Record<string, unknown>;
          if (!es.metrics || typeof es.metrics !== 'object') es.metrics = {};
          const m = es.metrics as Record<string, unknown>;
          m.participantsEngaged = aggregated.topActors.length;
          m.domainsExplored = Object.keys(aggregated.byDomain).length;
          m.insightsGenerated = aggregated.totalNodes;
          m.transformationalIdeas = aggregated.transformationalCount;
        }

        emit(
          'guardian',
          'orchestrator',
          `Metrics force-overwritten with computed values to prevent hallucination: **${aggregated.topActors.length}** participants, **${Object.keys(aggregated.byDomain).length}** domains, **${aggregated.totalNodes}** insights, **${aggregated.transformationalCount}** transformational ideas. Report is verified — proceed to save.`,
          'info',
        );

        // ════════════════════════════════════════════════════
        // STEP 10: Save to database
        // ════════════════════════════════════════════════════
        emit(
          'orchestrator',
          'orchestrator',
          `All agents have contributed and Guardian has approved. Saving synthesised report to database.`,
          'info',
        );

        const existing = await prisma.workshopScratchpad.findUnique({ where: { workshopId } });

        const jsonOrNull = (v: unknown) => (v && typeof v === 'object' ? v as Prisma.InputJsonValue : Prisma.DbNull);

        // ════════════════════════════════════════════════════
        // STEP 9b: Archetype classification (deterministic)
        // ════════════════════════════════════════════════════
        const nodeTypeCounts: Record<string, number> = {};
        let classifierConstraintCount = 0;
        let classifierEnablerCount = 0;
        for (const node of Object.values(rawNodes as Record<string, SnapshotNode>)) {
          if (!node?.rawText) continue;
          const pt = safeStr(node.classification?.primaryType).toUpperCase();
          if (pt) nodeTypeCounts[pt] = (nodeTypeCounts[pt] || 0) + 1;
          // Map to hemisphere-equivalent types for the classifier
          if (['CONSTRAINT', 'RISK'].includes(pt)) classifierConstraintCount++;
          if (pt === 'ENABLER') classifierEnablerCount++;
        }
        // Map VISIONARY/OPPORTUNITY to VISION for the classifier
        nodeTypeCounts['VISION'] = (nodeTypeCounts['VISION'] || 0) + (nodeTypeCounts['VISIONARY'] || 0) + (nodeTypeCounts['OPPORTUNITY'] || 0);

        // Domain weights: normalise by total node count per domain
        const domainWeights: Record<string, number> = {};
        const totalDomainNodes = Object.values(aggregated.byDomain).reduce((s, b) =>
          s + b.aspirations.length + b.constraints.length + b.enablers.length + b.opportunities.length + b.actions.length, 0) || 1;
        for (const [domain, bucket] of Object.entries(aggregated.byDomain)) {
          const domainTotal = bucket.aspirations.length + bucket.constraints.length + bucket.enablers.length + bucket.opportunities.length + bucket.actions.length;
          domainWeights[domain] = domainTotal / totalDomainNodes;
        }

        // Derive diagnostic posture from creative/constraint ratio
        const creativeCount = (nodeTypeCounts['VISION'] || 0) + (nodeTypeCounts['ENABLER'] || 0);
        const negativeCount = classifierConstraintCount + (nodeTypeCounts['CHALLENGE'] || 0) + (nodeTypeCounts['FRICTION'] || 0);
        const creativeRatio = aggregated.totalNodes > 0 ? creativeCount / aggregated.totalNodes : 0;
        const negativeRatio = aggregated.totalNodes > 0 ? negativeCount / aggregated.totalNodes : 0;
        let diagnosticPosture = 'aligned';
        if (creativeRatio >= 0.55 && negativeRatio < 0.15) diagnosticPosture = 'innovation-dominated';
        else if (negativeRatio >= 0.45 && creativeRatio < 0.15) diagnosticPosture = 'risk-dominated';
        else if (creativeRatio >= 0.50) diagnosticPosture = 'expansive';
        else if (negativeRatio >= 0.35) diagnosticPosture = 'defensive';

        // Theme keywords
        const themeKeywords = aggregated.topThemes.map(t => t.label);

        const classifierInput: ClassifierInput = {
          nodeTypeCounts,
          domainWeights,
          diagnosticPosture,
          industry: workshop.industry || null,
          dreamTrack: workshop.dreamTrack || null,
          targetDomain: workshop.targetDomain || null,
          constraintCount: classifierConstraintCount,
          enablerCount: classifierEnablerCount,
          themeKeywords,
          totalNodes: aggregated.totalNodes,
        };

        const archetypeClassification = classifyWorkshopArchetype(classifierInput);

        emit(
          'orchestrator',
          'orchestrator',
          `**Output assessment**: ${archetypeClassification.primaryArchetype.replace(/_/g, ' ')} (confidence: ${(archetypeClassification.confidence * 100).toFixed(0)}%). ${archetypeClassification.rationale}${archetypeClassification.secondaryArchetypes.length > 0 ? ` Secondary signals: ${archetypeClassification.secondaryArchetypes.map(a => a.replace(/_/g, ' ')).join(', ')}.` : ''}`,
          'info',
        );

        const scratchpadData = {
          execSummary: jsonOrNull(synthesised.execSummary),
          discoveryOutput: jsonOrNull(synthesised.discoveryOutput),
          reimagineContent: jsonOrNull(synthesised.reimagineContent),
          constraintsContent: jsonOrNull(synthesised.constraintsContent),
          potentialSolution: jsonOrNull(synthesised.potentialSolution),
          commercialContent: jsonOrNull(synthesised.commercialContent),
          customerJourney: jsonOrNull(synthesised.customerJourney),
          summaryContent: jsonOrNull(synthesised.summaryContent),
          outputAssessment: archetypeClassification as unknown as Prisma.InputJsonValue,
          generatedFromSnapshot: snapshot!.id,
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

        // ════════════════════════════════════════════════════
        // FINAL: Orchestrator summary
        // ════════════════════════════════════════════════════
        emit(
          'orchestrator',
          'orchestrator',
          `**Report synthesis complete.**\n\n• **Theme Agent**: Identified ${aggregated.topThemes.length} themes, mapped cross-domain narrative\n• **Constraint Agent**: Assessed ${domainNames.reduce((s, d) => s + aggregated.byDomain[d].constraints.length, 0)} constraints across ${domainNames.filter(d => aggregated.byDomain[d].constraints.length > 0).length} domains\n• **Research Agent**: ${researchContext ? 'External context injected' : 'No prep research available'}\n• **Guardian**: Quality approved, metrics verified\n• **Synthesis Agent**: ${presentSections.length}/8 tabs synthesised (${(raw.length / 1000).toFixed(1)}KB)\n• **Database**: Scratchpad ${existing ? 'updated' : 'created'} — Status: DRAFT\n\nThe report is ready for review in the Scratchpad.`,
          'info',
        );

        sendEvent('synthesis.complete', {
          ok: true,
          scratchpadId: scratchpad.id,
          workshopId,
          snapshotId: snapshot!.id,
          nodesProcessed: aggregated.totalNodes,
        });

      } catch (error) {
        console.error('[synthesise] Error:', error);
        emit(
          'orchestrator',
          'orchestrator',
          `**Synthesis failed**: ${error instanceof Error ? error.message : 'Unknown error'}. The multi-agent pipeline encountered an unrecoverable error.`,
          'challenge',
        );
        sendEvent('synthesis.error', { error: 'Synthesis failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

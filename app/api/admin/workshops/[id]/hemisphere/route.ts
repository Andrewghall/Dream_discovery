import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RunType = 'BASELINE' | 'FOLLOWUP';

type NodeType = 'VISION' | 'BELIEF' | 'CHALLENGE' | 'FRICTION' | 'CONSTRAINT' | 'ENABLER' | 'EVIDENCE';

type HemisphereLayer = 'H1' | 'H2' | 'H3' | 'H4';

type HemisphereNode = {
  id: string;
  type: NodeType;
  label: string;
  summary?: string;
  phaseTags: string[];
  layer: HemisphereLayer;
  weight: number;
  severity?: number;
  confidence?: number;
  sources: { sessionId: string; participantName: string }[];
  evidence?: { quote?: string; qaTag?: string; createdAt?: string; chunkId?: string }[];
};

type HemisphereEdge = {
  id: string;
  source: string;
  target: string;
  strength: number;
  kind: 'SIMILAR' | 'COOCCUR' | 'CAUSE_HINT';
};

type HemisphereGraph = {
  nodes: HemisphereNode[];
  edges: HemisphereEdge[];
  coreTruthNodeId: string;
};

type InsightCategory = 'BUSINESS' | 'TECHNOLOGY' | 'PEOPLE' | 'CUSTOMER' | 'REGULATION';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','has','have','i','if','in','into','is','it','its','me','my','no','not','of','on','or','our','so','that','the','their','then','there','these','they','this','to','too','up','us','was','we','were','what','when','where','which','who','why','will','with','you','your',
]);

function safeCategory(value: unknown): InsightCategory | null {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!s) return null;
  if (s === 'BUSINESS' || s === 'TECHNOLOGY' || s === 'PEOPLE' || s === 'CUSTOMER' || s === 'REGULATION') return s;
  return null;
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function phaseTagFromCategory(value: unknown): string[] {
  const cat = safeCategory(value);
  if (!cat) return [];
  if (cat === 'BUSINESS') return ['corporate'];
  return [cat.toLowerCase()];
}

function safeRunType(value: string | null | undefined): RunType {
  const v = (value || '').trim().toUpperCase();
  if (v === 'FOLLOWUP') return 'FOLLOWUP';
  return 'BASELINE';
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeStringArray(value: unknown): string[] {
  return safeArray(value).filter((v) => typeof v === 'string' && v.trim()).map((v) => String(v).trim());
}

function uniq(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function words(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOPWORDS.has(w));
}

function tokenSet(text: string): Set<string> {
  return new Set(words(text));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  const uni = a.size + b.size - inter;
  return uni <= 0 ? 0 : inter / uni;
}

function shortLabel(text: string, maxWords: number = 8): string {
  const w = (text || '').trim().split(/\s+/).filter(Boolean);
  return w.length <= maxWords ? w.join(' ') : w.slice(0, maxWords).join(' ');
}

function layerForType(type: NodeType): HemisphereLayer {
  if (type === 'VISION' || type === 'BELIEF') return 'H1';
  if (type === 'CHALLENGE' || type === 'FRICTION') return 'H2';
  if (type === 'CONSTRAINT' || type === 'ENABLER') return 'H3';
  return 'H4';
}

function defaultSeverity(type: NodeType): number | undefined {
  if (type === 'CONSTRAINT') return 5;
  if (type === 'CHALLENGE' || type === 'FRICTION') return 4;
  if (type === 'ENABLER') return 2;
  if (type === 'VISION' || type === 'BELIEF') return 1;
  return undefined;
}

function inferNodeTypeFromText(text: string): Exclude<NodeType, 'EVIDENCE'> {
  const t = (text || '').toLowerCase();
  if (/(\bvision\b|\bfuture\b|\blooking ahead\b|\bambition\b|\bwe want\b)/.test(t)) return 'VISION';
  if (/(\bbelief\b|\bwe believe\b|\bassume\b)/.test(t)) return 'BELIEF';
  if (/(\bconstraint\b|\bblocked\b|\bdependent\b|\bdependency\b|\bgovernance\b|\bcompliance\b)/.test(t)) return 'CONSTRAINT';
  if (/(\bfriction\b|\bslow\b|\bslows\b|\bhand[- ]offs\b|\bapproval\b|\bbureaucracy\b)/.test(t)) return 'FRICTION';
  if (/(\benable\b|\benabler\b|\bworking\b|\bstrength\b)/.test(t)) return 'ENABLER';
  return 'CHALLENGE';
}

function nodeTypeFromInsightType(value: unknown): Exclude<NodeType, 'EVIDENCE'> | null {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!s) return null;
  if (s === 'VISION') return 'VISION';
  if (s === 'BELIEF') return 'BELIEF';
  if (s === 'CHALLENGE') return 'CHALLENGE';
  if (s === 'CONSTRAINT') return 'CONSTRAINT';
  if (s === 'WHAT_WORKS') return 'ENABLER';
  return null;
}

function parseQuestionKey(questionKey: string): { phase: string | null; tag: string | null } {
  const parts = (questionKey || '').split(':');
  if (parts.length === 3) return { phase: parts[0] || null, tag: parts[1] || null };
  if (parts.length === 4) return { phase: parts[1] || null, tag: parts[2] || null };
  return { phase: null, tag: null };
}

function mergeScore(prev: number | undefined, next: number | null | undefined, weightPrev: number, weightNext: number): number | undefined {
  if (next == null || !Number.isFinite(next)) return prev;
  const n = Number(next);
  if (prev == null || !Number.isFinite(prev)) return n;
  const total = Math.max(1, weightPrev + weightNext);
  return (prev * weightPrev + n * weightNext) / total;
}

function mergeNode(target: HemisphereNode, incoming: Omit<HemisphereNode, 'weight'> & { weight?: number }) {
  const incWeight = typeof incoming.weight === 'number' && Number.isFinite(incoming.weight) ? incoming.weight : 1;

  const prevWeight = target.weight;
  target.weight += incWeight;

  target.phaseTags = uniq([...target.phaseTags, ...(incoming.phaseTags || [])]);
  target.sources = [...target.sources, ...(incoming.sources || [])];
  target.sources = uniq(target.sources.map((s) => `${s.sessionId}:${s.participantName}`)).map((k) => {
    const [sessionId, participantName] = k.split(':');
    return { sessionId, participantName };
  });

  target.severity = mergeScore(target.severity, incoming.severity, prevWeight, incWeight);
  target.confidence = mergeScore(target.confidence, incoming.confidence, prevWeight, incWeight);

  const mergedEvidence = [...(target.evidence || []), ...((incoming.evidence || []) as any[])];
  if (mergedEvidence.length) {
    target.evidence = mergedEvidence
      .filter((e) => e && typeof e === 'object')
      .slice(0, 12) as any;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const runType = safeRunType(request.nextUrl.searchParams.get('runType'));

    const allSessions = (await (prisma as any).conversationSession.findMany({
      where: {
        workshopId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        participantId: true,
        createdAt: true,
        completedAt: true,
        runType: true,
        questionSetVersion: true,
        participant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })) as Array<{
      id: string;
      participantId: string;
      createdAt: Date;
      completedAt: Date | null;
      runType?: string | null;
      questionSetVersion?: string | null;
      participant: { id: string; name: string; email: string };
    }>;

    const sessions = allSessions.filter((s) => safeRunType(s.runType) === runType);

    const sessionIds = sessions.map((s) => s.id);

    const reports = sessionIds.length
      ? ((await (prisma as any).conversationReport.findMany({
          where: { sessionId: { in: sessionIds } },
          select: {
            sessionId: true,
            keyInsights: true,
            phaseInsights: true,
            wordCloudThemes: true,
          },
        })) as Array<{ sessionId: string; keyInsights: unknown; phaseInsights: unknown; wordCloudThemes: unknown }>)
      : [];

    const insights = sessionIds.length
      ? await prisma.conversationInsight.findMany({
          where: { sessionId: { in: sessionIds } },
          select: {
            id: true,
            sessionId: true,
            participantId: true,
            insightType: true,
            category: true,
            text: true,
            severity: true,
            confidence: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const reportBySession = new Map(reports.map((r) => [r.sessionId, r]));
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    const nodesById = new Map<string, HemisphereNode>();

    const upsertNode = (incoming: HemisphereNode) => {
      const existing = nodesById.get(incoming.id);
      if (!existing) {
        nodesById.set(incoming.id, incoming);
        return;
      }
      mergeNode(existing, incoming);
    };

    for (const ins of insights) {
      const type = nodeTypeFromInsightType(ins.insightType);
      if (!type) continue;
      const text = String(ins.text || '').trim();
      if (!text) continue;

      const session = sessionById.get(String(ins.sessionId || ''));
      const participantName = session?.participant?.name || 'Participant';

      const norm = text.toLowerCase();
      const nodeId = `${type}:${norm}`;
      const sev = typeof ins.severity === 'number' ? clampInt(ins.severity, 1, 5) : defaultSeverity(type);
      const conf = typeof ins.confidence === 'number' ? clamp01(ins.confidence) : undefined;

      upsertNode({
        id: nodeId,
        type,
        label: shortLabel(text, 8),
        summary: text,
        phaseTags: phaseTagFromCategory(ins.category),
        layer: layerForType(type),
        weight: 1,
        severity: sev,
        confidence: conf,
        sources: [{ sessionId: String(ins.sessionId), participantName }],
        evidence: [],
      });
    }

    for (const s of sessions) {
      const report = reportBySession.get(s.id);
      if (!report) continue;

      const participantName = s.participant?.name || 'Participant';

      for (const ki of safeArray(report.keyInsights)) {
        const rec = ki && typeof ki === 'object' && !Array.isArray(ki) ? (ki as Record<string, unknown>) : null;
        const title = rec && typeof rec.title === 'string' ? rec.title.trim() : '';
        const insight = rec && typeof rec.insight === 'string' ? rec.insight.trim() : '';
        const combined = `${title}\n${insight}`.trim();
        if (!combined) continue;

        const type = inferNodeTypeFromText(combined);
        const confidenceLabel = rec && typeof rec.confidence === 'string' ? rec.confidence.trim().toLowerCase() : '';
        const conf = confidenceLabel === 'high' ? 0.85 : confidenceLabel === 'medium' ? 0.65 : confidenceLabel === 'low' ? 0.45 : undefined;
        const evidenceQuotes = rec ? safeStringArray(rec.evidence).slice(0, 3) : [];

        const nodeId = `${type}:key:${title.toLowerCase() || shortLabel(insight, 8).toLowerCase()}`;

        upsertNode({
          id: nodeId,
          type,
          label: shortLabel(title || insight, 8),
          summary: insight || title,
          phaseTags: [],
          layer: layerForType(type),
          weight: 1,
          severity: defaultSeverity(type),
          confidence: conf,
          sources: [{ sessionId: s.id, participantName }],
          evidence: evidenceQuotes.map((q) => ({ quote: q })),
        });
      }

      const phaseInsights = safeArray(report.phaseInsights)
        .filter((p) => p && typeof p === 'object' && !Array.isArray(p)) as Array<Record<string, unknown>>;
      for (const p of phaseInsights) {
        const phase = typeof p.phase === 'string' ? p.phase.trim().toLowerCase() : '';
        const phaseTags = phase ? [phase] : [];

        const future = safeStringArray(p.future);
        const frictions = safeStringArray(p.frictions);
        const constraint = safeStringArray(p.constraint);
        const strengths = safeStringArray(p.strengths);
        const working = safeStringArray(p.working);
        const gaps = safeStringArray(p.gaps);
        const painPoints = safeStringArray(p.painPoints);
        const barriers = safeStringArray(p.barriers);
        const support = safeStringArray(p.support);

        for (const text of future) {
          const type: NodeType = 'VISION';
          const nodeId = `${type}:phase:${phase}:${text.toLowerCase()}`;
          upsertNode({
            id: nodeId,
            type,
            label: shortLabel(text, 8),
            summary: text,
            phaseTags,
            layer: layerForType(type),
            weight: 1,
            severity: defaultSeverity(type),
            confidence: undefined,
            sources: [{ sessionId: s.id, participantName }],
            evidence: [{ quote: text }],
          });
        }

        for (const text of frictions) {
          const type: NodeType = 'FRICTION';
          const nodeId = `${type}:phase:${phase}:${text.toLowerCase()}`;
          upsertNode({
            id: nodeId,
            type,
            label: shortLabel(text, 8),
            summary: text,
            phaseTags,
            layer: layerForType(type),
            weight: 1,
            severity: defaultSeverity(type),
            confidence: undefined,
            sources: [{ sessionId: s.id, participantName }],
            evidence: [{ quote: text }],
          });
        }

        for (const text of barriers) {
          const type: NodeType = 'FRICTION';
          const nodeId = `${type}:phase:${phase}:${text.toLowerCase()}`;
          upsertNode({
            id: nodeId,
            type,
            label: shortLabel(text, 8),
            summary: text,
            phaseTags,
            layer: layerForType(type),
            weight: 1,
            severity: defaultSeverity(type),
            confidence: undefined,
            sources: [{ sessionId: s.id, participantName }],
            evidence: [{ quote: text }],
          });
        }

        for (const text of constraint) {
          const type: NodeType = 'CONSTRAINT';
          const nodeId = `${type}:phase:${phase}:${text.toLowerCase()}`;
          upsertNode({
            id: nodeId,
            type,
            label: shortLabel(text, 8),
            summary: text,
            phaseTags,
            layer: layerForType(type),
            weight: 1,
            severity: defaultSeverity(type),
            confidence: undefined,
            sources: [{ sessionId: s.id, participantName }],
            evidence: [{ quote: text }],
          });
        }

        for (const text of [...strengths, ...working]) {
          const type: NodeType = 'ENABLER';
          const nodeId = `${type}:phase:${phase}:${text.toLowerCase()}`;
          upsertNode({
            id: nodeId,
            type,
            label: shortLabel(text, 8),
            summary: text,
            phaseTags,
            layer: layerForType(type),
            weight: 1,
            severity: defaultSeverity(type),
            confidence: undefined,
            sources: [{ sessionId: s.id, participantName }],
            evidence: [{ quote: text }],
          });
        }

        for (const text of [...gaps, ...painPoints, ...support]) {
          const type: NodeType = 'CHALLENGE';
          const nodeId = `${type}:phase:${phase}:${text.toLowerCase()}`;
          upsertNode({
            id: nodeId,
            type,
            label: shortLabel(text, 8),
            summary: text,
            phaseTags,
            layer: layerForType(type),
            weight: 1,
            severity: defaultSeverity(type),
            confidence: undefined,
            sources: [{ sessionId: s.id, participantName }],
            evidence: [{ quote: text }],
          });
        }
      }
    }

    const dataPoints = sessionIds.length
      ? await prisma.dataPoint.findMany({
          where: {
            sessionId: { in: sessionIds },
            questionKey: { not: null },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, sessionId: true, participantId: true, questionKey: true, rawText: true, createdAt: true, transcriptChunkId: true },
        })
      : [];

    const evidenceCandidates = dataPoints
      .map((dp) => {
        const qk = String(dp.questionKey || '');
        const meta = parseQuestionKey(qk);
        const tag = (meta.tag || '').toLowerCase();
        if (tag === 'triple_rating' || tag.endsWith('_score') || tag.includes('rating')) return null;
        const answer = String(dp.rawText || '').trim();
        if (!answer) return null;
        const wordCount = answer.split(/\s+/).filter(Boolean).length;
        if (wordCount < 18) return null;
        const session = sessionById.get(String(dp.sessionId || ''));
        const participantName = session?.participant?.name || 'Participant';
        return {
          dp,
          answer,
          wordCount,
          phase: meta.phase ? meta.phase.toLowerCase() : null,
          tag: meta.tag,
          participantName,
        };
      })
      .filter(Boolean) as Array<{ dp: any; answer: string; wordCount: number; phase: string | null; tag: string | null; participantName: string }>;

    evidenceCandidates.sort((a, b) => b.wordCount - a.wordCount);
    const evidenceTop = evidenceCandidates.slice(0, 45);

    for (const item of evidenceTop) {
      const phaseTags = item.phase ? [item.phase] : [];
      const type: NodeType = 'EVIDENCE';
      const nodeId = `EVIDENCE:${String(item.dp.id)}`;
      upsertNode({
        id: nodeId,
        type,
        label: shortLabel(item.answer, 8),
        summary: item.answer,
        phaseTags,
        layer: layerForType(type),
        weight: Math.max(1, Math.round(item.wordCount / 10)),
        severity: undefined,
        confidence: undefined,
        sources: [{ sessionId: String(item.dp.sessionId), participantName: item.participantName }],
        evidence: [
          {
            quote: item.answer,
            qaTag: item.tag || undefined,
            createdAt: item.dp.createdAt ? new Date(item.dp.createdAt).toISOString() : undefined,
            chunkId: item.dp.transcriptChunkId ? String(item.dp.transcriptChunkId) : undefined,
          },
        ],
      });
    }

    const allNodes = [...nodesById.values()]
      .map((n) => ({
        ...n,
        severity: typeof n.severity === 'number' ? clampInt(n.severity, 1, 5) : n.severity,
        confidence: typeof n.confidence === 'number' ? clamp01(n.confidence) : n.confidence,
      }))
      .sort((a, b) => b.weight - a.weight);

    const nodesForSimilarity = allNodes
      .filter((n) => n.type !== 'EVIDENCE')
      .slice(0, 140);

    const tokenById = new Map(nodesForSimilarity.map((n) => [n.id, tokenSet(`${n.label} ${n.summary || ''}`)]));

    const edgesById = new Map<string, HemisphereEdge>();
    const addEdge = (edge: HemisphereEdge) => {
      const prev = edgesById.get(edge.id);
      if (!prev || edge.strength > prev.strength) edgesById.set(edge.id, edge);
    };

    for (let i = 0; i < nodesForSimilarity.length; i++) {
      for (let j = i + 1; j < nodesForSimilarity.length; j++) {
        const a = nodesForSimilarity[i];
        const b = nodesForSimilarity[j];
        if (a.layer !== b.layer && !(a.layer === 'H2' && b.layer === 'H3') && !(a.layer === 'H3' && b.layer === 'H2')) {
          continue;
        }
        const ta = tokenById.get(a.id) || new Set<string>();
        const tb = tokenById.get(b.id) || new Set<string>();
        const sim = jaccard(ta, tb);
        if (sim < 0.22) continue;
        const source = a.id;
        const target = b.id;
        const id = `SIMILAR:${source < target ? `${source}|${target}` : `${target}|${source}`}`;
        addEdge({ id, source, target, strength: clamp01(sim), kind: 'SIMILAR' });
      }
    }

    const nodesBySession = new Map<string, string[]>();
    for (const n of allNodes) {
      if (n.type === 'EVIDENCE') continue;
      for (const s of n.sources) {
        const list = nodesBySession.get(s.sessionId) || [];
        list.push(n.id);
        nodesBySession.set(s.sessionId, list);
      }
    }

    const weightById = new Map(allNodes.map((n) => [n.id, n.weight]));
    for (const [sessionId, ids] of nodesBySession.entries()) {
      const unique = uniq(ids);
      unique.sort((a, b) => (weightById.get(b) || 0) - (weightById.get(a) || 0));
      const limited = unique.slice(0, 18);
      for (let i = 0; i < limited.length; i++) {
        for (let j = i + 1; j < limited.length; j++) {
          const a = limited[i];
          const b = limited[j];
          const id = `COOCCUR:${a < b ? `${a}|${b}` : `${b}|${a}`}`;
          addEdge({ id, source: a, target: b, strength: 0.25, kind: 'COOCCUR' });
        }
      }
      void sessionId;
    }

    const edges = [...edgesById.values()];
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) || 0) + e.strength);
      degree.set(e.target, (degree.get(e.target) || 0) + e.strength);
    }

    const candidateNodes = allNodes.filter((n) => n.type !== 'EVIDENCE');
    const crossDomainCount = (n: HemisphereNode) => uniq((n.phaseTags || []).map((t) => String(t).toLowerCase())).length;
    const severity01 = (n: HemisphereNode) => (typeof n.severity === 'number' ? clamp01((n.severity - 1) / 4) : 0.5);

    const scored = candidateNodes
      .map((n) => {
        const cross = crossDomainCount(n);
        const crossMult = 1 + 0.45 * Math.min(3, Math.max(0, cross - 1));
        const sev = severity01(n);
        const deg = degree.get(n.id) || 0;
        const score = Math.max(1, n.weight) * (1 + sev * 1.6) * crossMult + deg * 2.5;
        return { n, score, deg, cross, sev };
      })
      .sort((a, b) => b.score - a.score || b.deg - a.deg || b.n.weight - a.n.weight);

    const driverNodes = scored.slice(0, 6).map((r) => r.n);
    const centralNodes = scored.slice(0, 10).map((r) => r.n);

    const coreTruthNodeId = 'CORE_TRUTH';
    const coreType: Exclude<NodeType, 'EVIDENCE'> =
      centralNodes.some((n) => n.type === 'CONSTRAINT') ? 'CONSTRAINT' : 'CHALLENGE';

    // Agentic synthesis (mandatory): produce one causal sentence from the most central drivers.
    let coreSummary = '';
    try {
      if (!env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

      const evidenceQuotes = driverNodes
        .flatMap((n) => (Array.isArray(n.evidence) ? n.evidence : []))
        .map((e) => (e && typeof e === 'object' && typeof e.quote === 'string' ? e.quote.trim() : ''))
        .filter(Boolean)
        .slice(0, 10);

      const driverLines = driverNodes
        .map((n, idx) => {
          const cross = crossDomainCount(n);
          const sev = typeof n.severity === 'number' ? n.severity : null;
          const deg = degree.get(n.id) || 0;
          return `${idx + 1}. [${n.type}] ${n.label}${n.summary ? ` — ${n.summary}` : ''} (weight=${n.weight}, severity=${sev ?? 'null'}, crossDomain=${cross}, centrality=${deg.toFixed(2)})`;
        })
        .join('\n');

      const prompt = `Synthesize a single causal Core Truth statement describing the organisation's gravity well.

Requirements:
- Output strict JSON with schema: {"sentence": string}
- Exactly ONE sentence.
- 16-28 words.
- Must express causality (e.g., "because", "drives", "causes", "amplifies", "leads to").
- Prefer concrete operational mechanism over abstract phrasing.
- Do NOT use bullet points.
- Do NOT mention "drivers" or "nodes".

Top drivers:
${driverLines}

Evidence quotes (if helpful):
${evidenceQuotes.length ? evidenceQuotes.map((q) => `- ${q}`).join('\n') : '- (none)'}
`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are an organisational intelligence analyst. Produce a single, high-signal causal sentence. Ground claims in the provided drivers and avoid generic consultant language.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
      const parsed = safeParseJson<{ sentence?: unknown }>(raw);
      const sent = parsed && typeof parsed.sentence === 'string' ? parsed.sentence.trim() : '';
      coreSummary = sent;
    } catch (e) {
      // Deterministic fallback (should be rare if OPENAI_API_KEY is configured).
      const a = driverNodes[0]?.label || centralNodes[0]?.label || 'Decision friction';
      const b = driverNodes[1]?.label || centralNodes[1]?.label || 'customer friction';
      const c = driverNodes[2]?.label || centralNodes[2]?.label || 'technology inefficiency';
      coreSummary = `${shortLabel(a, 7)} is driving ${shortLabel(b, 7)}, amplifying ${shortLabel(c, 7)}.`;
      console.warn('Core Truth agentic synthesis failed:', e);
    }

    if (!coreSummary.trim()) {
      const a = driverNodes[0]?.label || centralNodes[0]?.label || 'Decision friction';
      const b = driverNodes[1]?.label || centralNodes[1]?.label || 'customer friction';
      const c = driverNodes[2]?.label || centralNodes[2]?.label || 'technology inefficiency';
      coreSummary = `${shortLabel(a, 7)} is driving ${shortLabel(b, 7)}, amplifying ${shortLabel(c, 7)}.`;
    }

    allNodes.push({
      id: coreTruthNodeId,
      type: coreType,
      label: 'Core Truth',
      summary: coreSummary,
      phaseTags: uniq(centralNodes.flatMap((n) => n.phaseTags)),
      layer: layerForType(coreType),
      weight: 10,
      severity: defaultSeverity(coreType),
      confidence: undefined,
      sources: [],
      evidence: [],
    });

    for (let i = 0; i < centralNodes.length; i++) {
      const n = centralNodes[i];
      const source = coreTruthNodeId;
      const target = n.id;
      const id = `CAUSE_HINT:${source < target ? `${source}|${target}` : `${target}|${source}`}`;
      const strength = clamp01(0.95 - i * 0.04);
      edges.push({ id, source, target, strength, kind: 'CAUSE_HINT' });
    }

    const hemisphereGraph: HemisphereGraph = {
      nodes: allNodes,
      edges,
      coreTruthNodeId,
    };

    return NextResponse.json({
      ok: true,
      workshopId,
      runType,
      generatedAt: new Date().toISOString(),
      sessionCount: sessions.length,
      participantCount: uniq(sessions.map((s) => s.participantId)).length,
      hemisphereGraph,
    });
  } catch (error) {
    console.error('Error building hemisphere snapshot:', error);
    return NextResponse.json({ ok: false, error: 'Failed to build hemisphere snapshot' }, { status: 500 });
  }
}

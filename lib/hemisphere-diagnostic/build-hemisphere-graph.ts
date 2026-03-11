/**
 * Hemisphere Graph Builder — Shared Construction Logic
 *
 * Extracts the node/edge construction logic used by both the hemisphere
 * visualisation and the diagnostic engine. Two entry points:
 *
 *   1. buildGraphFromSessions()  — Discovery data (sessions + reports + insights)
 *   2. buildGraphFromSnapshot()  — Live workshop snapshot
 *
 * Both return { nodes, edges } without Core Truth synthesis (that stays
 * in the hemisphere route for visualisation purposes).
 */

import { prisma } from '@/lib/prisma';
import type {
  HemisphereNode,
  HemisphereEdge,
  NodeType,
  HemisphereLayer,
} from '@/lib/types/hemisphere-diagnostic';

// ── Types ────────────────────────────────────────────────────

type RunType = 'BASELINE' | 'FOLLOWUP';

type LivePrimaryType = 'VISIONARY' | 'OPPORTUNITY' | 'CONSTRAINT' | 'RISK' | 'ENABLER' | 'ACTION' | 'QUESTION' | 'INSIGHT';

type InsightCategory = 'BUSINESS' | 'TECHNOLOGY' | 'PEOPLE' | 'CUSTOMER' | 'REGULATION';

export interface HemisphereGraph {
  nodes: HemisphereNode[];
  edges: HemisphereEdge[];
}

// ── Constants ────────────────────────────────────────────────

const NODE_TYPE_ORDER: NodeType[] = ['CONSTRAINT', 'FRICTION', 'CHALLENGE', 'ENABLER', 'BELIEF', 'VISION', 'EVIDENCE'];

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','has','have','i','if','in','into','is','it','its','me','my','no','not','of','on','or','our','so','that','the','their','then','there','these','they','this','to','too','up','us','was','we','were','what','when','where','which','who','why','will','with','you','your',
]);

// ── Utility Functions ────────────────────────────────────────

function safeCategory(value: unknown): InsightCategory | null {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!s) return null;
  if (s === 'BUSINESS' || s === 'TECHNOLOGY' || s === 'PEOPLE' || s === 'CUSTOMER' || s === 'REGULATION') return s;
  return null;
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

function canonicalInsightKey(text: string): string {
  const cleaned = (text || '').trim().toLowerCase();
  const w = words(cleaned);
  if (w.length) return w.join(' ');
  return cleaned.replace(/\s+/g, ' ').trim();
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

function degreeByNode(edges: HemisphereEdge[]): Map<string, number> {
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + e.strength);
    degree.set(e.target, (degree.get(e.target) || 0) + e.strength);
  }
  return degree;
}

function shortLabel(text: string, maxWords: number = 8): string {
  const w = (text || '').trim().split(/\s+/).filter(Boolean);
  return w.length <= maxWords ? w.join(' ') : w.slice(0, maxWords).join(' ');
}

function layerForType(type: NodeType): HemisphereLayer {
  // Negative-to-positive posture gradient: bottom (H3) to top (H1)
  if (type === 'VISION' || type === 'BELIEF') return 'H1';          // Top: Imagine & Design (positive)
  if (type === 'ENABLER') return 'H2';                               // Middle: Transform & Enable (transitional)
  if (type === 'CHALLENGE' || type === 'FRICTION' || type === 'CONSTRAINT') return 'H3'; // Bottom: Challenges & Constraints (negative)
  return 'H4';
}

function defaultSeverity(type: NodeType): number | undefined {
  if (type === 'CONSTRAINT') return 5;
  if (type === 'CHALLENGE' || type === 'FRICTION') return 4;
  if (type === 'ENABLER') return 2;
  if (type === 'VISION' || type === 'BELIEF') return 1;
  return undefined;
}

function mapLivePrimaryTypeToNodeType(primary: LivePrimaryType): Exclude<NodeType, 'EVIDENCE'> {
  switch (primary) {
    case 'VISIONARY': return 'VISION';
    case 'OPPORTUNITY': return 'BELIEF';
    case 'RISK': return 'CHALLENGE';
    case 'ACTION': return 'ENABLER';
    case 'QUESTION': return 'CHALLENGE';
    case 'INSIGHT': return 'ENABLER';
    case 'CONSTRAINT': return 'CONSTRAINT';
    case 'ENABLER': return 'ENABLER';
    default: return 'CHALLENGE';
  }
}

function domainToPhaseTag(domain: string, customDimensionNames?: string[] | null): string | null {
  const d = (domain || '').trim();
  if (customDimensionNames?.length) {
    const match = customDimensionNames.find(n => n.toLowerCase() === d.toLowerCase());
    if (match) return match.toLowerCase().replace(/\s+/g, '_');
    for (const dimName of customDimensionNames) {
      if (d.toLowerCase().includes(dimName.toLowerCase())) return dimName.toLowerCase().replace(/\s+/g, '_');
    }
    return null;
  }
  const dl = d.toLowerCase();
  if (dl.includes('people') || dl.includes('human') || dl.includes('talent') || dl.includes('workforce') || dl.includes('hr')) return 'people';
  if (dl.includes('corporate') || dl.includes('business') || dl.includes('enterprise') || dl.includes('organization') || dl.includes('organisation') || dl.includes('strategy') || dl.includes('operation') || dl.includes('supply')) return 'corporate';
  if (dl.includes('customer') || dl.includes('client') || dl.includes('user') || dl.includes('consumer') || dl.includes('market')) return 'customer';
  if (dl.includes('tech') || dl.includes('digital') || dl.includes('software') || dl.includes('data') || dl.includes('infrastructure') || dl.includes('system')) return 'technology';
  if (dl.includes('regulat') || dl.includes('compliance') || dl.includes('legal') || dl.includes('governance') || dl.includes('policy')) return 'regulation';
  return null;
}

function phaseTagsFromDomains(domains: Array<{ domain: string; relevance: number; reasoning: string }> | undefined | null, customDimensionNames?: string[] | null): string[] {
  if (!Array.isArray(domains)) return [];
  const tags: string[] = [];
  for (const d of domains) {
    if (!d || typeof d.domain !== 'string') continue;
    const tag = domainToPhaseTag(d.domain, customDimensionNames);
    if (tag) tags.push(tag);
  }
  return uniq(tags);
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
    const out: any[] = [];
    const seen = new Set<string>();
    for (const e of mergedEvidence) {
      if (!e || typeof e !== 'object') continue;
      const quote = typeof (e as any).quote === 'string' ? String((e as any).quote).trim() : '';
      const qaTag = typeof (e as any).qaTag === 'string' ? String((e as any).qaTag).trim() : '';
      const key = `${quote.toLowerCase()}|${qaTag.toLowerCase()}`;
      if (!quote) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length >= 12) break;
    }
    if (out.length) target.evidence = out as any;
  }
}

// ── Edge Construction ────────────────────────────────────────

function layerDepth(layer: HemisphereLayer): number {
  if (layer === 'H1') return 1;
  if (layer === 'H2') return 2;
  if (layer === 'H3') return 3;
  return 4;
}

function buildEdges(nodes: HemisphereNode[], maxNodes: number = 140): HemisphereEdge[] {
  const nonEvidence = nodes.filter((n) => n.type !== 'EVIDENCE');
  const nodesForSimilarity = nonEvidence.slice(0, maxNodes);
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
      const da = layerDepth(a.layer);
      const db = layerDepth(b.layer);
      if (da === 4 || db === 4) continue;
      if (Math.abs(da - db) > 2) continue;
      const ta = tokenById.get(a.id) || new Set<string>();
      const tb = tokenById.get(b.id) || new Set<string>();
      const sim = jaccard(ta, tb);

      const involvesH1 = a.layer === 'H1' || b.layer === 'H1';
      const eqThresh = involvesH1 ? 0.22 : 0.28;
      const derivThresh = involvesH1 ? 0.17 : 0.20;
      const reinfThresh = involvesH1 ? 0.13 : 0.16;

      if (sim >= eqThresh) {
        const src = a.id;
        const tgt = b.id;
        const id = `EQUIVALENT:${src < tgt ? `${src}|${tgt}` : `${tgt}|${src}`}`;
        addEdge({ id, source: src, target: tgt, strength: clamp01(sim), kind: 'EQUIVALENT' });
        continue;
      }

      if (sim >= derivThresh && da !== db && da !== 4 && db !== 4) {
        const h1Source = da < db ? a.id : b.id;
        const h1Target = da < db ? b.id : a.id;
        const src = involvesH1 ? h1Source : da > db ? a.id : b.id;
        const tgt = involvesH1 ? h1Target : da > db ? b.id : a.id;
        const id = `DERIVATIVE:${src}|${tgt}`;
        addEdge({ id, source: src, target: tgt, strength: clamp01(sim), kind: 'DERIVATIVE' });
        continue;
      }

      if (sim >= reinfThresh) {
        const src = a.id;
        const tgt = b.id;
        const id = `REINFORCING:${src < tgt ? `${src}|${tgt}` : `${tgt}|${src}`}`;
        addEdge({ id, source: src, target: tgt, strength: clamp01(sim), kind: 'REINFORCING' });
      }
    }
  }

  return [...edgesById.values()];
}

/** Recover orphan nodes by connecting them to their nearest semantic neighbour */
function recoverOrphans(nodes: HemisphereNode[], edges: HemisphereEdge[]): void {
  const nonEvidence = nodes.filter((n) => n.type !== 'EVIDENCE');
  const tokenAll = new Map(nonEvidence.map((n) => [n.id, tokenSet(`${n.label} ${n.summary || ''}`)]));

  const degree = degreeByNode(edges);
  const orphanIds = nonEvidence
    .map((n) => n.id)
    .filter((id) => (degree.get(id) || 0) <= 0);

  for (const orphanId of orphanIds) {
    const orphanNode = nonEvidence.find((n) => n.id === orphanId);
    if (!orphanNode) continue;
    const ta = tokenAll.get(orphanId) || new Set<string>();

    let best: { other: HemisphereNode; sim: number } | null = null;
    for (const other of nonEvidence) {
      if (other.id === orphanId) continue;
      const tb = tokenAll.get(other.id) || new Set<string>();
      const sim = jaccard(ta, tb);
      if (!best || sim > best.sim) best = { other, sim };
    }

    if (!best) continue;
    const source = orphanId;
    const target = best.other.id;
    const id = `REINFORCING:${source < target ? `${source}|${target}` : `${target}|${source}`}`;
    const strength = clamp01(0.12 + 0.38 * clamp01(best.sim));
    edges.push({ id, source, target, strength, kind: 'REINFORCING' });
  }
}

// ── 1. Build Graph from Sessions (Discovery baseline) ────────

/**
 * Build a hemisphere graph from Discovery session data.
 *
 * @param workshopId — Workshop ID
 * @param runType — 'BASELINE' or 'FOLLOWUP'
 * @param customDimensionNames — Research-derived industry dimensions (optional)
 * @returns HemisphereGraph with nodes and edges
 */
export async function buildGraphFromSessions(
  workshopId: string,
  runType: RunType = 'BASELINE',
  customDimensionNames?: string[] | null,
): Promise<HemisphereGraph> {
  // Query sessions with reports and insights
  const allSessions = (await (prisma as any).conversationSession.findMany({
    where: { workshopId, status: 'COMPLETED' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      participantId: true,
      createdAt: true,
      completedAt: true,
      runType: true,
      questionSetVersion: true,
      participant: { select: { id: true, name: true, email: true } },
      report: { select: { sessionId: true, keyInsights: true, phaseInsights: true, wordCloudThemes: true } },
      insights: {
        select: { id: true, sessionId: true, participantId: true, insightType: true, category: true, text: true, severity: true, confidence: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })) as Array<{
    id: string;
    participantId: string;
    createdAt: Date;
    completedAt: Date | null;
    runType?: string | null;
    participant: { id: string; name: string; email: string };
    report?: { sessionId: string; keyInsights: unknown; phaseInsights: unknown; wordCloudThemes: unknown } | null;
    insights: Array<{
      id: string;
      sessionId: string;
      participantId: string;
      insightType: string;
      category: string | null;
      text: string;
      severity: number | null;
      confidence: number;
      createdAt: Date;
    }>;
  }>;

  const sessions = allSessions.filter((s) => safeRunType(s.runType) === runType);
  const sessionIds = sessions.map((s) => s.id);
  const reportBySession = new Map(sessions.filter((s) => s.report).map((s) => [s.id, s.report!]));
  const insights = sessions.flatMap((s) => s.insights);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const nodesById = new Map<string, HemisphereNode>();
  const upsertNode = (incoming: HemisphereNode) => {
    const existing = nodesById.get(incoming.id);
    if (!existing) { nodesById.set(incoming.id, incoming); return; }
    mergeNode(existing, incoming);
  };

  // Process insights
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
      id: nodeId, type, label: shortLabel(text, 8), summary: text,
      phaseTags: phaseTagFromCategory(ins.category), layer: layerForType(type),
      weight: 1, severity: sev, confidence: conf,
      sources: [{ sessionId: String(ins.sessionId), participantName }], evidence: [],
    });
  }

  // Process reports
  for (const s of sessions) {
    const report = reportBySession.get(s.id);
    if (!report) continue;
    const participantName = s.participant?.name || 'Participant';

    // Key insights
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
        id: nodeId, type, label: shortLabel(title || insight, 8), summary: insight || title,
        phaseTags: [], layer: layerForType(type), weight: 1,
        severity: defaultSeverity(type), confidence: conf,
        sources: [{ sessionId: s.id, participantName }],
        evidence: evidenceQuotes.map((q) => ({ quote: q })),
      });
    }

    // Phase insights
    const phaseInsights = safeArray(report.phaseInsights)
      .filter((p) => p && typeof p === 'object' && !Array.isArray(p)) as Array<Record<string, unknown>>;
    for (const p of phaseInsights) {
      const phase = typeof p.phase === 'string' ? p.phase.trim().toLowerCase() : '';
      const phaseTags = phase ? [phase] : [];
      const typeTextPairs: Array<{ type: NodeType; texts: string[] }> = [
        { type: 'VISION', texts: safeStringArray(p.future) },
        { type: 'FRICTION', texts: [...safeStringArray(p.frictions), ...safeStringArray(p.barriers)] },
        { type: 'CONSTRAINT', texts: safeStringArray(p.constraint) },
        { type: 'ENABLER', texts: [...safeStringArray(p.strengths), ...safeStringArray(p.working)] },
        { type: 'CHALLENGE', texts: [...safeStringArray(p.gaps), ...safeStringArray(p.painPoints), ...safeStringArray(p.support)] },
      ];
      for (const { type, texts } of typeTextPairs) {
        for (const text of texts) {
          const nodeId = `${type}:phase:${phase}:${text.toLowerCase()}`;
          upsertNode({
            id: nodeId, type, label: shortLabel(text, 8), summary: text,
            phaseTags, layer: layerForType(type), weight: 1,
            severity: defaultSeverity(type), confidence: undefined,
            sources: [{ sessionId: s.id, participantName }],
            evidence: [{ quote: text }],
          });
        }
      }
    }
  }

  // Process data points (evidence nodes)
  const dataPoints = sessionIds.length
    ? await prisma.dataPoint.findMany({
        where: { sessionId: { in: sessionIds }, questionKey: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, sessionId: true, participantId: true, questionKey: true, rawText: true, createdAt: true, transcriptChunkId: true },
      })
    : [];

  const evidenceCandidates = dataPoints
    .map((dp) => {
      const qk = String(dp.questionKey || '');
      const meta = parseQuestionKey(qk);
      const tag = (meta.tag || '').toLowerCase();
      const phase = (meta.phase || '').toLowerCase();
      if (tag === 'triple_rating' || tag.endsWith('_score') || tag.includes('rating')) return null;
      if (phase === 'intro' || tag === 'context') return null;
      const answer = String(dp.rawText || '').trim();
      if (!answer) return null;
      const wordCount = answer.split(/\s+/).filter(Boolean).length;
      if (wordCount < 18) return null;
      const session = sessionById.get(String(dp.sessionId || ''));
      const participantName = session?.participant?.name || 'Participant';
      return { dp, answer, wordCount, phase: meta.phase ? meta.phase.toLowerCase() : null, tag: meta.tag, participantName };
    })
    .filter(Boolean) as Array<{ dp: any; answer: string; wordCount: number; phase: string | null; tag: string | null; participantName: string }>;

  evidenceCandidates.sort((a, b) => b.wordCount - a.wordCount);
  for (const item of evidenceCandidates.slice(0, 45)) {
    const phaseTags = item.phase ? [item.phase] : [];
    const nodeId = `EVIDENCE:${String(item.dp.id)}`;
    upsertNode({
      id: nodeId, type: 'EVIDENCE', label: shortLabel(item.answer, 8), summary: item.answer,
      phaseTags, layer: layerForType('EVIDENCE'),
      weight: Math.max(1, Math.round(item.wordCount / 10)),
      severity: undefined, confidence: undefined,
      sources: [{ sessionId: String(item.dp.sessionId), participantName: item.participantName }],
      evidence: [{ quote: item.answer, qaTag: item.tag || undefined, createdAt: item.dp.createdAt ? new Date(item.dp.createdAt).toISOString() : undefined, chunkId: item.dp.transcriptChunkId ? String(item.dp.transcriptChunkId) : undefined }],
    });
  }

  // Normalise and sort
  let allNodes: HemisphereNode[] = [...nodesById.values()]
    .map((n): HemisphereNode => ({
      ...n,
      severity: typeof n.severity === 'number' ? clampInt(n.severity, 1, 5) : n.severity,
      confidence: typeof n.confidence === 'number' ? clamp01(n.confidence) : n.confidence,
    }))
    .sort((a, b) => b.weight - a.weight);

  // De-duplicate nodes (canonical text merge)
  const mergedByKey = new Map<string, { node: HemisphereNode; typeWeights: Map<NodeType, number> }>();
  const mergedNodes: HemisphereNode[] = [];
  for (const n of allNodes) {
    if (n.type === 'EVIDENCE') { mergedNodes.push(n); continue; }
    const basis = (n.summary || n.label || '').trim();
    const key = canonicalInsightKey(basis);
    const existing = mergedByKey.get(key);
    if (!existing) {
      const tw = new Map<NodeType, number>();
      tw.set(n.type, (tw.get(n.type) || 0) + Math.max(1, n.weight || 1));
      mergedByKey.set(key, { node: n, typeWeights: tw });
      mergedNodes.push(n);
      continue;
    }
    existing.typeWeights.set(n.type, (existing.typeWeights.get(n.type) || 0) + Math.max(1, n.weight || 1));
    mergeNode(existing.node, n);
  }

  for (const { node, typeWeights } of mergedByKey.values()) {
    let bestType: NodeType = node.type;
    let bestWeight = -1;
    for (const t of NODE_TYPE_ORDER) {
      if (t === 'EVIDENCE') continue;
      const w = typeWeights.get(t) || 0;
      if (w > bestWeight) { bestWeight = w; bestType = t; }
    }
    node.type = bestType;
    node.layer = layerForType(bestType);
  }

  for (const n of mergedNodes) {
    if (n.type === 'EVIDENCE') continue;
    const uniqueSessions = uniq((n.sources || []).map((s) => String(s.sessionId || '')).filter(Boolean));
    n.weight = Math.max(1, uniqueSessions.length);
  }
  allNodes = mergedNodes.sort((a, b) => b.weight - a.weight);

  // Semantic clustering (union-find)
  {
    const semanticCandidates = allNodes.filter((n) => n.type !== 'EVIDENCE');
    const candidates = semanticCandidates.slice(0, 180);
    const tokenById2 = new Map(candidates.map((n) => [n.id, tokenSet(`${n.label} ${n.summary || ''}`)]));
    const evidenceKeySet = (n: HemisphereNode): Set<string> => {
      const out = new Set<string>();
      const ev = Array.isArray(n.evidence) ? n.evidence : [];
      for (const e of ev) {
        if (!e || typeof e !== 'object') continue;
        const quote = typeof (e as any).quote === 'string' ? String((e as any).quote).trim() : '';
        const qaTag = typeof (e as any).qaTag === 'string' ? String((e as any).qaTag).trim() : '';
        if (!quote) continue;
        out.add(`${quote.toLowerCase()}|${qaTag.toLowerCase()}`);
      }
      return out;
    };
    const evidenceById = new Map(candidates.map((n) => [n.id, evidenceKeySet(n)]));
    const evidenceOverlap = (a: HemisphereNode, b: HemisphereNode): { score: number } => {
      const sa = evidenceById.get(a.id) || new Set<string>();
      const sb = evidenceById.get(b.id) || new Set<string>();
      const denom = Math.min(sa.size, sb.size);
      if (denom <= 0) return { score: 0 };
      let inter = 0;
      const small = sa.size <= sb.size ? sa : sb;
      const big = sa.size <= sb.size ? sb : sa;
      for (const k of small) { if (big.has(k)) inter++; }
      return { score: inter / denom };
    };

    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x);
      if (!p || p === x) { parent.set(x, x); return x; }
      const r = find(p);
      parent.set(x, r);
      return r;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    };
    for (const n of candidates) parent.set(n.id, n.id);

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        const da = layerDepth(a.layer);
        const db = layerDepth(b.layer);
        if (da === 4 || db === 4) continue;
        if (Math.abs(da - db) > 1) continue;
        const ta = tokenById2.get(a.id) || new Set<string>();
        const tb = tokenById2.get(b.id) || new Set<string>();
        const sim = jaccard(ta, tb);
        if (sim < 0.30) continue;
        const ov = evidenceOverlap(a, b);
        const okEvidence = ov.score >= 0.65;
        const okSim = sim >= 0.36 || (sim >= 0.32 && okEvidence);
        if (!okSim) continue;
        union(a.id, b.id);
      }
    }

    const groups = new Map<string, string[]>();
    for (const n of semanticCandidates) {
      const root = parent.has(n.id) ? find(n.id) : n.id;
      const arr = groups.get(root) || [];
      arr.push(n.id);
      groups.set(root, arr);
    }

    if ([...groups.values()].some((g) => g.length > 1)) {
      const nodeByIdLocal = new Map(semanticCandidates.map((n) => [n.id, n] as const));
      const mergedAway = new Set<string>();
      for (const ids of groups.values()) {
        if (ids.length <= 1) continue;
        const groupNodes = ids.map((id) => nodeByIdLocal.get(id)).filter(Boolean) as HemisphereNode[];
        groupNodes.sort((a, b) => (b.weight || 0) - (a.weight || 0));
        const rep = groupNodes[0];
        for (let k = 1; k < groupNodes.length; k++) {
          mergeNode(rep, groupNodes[k]);
          mergedAway.add(groupNodes[k].id);
        }
      }
      if (mergedAway.size) {
        allNodes = allNodes.filter((n) => !mergedAway.has(n.id));
        for (const n of allNodes) {
          if (n.type === 'EVIDENCE') continue;
          const uniqueSessions2 = uniq((n.sources || []).map((s) => String(s.sessionId || '')).filter(Boolean));
          n.weight = Math.max(1, uniqueSessions2.length);
        }
        allNodes.sort((a, b) => b.weight - a.weight);
      }
    }
  }

  // Build edges
  const edges = buildEdges(allNodes);

  // Recover orphans
  recoverOrphans(allNodes, edges);

  // Filter edges to valid nodes
  const allNodeIds = new Set(allNodes.map((n) => n.id));
  const filteredEdges = edges.filter((e) => allNodeIds.has(e.source) && allNodeIds.has(e.target));

  return { nodes: allNodes, edges: filteredEdges };
}

// ── 2. Build Graph from Snapshot (Live session) ──────────────

/**
 * Build a hemisphere graph from a live workshop snapshot.
 *
 * @param snapshotPayload — The snapshot.payload object (contains nodesById)
 * @param customDimensionNames — Research-derived industry dimensions (optional)
 * @returns HemisphereGraph with nodes and edges
 */
export function buildGraphFromSnapshot(
  snapshotPayload: Record<string, unknown> | null,
  customDimensionNames?: string[] | null,
): HemisphereGraph {
  const rawNodes = (snapshotPayload && typeof snapshotPayload === 'object')
    ? (snapshotPayload.nodesById ?? snapshotPayload.nodes)
    : null;
  const liveNodes = (rawNodes && typeof rawNodes === 'object' && !Array.isArray(rawNodes))
    ? rawNodes as Record<string, any>
    : {} as Record<string, any>;

  const nodesById = new Map<string, HemisphereNode>();

  for (const [dataPointId, datum] of Object.entries(liveNodes)) {
    if (!datum || typeof datum !== 'object') continue;
    const rawText = typeof datum.rawText === 'string' ? datum.rawText.trim() : '';
    if (!rawText) continue;

    const classification = datum.classification && typeof datum.classification === 'object' ? datum.classification : null;
    const agenticAnalysis = datum.agenticAnalysis && typeof datum.agenticAnalysis === 'object' ? datum.agenticAnalysis : null;

    const primaryType: LivePrimaryType = (classification && typeof classification.primaryType === 'string')
      ? classification.primaryType as LivePrimaryType
      : 'INSIGHT';
    const mappedType = mapLivePrimaryTypeToNodeType(primaryType);

    const phaseTags = phaseTagsFromDomains(agenticAnalysis?.domains, customDimensionNames);

    const confidence = (agenticAnalysis && typeof agenticAnalysis.overallConfidence === 'number')
      ? clamp01(agenticAnalysis.overallConfidence)
      : (classification && typeof classification.confidence === 'number')
        ? clamp01(classification.confidence)
        : undefined;

    const speakerId = typeof datum.speakerId === 'string' ? datum.speakerId : null;

    // Derive weight from richness
    const domainCount = Array.isArray(agenticAnalysis?.domains) ? (agenticAnalysis.domains as unknown[]).length : 0;
    const actorCount = Array.isArray(agenticAnalysis?.actors) ? (agenticAnalysis.actors as unknown[]).length : 0;
    const interactionCount = Array.isArray(agenticAnalysis?.actors)
      ? (agenticAnalysis.actors as Array<Record<string, unknown>>).reduce(
          (sum: number, a) => sum + (Array.isArray(a?.interactions) ? (a.interactions as unknown[]).length : 0), 0)
      : 0;
    const keywordCount = Array.isArray(classification?.keywords) ? (classification.keywords as unknown[]).length : 0;
    const computedWeight = 1 + domainCount + actorCount + Math.floor(interactionCount / 2) + Math.floor(keywordCount / 3);

    const nodeId = `${mappedType}:live:${dataPointId}`;
    nodesById.set(nodeId, {
      id: nodeId,
      type: mappedType,
      label: shortLabel(rawText, 8),
      summary: rawText,
      phaseTags,
      layer: layerForType(mappedType),
      weight: computedWeight,
      severity: defaultSeverity(mappedType),
      confidence,
      sources: [{ sessionId: 'live', participantName: speakerId || 'Speaker' }],
      evidence: [{ quote: rawText }],
    });
  }

  const allNodes: HemisphereNode[] = [...nodesById.values()].sort((a, b) => b.weight - a.weight);

  // Build edges
  const edges = buildEdges(allNodes);

  // Recover orphans
  recoverOrphans(allNodes, edges);

  // Filter edges to valid nodes
  const allNodeIds = new Set(allNodes.map((n) => n.id));
  const filteredEdges = edges.filter((e) => allNodeIds.has(e.source) && allNodeIds.has(e.target));

  return { nodes: allNodes, edges: filteredEdges };
}

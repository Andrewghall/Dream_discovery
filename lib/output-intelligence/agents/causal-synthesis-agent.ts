/**
 * Causal Synthesis Agent
 *
 * Transforms GraphIntelligence into board-facing CausalFindings.
 *
 * Two-phase approach:
 * 1. Deterministic mapping — graph objects → CausalFinding[] with structural fields.
 *    Every finding is directly traceable to a node, edge, or intelligence object.
 * 2. LLM enrichment — one GPT-4o-mini call fills whyItMatters, operationalImplication,
 *    and recommendedAction for all findings as a batch.
 *    Falls back to deterministic text if LLM fails.
 *
 * Gating rules (no graph database, no invented causality):
 * - ORGANISATIONAL_ISSUE: bottlenecks with evidenceTier ∈ {REINFORCED, ESTABLISHED, ORGANISATIONAL}
 *   OR compensating behaviours with riskLevel=high.
 * - REINFORCED_FINDING: compensating behaviours riskLevel=medium, or strong causal chain constraints.
 * - EMERGING_PATTERN: brokenChains ENABLER_LEADS_NOWHERE or REIMAGINATION_UNSUPPORTED (clearly labelled).
 * - CONTRADICTION: contradictionPaths (all included, sorted by score).
 * - EVIDENCE_GAP: CONSTRAINT_NO_RESPONSE with severity=high (unaddressed, high-frequency constraints).
 * - Weak/WEAK-tier nodes are never elevated to findings.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals, CausalFinding, CausalIntelligence } from '../types';
import type { GraphIntelligence } from '@/lib/output/relationship-graph';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

// ── Gating constants ──────────────────────────────────────────────────────────

const STRONG_EVIDENCE_TIERS = new Set(['REINFORCED', 'ESTABLISHED', 'ORGANISATIONAL']);

// ── Deterministic extraction ──────────────────────────────────────────────────

function extractFindings(graph: GraphIntelligence, clientName: string): CausalFinding[] {
  const findings: CausalFinding[] = [];
  let seq = 0;
  const id = (prefix: string) => `${prefix}_${++seq}`;

  // ── ORGANISATIONAL_ISSUE: Bottlenecks ─────────────────────────────────────
  for (const b of graph.bottlenecks) {
    if (!STRONG_EVIDENCE_TIERS.has(b.evidenceTier)) continue;

    findings.push({
      findingId: id('issue'),
      category: 'ORGANISATIONAL_ISSUE',
      issueTitle: `Structural bottleneck: ${b.displayLabel}`,
      whyItMatters: `This constraint affects ${b.outDegree} interconnected areas — making it a structural bottleneck across the organisation.`,
      whoItAffects: `Organisation-wide (${b.outDegree} dependent areas)`,
      evidenceBasis: `Evidence cluster "${b.displayLabel}" — ${b.evidenceTier} tier, composite score ${b.compositeScore}`,
      bottleneckContext: `${b.outDegree} outgoing relationship edges (constrains/blocks/drives) — the highest connected constraint node in the graph.`,
      operationalImplication: `Unresolved, this constraint creates cascading friction across ${b.outDegree} areas simultaneously.`,
      recommendedAction: `Prioritise root-cause investigation and resolution of "${b.displayLabel}" before scaling dependent enablers.`,
      evidenceEdgeIds: b.edgeIds,
      evidenceNodeId: b.nodeId,
    });
  }

  // ── ORGANISATIONAL_ISSUE + REINFORCED_FINDING: Compensating behaviours ────
  for (const cb of graph.compensatingBehaviours) {
    const category: CausalFinding['category'] =
      cb.riskLevel === 'high' ? 'ORGANISATIONAL_ISSUE' : 'REINFORCED_FINDING';

    findings.push({
      findingId: id(cb.riskLevel === 'high' ? 'issue' : 'finding'),
      category,
      issueTitle: `Workaround masking live constraint: ${cb.enablerLabel} → ${cb.constraintLabel}`,
      whyItMatters: cb.riskLevel === 'high'
        ? `"${cb.enablerLabel}" is papering over a live constraint ("${cb.constraintLabel}") that has ${cb.constraintRawFrequency} active mentions. The underlying problem remains unresolved.`
        : `"${cb.enablerLabel}" acts as a workaround for "${cb.constraintLabel}" — addressing symptoms rather than root cause.`,
      whoItAffects: `Teams relying on "${cb.enablerLabel}" without resolving "${cb.constraintLabel}"`,
      evidenceBasis: `compensates_for edge: "${cb.enablerLabel}" → "${cb.constraintLabel}" — constraint raw frequency: ${cb.constraintRawFrequency}`,
      compensatingBehaviourContext: `Risk level: ${cb.riskLevel}. Constraint "${cb.constraintLabel}" is ${cb.constraintIsLive ? 'still live' : 'lower activity'} with ${cb.constraintRawFrequency} signal mentions.`,
      operationalImplication: cb.riskLevel === 'high'
        ? `High risk of regression: if the workaround fails or scales, the underlying constraint will surface at greater scale.`
        : `Medium risk: the workaround is viable short-term but creates technical/process debt.`,
      recommendedAction: `Address root constraint "${cb.constraintLabel}" alongside scaling enabler "${cb.enablerLabel}" — resolve rather than compensate.`,
      evidenceEdgeIds: [cb.edgeId],
      evidenceNodeId: cb.enablerNodeId,
    });
  }

  // ── EVIDENCE_GAP: Unaddressed high-severity constraints ───────────────────
  for (const bc of graph.brokenChains) {
    if (bc.brokenChainType !== 'CONSTRAINT_NO_RESPONSE') continue;
    if (bc.severity !== 'high') continue;

    findings.push({
      findingId: id('gap'),
      category: 'EVIDENCE_GAP',
      issueTitle: `Unaddressed constraint: ${bc.displayLabel}`,
      whyItMatters: `"${bc.displayLabel}" has no responds_to or drives pathway — it is a high-frequency constraint with no identified organisational response.`,
      whoItAffects: `All stakeholders affected by "${bc.displayLabel}"`,
      evidenceBasis: `Evidence cluster "${bc.displayLabel}" — ${bc.evidenceTier} tier, raw frequency ${bc.rawFrequency}. No response pathway detected in relationship graph.`,
      operationalImplication: `Without a response pathway, this constraint will persist unaddressed and compound over time.`,
      recommendedAction: `Design or identify an enabler or initiative that directly responds to "${bc.displayLabel}".`,
      evidenceEdgeIds: [],
      evidenceNodeId: bc.nodeId,
    });
  }

  // ── EMERGING_PATTERN: Enablers leading nowhere ────────────────────────────
  for (const bc of graph.brokenChains) {
    if (bc.brokenChainType !== 'ENABLER_LEADS_NOWHERE') continue;
    if (bc.evidenceTier === 'WEAK') continue; // don't elevate thin signals

    findings.push({
      findingId: id('pattern'),
      category: 'EMERGING_PATTERN',
      issueTitle: `Enabler without vision pathway: ${bc.displayLabel}`,
      whyItMatters: `"${bc.displayLabel}" is identified as an enabler but has no confirmed connection to a reimagination outcome. It may be underutilised or mis-classified. (Emerging signal — not yet systemic.)`,
      whoItAffects: `Teams investing in "${bc.displayLabel}"`,
      evidenceBasis: `Evidence cluster "${bc.displayLabel}" — ${bc.evidenceTier} tier. No enables edge to any REIMAGINATION node detected.`,
      operationalImplication: `This capability may be deployed without a clear strategic outcome — effort without direction.`,
      recommendedAction: `Clarify how "${bc.displayLabel}" connects to specific future-state visions. If no vision applies, re-evaluate priority.`,
      evidenceEdgeIds: [],
      evidenceNodeId: bc.nodeId,
    });
  }

  // ── EMERGING_PATTERN: Unsupported visions ────────────────────────────────
  for (const bc of graph.brokenChains) {
    if (bc.brokenChainType !== 'REIMAGINATION_UNSUPPORTED') continue;
    if (bc.evidenceTier === 'WEAK') continue;

    findings.push({
      findingId: id('pattern'),
      category: 'EMERGING_PATTERN',
      issueTitle: `Vision without enabler support: ${bc.displayLabel}`,
      whyItMatters: `"${bc.displayLabel}" is a stated vision with no enables or depends_on edge from an enabler node — it is aspirational but currently unsupported by identified capabilities. (Emerging signal.)`,
      whoItAffects: `Leadership and teams accountable for "${bc.displayLabel}"`,
      evidenceBasis: `Evidence cluster "${bc.displayLabel}" — ${bc.evidenceTier} tier. No incoming enables or depends_on edges detected.`,
      operationalImplication: `Without an enabler, this vision remains aspirational. It risks being treated as a goal without a credible path.`,
      recommendedAction: `Identify and resource the capability that enables "${bc.displayLabel}" — or de-prioritise if no credible enabler can be named.`,
      evidenceEdgeIds: [],
      evidenceNodeId: bc.nodeId,
    });
  }

  // ── CONTRADICTION: Opposing signals on same topic ─────────────────────────
  for (const cp of graph.contradictionPaths) {
    findings.push({
      findingId: id('contradiction'),
      category: 'CONTRADICTION',
      issueTitle: `Opposing views: ${cp.nodeALabel} ↔ ${cp.nodeBLabel}`,
      whyItMatters: `Participants hold conflicting views on the relationship between "${cp.nodeALabel}" and "${cp.nodeBLabel}". This represents unresolved organisational tension.`,
      whoItAffects: `Participants with shared involvement in both areas`,
      evidenceBasis: `contradicts edge — score ${cp.edgeScore}, ${cp.sharedParticipantIds.length} shared participant(s), ${cp.fromSignalIds.length + cp.toSignalIds.length} signals`,
      operationalImplication: `Unresolved contradictions create inconsistent decision-making. Different teams may be working from opposing assumptions.`,
      recommendedAction: `Surface this tension explicitly with senior stakeholders. Align on a single position or acknowledge it as a managed trade-off.`,
      evidenceEdgeIds: [cp.edgeId],
    });
  }

  return findings;
}

// ── LLM enrichment ────────────────────────────────────────────────────────────

interface EnrichedFinding {
  findingId: string;
  whyItMatters: string;
  whoItAffects: string;
  operationalImplication: string;
  recommendedAction: string;
}

async function enrichFindings(
  findings: CausalFinding[],
  signals: WorkshopSignals,
): Promise<Map<string, EnrichedFinding>> {
  if (!openai || findings.length === 0) return new Map();

  const context = [
    `Client: ${signals.context.clientName || 'Not specified'}`,
    `Industry: ${signals.context.industry || 'Not specified'}`,
    `Business context: ${signals.context.businessContext || 'Not specified'}`,
  ].join('\n');

  const findingSummaries = findings.map((f) => ({
    findingId: f.findingId,
    category: f.category,
    issueTitle: f.issueTitle,
    evidenceBasis: f.evidenceBasis,
    bottleneckContext: f.bottleneckContext,
    compensatingBehaviourContext: f.compensatingBehaviourContext,
  }));

  const prompt = `You are a strategic advisor synthesising workshop relationship graph findings into board-grade language.

CLIENT CONTEXT:
${context}

FINDINGS TO ENRICH:
${JSON.stringify(findingSummaries, null, 2)}

For each finding, return enriched narrative fields. Be specific, evidence-grounded, and written for a C-suite audience.
Do NOT invent evidence not present in the finding. Use the client name and industry where relevant.

Return a JSON array (not an object) with one entry per finding:
[
  {
    "findingId": "string — matches the input findingId exactly",
    "whyItMatters": "string — 2-3 sentences, board-grade, specific to this client's context",
    "whoItAffects": "string — specific roles/teams, not generic",
    "operationalImplication": "string — concrete operational consequence if unaddressed",
    "recommendedAction": "string — specific, actionable, proportionate to evidence tier"
  }
]`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    const response = await openAiBreaker.execute(() =>
      openai!.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are a strategic advisor. Return valid JSON only — an object with a "findings" array.',
            },
            { role: 'user', content: prompt + '\n\nReturn: {"findings": [...]}' },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        },
        { signal: controller.signal },
      ),
    );
    clearTimeout(timeoutId);

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { findings?: EnrichedFinding[] };
    const arr = Array.isArray(parsed.findings) ? parsed.findings : [];

    const map = new Map<string, EnrichedFinding>();
    for (const e of arr) {
      if (e.findingId) map.set(e.findingId, e);
    }
    return map;
  } catch {
    return new Map();
  }
}

// ── Dominant chain narratives ─────────────────────────────────────────────────

function buildChainNarratives(
  graph: GraphIntelligence,
): CausalIntelligence['dominantCausalChains'] {
  return graph.dominantCausalChains.map((c) => ({
    constraintLabel: c.labels.constraint,
    enablerLabel: c.labels.enabler,
    reimaginationLabel: c.labels.reimagination,
    chainStrength: c.chainStrength,
    narrative: `"${c.labels.constraint}" → "${c.labels.enabler}" → "${c.labels.reimagination}" — chain strength ${c.chainStrength}/100, weakest link: ${c.weakestLinkTier}.`,
  }));
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the causal synthesis agent.
 *
 * Returns null when graphIntelligence is absent or has zero graph coverage.
 * The pipeline treats null as "skip causal intelligence" — not a failure.
 */
export async function runCausalSynthesisAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void,
): Promise<CausalIntelligence | null> {
  const graph = signals.graphIntelligence;

  // Guard: skip when no graph data
  if (!graph || (graph.summary.graphCoverageScore === 0 && graph.summary.totalChains === 0)) {
    onProgress?.('Causal Synthesis: no graph data — skipped');
    return null;
  }

  onProgress?.('Causal Synthesis: extracting graph findings…');
  const clientName = signals.context.clientName || 'the organisation';
  const findings = extractFindings(graph, clientName);

  // LLM enrichment (best-effort; falls back to deterministic text on failure)
  let enriched = new Map<string, EnrichedFinding>();
  if (findings.length > 0) {
    onProgress?.('Causal Synthesis: enriching findings…');
    enriched = await enrichFindings(findings, signals);
  }

  // Merge enriched fields into findings
  const mergedFindings = findings.map((f) => {
    const e = enriched.get(f.findingId);
    if (!e) return f;
    return {
      ...f,
      whyItMatters: e.whyItMatters || f.whyItMatters,
      whoItAffects: e.whoItAffects || f.whoItAffects,
      operationalImplication: e.operationalImplication || f.operationalImplication,
      recommendedAction: e.recommendedAction || f.recommendedAction,
    };
  });

  // Bucket into categories
  const byCategory = (cat: CausalFinding['category']) =>
    mergedFindings.filter((f) => f.category === cat);

  onProgress?.('Causal Synthesis: complete ✓');

  return {
    organisationalIssues:  byCategory('ORGANISATIONAL_ISSUE'),
    reinforcedFindings:    byCategory('REINFORCED_FINDING'),
    emergingPatterns:      byCategory('EMERGING_PATTERN'),
    contradictions:        byCategory('CONTRADICTION'),
    evidenceGaps:          byCategory('EVIDENCE_GAP'),
    dominantCausalChains:  buildChainNarratives(graph),
    graphCoverageScore:    graph.summary.graphCoverageScore,
    generatedAtMs:         Date.now(),
  };
}

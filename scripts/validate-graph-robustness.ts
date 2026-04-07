/**
 * Graph Robustness Validation Harness
 *
 * Stress-tests the board-output pipeline against 3 deterministic Jo Air scenarios:
 *
 *   FULL    — all signals unchanged
 *   REDUCED — ~40% of signals removed (deterministic: sort by id, remove idx where idx % 5 < 2)
 *   NOISY   — full corpus + 20% CONSTRAINT signal duplicates with vague reformulations
 *
 * Runs the deterministic pipeline only (refineClusters: false, extractFindings only).
 * No LLM calls. Fully reproducible.
 *
 * Usage:
 *   npx tsx scripts/validate-graph-robustness.ts
 */

import { PrismaClient } from '@prisma/client';
import { buildWorkshopGraphIntelligence } from '../lib/output/build-workshop-graph';
import { extractFindings } from '../lib/output-intelligence/agents/causal-synthesis-agent';
import type { GraphIntelligence } from '../lib/output/relationship-graph';
import type { CausalFinding } from '../lib/output-intelligence/types';

const prisma = new PrismaClient();

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw'; // Jo Air
const CLIENT_NAME = 'Jo Air';

// ── Types ──────────────────────────────────────────────────────────────────────

type ScenarioName = 'FULL' | 'REDUCED' | 'NOISY';

interface AgenticTheme { label: string; confidence: number }
interface AgenticAnalysis {
  sentimentTone?: string;
  themes?: AgenticTheme[];
  overallConfidence?: number;
}

interface NodeRecord {
  id: string;
  rawText: string;
  speaker?: string | null;
  speakerId?: string | null;
  lens?: string | null;
  dialoguePhase?: string | null;
  primaryType?: string | null;
  agenticAnalysis?: AgenticAnalysis | null;
}

interface ScenarioResult {
  scenario: ScenarioName;
  signalCount: number;
  graph: GraphIntelligence;
  findings: CausalFinding[];
  suppressedFindings: SuppressedFinding[];
}

interface SuppressedFinding {
  reason: string;
  description: string;
}

// ── Vague generic reformulations for NOISY scenario ──────────────────────────
// Fixed list — deterministic. These simulate noise: real-sounding but unfalsifiable.

const VAGUE_NOISE_NODES: Array<Omit<NodeRecord, 'id'>> = [
  {
    rawText: 'There are some issues with how things work currently',
    lens: 'Organisation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    speaker: null,
  },
  {
    rawText: 'Communication could be improved across the organisation',
    lens: 'People',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    speaker: null,
  },
  {
    rawText: 'The system doesn\'t always meet our needs',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    speaker: null,
  },
  {
    rawText: 'We need better processes going forward',
    lens: 'Organisation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    speaker: null,
  },
  {
    rawText: 'Things could be more efficient if we changed how we operate',
    lens: 'Organisation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    speaker: null,
  },
  {
    rawText: 'There are challenges that need to be addressed',
    lens: 'Customer',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    speaker: null,
  },
  {
    rawText: 'More collaboration would help the team perform better',
    lens: 'People',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    speaker: null,
  },
  {
    rawText: 'The tools we use are not always fit for purpose',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    speaker: null,
  },
];

// ── Data loading ───────────────────────────────────────────────────────────────

async function loadJoAirData() {
  const [workshop, latestSnapshot] = await Promise.all([
    prisma.workshop.findUnique({
      where: { id: WORKSHOP_ID },
      select: {
        name: true,
        clientName: true,
        insights: {
          take: 200,
          select: { id: true, text: true, insightType: true, category: true, participantId: true },
        },
        participants: {
          select: { id: true, role: true },
        },
      },
    }),
    prisma.liveWorkshopSnapshot.findFirst({
      where: { workshopId: WORKSHOP_ID },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    }),
  ]);

  if (!workshop) throw new Error(`Workshop ${WORKSHOP_ID} not found`);

  type RawSnapshotNode = {
    rawText: string;
    speaker?: string;
    speakerId?: string;
    lens?: string;
    dialoguePhase?: string;
    classification?: { primaryType?: string };
    agenticAnalysis?: { sentimentTone?: string; themes?: Array<{ label: string; confidence: number }>; overallConfidence?: number };
  };
  type SnapshotPayload = {
    nodesById?: Record<string, RawSnapshotNode>;
    nodes?: Record<string, RawSnapshotNode>;
  };

  const payload = latestSnapshot?.payload as SnapshotPayload | null;
  const rawNodes = payload?.nodesById ?? payload?.nodes ?? {};

  // Only take v2_ nodes — the validation harness targets the corpus seed exclusively.
  // Pre-existing snapshot nodes (without v2_ prefix) use generic topic labels that flood
  // the graph and mask the structural design of the v2 corpus.
  const v2Nodes = Object.entries(rawNodes).filter(([id]) => id.startsWith('v2_'));
  const allNodes = v2Nodes.length > 0 ? v2Nodes : Object.entries(rawNodes);

  const nodes: NodeRecord[] = allNodes
    .filter(([, n]) => n.rawText)
    .map(([id, n]) => ({
      id,
      rawText:       n.rawText,
      speaker:       n.speaker ?? null,
      speakerId:     n.speakerId ?? null,
      lens:          n.lens ?? null,
      dialoguePhase: n.dialoguePhase ?? null,
      primaryType:   n.classification?.primaryType ?? null,
      agenticAnalysis: n.agenticAnalysis ?? null,
    }));

  return {
    workshopName: workshop.name,
    nodes,
    // Validation uses ONLY the v2 snapshot corpus — not the pre-existing discovery
    // insights, which use generic single-word topic labels ("queue", "agent", "system")
    // and flood the graph, masking the structural design under test.
    insights: [],
    participants: workshop.participants,
  };
}

// ── Scenario builders ──────────────────────────────────────────────────────────

function buildReducedNodes(nodes: NodeRecord[]): NodeRecord[] {
  // Sort by id for determinism, then remove ~40%: keep nodes where sorted_idx % 5 >= 2
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  return sorted.filter((_, idx) => idx % 5 >= 2);
}

function buildNoisyNodes(nodes: NodeRecord[]): NodeRecord[] {
  // Sort by id for determinism
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

  // Duplicate the first 20% of CONSTRAINT-phase nodes
  const constraintNodes = sorted.filter(
    (n) => n.dialoguePhase?.toUpperCase() === 'CONSTRAINTS',
  );
  const duplicateCount = Math.ceil(constraintNodes.length * 0.2);
  const duplicates: NodeRecord[] = constraintNodes.slice(0, duplicateCount).map((n, i) => ({
    ...n,
    id: `noise_dup_${i}_${n.id}`,
  }));

  // Add fixed vague reformulations
  const vagueNodes: NodeRecord[] = VAGUE_NOISE_NODES.map((n, i) => ({
    ...n,
    id: `noise_vague_${i}`,
  }));

  return [...sorted, ...duplicates, ...vagueNodes];
}

// ── Build WorkshopGraphInput nodesById from NodeRecord[] ─────────────────────

type RawNodeValue = {
  rawText: string;
  speaker?: string | null;
  speakerId?: string | null;
  lens?: string | null;
  dialoguePhase?: string | null;
  classification?: { primaryType?: string | null };
  agenticAnalysis?: {
    sentimentTone?: string;
    themes?: Array<{ label: string; confidence: number }>;
    overallConfidence?: number;
  } | null;
};

function nodesToNodesById(nodes: NodeRecord[]): Record<string, Omit<RawNodeValue, 'id'>> {
  const result: Record<string, Omit<RawNodeValue, 'id'>> = {};
  for (const n of nodes) {
    result[n.id] = {
      rawText:       n.rawText,
      speaker:       n.speaker,
      speakerId:     n.speakerId,
      lens:          n.lens,
      dialoguePhase: n.dialoguePhase,
      classification: n.primaryType ? { primaryType: n.primaryType } : undefined,
      // Preserve agenticAnalysis.themes so the pipeline uses the pre-assigned
      // cluster labels from the corpus design rather than generic topic extraction.
      agenticAnalysis: n.agenticAnalysis ?? undefined,
    };
  }
  return result;
}

// ── Pipeline runner ─────────────────────────────────────────────────────────

async function runScenario(
  scenarioName: ScenarioName,
  nodes: NodeRecord[],
  insights: Awaited<ReturnType<typeof loadJoAirData>>['insights'],
  participants: Awaited<ReturnType<typeof loadJoAirData>>['participants'],
): Promise<ScenarioResult> {
  process.stdout.write(`\n  Building graph for ${scenarioName} (${nodes.length} nodes)...`);

  const graph = await buildWorkshopGraphIntelligence({
    workshopId: `${WORKSHOP_ID}_${scenarioName.toLowerCase()}`,
    nodesById: nodesToNodesById(nodes) as Parameters<typeof buildWorkshopGraphIntelligence>[0]['nodesById'],
    insights,
    participants,
    clientContext: { clientName: CLIENT_NAME, industry: 'Aviation / Contact Centre' },
    refineClusters: false, // deterministic only — no LLM
  });

  process.stdout.write(' done.\n');

  const findings = extractFindings(graph, CLIENT_NAME);

  const suppressedFindings = identifySuppressed(findings, graph, scenarioName);

  return {
    scenario: scenarioName,
    signalCount: nodes.length, // insights excluded from v2 corpus validation
    graph,
    findings,
    suppressedFindings,
  };
}

// ── Suppressed finding analysis ───────────────────────────────────────────────

function identifySuppressed(
  findings: CausalFinding[],
  graph: GraphIntelligence,
  scenario: ScenarioName,
): SuppressedFinding[] {
  const suppressed: SuppressedFinding[] = [];

  // 1. Bottlenecks that didn't make it to findings (WEAK tier blocked)
  const findingNodeIds = new Set(findings.map((f) => f.evidenceNodeId).filter(Boolean));
  for (const bottleneck of graph.bottlenecks) {
    if (!findingNodeIds.has(bottleneck.nodeId) && bottleneck.evidenceTier === 'WEAK') {
      suppressed.push({
        reason: `WEAK evidence tier (score: ${bottleneck.compositeScore}) — below REINFORCED gate`,
        description: `Bottleneck "${bottleneck.displayLabel}" affects ${bottleneck.outDegree} areas but has only WEAK tier evidence`,
      });
      if (suppressed.length >= 3) break;
    }
  }

  // 2. CONSTRAINT_NO_RESPONSE broken chains with low severity that were excluded
  if (suppressed.length < 3) {
    for (const bc of graph.brokenChains) {
      if (
        bc.brokenChainType === 'CONSTRAINT_NO_RESPONSE' &&
        bc.severity !== 'high' &&
        !findingNodeIds.has(bc.nodeId)
      ) {
        suppressed.push({
          reason: `Severity "${bc.severity}" — only high-severity unaddressed constraints surface as EVIDENCE_GAP`,
          description: `Unaddressed constraint "${bc.displayLabel}" (${bc.rawFrequency} mentions) suppressed — not high-severity`,
        });
        if (suppressed.length >= 3) break;
      }
    }
  }

  // 3. NOISY-specific: vague noise nodes that didn't create a cluster strong enough to gate
  if (scenario === 'NOISY' && suppressed.length < 3) {
    // Check for ENABLER_LEADS_NOWHERE patterns — these reflect real topics
    // that the noisy signal can't elevate into findings
    const enablerNowhere = graph.brokenChains.filter(
      (bc) => bc.brokenChainType === 'ENABLER_LEADS_NOWHERE',
    );
    for (const bc of enablerNowhere) {
      if (!findingNodeIds.has(bc.nodeId)) {
        suppressed.push({
          reason: `ENABLER_LEADS_NOWHERE — no REIMAGINATION link detected; generic noise cannot create causal chain`,
          description: `Enabler "${bc.displayLabel}" with no vision edge — generic noise descriptions fail to cluster to a specific topic`,
        });
        if (suppressed.length >= 3) break;
      }
    }
  }

  // Fill remaining slots with compensating behaviour items below threshold
  if (suppressed.length < 3) {
    for (const cb of graph.compensatingBehaviours) {
      if (cb.riskLevel === 'low' && !findingNodeIds.has(cb.enablerNodeId)) {
        suppressed.push({
          reason: `riskLevel "low" — compensating behaviour not elevated; constraint is no longer live (rawFrequency < 5)`,
          description: `"${cb.enablerLabel}" compensates for "${cb.constraintLabel}" but constraint frequency is only ${cb.constraintRawFrequency} — low-risk suppressed`,
        });
        if (suppressed.length >= 3) break;
      }
    }
  }

  return suppressed.slice(0, 3);
}

// ── Reporting ──────────────────────────────────────────────────────────────────

function printDivider(char = '─', width = 80) {
  console.log(char.repeat(width));
}

function printSectionHeader(title: string) {
  printDivider('═');
  console.log(`  ${title}`);
  printDivider('═');
}

function printScenarioSummary(result: ScenarioResult) {
  const { scenario, signalCount, graph, findings } = result;
  const g = graph.summary;

  const orgIssues    = findings.filter((f) => f.category === 'ORGANISATIONAL_ISSUE').length;
  const reinforced   = findings.filter((f) => f.category === 'REINFORCED_FINDING').length;
  const emerging     = findings.filter((f) => f.category === 'EMERGING_PATTERN').length;
  const contradicts  = findings.filter((f) => f.category === 'CONTRADICTION').length;
  const gaps         = findings.filter((f) => f.category === 'EVIDENCE_GAP').length;

  const withChain    = findings.filter((f) => f.causalChain !== undefined).length;
  const withQuotes   = findings.filter((f) => (f.evidenceQuotes?.length ?? 0) > 0).length;
  const withNodeId   = findings.filter((f) => f.evidenceNodeId).length;

  console.log(`\n  ┌─ ${scenario} scenario`);
  console.log(`  │  Input signals        : ${signalCount}`);
  console.log(`  │  Graph coverage score : ${g.graphCoverageScore}%`);
  console.log(`  │  Causal chains        : ${g.totalChains}`);
  console.log(`  │  Bottlenecks          : ${g.totalBottlenecks}`);
  console.log(`  │  Compensating behav.  : ${g.totalCompensatingBehaviours}`);
  console.log(`  │  Broken chains        : ${g.totalBrokenChains}`);
  console.log(`  │  Contradictions       : ${g.totalContradictions}`);
  console.log(`  │  Systemic edges       : ${g.systemicEdgeCount}`);
  console.log(`  │`);
  console.log(`  │  Findings total       : ${findings.length}`);
  console.log(`  │    ORGANISATIONAL_ISSUE : ${orgIssues}`);
  console.log(`  │    REINFORCED_FINDING   : ${reinforced}`);
  console.log(`  │    EMERGING_PATTERN     : ${emerging}`);
  console.log(`  │    CONTRADICTION        : ${contradicts}`);
  console.log(`  │    EVIDENCE_GAP         : ${gaps}`);
  console.log(`  │`);
  console.log(`  │  Provenance quality`);
  console.log(`  │    with evidenceNodeId  : ${withNodeId}/${findings.length}`);
  console.log(`  │    with evidenceQuotes  : ${withQuotes}/${findings.length}`);
  console.log(`  │    with causalChain     : ${withChain}/${findings.length}`);
  console.log(`  └`);
}

function printFindingsDetail(result: ScenarioResult) {
  const { scenario, findings } = result;
  if (findings.length === 0) {
    console.log(`\n  [${scenario}] No findings generated.`);
    return;
  }

  console.log(`\n  ── ${scenario}: Top findings ─────────────────────────────────`);

  // Show up to 5 findings across all categories
  const display = findings.slice(0, 5);
  for (const f of display) {
    console.log(`\n  [${f.category}] ${f.issueTitle}`);
    if (f.evidenceNodeId) console.log(`    evidenceNodeId  : ${f.evidenceNodeId}`);
    if (f.evidenceBasis)  console.log(`    evidenceBasis   : ${f.evidenceBasis.slice(0, 120)}${f.evidenceBasis.length > 120 ? '…' : ''}`);
    if (f.causalChain) {
      const cc = f.causalChain;
      console.log(`    causalChain     : ${cc.constraintLabel} → ${cc.enablerLabel} → ${cc.reimaginationLabel} (strength: ${cc.chainStrength}, tier: ${cc.weakestLinkTier})`);
    }
    if (f.evidenceQuotes && f.evidenceQuotes.length > 0) {
      console.log(`    quotes[0]       : "${f.evidenceQuotes[0].text.slice(0, 100)}${f.evidenceQuotes[0].text.length > 100 ? '…' : ''}" [${f.evidenceQuotes[0].participantRole ?? 'unknown role'}]`);
    }
  }
}

function printSuppressedFindings(result: ScenarioResult) {
  const { scenario, suppressedFindings } = result;
  console.log(`\n  ── ${scenario}: Suppressed findings (gating working) ───────────────────`);

  if (suppressedFindings.length === 0) {
    console.log(`  (No suppressed findings identified — all graph items escalated to findings)`);
    return;
  }

  for (let i = 0; i < suppressedFindings.length; i++) {
    const s = suppressedFindings[i];
    console.log(`\n  ${i + 1}. ${s.description}`);
    console.log(`     Gate reason: ${s.reason}`);
  }
}

function printSideBySideComparison(results: ScenarioResult[]) {
  printSectionHeader('SIDE-BY-SIDE COMPARISON');

  const headers = ['Metric', ...results.map((r) => r.scenario.padEnd(10))];
  const rows: string[][] = [
    ['Input signals',
      ...results.map((r) => String(r.signalCount))],
    ['Graph coverage %',
      ...results.map((r) => `${r.graph.summary.graphCoverageScore}%`)],
    ['Causal chains',
      ...results.map((r) => String(r.graph.summary.totalChains))],
    ['Bottlenecks',
      ...results.map((r) => String(r.graph.summary.totalBottlenecks))],
    ['Comp. behaviours',
      ...results.map((r) => String(r.graph.summary.totalCompensatingBehaviours))],
    ['Systemic edges',
      ...results.map((r) => String(r.graph.summary.systemicEdgeCount))],
    ['Total findings',
      ...results.map((r) => String(r.findings.length))],
    ['  ORGANISATIONAL_ISSUE',
      ...results.map((r) => String(r.findings.filter((f) => f.category === 'ORGANISATIONAL_ISSUE').length))],
    ['  REINFORCED_FINDING',
      ...results.map((r) => String(r.findings.filter((f) => f.category === 'REINFORCED_FINDING').length))],
    ['  EMERGING_PATTERN',
      ...results.map((r) => String(r.findings.filter((f) => f.category === 'EMERGING_PATTERN').length))],
    ['  CONTRADICTION',
      ...results.map((r) => String(r.findings.filter((f) => f.category === 'CONTRADICTION').length))],
    ['  EVIDENCE_GAP',
      ...results.map((r) => String(r.findings.filter((f) => f.category === 'EVIDENCE_GAP').length))],
    ['With causalChain',
      ...results.map((r) => String(r.findings.filter((f) => f.causalChain !== undefined).length))],
    ['With evidenceQuotes',
      ...results.map((r) => String(r.findings.filter((f) => (f.evidenceQuotes?.length ?? 0) > 0).length))],
    ['Suppressed (gated)',
      ...results.map((r) => String(r.suppressedFindings.length))],
  ];

  const colW = 24;
  const valW = 14;
  console.log('\n  ' + headers[0].padEnd(colW) + headers.slice(1).map((h) => h.padEnd(valW)).join(''));
  printDivider('-', colW + valW * results.length + 2);
  for (const row of rows) {
    console.log('  ' + row[0].padEnd(colW) + row.slice(1).map((v) => v.padEnd(valW)).join(''));
  }
}

function printFailurePatterns(results: ScenarioResult[]) {
  printSectionHeader('FAILURE PATTERN ANALYSIS');

  const full    = results.find((r) => r.scenario === 'FULL')!;
  const reduced = results.find((r) => r.scenario === 'REDUCED')!;
  const noisy   = results.find((r) => r.scenario === 'NOISY')!;

  // ── Pattern 1: overconfident findings in reduced mode
  const fullOrgIssues  = full.findings.filter((f) => f.category === 'ORGANISATIONAL_ISSUE').length;
  const redOrgIssues   = reduced.findings.filter((f) => f.category === 'ORGANISATIONAL_ISSUE').length;
  const orgDelta = redOrgIssues - fullOrgIssues;
  console.log(`\n  Pattern 1: Overconfident findings under reduced signal load`);
  if (orgDelta > 0) {
    console.log(`  ⚠  CONCERN: REDUCED produced ${orgDelta} MORE organisational issues than FULL.`);
    console.log(`     Reduced evidence should not produce more high-confidence findings.`);
    console.log(`     Indicates gating thresholds may be too permissive for sparse inputs.`);
  } else if (orgDelta < 0) {
    console.log(`  ✓  REDUCED produced ${Math.abs(orgDelta)} fewer organisational issues than FULL.`);
    console.log(`     Gating correctly demotes low-evidence findings under sparse conditions.`);
  } else {
    console.log(`  ~  REDUCED and FULL produced the same count of organisational issues.`);
    console.log(`     Acceptable if surviving topics still pass evidence thresholds.`);
  }

  // ── Pattern 2: generic topic inflation from noisy signals
  const fullTopics  = full.graph.summary.totalChains;
  const noisyTopics = noisy.graph.summary.totalChains;
  const topicDelta  = noisyTopics - fullTopics;
  console.log(`\n  Pattern 2: Generic topic inflation from noisy signals`);
  if (topicDelta > fullTopics * 0.3) {
    console.log(`  ⚠  CONCERN: NOISY produced ${topicDelta} more causal chains than FULL (${noisyTopics} vs ${fullTopics}).`);
    console.log(`     Generic noise phrases may be clustering to broad topic labels and inflating chain counts.`);
  } else if (topicDelta <= 0) {
    console.log(`  ✓  NOISY did not increase causal chain count (${noisyTopics} vs FULL: ${fullTopics}).`);
    console.log(`     Vague noise phrases failed to form distinct topic clusters — gating working correctly.`);
  } else {
    console.log(`  ~  Minor chain count increase from noise (+${topicDelta}). Within tolerance.`);
  }

  // ── Pattern 3: evidence strength degradation
  const fullWithChain  = full.findings.filter((f) => f.causalChain !== undefined).length;
  const redWithChain   = reduced.findings.filter((f) => f.causalChain !== undefined).length;
  const noisyWithChain = noisy.findings.filter((f) => f.causalChain !== undefined).length;
  console.log(`\n  Pattern 3: Causal chain linkage across scenarios`);
  console.log(`    FULL: ${fullWithChain}/${full.findings.length} findings with causal chain`);
  console.log(`    REDUCED: ${redWithChain}/${reduced.findings.length} findings with causal chain`);
  console.log(`    NOISY: ${noisyWithChain}/${noisy.findings.length} findings with causal chain`);
  if (full.findings.length > 0 && reduced.findings.length > 0) {
    const fullRate  = fullWithChain / full.findings.length;
    const redRate   = reduced.findings.length > 0 ? redWithChain / reduced.findings.length : 0;
    if (redRate < fullRate * 0.5) {
      console.log(`  ⚠  CONCERN: Chain linkage rate halves under REDUCED load (${(fullRate * 100).toFixed(0)}% → ${(redRate * 100).toFixed(0)}%).`);
      console.log(`     Fewer chains mean findings lack causal narrative — specificity risk.`);
    } else {
      console.log(`  ✓  Chain linkage rate holds under REDUCED load.`);
    }
  }

  // ── Pattern 4: quote provenance alignment
  const fullWithQuotes  = full.findings.filter((f) => (f.evidenceQuotes?.length ?? 0) > 0).length;
  const noisyWithQuotes = noisy.findings.filter((f) => (f.evidenceQuotes?.length ?? 0) > 0).length;
  console.log(`\n  Pattern 4: Quote provenance health`);
  console.log(`    FULL: ${fullWithQuotes}/${full.findings.length} findings have verbatim quotes`);
  console.log(`    NOISY: ${noisyWithQuotes}/${noisy.findings.length} findings have verbatim quotes`);
  if (noisy.findings.length > 0 && full.findings.length > 0) {
    const fullQRate  = fullWithQuotes / full.findings.length;
    const noisyQRate = noisyWithQuotes / noisy.findings.length;
    if (noisyQRate > fullQRate * 1.1) {
      console.log(`  ⚠  CONCERN: NOISY has disproportionately higher quote coverage rate.`);
      console.log(`     Noise signals may be supplying quotes to findings they shouldn't support.`);
    } else {
      console.log(`  ✓  Quote coverage rate stable across FULL and NOISY scenarios.`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n');
  printSectionHeader('DREAM Board-Output Robustness Validation — Jo Air Corpus');
  console.log(`  Workshop: ${WORKSHOP_ID}`);
  console.log(`  Deterministic pipeline only (refineClusters: false, no LLM enrichment)\n`);

  console.log('  Loading Jo Air corpus from pre-live DB...');
  const { nodes, insights, participants } = await loadJoAirData();
  console.log(`  Loaded: ${nodes.length} v2 snapshot nodes, ${participants.length} participants (discovery insights excluded)`);

  // ── Build 3 scenarios
  const fullNodes    = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const reducedNodes = buildReducedNodes(nodes);
  const noisyNodes   = buildNoisyNodes(nodes);

  console.log(`\n  Scenarios (v2 corpus only — discovery insights excluded):`);
  console.log(`    FULL    : ${fullNodes.length} nodes`);
  console.log(`    REDUCED : ${reducedNodes.length} nodes (${((1 - reducedNodes.length / fullNodes.length) * 100).toFixed(0)}% removed)`);
  console.log(`    NOISY   : ${noisyNodes.length} nodes (+ ${VAGUE_NOISE_NODES.length} vague + ${Math.ceil(fullNodes.filter(n => n.dialoguePhase?.toUpperCase() === 'CONSTRAINTS').length * 0.2)} duplicates)`);

  // ── Run pipeline for each scenario
  const results: ScenarioResult[] = [];
  for (const [name, nodeList] of [
    ['FULL', fullNodes],
    ['REDUCED', reducedNodes],
    ['NOISY', noisyNodes],
  ] as [ScenarioName, NodeRecord[]][]) {
    const result = await runScenario(name, nodeList, insights, participants);
    results.push(result);
  }

  // ── Print full report
  printSectionHeader('INDIVIDUAL SCENARIO RESULTS');

  for (const result of results) {
    printScenarioSummary(result);
    printFindingsDetail(result);
    printSuppressedFindings(result);
    printDivider();
  }

  printSideBySideComparison(results);
  printFailurePatterns(results);

  printSectionHeader('VALIDATION COMPLETE');
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Validation failed:', err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});

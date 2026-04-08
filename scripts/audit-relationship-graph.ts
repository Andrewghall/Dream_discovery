/**
 * Hemisphere Relationship Engine Audit — Stage 2
 *
 * Runs the full relationship graph pipeline against the Jo Air workshop
 * and produces a structured audit showing:
 *   - Node list with layer assignments
 *   - All edges with type, tier, and rationale
 *   - Dominant causal chains
 *   - Bottlenecks
 *   - Compensating behaviours
 *   - Broken chains
 *   - Contradiction paths
 *
 * Uses the same Jo Air data adapters as the evidence engine audit.
 * Stage 3 (UI integration) is NOT done here — this is evidence-only.
 *
 * Usage:
 *   npx tsx scripts/audit-relationship-graph.ts
 */

import { PrismaClient } from '@prisma/client';
import { buildEvidenceClusters, type RawSignal } from '../lib/output/evidence-clustering';
import { scoreAllClusters } from '../lib/output/evidence-scoring';
import { buildRelationshipGraph } from '../lib/output/edge-builder';
import { computeGraphIntelligence } from '../lib/output/graph-intelligence';
import type { RelationshipNode, RelationshipEdge, EdgeTier, NodeLayer } from '../lib/output/relationship-graph';

const prisma = new PrismaClient();
const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

// ── Adapters (same as audit-evidence-engine.ts) ───────────────────────────────

function joAirNodesToSignals(
  nodes: Record<string, unknown>[],
  confirmedParticipantIds: Set<string>,
  nameToIdMap: Map<string, string>,
  participantRoleMap: Map<string, string>,
): RawSignal[] {
  return nodes
    .filter((n: any) => n.rawText && String(n.rawText).trim().length > 3)
    .map((n: any) => {
      const nameKey   = n.speakerId ?? null;
      const speakerId = nameKey ? (nameToIdMap.get(nameKey) ?? null) : null;
      const isConfirmed = speakerId !== null && confirmedParticipantIds.has(speakerId);
      const lens       = n.lens ?? null;
      const primaryType = n.classification?.primaryType ?? null;

      const themeLabels: string[] = [];
      if (lens && primaryType) themeLabels.push(`${lens} ${primaryType}`);
      else if (lens) themeLabels.push(lens);

      const sentimentMap: Record<string, 'positive' | 'neutral' | 'concerned' | 'critical'> = {
        VISION: 'positive', ENABLER: 'positive', CONSTRAINT: 'concerned', ACTION: 'neutral',
      };
      return {
        id: String(n.id ?? `node_${Math.random().toString(36).slice(2)}`),
        rawText: String(n.rawText).trim(),
        speakerId,
        participantRole: speakerId ? (participantRoleMap.get(speakerId) ?? null) : null,
        lens,
        phase: n.dialoguePhase ?? null,
        primaryType,
        sentiment: sentimentMap[primaryType ?? ''] ?? 'neutral',
        themeLabels,
        confidence: n.classification?.confidence ?? null,
        isConfirmedParticipant: isConfirmed,
        sourceStream: 'live' as const,
      };
    });
}

function joAirInsightsToSignals(
  insights: Array<{ id: string; text: string; insightType: string; category: string | null; participantId: string | null }>,
  participantRoleMap: Map<string, string>,
): RawSignal[] {
  return insights
    .filter((i) => i.text && i.text.trim().length > 3)
    .map((i) => {
      const speakerId = i.participantId ?? null;
      const category  = i.category ?? 'General';
      const sentimentMap: Record<string, 'positive' | 'neutral' | 'concerned' | 'critical'> = {
        CONSTRAINT: 'concerned', RISK: 'concerned', CHALLENGE: 'concerned', FRICTION: 'concerned',
        VISION: 'positive', OPPORTUNITY: 'positive', ENABLER: 'positive', ACTUAL_JOB: 'neutral',
      };
      return {
        id:                      i.id,
        rawText:                 i.text.trim(),
        speakerId,
        participantRole:         speakerId ? (participantRoleMap.get(speakerId) ?? null) : null,
        lens:                    category,
        phase:                   'DISCOVERY',
        primaryType:             i.insightType,
        sentiment:               sentimentMap[i.insightType.toUpperCase()] ?? 'neutral',
        themeLabels:             [`${category} ${i.insightType}`],
        confidence:              null,
        isConfirmedParticipant:  speakerId !== null,
        sourceStream:            'discovery' as const,
      };
    });
}

// ── Display helpers ───────────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

const TIER_BADGES: Record<EdgeTier, string> = {
  WEAK: '⬜ WEAK', EMERGING: '🟡 EMRG', REINFORCED: '🟠 REIN', SYSTEMIC: '🔵 SYST',
};

const LAYER_BADGES: Record<NodeLayer, string> = {
  CONSTRAINT: '🔴 CONSTRAINT', ENABLER: '🟢 ENABLER', REIMAGINATION: '🔵 REIMAGINATION',
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== DREAM Hemisphere Relationship Engine — Jo Air Audit ===\n');

  // Load data
  const snap = await (prisma as any).liveWorkshopSnapshot.findFirst({
    where: { workshopId: WORKSHOP_ID },
    select: { payload: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!snap) { console.error('No snapshot'); process.exit(1); }

  const payload  = snap.payload as any;
  const nodes    = Object.values(payload?.nodesById ?? {}) as any[];

  const workshop = await prisma.workshop.findUnique({
    where: { id: WORKSHOP_ID },
    include: { participants: { select: { id: true, name: true, role: true } } },
  });
  if (!workshop) { console.error('Workshop not found'); process.exit(1); }

  const confirmedIds  = new Set(workshop.participants.map((p) => p.id));
  const roleMap       = new Map(workshop.participants.map((p) => [p.id, p.role ?? 'Unknown']));
  const nameToId      = new Map(workshop.participants.filter((p) => p.name).map((p) => [p.name!, p.id]));
  const distinctRoles = new Set(workshop.participants.map((p) => p.role ?? 'Unknown'));

  const insights = await prisma.conversationInsight.findMany({
    where: { session: { workshopId: WORKSHOP_ID } },
    select: { id: true, text: true, insightType: true, category: true, participantId: true },
  });

  const liveSignals      = joAirNodesToSignals(nodes, confirmedIds, nameToId, roleMap);
  const discoverySignals = joAirInsightsToSignals(insights, roleMap);
  const allSignals       = [...liveSignals, ...discoverySignals];

  console.log(`Participants: ${confirmedIds.size} | Roles: ${distinctRoles.size}`);
  console.log(`Signals: ${allSignals.length} (${liveSignals.filter((s) => s.isConfirmedParticipant).length} confirmed live + ${discoverySignals.length} discovery)\n`);

  // Build clusters → score → graph → intelligence
  const clusters = buildEvidenceClusters(allSignals);
  const scored   = scoreAllClusters(clusters, distinctRoles.size);
  const graph    = buildRelationshipGraph(scored, WORKSHOP_ID);
  const intel    = computeGraphIntelligence(graph);

  // ── A. Node list ──────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('A. RELATIONSHIP NODES');
  console.log('══════════════════════════════════════════════════════════════════\n');
  console.log(`${pad('Label', 38)} ${pad('Layer', 20)} Score Tier    Ptcp Freq`);
  console.log('─'.repeat(85));

  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const lo: Record<NodeLayer, number> = { CONSTRAINT: 0, ENABLER: 1, REIMAGINATION: 2 };
    return lo[a.layer] - lo[b.layer] || b.compositeScore - a.compositeScore;
  });

  for (const n of sortedNodes) {
    console.log(
      `${pad(n.displayLabel.slice(0, 37), 38)} ` +
      `${pad(LAYER_BADGES[n.layer], 20)} ` +
      `${pad(String(n.compositeScore), 6)} ` +
      `${pad(n.evidenceTier.slice(0, 6), 9)} ` +
      `${pad(String(n.distinctParticipants), 5)} ` +
      `${n.rawFrequency}`,
    );
  }

  console.log(`\nLayer counts: ${JSON.stringify(graph.layerCounts)}`);

  // ── B. Edge list ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('B. RELATIONSHIP EDGES');
  console.log('══════════════════════════════════════════════════════════════════\n');
  console.log(`${pad('Edge', 70)} ${pad('Tier', 10)} Score Ptcp`);
  console.log('─'.repeat(95));

  const sortedEdges = [...graph.edges].sort((a, b) => b.score - a.score);
  const nodeLabel = (id: string) =>
    graph.nodes.find((n) => n.nodeId === id)?.displayLabel?.slice(0, 28) ?? id.slice(0, 28);

  for (const e of sortedEdges) {
    const from = nodeLabel(e.fromNodeId);
    const to   = nodeLabel(e.toNodeId);
    const rel  = e.relationshipType.padEnd(15);
    const edge = `${from} --[${e.relationshipType}]--> ${to}`;
    console.log(
      `${pad(edge.slice(0, 68), 70)} ` +
      `${pad(TIER_BADGES[e.tier], 10)} ` +
      `${pad(String(e.score), 6)} ` +
      `${e.sharedParticipantIds.length}`,
    );
  }

  if (graph.edges.length === 0) {
    console.log('  (no edges formed — insufficient keyword overlap or participant cross-reference)');
  }

  console.log(`\nEdge type counts: ${JSON.stringify(graph.edgeTypeCounts)}`);

  // ── C. Dominant causal chains ─────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('C. DOMINANT CAUSAL CHAINS');
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (intel.dominantCausalChains.length === 0) {
    console.log('  No complete causal chains found (CONSTRAINT → ENABLER → REIMAGINATION).');
    console.log('  This means either: no enables edges exist, or constraints have no enabler responses.');
  }

  intel.dominantCausalChains.forEach((chain, i) => {
    console.log(`Chain ${i + 1} (strength: ${chain.chainStrength}/100, weakest link: ${chain.weakestLinkTier})`);
    console.log(`  [CONSTRAINT]    ${chain.labels.constraint}`);
    console.log(`       ↓ ${graph.edges.find((e) => e.edgeId === chain.constraintToEnablerEdgeId)?.relationshipType ?? '?'}`);
    console.log(`  [ENABLER]       ${chain.labels.enabler}`);
    console.log(`       ↓ enables`);
    console.log(`  [REIMAGINATION] ${chain.labels.reimagination}\n`);
  });

  // ── D. Bottlenecks ────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('D. BOTTLENECKS (constraint blocking/driving ≥ 3 nodes)');
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (intel.bottlenecks.length === 0) {
    console.log('  No bottlenecks detected — no single constraint dominates multiple paths.');
  }
  for (const b of intel.bottlenecks) {
    const affected = b.affectedNodeIds
      .map((id) => nodeLabel(id))
      .join(', ');
    console.log(`⚠️  "${b.displayLabel}"`);
    console.log(`   Out-degree: ${b.outDegree} | Tier: ${b.evidenceTier} | Score: ${b.compositeScore}`);
    console.log(`   Affects: ${affected}\n`);
  }

  // ── E. Compensating behaviours ────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('E. COMPENSATING BEHAVIOURS (enabler working around a live constraint)');
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (intel.compensatingBehaviours.length === 0) {
    console.log('  No compensating behaviours detected.');
  }
  for (const c of intel.compensatingBehaviours) {
    const risk = c.riskLevel === 'high' ? '🔴' : c.riskLevel === 'medium' ? '🟡' : '🟢';
    console.log(`${risk} RISK: "${c.enablerLabel}"`);
    console.log(`   Compensates for: "${c.constraintLabel}" (${c.constraintRawFrequency} signals, still live: ${c.constraintIsLive})\n`);
  }

  // ── F. Broken chains ──────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('F. BROKEN CHAINS (nodes with no credible causal connection)');
  console.log('══════════════════════════════════════════════════════════════════\n');

  const brokenByType = intel.brokenChains.reduce((acc, b) => {
    acc[b.brokenChainType] = (acc[b.brokenChainType] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`Broken chain types: ${JSON.stringify(brokenByType)}`);

  const highSeverity = intel.brokenChains.filter((b) => b.severity === 'high');
  if (highSeverity.length > 0) {
    console.log(`\nHigh-severity broken chains:`);
    for (const b of highSeverity) {
      console.log(`  🔴 [${b.brokenChainType}] "${b.displayLabel}" (tier: ${b.evidenceTier}, freq: ${b.rawFrequency})`);
    }
  }

  // ── G. Contradiction paths ────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('G. CONTRADICTION PATHS');
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (intel.contradictionPaths.length === 0) {
    console.log('  No contradiction paths detected.');
  }
  for (const c of intel.contradictionPaths) {
    console.log(`⚡ "${c.nodeALabel}" ←contradicts→ "${c.nodeBLabel}"`);
    console.log(`   Layer: ${c.layer} | Shared participants: ${c.sharedParticipantIds.length} | Score: ${c.edgeScore}\n`);
  }

  // ── H. Summary ────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('H. GRAPH SUMMARY STATISTICS');
  console.log('══════════════════════════════════════════════════════════════════\n');
  console.log(`Nodes:             ${graph.nodeCount}  (${JSON.stringify(graph.layerCounts)})`);
  console.log(`Edges:             ${graph.edgeCount}  (${JSON.stringify(graph.edgeTypeCounts)})`);
  console.log(`Coverage:          ${intel.summary.graphCoverageScore}% of nodes connected`);
  console.log(`Causal chains:     ${intel.summary.totalChains}`);
  console.log(`Bottlenecks:       ${intel.summary.totalBottlenecks}`);
  console.log(`Compensating:      ${intel.summary.totalCompensatingBehaviours}`);
  console.log(`Broken chains:     ${intel.summary.totalBrokenChains}`);
  console.log(`Contradictions:    ${intel.summary.totalContradictions}`);
  console.log(`Systemic edges:    ${intel.summary.systemicEdgeCount}`);

  // ── Proposed output integration ───────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('I. PROPOSED OUTPUT INTEGRATION PLAN (Stage 3)');
  console.log('══════════════════════════════════════════════════════════════════\n');
  console.log(`Each major synthesis finding should include:`);
  console.log(`  1. Core issue — the cluster's displayLabel + evidence tier`);
  console.log(`  2. Causal chain — if the cluster is in a CausalChain, show the path`);
  console.log(`  3. Supporting evidence — bestQuotes from the cluster`);
  console.log(`  4. Who is affected — participantRoles from the cluster`);
  console.log(`  5. Why it matters — bottleneck status, compensating behaviour risk`);
  console.log(`  6. Recommended action — derived from the enabler's rationale`);
  console.log(`\nFile to modify: lib/output-intelligence/agents/strategic-impact-agent.ts`);
  console.log(`Add to WorkshopSignals: relationshipGraph: RelationshipGraph`);
  console.log(`Inject causal chains into strategic impact prompts`);
  console.log(`Gate synthesis findings by passesReinforcedGate + causal chain presence`);

  console.log('\n✓ Audit complete\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());

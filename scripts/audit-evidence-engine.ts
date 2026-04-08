/**
 * Evidence Engine Audit — Step 5
 *
 * Runs the deterministic evidence engine against the Jo Air workshop snapshot
 * and produces a side-by-side comparison: old system (raw mention count, confidence=0.8
 * default, no provenance gating) vs new tier assignments.
 *
 * Jo Air snapshot specifics that this script accounts for:
 *  - Live nodes use participant NAME strings as speakerId (not UUIDs).
 *    We resolve names → UUIDs via the participants table.
 *  - Live nodes have no agenticAnalysis themes (seeded demo data).
 *    We use lens + classification.primaryType as synthetic theme labels.
 *  - Discovery insights have category (BUSINESS/TECHNOLOGY/PEOPLE/CUSTOMER)
 *    but no theme labels. We use `category_insightType` as the theme label.
 *
 * Usage:
 *   npx tsx scripts/audit-evidence-engine.ts
 */

import { PrismaClient } from '@prisma/client';
import type { WorkshopParticipant } from '@prisma/client';
import { buildEvidenceClusters, type RawSignal } from '../lib/output/evidence-clustering';
import {
  scoreAllClusters,
  passesOrganisationalGate,
  passesReinforcedGate,
  type EvidenceTier,
} from '../lib/output/evidence-scoring';

const prisma = new PrismaClient();

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw'; // Jo Air demo workshop

// ── Helpers ──────────────────────────────────────────────────────────────────

function tierBadge(tier: EvidenceTier): string {
  const map: Record<EvidenceTier, string> = {
    WEAK: '⬜ WEAK',
    EMERGING: '🟡 EMERGING',
    REINFORCED: '🟠 REINFORCED',
    ESTABLISHED: '🟢 ESTABLISHED',
    ORGANISATIONAL: '🔵 ORGANISATIONAL',
  };
  return map[tier];
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

// ── Jo Air-specific signal adapters ──────────────────────────────────────────

/**
 * Convert snapshot nodes to RawSignals for Jo Air.
 *
 * Jo Air-specific adaptations:
 * 1. speakerId is a name string → resolve via nameToId map
 * 2. No agenticAnalysis themes → use `${lens}_${classification.primaryType}` as theme
 */
function joAirNodesToSignals(
  nodes: Record<string, unknown>[],
  confirmedParticipantIds: Set<string>,
  nameToIdMap: Map<string, string>,   // participant name → UUID
  participantRoleMap: Map<string, string>, // participant UUID → role
): RawSignal[] {
  return nodes
    .filter((n: any) => n.rawText && String(n.rawText).trim().length > 3)
    .map((n: any) => {
      const nameKey = n.speakerId ?? null;
      // Resolve name to UUID
      const speakerId = nameKey ? (nameToIdMap.get(nameKey) ?? null) : null;
      const isConfirmed = speakerId !== null && confirmedParticipantIds.has(speakerId);

      // Synthetic theme: lens + type (since no agenticAnalysis themes in seeded data)
      const lens = n.lens ?? null;
      const primaryType = n.classification?.primaryType ?? null;
      const themeLabels: string[] = [];
      if (lens && primaryType) {
        themeLabels.push(`${lens} — ${primaryType}`);
      } else if (lens) {
        themeLabels.push(lens);
      }

      // Classify sentiment from primaryType
      const sentimentMap: Record<string, 'positive' | 'neutral' | 'concerned' | 'critical'> = {
        VISION: 'positive',
        ENABLER: 'positive',
        CONSTRAINT: 'concerned',
        ACTION: 'neutral',
      };
      const sentiment = sentimentMap[primaryType ?? ''] ?? 'neutral';

      return {
        id: String(n.id ?? `node_${Math.random().toString(36).slice(2)}`),
        rawText: String(n.rawText).trim(),
        speakerId,
        participantRole: speakerId ? (participantRoleMap.get(speakerId) ?? null) : null,
        lens,
        phase: n.dialoguePhase ?? null,
        primaryType,
        sentiment,
        themeLabels,
        confidence: n.classification?.confidence ?? null,
        isConfirmedParticipant: isConfirmed,
        sourceStream: 'live' as const,
      };
    });
}

/**
 * Convert discovery insights to RawSignals for Jo Air.
 *
 * Jo Air-specific adaptation: use `${category} — ${insightType}` as theme label.
 */
function joAirInsightsToSignals(
  insights: Array<{
    id: string;
    text: string;
    insightType: string;
    category: string | null;
    participantId: string | null;
  }>,
  participantRoleMap: Map<string, string>,
): RawSignal[] {
  return insights
    .filter((i) => i.text && i.text.trim().length > 3)
    .map((i) => {
      const speakerId = i.participantId ?? null;
      const category = i.category ?? 'General';

      // Use `category` as lens-level theme and `insightType` as sub-theme
      const themeLabel = `${category} — ${i.insightType}`;

      const sentimentMap: Record<string, 'positive' | 'neutral' | 'concerned' | 'critical'> = {
        CONSTRAINT: 'concerned',
        RISK: 'concerned',
        CHALLENGE: 'concerned',
        FRICTION: 'concerned',
        VISION: 'positive',
        OPPORTUNITY: 'positive',
        ENABLER: 'positive',
        ACTUAL_JOB: 'neutral',
      };
      const sentiment = sentimentMap[i.insightType.toUpperCase()] ?? 'neutral';

      return {
        id: i.id,
        rawText: i.text.trim(),
        speakerId,
        participantRole: speakerId ? (participantRoleMap.get(speakerId) ?? null) : null,
        lens: category,
        phase: 'DISCOVERY',
        primaryType: i.insightType,
        sentiment,
        themeLabels: [themeLabel],
        confidence: null,
        isConfirmedParticipant: speakerId !== null,
        sourceStream: 'discovery' as const,
      };
    });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== DREAM Evidence Engine Audit — Jo Air Workshop ===');
  console.log(`Workshop: ${WORKSHOP_ID}`);
  console.log('(Note: Jo Air is seeded demo data — live nodes use name-based speakerIds');
  console.log(' and have no agenticAnalysis themes. Audit uses lens+type as synthetic themes.)\n');

  // ── 1. Load snapshot ────────────────────────────────────────────────────
  const snap = await (prisma as any).liveWorkshopSnapshot.findFirst({
    where: { workshopId: WORKSHOP_ID },
    select: { payload: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!snap) {
    console.error('No snapshot found for workshop');
    process.exit(1);
  }

  const payload = snap.payload as Record<string, unknown>;
  const nodesById = (payload?.nodesById ?? {}) as Record<string, Record<string, unknown>>;
  const nodes = Object.values(nodesById);

  console.log(`Snapshot nodes: ${nodes.length}`);

  // ── 2. Load participants ───────────────────────────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: WORKSHOP_ID },
    include: {
      participants: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  if (!workshop) {
    console.error('Workshop not found');
    process.exit(1);
  }

  const confirmedIds = new Set(workshop.participants.map((p) => p.id));
  const roleMap = new Map(workshop.participants.map((p) => [p.id, p.role ?? 'Unknown']));
  // Name → UUID map (for Jo Air name-based speakerIds)
  const nameToId = new Map(
    workshop.participants
      .filter((p) => p.name)
      .map((p) => [p.name!, p.id]),
  );

  const distinctRoles = new Set(workshop.participants.map((p) => p.role ?? 'Unknown'));
  console.log(`Confirmed participants: ${confirmedIds.size} across ${distinctRoles.size} roles`);

  // ── 3. Load discovery insights ─────────────────────────────────────────
  const insights = await prisma.conversationInsight.findMany({
    where: { session: { workshopId: WORKSHOP_ID } },
    select: { id: true, text: true, insightType: true, category: true, participantId: true },
  });

  console.log(`Discovery insights: ${insights.length}\n`);

  // ── 4. Build signals ───────────────────────────────────────────────────
  const liveSignals = joAirNodesToSignals(nodes, confirmedIds, nameToId, roleMap);
  const discoverySignals = joAirInsightsToSignals(insights, roleMap);
  const allSignals = [...liveSignals, ...discoverySignals];

  const liveConfirmed = liveSignals.filter((s) => s.isConfirmedParticipant).length;
  const liveUnconfirmed = liveSignals.filter((s) => !s.isConfirmedParticipant).length;
  const discoveryConfirmed = discoverySignals.filter((s) => s.isConfirmedParticipant).length;

  console.log(`Signal breakdown:`);
  console.log(`  Live (confirmed participant):     ${liveConfirmed}`);
  console.log(`  Live (unconfirmed/unresolved):    ${liveUnconfirmed}`);
  console.log(`  Discovery (confirmed):            ${discoveryConfirmed}`);
  console.log(`  Total:                            ${allSignals.length}`);

  // ── 5. OLD SYSTEM simulation ───────────────────────────────────────────
  // Old system: count raw mentions, confidence defaults to 0.8
  // No confirmed-participant gating, no cross-lens, no contradiction check
  const oldThemeCounts = new Map<string, number>();
  for (const sig of allSignals) {
    for (const label of sig.themeLabels) {
      if (label) oldThemeCounts.set(label, (oldThemeCounts.get(label) ?? 0) + 1);
    }
  }
  const oldTop20 = [...oldThemeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // ── 6. NEW SYSTEM ─────────────────────────────────────────────────────
  const totalRoles = distinctRoles.size;
  const clusters = buildEvidenceClusters(allSignals);
  const scored = scoreAllClusters(clusters, totalRoles);

  // ── 7. Print old-system findings ──────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('OLD SYSTEM — Top themes by raw mention count (no provenance gating)');
  console.log('All presented with confidence = 0.80 regardless of actual evidence');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`${pad('Theme', 40)} ${pad('Mentions', 9)} Confidence`);
  console.log('─'.repeat(65));
  for (const [label, count] of oldTop20) {
    console.log(`${pad(label, 40)} ${pad(String(count), 9)} 0.80 (hardcoded default)`);
  }

  // ── 8. Print new-system top findings ──────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('NEW SYSTEM — Evidence clusters with deterministic tier assignments');
  console.log('════════════════════════════════════════════════════════════════\n');

  const header =
    `${pad('Cluster', 36)} ${pad('Score', 6)} ${pad('Tier', 22)} ` +
    `${pad('Freq', 5)} ${pad('Ptcp', 5)} ${pad('Lens', 5)} Flags`;
  console.log(header);
  console.log('─'.repeat(105));

  for (const { cluster, score } of scored.slice(0, 25)) {
    const flags = [
      score.isAnecdotal ? 'ANECDOTAL' : null,
      score.isContested ? 'CONTESTED' : null,
      score.dominantSpeakerRatio >= 0.7 ? `DOM-SPK:${(score.dominantSpeakerRatio * 100).toFixed(0)}%` : null,
      passesOrganisationalGate(score) ? '✅org' : null,
      !passesOrganisationalGate(score) && passesReinforcedGate(score) ? '✅rein' : null,
    ]
      .filter(Boolean)
      .join(' ');

    console.log(
      `${pad(cluster.displayLabel.slice(0, 35), 36)}` +
        `${pad(String(score.compositeScore), 6)} ` +
        `${pad(tierBadge(score.tier), 22)} ` +
        `${pad(String(score.rawFrequency), 5)} ` +
        `${pad(String(score.distinctParticipants), 5)} ` +
        `${pad(String(score.lensCount), 5)} ` +
        `${flags || '—'}`,
    );
  }

  // ── 9. Cross-reference ────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('COMPARISON — Old top themes vs new evidence tier');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`${pad('Old theme', 40)} ${pad('Mentions', 9)} New tier            Flags`);
  console.log('─'.repeat(95));

  for (const [label, count] of oldTop20) {
    const normLabel = label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim()
      .slice(0, 80);

    const match = scored.find(({ cluster }) => cluster.clusterKey === normLabel);
    const tierStr = match ? tierBadge(match.score.tier) : '(no cluster formed)';
    const ptcp = match ? `[${match.score.distinctParticipants}p/${match.score.lensCount}L]` : '';
    const anec = match?.score.isAnecdotal ? ' ⚠️ANEC' : '';
    const cont = match?.score.isContested ? ' ⚠️CONT' : '';
    const org = match && passesOrganisationalGate(match.score) ? ' ✅org' : '';

    console.log(
      `${pad(label, 40)} ${pad(String(count), 9)} ${pad(tierStr, 20)} ${ptcp}${anec}${cont}${org}`,
    );
  }

  // ── 10. Worst overstatements ──────────────────────────────────────────
  const overstatements = oldTop20
    .map(([label, count]) => {
      const normLabel = label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .trim()
        .slice(0, 80);
      const match = scored.find(({ cluster }) => cluster.clusterKey === normLabel);
      return { label, count, match };
    })
    .filter(
      ({ match }) =>
        !match ||
        match.score.tier === 'WEAK' ||
        match.score.tier === 'EMERGING' ||
        match.score.isAnecdotal,
    )
    .sort((a, b) => b.count - a.count);

  if (overstatements.length > 0) {
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('OVERSTATEMENTS — Old findings downgraded to WEAK/EMERGING/ANECDOTAL');
    console.log('════════════════════════════════════════════════════════════════\n');
    for (const { label, count, match } of overstatements) {
      if (!match) {
        console.log(`• "${label}"`);
        console.log(`  Old: ${count} mentions, confidence=0.80`);
        console.log(`  New: No cluster formed (all signals from unconfirmed speakers)`);
        console.log(`  Why: Signals counted without verifying speaker identity against participant list`);
      } else {
        const { score } = match;
        const reasons: string[] = [];
        if (score.distinctParticipants < 3)
          reasons.push(`only ${score.distinctParticipants} confirmed participant(s)`);
        if (score.lensCount < 2) reasons.push(`single-lens (no cross-domain corroboration)`);
        if (score.isAnecdotal) reasons.push(`ANECDOTAL — too few or infrequent participants`);
        if (score.isContested) reasons.push(`CONTESTED — ${score.contradictionCount} contradicting signal(s)`);
        if (score.dominantSpeakerRatio >= 0.7)
          reasons.push(`dominant speaker: ${(score.dominantSpeakerRatio * 100).toFixed(0)}% of signals from one person`);
        console.log(`• "${label}"`);
        console.log(`  Old: ${count} mentions, composite=${score.compositeScore} → confidence=0.80 (blind)`);
        console.log(`  New: ${tierBadge(score.tier)} (composite=${score.compositeScore}, ${score.distinctParticipants} ptcp, ${score.lensCount} lens)`);
        console.log(`  Why downgraded: ${reasons.join('; ')}`);
      }
      console.log('');
    }
  }

  // ── 11. Summary ────────────────────────────────────────────────────────
  const tierCounts: Record<string, number> = {
    WEAK: 0, EMERGING: 0, REINFORCED: 0, ESTABLISHED: 0, ORGANISATIONAL: 0,
  };
  for (const { score } of scored) tierCounts[score.tier]++;

  const orgGateCount = scored.filter(({ score }) => passesOrganisationalGate(score)).length;
  const reinGateCount = scored.filter(({ score }) => passesReinforcedGate(score)).length;
  const anecdotalCount = scored.filter(({ score }) => score.isAnecdotal).length;
  const contestedCount = scored.filter(({ score }) => score.isContested).length;

  console.log('════════════════════════════════════════════════════════════════');
  console.log('SUMMARY STATISTICS');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`Total clusters scored:             ${scored.length}`);
  console.log(`\nTier distribution:`);
  for (const [tier, count] of Object.entries(tierCounts)) {
    if (count > 0) {
      const pct = ((count / scored.length) * 100).toFixed(0);
      console.log(`  ${pad(tier, 20)} ${count}  (${pct}%)`);
    }
  }
  console.log(`\nAnecdotal clusters:                ${anecdotalCount}`);
  console.log(`Contested clusters:                ${contestedCount}`);
  console.log(`\nPass organisational gate:          ${orgGateCount}`);
  console.log(`Pass reinforced gate:              ${reinGateCount}`);
  console.log(`\nOld system: ${oldTop20.length} themes all presented at confidence=0.80`);
  console.log(`New system: ${orgGateCount} clusters reach board-grade (ESTABLISHED/ORGANISATIONAL)`);
  if (oldTop20.length > 0 && oldTop20.length !== orgGateCount) {
    const delta = oldTop20.length - orgGateCount;
    const reduction = ((delta / oldTop20.length) * 100).toFixed(0);
    console.log(`Overstatement reduction: ${delta} fewer findings presented without evidence gates (~${reduction}%)`);
  }

  console.log('\n✓ Audit complete\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

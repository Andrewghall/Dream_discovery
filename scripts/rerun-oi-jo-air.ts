/**
 * Re-run Output Intelligence for the Jo Air workshop.
 *
 * Usage: npx tsx scripts/rerun-oi-jo-air.ts
 *
 * This forces a fresh pipeline run (bypassing the cache) and writes the
 * result directly to the DB, exactly as the SSE route does.
 */

import { prisma } from '@/lib/prisma';
import { aggregateWorkshopSignals } from '@/lib/output-intelligence/signal-aggregator';
import { runIntelligencePipeline as runOutputIntelligencePipeline } from '@/lib/output-intelligence/pipeline';
import type { StoredOutputIntelligence } from '@/lib/output-intelligence/types';
import crypto from 'crypto';

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

async function main() {
  console.log(`\n=== Re-running Output Intelligence for Jo Air (${WORKSHOP_ID}) ===\n`);

  // ── 1. Aggregate signals ──────────────────────────────────────────────────
  console.log('Step 1: Aggregating workshop signals…');
  const signals = await aggregateWorkshopSignals(WORKSHOP_ID);
  console.log(`  Signals: ${signals.discovery.insights?.length ?? 0} insights, graphIntelligence: ${signals.graphIntelligence ? 'present' : 'absent'}`);

  if (signals.graphIntelligence) {
    const gi = signals.graphIntelligence;
    console.log(`  Graph: chains=${gi.dominantCausalChains.length} bottlenecks=${gi.bottlenecks.length} coverage=${gi.summary.graphCoverageScore}%`);
    const quoteNodeCount = Object.keys(gi.clusterQuotes).length;
    const totalQuotes = Object.values(gi.clusterQuotes).reduce((n, qs) => n + qs.length, 0);
    console.log(`  clusterQuotes: ${quoteNodeCount} nodes with quotes, ${totalQuotes} total`);

    // Spot-check: show first bottleneck nodeId vs clusterQuote keys
    if (gi.bottlenecks.length > 0) {
      const b = gi.bottlenecks[0];
      const hasQuotes = !!gi.clusterQuotes[b.nodeId];
      console.log(`  Bottleneck[0] nodeId="${b.nodeId}" → quotes: ${hasQuotes ? gi.clusterQuotes[b.nodeId].length : 0}`);
    }
    console.log(`  clusterQuotes keys (first 5):`, Object.keys(gi.clusterQuotes).slice(0, 5));
  }

  // ── 2. Run pipeline ──────────────────────────────────────────────────────
  console.log('\nStep 2: Running intelligence pipeline (LLM calls in progress)…');
  const result = await runOutputIntelligencePipeline(signals, (engine, event, detail) => {
    const icon = event === 'complete' ? '✓' : event === 'error' ? '✗' : '…';
    console.log(`  [${icon}] ${engine}: ${event}${detail ? ' — ' + detail : ''}`);
  });

  const { intelligence, errors } = result;

  if (Object.keys(errors).length > 0) {
    console.warn('\nEngine errors:', errors);
  }

  // ── 3. Inspect causal intelligence output ────────────────────────────────
  const ci = intelligence.causalIntelligence;
  if (!ci) {
    console.error('\n✗ No causal intelligence generated — stopping.');
    process.exit(1);
  }

  console.log('\nCausal Intelligence summary:');
  console.log(`  dominantCausalChains: ${ci.dominantCausalChains.length}`);
  console.log(`  organisationalIssues: ${ci.organisationalIssues.length}`);
  console.log(`  reinforcedFindings:   ${ci.reinforcedFindings.length}`);
  console.log(`  emergingPatterns:     ${ci.emergingPatterns.length}`);
  console.log(`  contradictions:       ${ci.contradictions.length}`);
  console.log(`  evidenceGaps:         ${ci.evidenceGaps.length}`);
  console.log(`  graphCoverageScore:   ${ci.graphCoverageScore}%`);

  const allFindings = [
    ...ci.organisationalIssues,
    ...ci.reinforcedFindings,
    ...ci.emergingPatterns,
  ];

  console.log('\nFindings (first 5):');
  allFindings.slice(0, 5).forEach((f, i) => {
    const quoteCount = f.evidenceQuotes?.length ?? 0;
    const hasChain = !!f.causalChain;
    const chainStrength = hasChain ? ` chain=${f.causalChain!.chainStrength}` : ' chain=none';
    console.log(`  #${i + 1} [${f.category}] quotes=${quoteCount}${chainStrength}`);
    console.log(`       "${f.issueTitle.slice(0, 70)}"`);
    if (f.evidenceQuotes && f.evidenceQuotes.length > 0) {
      const q = f.evidenceQuotes[0];
      console.log(`       Quote: "${q.text.slice(0, 60)}" via ${q.lens ?? 'unknown lens'}`);
    }
    if (hasChain) {
      console.log(`       Unlocks: ${f.causalChain!.enablerLabel} → ${f.causalChain!.reimaginationLabel}`);
    }
  });

  // ── 4. Persist to DB ─────────────────────────────────────────────────────
  console.log('\nStep 3: Writing to database…');
  const signalsHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ insightCount: signals.discovery.insights?.length ?? 0, ts: Date.now() }))
    .digest('hex')
    .slice(0, 16);

  const stored: StoredOutputIntelligence = {
    version: 1,
    generatedAtMs: Date.now(),
    lensesUsed: intelligence.lensesUsed,
    signalsHash,
    intelligence,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };

  await prisma.workshop.update({
    where: { id: WORKSHOP_ID },
    data: { outputIntelligence: JSON.parse(JSON.stringify(stored)) },
  });

  console.log('  ✓ Saved to workshop.outputIntelligence\n');

  // ── 5. Verify stored data ─────────────────────────────────────────────────
  const fresh = await prisma.workshop.findUnique({
    where: { id: WORKSHOP_ID },
    select: { outputIntelligence: true },
  }) as { outputIntelligence: StoredOutputIntelligence | null };

  const freshCi = fresh?.outputIntelligence?.intelligence?.causalIntelligence;
  if (!freshCi) {
    console.error('✗ Verification failed — causalIntelligence not found in DB after write');
    process.exit(1);
  }

  const freshAll = [
    ...freshCi.organisationalIssues,
    ...freshCi.reinforcedFindings,
    ...freshCi.emergingPatterns,
  ];
  const withQuotes = freshAll.filter(f => (f.evidenceQuotes?.length ?? 0) > 0);
  const withChain = freshAll.filter(f => !!f.causalChain);

  console.log('=== VERIFICATION ===');
  console.log(`  Findings total:     ${freshAll.length}`);
  console.log(`  With evidenceQuotes: ${withQuotes.length}`);
  console.log(`  With causalChain:    ${withChain.length}`);
  console.log(`  graphCoverageScore:  ${freshCi.graphCoverageScore}%`);
  console.log(withQuotes.length > 0 && withChain.length > 0 ? '\n✅ PASS — causalChain and evidenceQuotes populated' : '\n⚠  Some fields still empty — see diagnostics above');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});

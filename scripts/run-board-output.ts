/**
 * Board-Output Generation Runner — Jo Air (Full Corpus, LLM Pipeline)
 *
 * Runs the full board-output generation pipeline against the live Jo Air v2 corpus:
 *   1. aggregateWorkshopSignals — loads snapshot, builds calibrated relationship graph
 *      (refineClusters: true — LLM topic consolidation active)
 *   2. runIntelligencePipeline — 5 LLM agents (discoveryValidation, rootCause,
 *      futureState, roadmap, strategicImpact) + deterministic causalSynthesis
 *   3. Prints a structured board-output quality review covering:
 *      - Top 5 findings with quotes, causal chain, and action
 *      - Causal chain quality
 *      - Quote provenance health
 *      - All findings grouped by category
 *      - Pipeline errors (if any)
 *
 * Usage:
 *   npx tsx scripts/run-board-output.ts
 *
 * Requires: OPENAI_API_KEY set in .env.local
 * Duration: ~60-90 seconds (LLM pipeline)
 */

import { aggregateWorkshopSignals } from '../lib/output-intelligence/signal-aggregator';
import { runIntelligencePipeline } from '../lib/output-intelligence/pipeline';
import type { CausalFinding } from '../lib/output-intelligence/types';

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw'; // Jo Air

// ── Formatting helpers ────────────────────────────────────────────────────────

function hr(char = '─', width = 80): string {
  return char.repeat(width);
}

function printFinding(f: CausalFinding, idx?: number): void {
  const prefix = idx !== undefined ? `${idx + 1}. ` : '   ';
  console.log(`\n${prefix}[${f.category}] ${f.issueTitle}`);
  console.log(`   evidenceNodeId : ${f.evidenceNodeId ?? '(none)'}`);
  console.log(`   evidenceBasis  : ${f.evidenceBasis}`);

  if (f.causalChain) {
    const c = f.causalChain;
    console.log(
      `   causalChain    : ${c.constraintLabel} → ${c.enablerLabel} → ${c.reimaginationLabel}` +
      ` (strength: ${c.chainStrength}, tier: ${c.weakestLinkTier})`,
    );
  }

  if (f.compensatingBehaviourContext) {
    console.log(`   cbContext       : ${f.compensatingBehaviourContext}`);
  }

  console.log(`   whyItMatters   : ${f.whyItMatters}`);
  console.log(`   whoItAffects   : ${f.whoItAffects}`);
  console.log(`   operationalImp : ${f.operationalImplication}`);
  console.log(`   recommendAction: ${f.recommendedAction}`);

  if (f.evidenceQuotes && f.evidenceQuotes.length > 0) {
    console.log(`   quotes (${f.evidenceQuotes.length}):`);
    for (const q of f.evidenceQuotes.slice(0, 3)) {
      const role = q.participantRole ?? 'unknown';
      const lens = q.lens ? ` [${q.lens}]` : '';
      console.log(`     • "${q.text.slice(0, 120)}…" [${role}${lens}]`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n' + hr('═'));
  console.log('  DREAM Board-Output Generation — Jo Air Full Corpus');
  console.log('  refineClusters: true  |  IDF-weighted Jaccard calibration active');
  console.log(hr('═'));

  // ── Step 1: Aggregate signals + build calibrated graph ──────────────────
  console.log('\n  [1/2] Aggregating signals and building relationship graph…');
  const t0 = Date.now();
  const signals = await aggregateWorkshopSignals(WORKSHOP_ID);
  console.log(`        done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const gi = signals.graphIntelligence;
  if (gi) {
    console.log(`\n  Graph summary (calibrated):`);
    console.log(`    Nodes             : ${gi.summary.totalChains + gi.summary.totalBottlenecks + gi.summary.totalBrokenChains} (chains+bottlenecks+broken)`);
    console.log(`    Causal chains     : ${gi.summary.totalChains}`);
    console.log(`    Bottlenecks       : ${gi.summary.totalBottlenecks}`);
    console.log(`    Comp. behaviours  : ${gi.summary.totalCompensatingBehaviours}`);
    console.log(`    Broken chains     : ${gi.summary.totalBrokenChains}`);
    console.log(`    Contradictions    : ${gi.summary.totalContradictions}`);
    console.log(`    Graph coverage    : ${gi.summary.graphCoverageScore}%`);
    console.log(`    Systemic edges    : ${gi.summary.systemicEdgeCount}`);
  } else {
    console.log('  ⚠  No graphIntelligence — snapshot may be missing or empty');
  }

  // ── Step 2: Run intelligence pipeline ──────────────────────────────────
  console.log('\n  [2/2] Running LLM intelligence pipeline (6 agents)…');
  const t1 = Date.now();
  const { intelligence, errors } = await runIntelligencePipeline(
    signals,
    (engine, event, detail) => {
      const icon = event === 'complete' ? '✓' : event === 'error' ? '✗' : '…';
      const msg = detail ? ` — ${detail.slice(0, 80)}` : '';
      console.log(`    [${icon}] ${engine}${msg}`);
    },
  );
  console.log(`        done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

  // ── Pipeline errors ─────────────────────────────────────────────────────
  if (Object.keys(errors).length > 0) {
    console.log('\n  ⚠  Pipeline errors:');
    for (const [engine, msg] of Object.entries(errors)) {
      console.log(`    ${engine}: ${msg}`);
    }
  }

  // ── Causal intelligence ────────────────────────────────────────────────
  const ci = intelligence.causalIntelligence;
  if (!ci) {
    console.log('\n  ⚠  No causal intelligence output — graph may have been empty.');
  } else {
    const allFindings: CausalFinding[] = [
      ...(ci.organisationalIssues ?? []),
      ...(ci.reinforcedFindings ?? []),
      ...(ci.emergingPatterns ?? []),
      ...(ci.contradictions ?? []),
      ...(ci.evidenceGaps ?? []),
    ];

    // ── Dominant causal chains ─────────────────────────────────────────
    console.log('\n' + hr('═'));
    console.log('  CAUSAL CHAINS (structural backbone)');
    console.log(hr('─'));
    if (ci.dominantCausalChains && ci.dominantCausalChains.length > 0) {
      for (const c of ci.dominantCausalChains) {
        console.log(
          `  ${c.constraintLabel} → ${c.enablerLabel} → ${c.reimaginationLabel}` +
          ` (strength: ${c.chainStrength})`,
        );
        if (c.narrative) console.log(`    ${c.narrative.slice(0, 200)}`);
      }
    } else {
      console.log('  (none)');
    }

    // ── Top 5 findings ─────────────────────────────────────────────────
    console.log('\n' + hr('═'));
    console.log('  TOP 5 FINDINGS (ranked by category priority)');
    console.log(hr('─'));
    // Priority: ORGANISATIONAL_ISSUE > REINFORCED_FINDING > CONTRADICTION > EVIDENCE_GAP > EMERGING_PATTERN
    const PRIORITY: Record<string, number> = {
      ORGANISATIONAL_ISSUE: 0,
      REINFORCED_FINDING: 1,
      CONTRADICTION: 2,
      EVIDENCE_GAP: 3,
      EMERGING_PATTERN: 4,
    };
    const sorted = [...allFindings].sort(
      (a, b) => (PRIORITY[a.category] ?? 9) - (PRIORITY[b.category] ?? 9),
    );
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
      printFinding(sorted[i], i);
    }

    // ── All findings grouped ───────────────────────────────────────────
    console.log('\n' + hr('═'));
    console.log('  ALL FINDINGS BY CATEGORY');
    console.log(hr('─'));

    const groups: Array<{ key: keyof typeof ci; label: string }> = [
      { key: 'organisationalIssues', label: 'ORGANISATIONAL_ISSUE' },
      { key: 'reinforcedFindings',   label: 'REINFORCED_FINDING' },
      { key: 'emergingPatterns',     label: 'EMERGING_PATTERN' },
      { key: 'contradictions',       label: 'CONTRADICTION' },
      { key: 'evidenceGaps',         label: 'EVIDENCE_GAP' },
    ];

    for (const { key, label } of groups) {
      const items = ci[key] as CausalFinding[] | undefined ?? [];
      console.log(`\n  ${label} (${items.length})`);
      for (const f of items) {
        console.log(`    • ${f.issueTitle}`);
        if (f.evidenceNodeId) console.log(`      node: ${f.evidenceNodeId}`);
        if (f.causalChain) {
          const c = f.causalChain;
          console.log(`      chain: ${c.constraintLabel} → ${c.enablerLabel} → ${c.reimaginationLabel}`);
        }
      }
    }

    // ── Provenance health ─────────────────────────────────────────────
    console.log('\n' + hr('═'));
    console.log('  PROVENANCE HEALTH');
    console.log(hr('─'));
    const withNodeId  = allFindings.filter(f => Boolean(f.evidenceNodeId)).length;
    const withQuotes  = allFindings.filter(f => (f.evidenceQuotes?.length ?? 0) > 0).length;
    const withChain   = allFindings.filter(f => Boolean(f.causalChain)).length;
    const total       = allFindings.length;
    console.log(`  Total findings        : ${total}`);
    console.log(`  With evidenceNodeId   : ${withNodeId}/${total}`);
    console.log(`  With evidenceQuotes   : ${withQuotes}/${total}`);
    console.log(`  With causalChain      : ${withChain}/${total}`);
    console.log(`  Graph coverage score  : ${ci.graphCoverageScore}%`);

    // ── Action recommendation sample ───────────────────────────────────
    console.log('\n' + hr('═'));
    console.log('  ACTION RECOMMENDATIONS SAMPLE (top 5 findings)');
    console.log(hr('─'));
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
      const f = sorted[i];
      console.log(`\n  [${f.category}] ${f.issueTitle}`);
      console.log(`    Action: ${f.recommendedAction}`);
    }

    // ── Other OI agents ─────────────────────────────────────────────────
    console.log('\n' + hr('═'));
    console.log('  ROOT CAUSE AGENT — top 3 root causes');
    console.log(hr('─'));
    const rc = intelligence.rootCause;
    for (const cause of (rc.rootCauses ?? []).slice(0, 3)) {
      console.log(`  [${cause.rank}] ${cause.cause} (${cause.severity})`);
      console.log(`    Category: ${cause.category}`);
      console.log(`    Evidence: ${cause.evidence?.slice(0, 120) ?? '(none)'}`);
    }
    if (rc.systemicPattern) {
      console.log(`\n  Systemic pattern: ${rc.systemicPattern.slice(0, 200)}`);
    }

    console.log('\n' + hr('═'));
    console.log('  DISCOVERY VALIDATION — hypothesis accuracy');
    console.log(hr('─'));
    const dv = intelligence.discoveryValidation;
    console.log(`  hypothesisAccuracy : ${dv.hypothesisAccuracy ?? '(gated)'}%`);
    console.log(`  confirmedIssues    : ${dv.confirmedIssues?.length ?? 0}`);
    console.log(`  newIssues          : ${dv.newIssues?.length ?? 0}`);
    console.log(`  reducedIssues      : ${dv.reducedIssues?.length ?? 0}`);
    if (dv.summary) console.log(`  summary: ${dv.summary.slice(0, 250)}`);

    console.log('\n' + hr('═'));
    console.log('  STRATEGIC IMPACT');
    console.log(hr('─'));
    const si = intelligence.strategicImpact;
    if (si.automationPotential) {
      console.log(`  automationPotential : ${si.automationPotential.percentage ?? '?'}%`);
    } else {
      console.log('  automationPotential : (gated or null)');
    }
    if (si.businessCaseSummary) {
      console.log(`  businessCase: ${si.businessCaseSummary.slice(0, 250)}`);
    }

    console.log('\n' + hr('═'));
    console.log('  EXECUTION ROADMAP — phase titles');
    console.log(hr('─'));
    for (const phase of intelligence.roadmap.phases ?? []) {
      console.log(`  ${phase.phase} (${phase.timeframe})`);
      console.log(`    Initiatives: ${(phase.initiatives ?? []).slice(0, 3).join(', ')}`);
    }
  }

  console.log('\n' + hr('═'));
  console.log('  GENERATION COMPLETE');
  console.log(hr('═') + '\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Board-output generation failed:', err);
  process.exit(1);
});

/**
 * Agentic Eval Drift Monitor
 *
 * Runs both discovery and sales rubric suites against their gold
 * fixtures, then writes a timestamped JSON snapshot to
 * .agentic-evals/snapshots/.
 *
 * Usage:
 *   npm run eval:drift
 *
 * Environment:
 *   Executed via vite-node so @/ path aliases resolve correctly.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { scoreDiscoverySuite, scoreSalesSuite } from '@/lib/agentic-evals/rubric';
import type { DiscoveryEvalCase, SalesEvalCase } from '@/lib/agentic-evals/types';

const root = process.cwd();
const discoveryFixture: DiscoveryEvalCase[] = JSON.parse(
  fs.readFileSync(path.join(root, '__tests__/fixtures/agentic/discovery-gold-cases.json'), 'utf8'),
);
const salesFixture: SalesEvalCase[] = JSON.parse(
  fs.readFileSync(path.join(root, '__tests__/fixtures/agentic/sales-gold-cases.json'), 'utf8'),
);

const DISCOVERY_THRESHOLD = 80;
const SALES_THRESHOLD = 80;
const SNAPSHOT_DIR = path.resolve(process.cwd(), '.agentic-evals', 'snapshots');

// ---- helpers ----

function gitRef(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function gitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---- scoring ----

const discoveryReport = scoreDiscoverySuite(discoveryFixture, DISCOVERY_THRESHOLD);
const salesReport = scoreSalesSuite(salesFixture, SALES_THRESHOLD);

const allPassed = discoveryReport.pass && salesReport.pass;

// ---- build artifact ----

const now = new Date();
const artifact = {
  timestamp: now.toISOString(),
  gitRef: gitRef(),
  gitBranch: gitBranch(),
  suites: {
    discovery: {
      overallScore: discoveryReport.overallScore,
      threshold: DISCOVERY_THRESHOLD,
      pass: discoveryReport.pass,
      caseCount: discoveryReport.cases.length,
      failedCases: discoveryReport.cases
        .filter((c) => c.score < DISCOVERY_THRESHOLD)
        .map((c) => ({ id: c.id, score: c.score })),
    },
    sales: {
      overallScore: salesReport.overallScore,
      threshold: SALES_THRESHOLD,
      pass: salesReport.pass,
      caseCount: salesReport.cases.length,
      failedCases: salesReport.cases
        .filter((c) => c.score < SALES_THRESHOLD)
        .map((c) => ({ id: c.id, score: c.score })),
    },
  },
  gateResult: allPassed ? 'PASSED' : 'FAILED',
};

// ---- write snapshot ----

ensureDir(SNAPSHOT_DIR);

const slug = now.toISOString().replace(/[:.]/g, '-');
const filename = `eval-${slug}.json`;
const filepath = path.join(SNAPSHOT_DIR, filename);

fs.writeFileSync(filepath, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

// ---- console output ----

console.log('');
console.log('==========================================');
console.log('  AGENTIC EVAL DRIFT MONITOR');
console.log('==========================================');
console.log('');
console.log(`Timestamp:  ${artifact.timestamp}`);
console.log(`Git ref:    ${artifact.gitRef} (${artifact.gitBranch})`);
console.log('');
console.log(`Discovery:  ${discoveryReport.overallScore}/100  (threshold ${DISCOVERY_THRESHOLD})  ${discoveryReport.pass ? 'PASS' : 'FAIL'}`);
console.log(`  Cases:    ${discoveryReport.cases.length}`);
if (artifact.suites.discovery.failedCases.length > 0) {
  console.log('  Below threshold:');
  for (const c of artifact.suites.discovery.failedCases) {
    console.log(`    - ${c.id}: ${c.score}`);
  }
}
console.log('');
console.log(`Sales:      ${salesReport.overallScore}/100  (threshold ${SALES_THRESHOLD})  ${salesReport.pass ? 'PASS' : 'FAIL'}`);
console.log(`  Cases:    ${salesReport.cases.length}`);
if (artifact.suites.sales.failedCases.length > 0) {
  console.log('  Below threshold:');
  for (const c of artifact.suites.sales.failedCases) {
    console.log(`    - ${c.id}: ${c.score}`);
  }
}
console.log('');
console.log(`Gate:       ${artifact.gateResult}`);
console.log(`Snapshot:   ${filepath}`);
console.log('');

process.exit(allPassed ? 0 : 1);

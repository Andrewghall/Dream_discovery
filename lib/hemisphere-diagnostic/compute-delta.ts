/**
 * Hemisphere Diagnostic Delta — Before/After Comparison
 *
 * Pure functions that compare two HemisphereDiagnostic objects
 * (Discovery baseline vs Live Session) and produce a DiagnosticDelta
 * describing the organisational shift.
 */

import type {
  HemisphereDiagnostic,
  DiagnosticDelta,
  DomainDelta,
} from '@/lib/types/hemisphere-diagnostic';

/** Stability threshold: deltas smaller than this are considered stable */
const STABILITY_THRESHOLD = 3;

/**
 * Compute the delta between a "before" (Discovery baseline) and "after" (Live Session) diagnostic.
 *
 * @param before — Diagnostic from Discovery session data
 * @param after  — Diagnostic from Live Session snapshot
 * @returns DiagnosticDelta describing the movement
 */
export function computeDiagnosticDelta(
  before: HemisphereDiagnostic,
  after: HemisphereDiagnostic,
): DiagnosticDelta {
  const beforeDomainMap = new Map(
    before.sentimentIndex.domains.map((d) => [d.domain, d]),
  );
  const afterDomainMap = new Map(
    after.sentimentIndex.domains.map((d) => [d.domain, d]),
  );

  // All unique domains across both diagnostics
  const allDomains = new Set([
    ...beforeDomainMap.keys(),
    ...afterDomainMap.keys(),
  ]);

  const domainDeltas: DomainDelta[] = [];
  const newDomainsAppeared: string[] = [];

  for (const domain of allDomains) {
    const bDomain = beforeDomainMap.get(domain);
    const aDomain = afterDomainMap.get(domain);

    if (!bDomain && aDomain) {
      // New domain only in "after"
      newDomainsAppeared.push(domain);
      domainDeltas.push({
        domain,
        creativeDelta: aDomain.creativeDensity,
        constraintDelta: aDomain.constraintDensity,
        direction: aDomain.creativeDensity > aDomain.constraintDensity
          ? 'more-creative'
          : 'more-constrained',
      });
      continue;
    }

    const creativeBefore = bDomain?.creativeDensity ?? 0;
    const constraintBefore = bDomain?.constraintDensity ?? 0;
    const creativeAfter = aDomain?.creativeDensity ?? 0;
    const constraintAfter = aDomain?.constraintDensity ?? 0;

    const creativeDelta = round2(creativeAfter - creativeBefore);
    const constraintDelta = round2(constraintAfter - constraintBefore);

    const direction: DomainDelta['direction'] =
      Math.abs(creativeDelta) < STABILITY_THRESHOLD && Math.abs(constraintDelta) < STABILITY_THRESHOLD
        ? 'stable'
        : creativeDelta > constraintDelta
          ? 'more-creative'
          : 'more-constrained';

    domainDeltas.push({ domain, creativeDelta, constraintDelta, direction });
  }

  // Sort by absolute delta magnitude (biggest shifts first)
  domainDeltas.sort(
    (a, b) =>
      Math.abs(b.creativeDelta) + Math.abs(b.constraintDelta) -
      (Math.abs(a.creativeDelta) + Math.abs(a.constraintDelta)),
  );

  const overallCreativeDelta = round2(
    after.sentimentIndex.overallCreative - before.sentimentIndex.overallCreative,
  );
  const overallConstraintDelta = round2(
    after.sentimentIndex.overallConstraint - before.sentimentIndex.overallConstraint,
  );

  const balanceShift = describeBalanceShift(before, after);
  const biasChange = describeBiasChange(before, after);

  return {
    domainDeltas,
    newDomainsAppeared,
    balanceShift,
    biasChange,
    overallCreativeDelta,
    overallConstraintDelta,
  };
}

// ── Description Builders ─────────────────────────────────────

function describeBalanceShift(
  before: HemisphereDiagnostic,
  after: HemisphereDiagnostic,
): string {
  const bLabel = before.sentimentIndex.balanceLabel;
  const aLabel = after.sentimentIndex.balanceLabel;

  if (bLabel === aLabel) {
    return `Organisational balance remained ${formatLabel(bLabel)} throughout the session.`;
  }

  return `Moved from ${formatLabel(bLabel)} to ${formatLabel(aLabel)} during the live session.`;
}

function describeBiasChange(
  before: HemisphereDiagnostic,
  after: HemisphereDiagnostic,
): string {
  const bGini = before.biasDetection.giniCoefficient;
  const aGini = after.biasDetection.giniCoefficient;
  const giniDelta = round2(aGini - bGini);

  const bLevel = before.biasDetection.overallBiasLevel;
  const aLevel = after.biasDetection.overallBiasLevel;

  if (bLevel === aLevel && Math.abs(giniDelta) < 0.05) {
    return `Contribution balance remained ${bLevel} (Gini: ${aGini}).`;
  }

  const direction = giniDelta > 0 ? 'increased' : 'decreased';
  const improvement = giniDelta < 0 ? 'improving' : 'worsening';

  if (bLevel !== aLevel) {
    return `Bias ${direction} from ${bLevel} to ${aLevel} (Gini: ${bGini} → ${aGini}), ${improvement} voice balance.`;
  }

  return `Contribution Gini ${direction} by ${Math.abs(giniDelta).toFixed(2)} (${bGini} → ${aGini}), ${improvement} voice balance.`;
}

// ── Helpers ──────────────────────────────────────────────────

function formatLabel(label: string): string {
  return label.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

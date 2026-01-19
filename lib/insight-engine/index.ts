export type DimensionKey = 'People' | 'Organisation' | 'Customer' | 'Technology' | 'Regulation';

export type DimensionMedians = {
  key: DimensionKey;
  current_median: number;
  target_median: number;
  projected_median: number;
  n?: number;
};

export type InsightFeatures = {
  byDimension: Record<DimensionKey, {
    current: number;
    target: number;
    projected: number;
    gap_to_target: number;
    stagnation: number;
    optimism_gap: number;
  }>;
  current_range: number;
  target_range: number;
  projected_range: number;
  lowest_current: { key: DimensionKey; value: number };
  highest_gap: { key: DimensionKey; value: number };
  strongest_current: { key: DimensionKey; value: number };
  dependency_flags: {
    customer_requires_org_enablement: boolean;
    customer_requires_tech_enablement: boolean;
    org_requires_tech_enablement: boolean;
  };
  bottlenecks: Array<{ key: DimensionKey; reason: string }>
};

export type RuleBullet = {
  id: string;
  text: string;
  drivers: string[];
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function sortedKeysBy<T extends DimensionKey>(
  by: Record<DimensionKey, T>,
  score: (k: DimensionKey) => number,
  dir: 'asc' | 'desc'
): DimensionKey[] {
  const keys = Object.keys(by) as DimensionKey[];
  return keys.sort((a, b) => {
    const da = score(a);
    const db = score(b);
    if (da === db) return a.localeCompare(b);
    return dir === 'asc' ? da - db : db - da;
  });
}

function range(vals: number[]): number {
  if (!vals.length) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

export function computeInsightFeatures(input: DimensionMedians[]): InsightFeatures {
  const dims: DimensionKey[] = ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'];

  const byDimension = {} as InsightFeatures['byDimension'];
  for (const d of dims) {
    const row = input.find((x) => x.key === d);
    const current = clampScore(row?.current_median ?? 0);
    const target = clampScore(row?.target_median ?? 0);
    const projected = clampScore(row?.projected_median ?? 0);
    byDimension[d] = {
      current,
      target,
      projected,
      gap_to_target: round1(target - current),
      stagnation: round1(projected - current),
      optimism_gap: round1(target - projected),
    };
  }

  const currentVals = dims.map((d) => byDimension[d].current);
  const targetVals = dims.map((d) => byDimension[d].target);
  const projectedVals = dims.map((d) => byDimension[d].projected);

  const current_range = round1(range(currentVals));
  const target_range = round1(range(targetVals));
  const projected_range = round1(range(projectedVals));

  const lowestKey = dims.reduce((acc, d) => (byDimension[d].current < byDimension[acc].current ? d : acc), dims[0]);
  const strongestKey = dims.reduce((acc, d) => (byDimension[d].current > byDimension[acc].current ? d : acc), dims[0]);
  const highestGapKey = dims.reduce((acc, d) => (byDimension[d].gap_to_target > byDimension[acc].gap_to_target ? d : acc), dims[0]);

  const customerTarget = byDimension.Customer.target;
  const orgCurrent = byDimension.Organisation.current;
  const techCurrent = byDimension.Technology.current;
  const orgTarget = byDimension.Organisation.target;

  const dependency_flags = {
    customer_requires_org_enablement: round1(customerTarget - orgCurrent) >= 1.5 && customerTarget >= 7.5,
    customer_requires_tech_enablement: round1(customerTarget - techCurrent) >= 1.5 && customerTarget >= 7.5,
    org_requires_tech_enablement: round1(orgTarget - techCurrent) >= 1.5 && orgTarget >= 7.5,
  };

  const bottlenecks: InsightFeatures['bottlenecks'] = [];
  const avgCurrent = currentVals.reduce((a, b) => a + b, 0) / Math.max(1, currentVals.length);
  for (const d of dims) {
    const c = byDimension[d].current;
    if (c <= avgCurrent - 1.2) {
      bottlenecks.push({ key: d, reason: `Current median is materially below the overall average (avg ${round1(avgCurrent)}).` });
    }
  }

  return {
    byDimension,
    current_range,
    target_range,
    projected_range,
    lowest_current: { key: lowestKey, value: byDimension[lowestKey].current },
    strongest_current: { key: strongestKey, value: byDimension[strongestKey].current },
    highest_gap: { key: highestGapKey, value: byDimension[highestGapKey].gap_to_target },
    dependency_flags,
    bottlenecks,
  };
}

export function buildRuleBackedBullets(params: {
  focus: 'MASTER' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5';
  dimensions: DimensionMedians[];
  features: InsightFeatures;
}): RuleBullet[] {
  const f = params.features;
  const d = f.byDimension;

  const bullets: RuleBullet[] = [];

  const hi = f.highest_gap.key;
  bullets.push({
    id: 'largest_gap',
    drivers: [`gap_to_target:${hi}`],
    text: `Largest ambition gap is ${hi}: target ${d[hi].target} vs current ${d[hi].current} (gap ${d[hi].gap_to_target}).`,
  });

  if (f.dependency_flags.customer_requires_org_enablement || f.dependency_flags.customer_requires_tech_enablement) {
    const parts: string[] = [];
    const drivers: string[] = [];
    if (f.dependency_flags.customer_requires_org_enablement) {
      parts.push(`Organisation current ${d.Organisation.current} is ${round1(d.Customer.target - d.Organisation.current)} behind Customer target ${d.Customer.target}`);
      drivers.push('dependency:customer_requires_org_enablement');
    }
    if (f.dependency_flags.customer_requires_tech_enablement) {
      parts.push(`Technology current ${d.Technology.current} is ${round1(d.Customer.target - d.Technology.current)} behind Customer target ${d.Customer.target}`);
      drivers.push('dependency:customer_requires_tech_enablement');
    }
    bullets.push({
      id: 'customer_dependency',
      drivers,
      text: `Customer ambition (${d.Customer.target}) implies enablement needs elsewhere: ${parts.join('; ')}.`,
    });
  }

  const low = f.lowest_current.key;
  if (f.current_range >= 1.4) {
    bullets.push({
      id: 'imbalance',
      drivers: ['imbalance:current_range', `bottleneck:${low}`],
      text: `Current capability is uneven (range ${f.current_range}). ${low} is the weakest current median at ${d[low].current} and is likely the primary constraint.`,
    });
  }

  const stagnators = (Object.keys(d) as DimensionKey[])
    .map((k) => ({ k, v: d[k].stagnation }))
    .sort((a, b) => (a.v === b.v ? a.k.localeCompare(b.k) : a.v - b.v));
  const worst = stagnators[0];
  if (worst && worst.v <= 0.3) {
    bullets.push({
      id: 'stagnation',
      drivers: [`stagnation:${worst.k}`],
      text: `Projected trajectory indicates limited improvement without intervention in ${worst.k}: projected ${d[worst.k].projected} vs current ${d[worst.k].current} (Δ ${d[worst.k].stagnation}).`,
    });
  }

  const planToExecuteGap = (Object.keys(d) as DimensionKey[])
    .map((k) => ({ k, v: d[k].optimism_gap }))
    .sort((a, b) => (a.v === b.v ? a.k.localeCompare(b.k) : b.v - a.v))[0];
  if (planToExecuteGap && planToExecuteGap.v >= 1.2) {
    bullets.push({
      id: 'plan_execute_gap',
      drivers: [`optimism_gap:${planToExecuteGap.k}`],
      text: `For ${planToExecuteGap.k}, target exceeds projected by ${d[planToExecuteGap.k].optimism_gap} (target ${d[planToExecuteGap.k].target} vs projected ${d[planToExecuteGap.k].projected}), suggesting a plan-to-delivery gap if unchanged.`,
    });
  }

  // Deterministic de-dup + cap to 6
  const seen = new Set<string>();
  const out: RuleBullet[] = [];
  for (const b of bullets) {
    const key = b.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
    if (out.length >= 6) break;
  }

  // Ensure minimum 4 by adding the strongest dimension as a stabilizer
  if (out.length < 4) {
    const strong = f.strongest_current.key;
    out.push({
      id: 'strength_anchor',
      drivers: [`strength:${strong}`],
      text: `Strongest current position is ${strong} at ${d[strong].current}; this can be leveraged as an enabler while addressing gaps elsewhere.`,
    });
  }

  return out.slice(0, 6);
}

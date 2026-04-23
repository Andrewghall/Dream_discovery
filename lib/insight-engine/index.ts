export type DimensionKey = string;

export type Focus = 'MASTER' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6';

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
    projected_delta: number;
    stagnation: boolean;
    target_vs_projected_gap: number;
  }>;
  current_range: number;
  target_range: number;
  projected_range: number;
  lowest_current: { key: DimensionKey; value: number };
  highest_gap: { key: DimensionKey; value: number };
  strongest_current: { key: DimensionKey; value: number };
  chain: {
    weakest_enabler_for_commercial: { key: string; value: number };
    weakest_enabler_for_technology: { key: string; value: number };
    weakest_enabler_for_operations: { key: string; value: number };
  };
  dependency_gaps: Array<{ from: DimensionKey; to: DimensionKey; delta: number }>;
};

export type RuleBullet = {
  id: string;
  text: string;
  drivers: string[];
};

export type DependencySynthesis = {
  primary: string[];
  supporting: string[];
  evidence: string[];
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function range(vals: number[]): number {
  if (!vals.length) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

export function computeInsightFeatures(input: DimensionMedians[]): InsightFeatures {
  const dims = input.map((x) => x.key);

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
      projected_delta: round1(projected - current),
      stagnation: round1(projected - current) <= 0.3,
      target_vs_projected_gap: round1(target - projected),
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

  const minAmong = (exclude: string): { key: string; value: number } => {
    const candidates = dims.filter((d) => d !== exclude).map((k) => ({ key: k, value: byDimension[k].current }));
    if (!candidates.length) return { key: dims[0] ?? '', value: 0 };
    return candidates.reduce((acc, x) => (x.value < acc.value ? x : acc), candidates[0]);
  };

  const weakest_enabler_for_commercial = minAmong('Commercial');
  const weakest_enabler_for_technology = minAmong('Technology');
  const weakest_enabler_for_operations = minAmong('Operations');

  const dependency_gaps: InsightFeatures['dependency_gaps'] = [];
  const depThreshold = 1.5;
  const addGap = (from: string, to: string, delta: number) => {
    if (round1(delta) >= depThreshold) dependency_gaps.push({ from, to, delta: round1(delta) });
  };

  // Pairwise dependency gaps across all dims
  for (const fromDim of dims) {
    for (const toDim of dims) {
      if (fromDim !== toDim) {
        addGap(fromDim, toDim, byDimension[fromDim].target - byDimension[toDim].current);
      }
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
    chain: {
      weakest_enabler_for_commercial,
      weakest_enabler_for_technology,
      weakest_enabler_for_operations,
    },
    dependency_gaps,
  };
}

export function buildRuleBackedBullets(params: {
  focus: Focus;
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

  const topDep = [...f.dependency_gaps].sort((a, b) => (b.delta === a.delta ? `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`) : b.delta - a.delta))[0];
  if (topDep) {
    bullets.push({
      id: 'dependency_gap',
      drivers: [`dependency_gap:${topDep.from}->${topDep.to}`],
      text: `To achieve ${topDep.from} ambition (${d[topDep.from].target}), ${topDep.to} enablement must rise from current ${d[topDep.to].current} (gap ${topDep.delta}).`,
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

  const stagnators = Object.keys(d)
    .map((k) => ({ k, v: d[k].projected_delta }))
    .sort((a, b) => (a.v === b.v ? a.k.localeCompare(b.k) : a.v - b.v));
  const worst = stagnators[0];
  if (worst && worst.v <= 0.3) {
    bullets.push({
      id: 'stagnation',
      drivers: [`stagnation:${worst.k}`],
      text: `Projected trajectory indicates limited improvement without intervention in ${worst.k}: projected ${d[worst.k].projected} vs current ${d[worst.k].current} (Δ ${d[worst.k].projected_delta}).`,
    });
  }

  const planToExecuteGap = Object.keys(d)
    .map((k) => ({ k, v: d[k].target_vs_projected_gap }))
    .sort((a, b) => (a.v === b.v ? a.k.localeCompare(b.k) : b.v - a.v))[0];
  if (planToExecuteGap && planToExecuteGap.v >= 1.2) {
    bullets.push({
      id: 'plan_execute_gap',
      drivers: [`optimism_gap:${planToExecuteGap.k}`],
      text: `For ${planToExecuteGap.k}, target exceeds projected by ${d[planToExecuteGap.k].target_vs_projected_gap} (target ${d[planToExecuteGap.k].target} vs projected ${d[planToExecuteGap.k].projected}), suggesting a plan-to-delivery gap if unchanged.`,
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

function primaryDimensionForFocus(focus: Focus): string {
  if (focus === 'D1') return 'People';
  if (focus === 'D2') return 'Operations';
  if (focus === 'D3') return 'Technology';
  if (focus === 'D4') return 'Commercial';
  if (focus === 'D5') return 'Risk/Compliance';
  if (focus === 'D6') return 'Partners';
  return 'Commercial';
}

function joinList(xs: string[]): string {
  const ys = xs.filter(Boolean);
  if (ys.length <= 1) return ys[0] || '';
  if (ys.length === 2) return `${ys[0]} and ${ys[1]}`;
  return `${ys.slice(0, ys.length - 1).join(', ')}, and ${ys[ys.length - 1]}`;
}

export function buildDependencySynthesis(params: { focus: Focus; dimensions: DimensionMedians[] }): DependencySynthesis {
  const features = computeInsightFeatures(params.dimensions);
  const d = features.byDimension;

  const primary: string[] = [];
  const supporting: string[] = [];
  const evidence: string[] = [];

  const focusDim = primaryDimensionForFocus(params.focus);

  const ENABLERS_FOR_OUTCOME = Object.fromEntries(
    Object.keys(d).map((outcomeKey) => [
      outcomeKey,
      Object.keys(d).filter((candidateKey) => candidateKey !== outcomeKey),
    ]),
  ) as Record<string, string[]>;

  const outcomeIsMaster = params.focus === 'MASTER';
  const outcome: DimensionKey = outcomeIsMaster ? 'Commercial' : focusDim;
  const outcomeTarget = d[outcome].target;

  const enablers = outcomeIsMaster
    ? Object.keys(d).filter((k) => k !== outcome)
    : (ENABLERS_FOR_OUTCOME[outcome] || Object.keys(d).filter((k) => k !== outcome));

  const gaps = enablers
    .map((k) => ({ k, gap: round1(outcomeTarget - d[k].current) }))
    .sort((a, b) => (b.gap === a.gap ? a.k.localeCompare(b.k) : b.gap - a.gap));

  const materialThreshold = 1.5;
  const chosenEnablers = (gaps.filter((x) => x.gap >= materialThreshold).length ? gaps.filter((x) => x.gap >= materialThreshold) : gaps)
    .slice(0, 2)
    .map((x) => x.k);

  const weakestEnabler = gaps.length ? gaps[gaps.length - 1] : null;

  if (outcomeIsMaster) {
    primary.push('To achieve the stated ambition, delivery requires balanced enablement across the canonical lenses to realise commercial outcomes.');
    primary.push(`The current delivery chain is only as strong as its weakest enabler; ${features.chain.weakest_enabler_for_commercial.key} is most likely to constrain execution.`);
  } else {
    const topText = joinList(chosenEnablers);

    if (outcome === 'Commercial') {
      primary.push(`To achieve the stated Commercial ambition, it requires enablement in ${topText} because commercial outcomes depend on upstream capability, delivery flow, and market execution.`);
    } else if (outcome === 'Technology') {
      primary.push(`To achieve the stated Technology ambition, it requires enablement in ${topText} so the organisation can adopt, govern and sustain change.`);
    } else if (outcome === 'Operations') {
      primary.push(`To achieve the stated Operations ambition, it requires enablement in ${topText} so decision-making and delivery can operate at the intended level.`);
    } else if (outcome === 'People') {
      primary.push(`To achieve the stated People ambition, it requires enablement in ${topText} because People capability depends on organisational design and tools.`);
    } else if (outcome === 'Risk/Compliance') {
      primary.push(`To achieve the stated Risk/Compliance ambition, it requires enablement in ${topText} because controls are embedded through operating model, technology, and governance.`);
    } else if (outcome === 'Partners') {
      primary.push(`To achieve the stated Partners ambition, it requires enablement in ${topText} because external dependencies are managed through strong internal capability and governance.`);
    } else {
      primary.push(`To achieve the stated ${outcome} ambition, it requires enablement in ${topText}.`);
    }

    if (chosenEnablers.length) {
      primary.push(`Without commensurate enablement in ${chosenEnablers[0]}, the ${outcome} ambition is likely to remain constrained.`);
    }
  }

  const stagnators = Object.keys(d)
    .filter((k) => d[k].stagnation)
    .sort((a, b) => (d[a].projected_delta === d[b].projected_delta ? a.localeCompare(b) : d[a].projected_delta - d[b].projected_delta));
  if (stagnators.length) {
    supporting.push('Projected improvement indicates limited natural uplift without intervention.');
  }

  if (features.current_range >= 1.4) {
    supporting.push('Uneven capability increases execution risk across the dependency chain.');
  }

  const planGap = Object.keys(d)
    .map((k) => ({ k, v: d[k].target_vs_projected_gap }))
    .sort((a, b) => (b.v === a.v ? a.k.localeCompare(b.k) : b.v - a.v))[0];
  if (planGap && planGap.v >= 1.2) {
    supporting.push('Target ambition exceeds the projected trajectory without intervention, increasing delivery risk.');
  }

  if (!outcomeIsMaster && weakestEnabler && chosenEnablers.length) {
    supporting.push(`${chosenEnablers[0]} is materially behind the level implied by the selected outcome ambition.`);
  }

  const focusEvidencePairs: Array<{ a: string; aLabel: 'target' | 'projected' | 'current'; b: string; bLabel: 'current' | 'target' | 'projected' }> = [];
  if (outcomeIsMaster) {
    focusEvidencePairs.push({ a: 'Commercial', aLabel: 'target', b: 'Operations', bLabel: 'current' });
    focusEvidencePairs.push({ a: 'Commercial', aLabel: 'target', b: 'Technology', bLabel: 'current' });
  } else {
    for (const en of chosenEnablers.slice(0, 3)) {
      focusEvidencePairs.push({ a: outcome, aLabel: 'target', b: en, bLabel: 'current' });
    }
  }

  for (const p of focusEvidencePairs) {
    const av = d[p.a][p.aLabel];
    const bv = d[p.b][p.bLabel];
    evidence.push(`${p.a} ${p.aLabel} ${av} vs ${p.b} ${p.bLabel} ${bv}`);
  }

  const worstDelta = Object.keys(d)
    .map((k) => ({ k, v: d[k].projected_delta }))
    .sort((a, b) => (a.v === b.v ? a.k.localeCompare(b.k) : a.v - b.v))[0];
  if (worstDelta) evidence.push(`Projected improvement delta ${worstDelta.v} in ${worstDelta.k}`);
  evidence.push(`${outcome} target ${d[outcome].target} vs ${outcome} current ${d[outcome].current}`);
  evidence.push(`Current range ${features.current_range}`);

  const deDup = (xs: string[]) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const x of xs) {
      const t = (x || '').trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  };

  const p = deDup(primary).slice(0, 2);
  const s = deDup(supporting).slice(0, 3);
  const e = deDup(evidence).slice(0, 5);

  return {
    primary: p.length ? p : [`To achieve the stated ambition, the enabling capabilities in the delivery chain must strengthen from current levels.`],
    supporting: s.length ? s : [`Projected improvement indicates limited natural uplift without intervention.`],
    evidence: e,
  };
}

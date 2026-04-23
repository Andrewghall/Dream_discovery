import { describe, expect, it } from 'vitest';

import {
  buildOperationsGoldReferenceBlock,
  getOperationsGoldDataset,
  getOperationsGoldDatasetRules,
  getOperationsGoldSignals,
  isExactOperationsGoldQuestion,
} from '@/lib/gold-data/operations-reference';

describe('operations gold reference', () => {
  it('loads the Operations gold dataset', () => {
    const dataset = getOperationsGoldDataset();

    expect(dataset.workshop_type).toBe('OPERATIONS');
    expect(dataset.signals).toContain('delivery_constraint');
    expect(dataset.rules.must_anchor_to).toContain('post_sale_metrics');
  });

  it('builds an Operations gold reference block for prompt injection', () => {
    const block = buildOperationsGoldReferenceBlock();

    expect(block).toContain('GOLD REFERENCE DATASET: OPERATIONS');
    expect(block).toContain('Required dataset inputs: won_deals_dataset, delivered_outcomes, delivery_performance_metrics');
    expect(block).toContain('sale_vs_delivery_gap_view');
    expect(block).toContain('operations_anti_icp');
  });

  it('exposes Operations gold signals and dataset rules for validator calibration', () => {
    const signals = getOperationsGoldSignals();
    const rules = getOperationsGoldDatasetRules();

    expect(signals).toContain('handoff_failure');
    expect(signals).toContain('operational_readiness_gap');
    expect(rules.require_evidence_reference).toBe(true);
    expect(rules.must_use_at_least).toContain('delivery_performance_metrics');
  });

  it('detects verbatim reuse of Operations gold example wording', () => {
    expect(
      isExactOperationsGoldQuestion('Where does the transition from sale to delivery break down most often?'),
    ).toBe(true);

    expect(
      isExactOperationsGoldQuestion('Where does the transition from sale to execution break down most often?'),
    ).toBe(false);
  });
});

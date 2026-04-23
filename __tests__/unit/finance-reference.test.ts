import { describe, expect, it } from 'vitest';

import {
  buildFinanceGoldReferenceBlock,
  getFinanceGoldDataset,
  getFinanceGoldSignals,
  isExactFinanceGoldQuestion,
} from '@/lib/gold-data/finance-reference';

describe('finance gold reference', () => {
  it('loads the finance gold dataset', () => {
    const dataset = getFinanceGoldDataset();

    expect(dataset.workshop_type).toBe('FINANCE');
    expect(dataset.signals).toContain('profitable_growth');
    expect(dataset.rules.must_anchor_to).toContain('won_deals');
  });

  it('builds a finance gold reference block for prompt injection', () => {
    const block = buildFinanceGoldReferenceBlock();

    expect(block).toContain('GOLD REFERENCE DATASET: FINANCE');
    expect(block).toContain('Generation sequence: workshop -> context -> gtm_intent -> signal -> question');
    expect(block).toContain('profitable_growth');
    expect(block).toContain('finance_anti_icp');
  });

  it('exposes finance gold signals for validator calibration', () => {
    const signals = getFinanceGoldSignals();

    expect(signals).toContain('pricing_power');
    expect(signals).toContain('forecast_reliability');
  });

  it('detects verbatim reuse of finance gold example wording', () => {
    expect(
      isExactFinanceGoldQuestion('Which deals create cash flow strain despite appearing profitable?'),
    ).toBe(true);

    expect(
      isExactFinanceGoldQuestion('Which deals create cash pressure despite appearing profitable?'),
    ).toBe(false);
  });
});

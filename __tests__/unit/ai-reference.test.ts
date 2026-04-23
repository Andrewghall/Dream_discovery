import { describe, expect, it } from 'vitest';

import {
  buildAiGoldReferenceBlock,
  getAiGoldDataset,
  getAiGoldSignals,
  isExactAiGoldQuestion,
} from '@/lib/gold-data/ai-reference';

describe('ai gold reference', () => {
  it('loads the AI gold dataset', () => {
    const dataset = getAiGoldDataset();

    expect(dataset.workshop_type).toBe('AI');
    expect(dataset.signals).toContain('ai_business_readiness');
    expect(dataset.rules.must_anchor_to).toContain('operating_model');
  });

  it('builds an AI gold reference block for prompt injection', () => {
    const block = buildAiGoldReferenceBlock();

    expect(block).toContain('GOLD REFERENCE DATASET: AI');
    expect(block).toContain('Generation sequence: workshop -> context -> gtm_intent -> signal -> question');
    expect(block).toContain('ai_operating_model_alignment');
    expect(block).toContain('ai_change_resistance');
  });

  it('exposes AI gold signals for validator calibration', () => {
    const signals = getAiGoldSignals();

    expect(signals).toContain('ai_trust_risk');
    expect(signals).toContain('ai_adoption_success');
  });

  it('detects verbatim reuse of AI gold example wording', () => {
    expect(
      isExactAiGoldQuestion('Which opportunities failed because AI claims were not believable?'),
    ).toBe(true);

    expect(
      isExactAiGoldQuestion('Which opportunities failed because AI claims were not credible enough?'),
    ).toBe(false);
  });
});

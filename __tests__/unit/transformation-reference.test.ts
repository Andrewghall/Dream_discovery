import { describe, expect, it } from 'vitest';

import {
  buildTransformationGoldReferenceBlock,
  getTransformationGoldDataset,
  getTransformationGoldSignals,
  isExactTransformationGoldQuestion,
} from '@/lib/gold-data/transformation-reference';

describe('transformation gold reference', () => {
  it('loads the Transformation gold dataset', () => {
    const dataset = getTransformationGoldDataset();

    expect(dataset.workshop_type).toBe('TRANSFORMATION');
    expect(dataset.signals).toContain('sequencing_dependency');
    expect(dataset.rules.must_anchor_to).toContain('failed_initiatives');
  });

  it('builds a Transformation gold reference block for prompt injection', () => {
    const block = buildTransformationGoldReferenceBlock();

    expect(block).toContain('GOLD REFERENCE DATASET: TRANSFORMATION');
    expect(block).toContain('Generation sequence: workshop -> context -> gtm_intent -> signal -> question');
    expect(block).toContain('leadership_alignment_gap');
    expect(block).toContain('transformation_anti_pattern');
  });

  it('exposes Transformation gold signals for validator calibration', () => {
    const signals = getTransformationGoldSignals();

    expect(signals).toContain('operating_model_misalignment');
    expect(signals).toContain('technology_dependency');
  });

  it('detects verbatim reuse of Transformation gold example wording', () => {
    expect(
      isExactTransformationGoldQuestion('What must change first before any other transformation step becomes viable?'),
    ).toBe(true);

    expect(
      isExactTransformationGoldQuestion('What must shift first before any other transformation step becomes viable?'),
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildGtmIcpGoldReferenceBlock,
  findClosestGtmGoldExample,
  findClosestGtmGoldExampleForLens,
  getGtmGoldScaleAnchors,
  getGtmIcpGoldDataset,
} from '@/lib/gold-data/gtm-icp-reference';

describe('GTM/ICP gold runtime reference', () => {
  it('loads the authoritative dataset', () => {
    const dataset = getGtmIcpGoldDataset();
    expect(dataset.lens_pack).toBe('GTM_ICP_DISCOVERY_GOLD');
    expect(dataset.lenses).toHaveLength(6);
    expect(dataset.rules.anchor).toContain('how the business wins');
  });

  it('builds a prompt/reference block from the dataset', () => {
    const block = buildGtmIcpGoldReferenceBlock();
    expect(block).toContain('GOLD REFERENCE DATASET: GTM_ICP_DISCOVERY_GOLD');
    expect(block).toContain('Authoritative lens examples:');
    expect(block).toContain('Commercial:');
  });

  it('matches commercial-truth questions to the closest gold example', () => {
    const match = findClosestGtmGoldExample(
      'Across recent wins and losses, where do you see the clearest pattern in why buyers choose you or reject you?'
    );

    expect(match?.lens).toBe('Commercial');
    expect(match?.score ?? 0).toBeGreaterThan(0.3);
  });

  it('matches delivery-against-sale questions to Operations gold examples', () => {
    const match = findClosestGtmGoldExampleForLens(
      'Where does delivery struggle to match what was sold in recent deals?',
      'Operations',
    );

    expect(match?.lens).toBe('Operations');
    expect(match?.score ?? 0).toBeGreaterThan(0.24);
  });

  it('exposes the gold scale anchors for GTM lenses', () => {
    const anchors = getGtmGoldScaleAnchors('Technology');
    expect(anchors).toHaveLength(3);
    expect(anchors.join(' ')).toContain('differentiator');
  });
});

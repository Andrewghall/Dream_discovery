import { describe, expect, it } from 'vitest';

import { getWorkshopPack, WORKSHOP_PACKS } from '@/lib/workshop/workshop-packs';

describe('workshop packs', () => {
  it('resolves canonical workshop packs from runtime workshop types', () => {
    expect(getWorkshopPack('GO_TO_MARKET').key).toBe('GO_TO_MARKET');
    expect(getWorkshopPack('CUSTOMER').key).toBe('GO_TO_MARKET');
    expect(getWorkshopPack('CHANGE').key).toBe('TRANSFORMATION');
    expect(getWorkshopPack('PROCESS').key).toBe('OPERATIONS');
  });

  it('defines a contract for every canonical workshop type', () => {
    expect(Object.keys(WORKSHOP_PACKS)).toEqual([
      'TRANSFORMATION',
      'OPERATIONS',
      'AI',
      'GO_TO_MARKET',
      'FINANCE',
    ]);
  });

  it('marks transformation as the baseline reference model and GTM as specialized', () => {
    expect(WORKSHOP_PACKS.TRANSFORMATION.referenceModel).toBe('baseline');
    expect(WORKSHOP_PACKS.GO_TO_MARKET.referenceModel).toBe('specialized');
  });
});

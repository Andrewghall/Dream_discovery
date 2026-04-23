import { describe, expect, it } from 'vitest';

import { getIntentAwareDomainTheta } from '@/components/live/hemisphere-nodes';

function buildTestAngles() {
  return {
    People: Math.PI,
    Operations: (3 * Math.PI) / 4,
    Technology: (2 * Math.PI) / 3,
    Customer: Math.PI / 2,
    Commercial: Math.PI / 4,
    'Risk/Compliance': Math.PI / 8,
    Partners: 0,
  };
}

describe('hemisphere placement weighting', () => {
  it('uses the primary domain sector directly for tied cases by choosing one deterministically', () => {
    const angles = buildTestAngles();
    const placement = getIntentAwareDomainTheta(
      'Sixty-second training chunks can quickly support team leaders during live calls.',
      [
        { domain: 'People', relevance: 0.75 },
        { domain: 'Operations', relevance: 0.75 },
      ],
      angles
    );

    expect(placement.theta).not.toBeNull();
    expect(placement.theta!).toBe(angles.People);
  });

  it('uses the primary operations domain sector directly', () => {
    const angles = buildTestAngles();
    const placement = getIntentAwareDomainTheta(
      'Routing rules and queue handoffs are slowing case resolution across the workflow.',
      [
        { domain: 'People', relevance: 0.4 },
        { domain: 'Operations', relevance: 0.6 },
      ],
      angles
    );

    expect(placement.theta).not.toBeNull();
    expect(placement.theta!).toBe(angles.Operations);
  });

  it('uses the primary partners domain sector directly', () => {
    const angles = buildTestAngles();
    const placement = getIntentAwareDomainTheta(
      'We have a lot of commercial models with our partners.',
      [
        { domain: 'Partners', relevance: 0.75 },
        { domain: 'Commercial', relevance: 0.25 },
      ],
      angles
    );

    expect(placement.theta).not.toBeNull();
    expect(placement.theta!).toBe(angles.Partners);
  });

  it('uses the primary operations domain even with meaningful secondary support', () => {
    const angles = buildTestAngles();
    const placement = getIntentAwareDomainTheta(
      'We need to guide agents in a more dynamic way to improve operations.',
      [
        { domain: 'Operations', relevance: 0.45 },
        { domain: 'People', relevance: 0.37 },
        { domain: 'Technology', relevance: 0.09 },
        { domain: 'Customer', relevance: 0.09 },
      ],
      angles
    );

    expect(placement.theta).not.toBeNull();
    expect(placement.theta!).toBe(angles.Operations);
  });

  it('keeps primary-domain placement away from neighboring sector boundaries', () => {
    const angles = buildTestAngles();
    const placement = getIntentAwareDomainTheta(
      'We need to leverage AI to enhance support for our operations.',
      [
        { domain: 'Operations', relevance: 0.35 },
        { domain: 'Technology', relevance: 0.29 },
        { domain: 'People', relevance: 0.29 },
        { domain: 'Customer', relevance: 0.07 },
      ],
      angles
    );

    expect(placement.theta).not.toBeNull();
    expect(placement.theta!).toBe(angles.Operations);
  });
});

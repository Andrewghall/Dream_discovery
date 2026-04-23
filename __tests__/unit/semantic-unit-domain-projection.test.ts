import { describe, expect, it } from 'vitest';

import fixture from '@/__tests__/fixtures/agentic/semantic-unit-domain-boundary-cases.json';
import {
  applyMatchingDomainFeedback,
  CANONICAL_RENDER_DOMAINS,
  promotePrimaryDomain,
  projectSemanticUnitDomains,
  removeDomain,
  normalizeRenderDomain,
  setDomainPercentage,
} from '@/lib/live/semantic-unit-domain-projection';

type BoundaryCase = {
  text: string;
  primary_domain: string;
  secondary_domain: string;
  tertiary_domain: string;
};

describe('semantic unit domain projection boundary cases', () => {
  const cases = (fixture as { dataset: BoundaryCase[] }).dataset;
  const expectedPrimaryDomains = [
    'Customer',
    'Technology',
    'Operations',
    'People',
    'Commercial',
    'Partners',
    'Risk/Compliance',
  ];

  it('contains the targeted partners/commercial/compliance boundary pack', () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  it('includes finance as a canonical render domain and normalizes finance aliases', () => {
    expect(CANONICAL_RENDER_DOMAINS).toContain('Finance');
    expect(normalizeRenderDomain('finance')).toBe('Finance');
    expect(normalizeRenderDomain('financial')).toBe('Finance');
  });

  it('covers every live hemisphere domain as a primary target at least once', () => {
    const covered = new Set(cases.map((testCase) => testCase.primary_domain));
    for (const domain of expectedPrimaryDomains) {
      expect(covered.has(domain)).toBe(true);
    }
  });

  it('projects expected primary/secondary/tertiary ordering for the boundary pack', () => {
    for (const testCase of cases) {
      const projected = projectSemanticUnitDomains({
        unitText: testCase.text,
        inheritedDomains: [
          { domain: testCase.primary_domain, relevance: 0.8, reasoning: 'gold primary' },
          { domain: testCase.secondary_domain, relevance: 0.6, reasoning: 'gold secondary' },
          { domain: testCase.tertiary_domain, relevance: 0.45, reasoning: 'gold tertiary' },
        ],
      });

      expect(projected[0]?.domain, testCase.text).toBe(testCase.primary_domain);
      expect(projected[1]?.domain, testCase.text).toBe(testCase.secondary_domain);
      expect(projected[2]?.domain, testCase.text).toBe(testCase.tertiary_domain);

      const total = projected.reduce((sum, domain) => sum + domain.relevance, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it('can promote a missing domain into the render distribution as primary', () => {
    const promoted = promotePrimaryDomain([
      { domain: 'People', relevance: 0.72, reasoning: 'existing' },
      { domain: 'Operations', relevance: 0.14, reasoning: 'existing' },
      { domain: 'Risk/Compliance', relevance: 0.14, reasoning: 'existing' },
    ], 'Partners');

    expect(promoted[0]?.domain).toBe('Partners');
    expect(promoted.some((domain) => domain.domain === 'People')).toBe(true);
    expect(promoted.reduce((sum, domain) => sum + domain.relevance, 0)).toBeCloseTo(1, 6);
  });

  it('removes a selected domain and renormalizes the remainder', () => {
    const remaining = removeDomain([
      { domain: 'People', relevance: 0.5, reasoning: 'existing' },
      { domain: 'Partners', relevance: 0.3, reasoning: 'existing' },
      { domain: 'Risk/Compliance', relevance: 0.2, reasoning: 'existing' },
    ], 'Partners');

    expect(remaining.map((domain) => domain.domain)).toEqual(['People', 'Risk/Compliance']);
    expect(remaining.reduce((sum, domain) => sum + domain.relevance, 0)).toBeCloseTo(1, 6);
  });

  it('rebalances the remaining domains when a manual percentage is entered', () => {
    const adjusted = setDomainPercentage([
      { domain: 'People', relevance: 0.5, reasoning: 'existing' },
      { domain: 'Operations', relevance: 0.3, reasoning: 'existing' },
      { domain: 'Risk/Compliance', relevance: 0.2, reasoning: 'existing' },
    ], 'Partners', 25);

    expect(adjusted[0]?.domain).toBe('People');
    expect(adjusted.find((domain) => domain.domain === 'Partners')?.relevance).toBeCloseTo(0.25, 6);
    expect(adjusted.reduce((sum, domain) => sum + domain.relevance, 0)).toBeCloseTo(1, 6);
  });

  it('reuses saved domain feedback on exact semantic-unit text matches', () => {
    const matched = applyMatchingDomainFeedback(
      'We have various commercial models with our partners, and many of their profits are derived from our business.',
      [
        { domain: 'People', relevance: 0.69, reasoning: 'existing' },
        { domain: 'Operations', relevance: 0.16, reasoning: 'existing' },
        { domain: 'Risk/Compliance', relevance: 0.15, reasoning: 'existing' },
      ],
      [
        {
          text: 'We have various commercial models with our partners, and many of their profits are derived from our business.',
          correctedDomains: [
            { domain: 'Partners', relevance: 0.8, reasoning: 'manual correction' },
            { domain: 'People', relevance: 0.14, reasoning: 'manual correction' },
            { domain: 'Operations', relevance: 0.03, reasoning: 'manual correction' },
            { domain: 'Risk/Compliance', relevance: 0.03, reasoning: 'manual correction' },
          ],
        },
      ]
    );

    expect(matched[0]?.domain).toBe('Partners');
    expect(matched.reduce((sum, domain) => sum + domain.relevance, 0)).toBeCloseTo(1, 6);
  });

  it('uses the GTM gold dataset to boost commercial-truth semantic units toward the matched lens', () => {
    const projected = projectSemanticUnitDomains({
      unitText: 'Across recent wins and losses, the clearest pattern is that buyers choose us when they want low-risk delivery in a regulated environment.',
      inheritedDomains: [
        { domain: 'Operations', relevance: 0.5, reasoning: 'inherited' },
        { domain: 'People', relevance: 0.3, reasoning: 'inherited' },
        { domain: 'Risk/Compliance', relevance: 0.2, reasoning: 'inherited' },
      ],
      workshopType: 'GO_TO_MARKET',
    });

    expect(projected[0]?.domain).toBe('Commercial');
    expect(projected[0]?.relevance ?? 0).toBeGreaterThan(0.3);
  });
});

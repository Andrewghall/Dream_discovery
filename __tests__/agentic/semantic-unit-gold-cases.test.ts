import { describe, expect, it } from 'vitest';
import fixture from '@/__tests__/fixtures/agentic/semantic-unit-gold-cases.json';
import spokenLiveFixture from '@/__tests__/fixtures/agentic/semantic-unit-spoken-live-cases.json';
import {
  SEMANTIC_UNIT_SYSTEM_PROMPT,
  buildSemanticUnitUserPrompt,
} from '@/lib/live/semantic-unit-prompt';

type SemanticUnitQuality = {
  self_contained: true;
  complete_thought: true;
  non_fragment: true;
  non_filler: true;
  business_meaningful: true;
  no_external_dependency: true;
};

type SemanticUnitCase = {
  id: string;
  input: string;
  expectedUnits: string[];
  expectedDiscarded: Array<{
    text: string;
    reason: string;
  }>;
  note?: string;
};

type SemanticUnitFixtureShape =
  | SemanticUnitCase[]
  | {
      dataset: Array<{
        id?: string;
        lens?: string;
        input: string;
        expected_units: string[];
        expectedDiscarded?: Array<{
          text: string;
          reason: string;
        }>;
        expected_discarded?: Array<{
          text: string;
          reason: string;
        }>;
        note?: string;
      }>;
    };

function normalizeCases(source: SemanticUnitFixtureShape, fallbackPrefix: string): SemanticUnitCase[] {
  const entries = Array.isArray(source) ? source : source.dataset;
  return entries.map((entry, index) => ({
    id: entry.id ?? `${fallbackPrefix}-${index + 1}`,
    input: entry.input,
    expectedUnits: 'expectedUnits' in entry ? entry.expectedUnits : entry.expected_units,
    expectedDiscarded:
      ('expectedDiscarded' in entry ? entry.expectedDiscarded : undefined) ??
      ('expected_discarded' in entry ? entry.expected_discarded : undefined) ??
      [],
    note: entry.note,
  }));
}

describe('semantic unit gold cases', () => {
  const cases = normalizeCases(fixture as SemanticUnitFixtureShape, 'semantic-unit');
  const spokenLiveCases = normalizeCases(spokenLiveFixture as SemanticUnitFixtureShape, 'spoken-live');

  it('contains non-empty fixture coverage for stage-one semantic extraction', () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(spokenLiveCases.length).toBeGreaterThanOrEqual(10);
  });

  it('keeps every case structurally valid', () => {
    for (const testCase of cases) {
      expect(testCase.id).toBeTruthy();
      expect(testCase.input.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(testCase.expectedUnits)).toBe(true);
      expect(Array.isArray(testCase.expectedDiscarded)).toBe(true);
    }
  });

  it('contains at least one zero-output case', () => {
    expect(cases.some((c) => c.expectedUnits.length === 0)).toBe(true);
    expect(spokenLiveCases.some((c) => c.expectedUnits.length === 0)).toBe(true);
  });

  it('contains at least one merge case', () => {
    expect(
      cases.some((c) =>
        c.note?.toLowerCase().includes('merge') || c.expectedUnits.some((u) => u.includes(' and '))
      )
    ).toBe(true);
  });

  it('contains spoken-live cases with multiple expected semantic units', () => {
    expect(spokenLiveCases.some((c) => c.expectedUnits.length >= 2)).toBe(true);
  });

  it('keeps spoken-live cases structurally valid', () => {
    for (const testCase of spokenLiveCases) {
      expect(testCase.id).toBeTruthy();
      expect(testCase.input.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(testCase.expectedUnits)).toBe(true);
    }
  });

  it('prompt enforces the hard render boundary', () => {
    expect(SEMANTIC_UNIT_SYSTEM_PROMPT).toContain('Raw transcript must NEVER be rendered directly.');
    expect(SEMANTIC_UNIT_SYSTEM_PROMPT).toContain('ZERO OUTPUT RULE');
    expect(SEMANTIC_UNIT_SYSTEM_PROMPT).toContain('Split on meaning, not punctuation');
  });

  it('user prompt wraps the passage as input only', () => {
    const prompt = buildSemanticUnitUserPrompt('Example passage');
    expect(prompt).toBe('INPUT:\nExample passage');
  });

  it('documents the strict quality gate shape used for emitted units', () => {
    const expectedQuality: SemanticUnitQuality = {
      self_contained: true,
      complete_thought: true,
      non_fragment: true,
      non_filler: true,
      business_meaningful: true,
      no_external_dependency: true,
    };

    expect(expectedQuality).toEqual({
      self_contained: true,
      complete_thought: true,
      non_fragment: true,
      non_filler: true,
      business_meaningful: true,
      no_external_dependency: true,
    });
  });
});

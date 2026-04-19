import { describe, test, expect } from 'vitest';
import { evaluateUnitQuality } from '@/lib/ethentaflow/unit-quality-gate';

describe('evaluateUnitQuality — hard blockers', () => {
  describe('agreement fragments / ASR noise (must be blocked)', () => {
    const junk = [
      'Know about me. That\'s exactly.',
      'That\'s exactly right.',
      'Yes, that\'s right.',
      'I know. That\'s it.',
      'Yeah, okay, sure.',
      'Right. That is.',
    ];

    test.each(junk)('blocks: "%s"', (text) => {
      const result = evaluateUnitQuality(text);
      expect(result.pass).toBe(false);
    });
  });

  describe('genuine insights (must pass)', () => {
    const valid = [
      'Most people come to work to do their best.',
      'I love that we keep coming back to metrics.',
      'Leaders should ask questions before interpreting performance data.',
      'Contact centres need better tools for real-time decision making.',
      'Metrics alone cannot tell you why performance is declining.',
      'When something looks wrong you need to go to the source.',
      'I genuinely feel I need to apologize to anyone I mismanaged.',
    ];

    test.each(valid)('passes: "%s"', (text) => {
      const result = evaluateUnitQuality(text);
      expect(result.pass).toBe(true);
    });
  });

  describe('minimum word count (must be blocked)', () => {
    test('blocks fragments under 5 words', () => {
      expect(evaluateUnitQuality('Eat.').pass).toBe(false);
      expect(evaluateUnitQuality('Because.').pass).toBe(false);
      expect(evaluateUnitQuality('Right tools.').pass).toBe(false);
    });
  });
});

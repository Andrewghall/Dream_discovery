// @vitest-environment node

import { describe, expect, it } from 'vitest';
import fixture from '@/__tests__/fixtures/agentic/interview-agent-cases.json';
import {
  buildRoleGuidance,
  compressPromptForMode,
  type PreferredInteractionMode,
} from '@/lib/conversation/agentic-interview';

type InterviewAgentFixtureCase = {
  id: string;
  role: string;
  department: string;
  phase: string;
  mode: PreferredInteractionMode;
  probe: string;
  expectedGuidancePhrases: string[];
  maxPromptLength: number;
};

describe('interview agent fixtures', () => {
  it('keeps role framing aligned to expected role-world cues', () => {
    const cases = fixture as InterviewAgentFixtureCase[];

    for (const testCase of cases) {
      const guidance = buildRoleGuidance(
        testCase.role,
        testCase.department,
        testCase.phase,
      ).join(' ');

      for (const phrase of testCase.expectedGuidancePhrases) {
        expect(
          guidance,
          `${testCase.id} should include guidance phrase "${phrase}"`,
        ).toContain(phrase);
      }
    }
  });

  it('keeps probes within the expected voice/text length budget', () => {
    const cases = fixture as InterviewAgentFixtureCase[];

    for (const testCase of cases) {
      const prompt = compressPromptForMode(testCase.probe, testCase.mode);

      expect(
        prompt.length,
        `${testCase.id} should stay within ${testCase.maxPromptLength} chars`,
      ).toBeLessThanOrEqual(testCase.maxPromptLength);

      if (testCase.mode === 'VOICE') {
        expect(
          prompt.length,
          `${testCase.id} voice prompt should be compact`,
        ).toBeLessThanOrEqual(160);
      }
    }
  });
});

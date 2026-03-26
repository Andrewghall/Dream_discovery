// @vitest-environment node

/**
 * Agent loop fail-hard enforcement.
 *
 * Proves that runQuestionSetAgent throws when the agent loop ends without
 * an explicit commit_question_set call — no silent salvage from partial
 * designedPhases.
 *
 * Uses node environment (not jsdom) because the OpenAI client rejects
 * browser-like environments.
 */

import { vi, describe, it, expect } from 'vitest';

// Mocks must be at top level — vi.mock is hoisted before imports.
vi.mock('@/lib/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-key-for-loop-enforcement',
    DATABASE_URL: 'postgresql://test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/lib/circuit-breaker', () => ({
  openAiBreaker: {
    execute: vi.fn().mockResolvedValue({
      choices: [{
        message: {
          role: 'assistant',
          content: 'I am thinking but never committing.',
          tool_calls: [],
        },
      }],
    }),
  },
}));

import { runQuestionSetAgent } from '@/lib/cognition/agents/question-set-agent';

const context = {
  workshopId: 'test-ws',
  workshopPurpose: 'Enforce loop test',
  desiredOutcomes: 'Proof of throw',
  clientName: 'TestCorp',
  industry: 'Test',
  companyWebsite: null,
  dreamTrack: null as const,
  targetDomain: null,
  blueprint: null,
};

const mockResearch = {
  companyOverview: 'TestCorp',
  industryContext: 'Test',
  keyPublicChallenges: [],
  recentDevelopments: [],
  competitorLandscape: '',
  domainInsights: null,
  researchedAtMs: Date.now(),
  sourceUrls: [],
  journeyStages: null,
  industryDimensions: [
    { name: 'TestLens', description: 'Test', keywords: [], color: '#000' },
  ],
};

describe('runQuestionSetAgent — loop ended without commit fails hard', () => {
  it('throws when agent returns no tool calls (no commit)', async () => {
    // The mock returns an empty tool_calls array every iteration.
    // The loop will break on the first iteration, then hit the throw.
    await expect(runQuestionSetAgent(context, mockResearch))
      .rejects.toThrow(/Loop ended without explicit commit/);
  });

  it('does not return a question set when agent never commits', async () => {
    let result: unknown;
    try {
      result = await runQuestionSetAgent(context, mockResearch);
    } catch {
      result = null;
    }
    expect(result).toBeNull();
  });
});

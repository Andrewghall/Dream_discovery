// @vitest-environment node

/**
 * Proves that runPrepOrchestrator never writes invalid customQuestions to the DB
 * and never returns an invalid questionSet to the caller.
 *
 * These tests mock runQuestionSetAgent to return runtime-invalid data (bypassing
 * TypeScript's type guarantees) and assert the structural guarantee introduced in
 * prep-orchestrator.ts: validation runs OUTSIDE the catch block, so a failing
 * validation cannot be swallowed, and questionSet is reset to null.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workshop: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/cognition/agents/research-agent', () => ({
  runResearchAgent: vi.fn().mockResolvedValue(null),
  ResearchClarificationNeededError: class extends Error {},
}));

vi.mock('@/lib/cognition/agents/question-set-agent', () => ({
  runQuestionSetAgent: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'gpt-4o',
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { runPrepOrchestrator } from '@/lib/cognition/agents/prep-orchestrator';
import { prisma } from '@/lib/prisma';
import { runQuestionSetAgent } from '@/lib/cognition/agents/question-set-agent';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext() {
  return {
    workshopId: 'ws-test',
    workshopPurpose: 'Test purpose',
    desiredOutcomes: 'Test outcomes',
    clientName: 'TestCorp',
    industry: 'Test',
    companyWebsite: null,
    dreamTrack: 'ENTERPRISE' as const,
    targetDomain: null,
    blueprint: null,
  };
}

/** An invalid question set: all required phases present but with empty questions arrays. */
function invalidQuestionSet() {
  return {
    phases: {
      REIMAGINE: { questions: [], lensOrder: [], label: 'Reimagine', description: '' },
      CONSTRAINTS: { questions: [], lensOrder: [], label: 'Constraints', description: '' },
      DEFINE_APPROACH: { questions: [], lensOrder: [], label: 'Define Approach', description: '' },
    },
    designRationale: 'Invalid — empty phases',
    generatedAtMs: Date.now(),
    dataConfidence: 'low' as const,
    dataSufficiencyNotes: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runPrepOrchestrator — validation gates DB write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call prisma.workshop.update with customQuestions when runQuestionSetAgent returns invalid data', async () => {
    // Bypass TypeScript: return an object that passes the type but fails runtime validation
    vi.mocked(runQuestionSetAgent).mockResolvedValueOnce(invalidQuestionSet() as never);

    const updateSpy = vi.spyOn(prisma.workshop, 'update');

    const result = await runPrepOrchestrator(makeContext());

    // DB must never be written with invalid data
    const customQsWrites = updateSpy.mock.calls.filter(([arg]) => {
      const data = (arg as { data: Record<string, unknown> }).data;
      return 'customQuestions' in data;
    });
    expect(customQsWrites).toHaveLength(0);
  });

  it('returns questionSet = null when runQuestionSetAgent returns invalid data', async () => {
    vi.mocked(runQuestionSetAgent).mockResolvedValueOnce(invalidQuestionSet() as never);

    const result = await runPrepOrchestrator(makeContext());

    // Invalid data must not propagate to the caller
    expect(result.questionSet).toBeNull();
  });

  it('does NOT call prisma.workshop.update with customQuestions when runQuestionSetAgent throws', async () => {
    vi.mocked(runQuestionSetAgent).mockRejectedValueOnce(
      new Error('[Question Set Agent] Loop ended without explicit commit — question set is incomplete.'),
    );

    const updateSpy = vi.spyOn(prisma.workshop, 'update');

    await runPrepOrchestrator(makeContext());

    const customQsWrites = updateSpy.mock.calls.filter(([arg]) => {
      const data = (arg as { data: Record<string, unknown> }).data;
      return 'customQuestions' in data;
    });
    expect(customQsWrites).toHaveLength(0);
  });

  it('returns questionSet = null when runQuestionSetAgent throws', async () => {
    vi.mocked(runQuestionSetAgent).mockRejectedValueOnce(
      new Error('[Question Set Agent] Loop ended without explicit commit — question set is incomplete.'),
    );

    const result = await runPrepOrchestrator(makeContext());

    expect(result.questionSet).toBeNull();
  });
});

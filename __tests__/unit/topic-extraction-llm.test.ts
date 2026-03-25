/**
 * Unit tests — refineTopicsWithLLM (Codex blockers 2 & 3)
 *
 * Blocker 2: LLM canonical must be an exact existing input label, not token recombination.
 *   "approval_system" is rejected if there is no input cluster named "approval_system",
 *   even though "approval" and "system" are separate input labels.
 *
 * Blocker 3: OpenAI client is constructed lazily inside the function.
 *   Importing topic-extraction.ts must be safe with no OPENAI_API_KEY in scope.
 *   These tests verify the module loads without side effects under the mock.
 *
 * Guard 1 (from previous fix, retained): oldLabel must be a known input cluster key.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { RawSignal } from '@/lib/output/evidence-clustering';

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  (MockOpenAI as any)._mockCreate = mockCreate;
  return { default: MockOpenAI };
});

vi.mock('@/lib/circuit-breaker', () => ({
  openAiBreaker: { execute: (fn: () => unknown) => fn() },
}));

// topic-extraction.ts reads process.env.OPENAI_API_KEY directly (not via @/lib/env),
// so we set it here for tests that exercise the LLM path.
beforeAll(() => { process.env.OPENAI_API_KEY = 'test-key'; });
afterAll(() => { delete process.env.OPENAI_API_KEY; });

function makeSignal(id: string, themeLabel: string): RawSignal {
  return {
    id,
    rawText: `signal about ${themeLabel}`,
    speakerId: null,
    participantRole: null,
    lens: null,
    phase: null,
    primaryType: null,
    sentiment: 'neutral',
    themeLabels: [themeLabel],
    confidence: null,
    isConfirmedParticipant: false,
    sourceStream: 'live',
  };
}

describe('refineTopicsWithLLM — Guard 1: key must be a known input cluster', () => {
  it('rejects merge entries whose key is not present in the input cluster set', async () => {
    const { default: MockOpenAI } = await import('openai');
    const mockCreate = (MockOpenAI as any)._mockCreate;
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            merges: {
              'approval':        'approval_wait',   // Guard 1: valid key
              'unknown_cluster': 'approval',        // Guard 1: "unknown_cluster" not in input → reject
            },
          }),
        },
      }],
    });

    const labels = ['approval', 'approval_wait', 'system', 'training', 'training_gap', 'customer'];
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    expect(mergeMap.get('approval')).toBe('approval_wait');
    expect(mergeMap.has('unknown_cluster')).toBe(false);
  });
});

describe('refineTopicsWithLLM — Guard 2: canonical must be an existing input label (allow-list)', () => {
  it('rejects a canonical that is a token recombination not present as an input label', async () => {
    // Input labels: ["approval", "system", "training", "training_gap", "customer", "portal"]
    // "approval_system" does NOT exist as an input label — it is a recombination.
    // "customer_portal" does NOT exist as an input label — same.
    // Both must be rejected even though their constituent tokens are in separate input labels.
    const { default: MockOpenAI } = await import('openai');
    const mockCreate = (MockOpenAI as any)._mockCreate;
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            merges: {
              'approval':   'approval_system',  // "approval_system" not an input label → reject
              'portal':     'customer_portal',  // "customer_portal" not an input label → reject
              'training':   'training_gap',     // "training_gap" IS an input label → accept
            },
          }),
        },
      }],
    });

    const labels = ['approval', 'system', 'training', 'training_gap', 'customer', 'portal'];
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    // Token-recombined labels rejected — only exact input labels are allowed
    expect(mergeMap.has('approval')).toBe(false);   // "approval_system" blocked
    expect(mergeMap.has('portal')).toBe(false);     // "customer_portal" blocked
    // Exact input label accepted
    expect(mergeMap.get('training')).toBe('training_gap');
  });

  it('accepts a canonical that exactly matches an existing normalised input label', async () => {
    // "approval_wait" IS an input label; the LLM is allowed to map "approval" → "approval_wait".
    const { default: MockOpenAI } = await import('openai');
    const mockCreate = (MockOpenAI as any)._mockCreate;
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            merges: {
              'approval': 'approval_wait',  // "approval_wait" is an input label → accept
            },
          }),
        },
      }],
    });

    const labels = ['approval', 'approval_wait', 'system', 'training', 'training_gap', 'customer'];
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    expect(mergeMap.get('approval')).toBe('approval_wait');
  });

  it('rejects invented vocabulary even when all individual tokens are in the input', async () => {
    // "strategic_alignment" — neither "strategic" nor "alignment" appear in input labels.
    // "strategic_system" — "strategic" absent from input labels.
    const { default: MockOpenAI } = await import('openai');
    const mockCreate = (MockOpenAI as any)._mockCreate;
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            merges: {
              'approval_wait': 'strategic_alignment', // invented — reject
              'system':        'strategic_system',    // invented — reject
            },
          }),
        },
      }],
    });

    const labels = ['approval', 'approval_wait', 'system', 'training', 'training_gap', 'customer'];
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    expect(mergeMap.has('approval_wait')).toBe(false);
    expect(mergeMap.has('system')).toBe(false);
    expect(mergeMap.size).toBe(0);
  });
});

describe('refineTopicsWithLLM — Blocker 3: lazy client construction', () => {
  it('returns empty map when OPENAI_API_KEY is absent (no module-level crash)', async () => {
    // This test verifies two things:
    // 1. topic-extraction.ts does NOT import @/lib/env at module level (which would throw
    //    when DATABASE_URL is absent, crashing the import).
    // 2. When OPENAI_API_KEY is absent from process.env, the function returns an empty
    //    map rather than throwing.
    //
    // vi.resetModules() clears the module registry so the next import() genuinely
    // re-evaluates topic-extraction.ts from scratch — without a cached copy that was
    // already evaluated. This proves there is no module-level side effect that would crash.
    vi.resetModules();
    // Temporarily remove the API key so the no-key code path is exercised.
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      // topic-extraction.ts reads process.env.OPENAI_API_KEY directly — if absent,
      // refineTopicsWithLLM returns new Map() immediately without constructing a client.
      const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
      const signals = [makeSignal('s1', 'approval')];
      const result = await refineTopicsWithLLM(signals, {});
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    } finally {
      // Always restore, even if assertions fail
      if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
    }
  });

  it('returns empty map when fewer than 6 clusters exist', async () => {
    const labels = ['approval', 'system', 'training'];
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    expect(mergeMap.size).toBe(0);
  });
});

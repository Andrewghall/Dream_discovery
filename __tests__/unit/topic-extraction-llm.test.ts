/**
 * Unit tests — refineTopicsWithLLM vocabulary constraint (Codex Blocker 4)
 *
 * Verifies that the post-parse validation in refineTopicsWithLLM:
 *  Guard 1 — rejects merge entries whose key is not a known input cluster label
 *  Guard 2 — rejects canonical labels containing tokens absent from all input labels
 *
 * Uses vi.mock('openai') pattern consistent with
 * __tests__/integration/discovery-intelligence-unified.test.ts
 */

import { describe, it, expect, vi } from 'vitest';
import type { RawSignal } from '@/lib/output/evidence-clustering';

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  (MockOpenAI as any)._mockCreate = mockCreate;
  return { default: MockOpenAI };
});

// Also mock the circuit breaker so it just passes through the call
vi.mock('@/lib/circuit-breaker', () => ({
  openAiBreaker: { execute: (fn: () => unknown) => fn() },
}));

// Also mock env so OPENAI_API_KEY is present (enables openai client instantiation)
vi.mock('@/lib/env', () => ({
  env: { OPENAI_API_KEY: 'test-key' },
}));

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

describe('refineTopicsWithLLM — vocabulary constraint (Codex Blocker 4)', () => {
  it('accepts only merges whose key is a known input cluster label', async () => {
    const { default: MockOpenAI } = await import('openai');
    const mockCreate = (MockOpenAI as any)._mockCreate;

    // LLM returns a mix of valid and invalid entries
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            merges: {
              'approval':        'approval_wait',   // valid key
              'unknown_cluster': 'approval',        // Guard 1: key not in input → reject
            },
          }),
        },
      }],
    });

    // Build 6+ signals so the cluster threshold (≥6) is met
    const labels = ['approval', 'approval_wait', 'system', 'training', 'training_gap', 'customer'];
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    // Valid entry accepted
    expect(mergeMap.get('approval')).toBe('approval_wait');
    // Unknown key rejected — must not appear in result
    expect(mergeMap.has('unknown_cluster')).toBe(false);
  });

  it('rejects canonical labels containing tokens absent from all input cluster labels', async () => {
    const { default: MockOpenAI } = await import('openai');
    const mockCreate = (MockOpenAI as any)._mockCreate;

    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            merges: {
              'approval':      'approval_wait',       // Guard 2: valid — "approval","wait" in master
              'approval_wait': 'strategic_alignment', // Guard 2: "strategic","alignment" absent → reject
              'training':      'training_gap',        // Guard 2: valid — "training","gap" in master
              'system':        'strategic_system',    // Guard 2: "strategic" absent → reject
            },
          }),
        },
      }],
    });

    const labels = ['approval', 'approval_wait', 'system', 'training', 'training_gap', 'customer'];
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    // Valid merges accepted
    expect(mergeMap.get('approval')).toBe('approval_wait');
    expect(mergeMap.get('training')).toBe('training_gap');

    // Invented vocabulary rejected — LLM cannot introduce "strategic" or "alignment"
    expect(mergeMap.has('approval_wait')).toBe(false);  // "strategic_alignment" blocked
    expect(mergeMap.has('system')).toBe(false);         // "strategic_system" blocked
  });

  it('returns empty map when LLM returns empty merges object', async () => {
    const { default: MockOpenAI } = await import('openai');
    const mockCreate = (MockOpenAI as any)._mockCreate;

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ merges: {} }) } }],
    });

    const labels = ['approval', 'approval_wait', 'system', 'training', 'training_gap', 'customer'];
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    expect(mergeMap.size).toBe(0);
  });

  it('returns empty map when fewer than 6 clusters exist (below threshold)', async () => {
    const labels = ['approval', 'system', 'training'];  // only 3 — below threshold of 6
    const signals = labels.map((l, i) => makeSignal(`s${i}`, l));

    const { refineTopicsWithLLM } = await import('@/lib/output/topic-extraction');
    const mergeMap = await refineTopicsWithLLM(signals, {});

    // LLM should not have been called; result is empty map
    expect(mergeMap.size).toBe(0);
  });
});

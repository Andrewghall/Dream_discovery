/**
 * Discovery Intelligence — Unified Agentic Flow Tests
 *
 * Validates that:
 * 1. The discovery-intelligence endpoint emits SSE (text/event-stream).
 * 2. runDiscoveryIntelligenceAgent is invoked when no briefing exists.
 * 3. When a valid discoveryBriefing already exists, the agent is NOT re-run.
 * 4. The complete SSE event carries discoveryOutput with all 4 diagnostic sections.
 * 5. An error SSE event is emitted when discovery data is missing.
 * 6. No workshop-name or workshop-id special-casing: any workshopId works.
 * 7. The GPT-4o diagnostic call happens AFTER runDiscoveryIntelligenceAgent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasDiscoveryData } from '@/lib/cognition/agents/agent-types';

// ── vi.mock declarations — must be at top level; factories must NOT reference
//    top-level `const`s (they are hoisted before var init).
//    Return values are injected in beforeEach via mockResolvedValue / mockReturnValue.

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workshop: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    workshopScratchpad: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/get-session-user', () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/middleware/validate-workshop-access', () => ({
  validateWorkshopAccess: vi.fn(),
}));

vi.mock('@/lib/cognition/agents/discovery-intelligence-agent', () => ({
  runDiscoveryIntelligenceAgent: vi.fn(),
}));

vi.mock('@/lib/workshop/blueprint', () => ({
  readBlueprintFromJson: vi.fn().mockReturnValue(null),
}));

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  // Expose mockCreate on the constructor so tests can spy on it
  (MockOpenAI as any)._mockCreate = mockCreate;
  return { default: MockOpenAI };
});

// ── Imports (after vi.mock) ───────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runDiscoveryIntelligenceAgent } from '@/lib/cognition/agents/discovery-intelligence-agent';
import OpenAI from 'openai';
import { POST } from '@/app/api/admin/workshops/[id]/discovery-intelligence/route';

// ── Test fixtures (defined here, NOT inside vi.mock factories) ────────────────

const MOCK_WORKSHOP_ID = 'ws_test_arbitrary_001';

const MOCK_INTELLIGENCE = {
  maturitySnapshot:  [],
  discoveryThemes:   [{ title: 'Process Debt', domain: 'Technology', frequency: 4, sentiment: 'negative', keyQuotes: [] }],
  consensusAreas:    ['Need for better tooling'],
  divergenceAreas:   [{ topic: 'Leadership buy-in', perspectives: ['Exec: optimistic', 'Ops: sceptical'] }],
  painPoints:        [{ description: 'Manual handoffs cause delays', domain: 'Organisation', frequency: 3, severity: 'significant' }],
  aspirations:       ['Automate routine reporting'],
  watchPoints:       ['Risk of initiative fatigue'],
  participantCount:  3,
  synthesizedAtMs:   Date.now(),
  briefingSummary:   'The organisation shows moderate transformation readiness with notable process debt.',
};

const MOCK_SCRATCHPAD_DISCOVERY = {
  sections: [
    {
      domain:         'Technology',
      utteranceCount:  12,
      consensusLevel:  65,
      topThemes:      ['Process Debt', 'Integration Gaps'],
      quotes:         [{ text: 'We spend half our day on manual work.', author: 'Ops Lead' }],
      sentiment:      { concerned: 45, neutral: 35, optimistic: 20 },
    },
  ],
  participants:     ['Alice', 'Bob', 'Carol'],
  totalUtterances:  12,
  _aiSummary:       'Technology friction is the primary constraint.',
};

const MOCK_GPT_DIAGNOSTIC = {
  operationalReality:          { insight: 'Operations rely heavily on manual handoffs.', evidence: ['Signal A', 'Signal B', 'Signal C'] },
  organisationalMisalignment:  { insight: 'Leadership vs Ops diverge on timeline.', evidence: ['Tension rank 1'] },
  systemicFriction:            { insight: 'Integration gaps block delivery.', evidence: ['Constraint: Manual handoffs'] },
  transformationReadiness:     { insight: 'Moderate readiness with fatigue risk.', evidence: ['Optimism in HR domain'] },
  finalDiscoverySummary:       'The organisation is constrained by process debt and cross-team divergence.',
};

// ── SSE helpers ───────────────────────────────────────────────────────────────

function parseSSE(raw: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  for (const block of raw.split('\n\n').filter(Boolean)) {
    const lines    = block.split('\n');
    const dataLine = lines.find(l => l.startsWith('data: '));
    if (!dataLine) continue;
    events.push({
      event: lines.find(l => l.startsWith('event: '))?.slice(7).trim() ?? 'message',
      data:  JSON.parse(dataLine.slice(6)),
    });
  }
  return events;
}

async function drainStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader  = stream.getReader();
  const decoder = new TextDecoder();
  let   out     = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

function makeRequest(id = MOCK_WORKSHOP_ID) {
  return new Request(`https://app/api/admin/workshops/${id}/discovery-intelligence`, { method: 'POST' });
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Auth passes by default
  (getAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: 'user_test', organizationId: 'org_test', role: 'admin',
  });
  (validateWorkshopAccess as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: true });

  // Workshop with NO existing briefing
  (prisma.workshop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id:               MOCK_WORKSHOP_ID,
    description:      'Test workshop',
    businessContext:  'Improve operational efficiency',
    clientName:       'Acme Corp',
    industry:         'Retail',
    companyWebsite:   'https://acme.example',
    dreamTrack:       null,
    targetDomain:     null,
    prepResearch:     null,
    blueprint:        null,
    discoveryBriefing:null,    // ← triggers agent
    discoverAnalysis: null,
  });
  (prisma.workshop.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

  // Scratchpad has discovery sections
  (prisma.workshopScratchpad.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    discoveryOutput: MOCK_SCRATCHPAD_DISCOVERY,
  });
  (prisma.workshopScratchpad.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

  // Agent returns structured intelligence
  (runDiscoveryIntelligenceAgent as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_INTELLIGENCE);

  // GPT-4o returns the diagnostic JSON
  const mockCreate = (OpenAI as any)._mockCreate as ReturnType<typeof vi.fn>;
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(MOCK_GPT_DIAGNOSTIC) } }],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Discovery Intelligence — unified agentic flow', () => {

  it('returns text/event-stream, not application/json', async () => {
    const res = await POST(makeRequest() as any, { params: Promise.resolve({ id: MOCK_WORKSHOP_ID }) });
    await drainStream(res.body!);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  it('calls runDiscoveryIntelligenceAgent when discoveryBriefing is null', async () => {
    const res = await POST(makeRequest() as any, { params: Promise.resolve({ id: MOCK_WORKSHOP_ID }) });
    await drainStream(res.body!);

    expect(runDiscoveryIntelligenceAgent).toHaveBeenCalledOnce();

    // PrepContext is built from DB fields — not from the workshopId string
    const [ctx] = (runDiscoveryIntelligenceAgent as ReturnType<typeof vi.fn>).mock.calls[0] as any[];
    expect(ctx.workshopId).toBe(MOCK_WORKSHOP_ID);
    expect(ctx.workshopPurpose).toBe('Test workshop');
  });

  it('skips runDiscoveryIntelligenceAgent when valid briefing already exists', async () => {
    (prisma.workshop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id:               MOCK_WORKSHOP_ID,
      description:      'Test workshop',
      businessContext:  null,
      clientName:       null,
      industry:         null,
      companyWebsite:   null,
      dreamTrack:       null,
      targetDomain:     null,
      prepResearch:     null,
      blueprint:        null,
      discoveryBriefing:MOCK_INTELLIGENCE,   // ← briefing already stored
      discoverAnalysis: null,
    });

    const res = await POST(makeRequest() as any, { params: Promise.resolve({ id: MOCK_WORKSHOP_ID }) });
    await drainStream(res.body!);

    expect(runDiscoveryIntelligenceAgent).not.toHaveBeenCalled();
  });

  it('emits a complete SSE event with all 4 diagnostic sections', async () => {
    const res    = await POST(makeRequest() as any, { params: Promise.resolve({ id: MOCK_WORKSHOP_ID }) });
    const raw    = await drainStream(res.body!);
    const events = parseSSE(raw);

    const complete = events.find(e => e.event === 'complete');
    expect(complete).toBeDefined();

    const output = (complete!.data as any).discoveryOutput;
    expect(output).toHaveProperty('operationalReality');
    expect(output).toHaveProperty('organisationalMisalignment');
    expect(output).toHaveProperty('systemicFriction');
    expect(output).toHaveProperty('transformationReadiness');
    expect(output).toHaveProperty('finalDiscoverySummary');
  });

  it('emits at least one progress event before complete', async () => {
    const res    = await POST(makeRequest() as any, { params: Promise.resolve({ id: MOCK_WORKSHOP_ID }) });
    const raw    = await drainStream(res.body!);
    const events = parseSSE(raw);

    expect(events.filter(e => e.event === 'progress').length).toBeGreaterThan(0);
  });

  it('emits an error event when scratchpad has no discoveryOutput', async () => {
    (prisma.workshopScratchpad.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res    = await POST(makeRequest() as any, { params: Promise.resolve({ id: MOCK_WORKSHOP_ID }) });
    const raw    = await drainStream(res.body!);
    const events = parseSSE(raw);

    const err = events.find(e => e.event === 'error');
    expect(err).toBeDefined();
    expect((err!.data as any).message).toContain('No discovery output data');
  });

  it('routes correctly for an arbitrary workshopId — no name/id branching', async () => {
    const otherId = 'ws_completely_different_999';

    (prisma.workshop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id:               otherId,
      description:      'Another workshop',
      businessContext:  null,
      clientName:       null,
      industry:         null,
      companyWebsite:   null,
      dreamTrack:       null,
      targetDomain:     null,
      prepResearch:     null,
      blueprint:        null,
      discoveryBriefing:null,
      discoverAnalysis: null,
    });

    const res    = await POST(makeRequest(otherId) as any, { params: Promise.resolve({ id: otherId }) });
    const raw    = await drainStream(res.body!);
    const events = parseSSE(raw);

    // Agent called with the correct (arbitrary) id
    const [ctx] = (runDiscoveryIntelligenceAgent as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(ctx.workshopId).toBe(otherId);

    // Flow completed successfully
    expect(events.find(e => e.event === 'complete')).toBeDefined();
  });

  it('calls openai.chat.completions.create AFTER runDiscoveryIntelligenceAgent', async () => {
    const order: string[] = [];

    (runDiscoveryIntelligenceAgent as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push('agent');
      return MOCK_INTELLIGENCE;
    });

    const mockCreate = (OpenAI as any)._mockCreate as ReturnType<typeof vi.fn>;
    mockCreate.mockImplementation(async () => {
      order.push('gpt');
      return { choices: [{ message: { content: JSON.stringify(MOCK_GPT_DIAGNOSTIC) } }] };
    });

    const res = await POST(makeRequest() as any, { params: Promise.resolve({ id: MOCK_WORKSHOP_ID }) });
    await drainStream(res.body!);

    expect(order.indexOf('agent')).toBeLessThan(order.indexOf('gpt'));
  });
});

// ── hasDiscoveryData gate used by the unified route ──────────────────────────

describe('hasDiscoveryData — gate used by unified route', () => {
  it('returns false for null (triggers agent run)', () => {
    expect(hasDiscoveryData(null)).toBe(false);
  });

  it('returns false for empty briefing (triggers agent run)', () => {
    expect(hasDiscoveryData({ discoveryThemes: [], painPoints: [], aspirations: [], participantCount: 0 })).toBe(false);
  });

  it('returns true when themes exist (skips agent re-run)', () => {
    expect(hasDiscoveryData({ discoveryThemes: [{ title: 'Theme A' }], painPoints: [], aspirations: [], participantCount: 1 })).toBe(true);
  });
});

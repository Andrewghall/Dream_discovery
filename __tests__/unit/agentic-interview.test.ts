// @vitest-environment node

import { describe, expect, it } from 'vitest';
import OpenAI from 'openai';
import {
  buildRoleGuidance,
  compressPromptForMode,
  detectDeliveryMode,
  extractTripleRatings,
  formatTripleRatingPrompt,
  generateAgenticTurn,
} from '@/lib/conversation/agentic-interview';
import type { FixedQuestion } from '@/lib/conversation/fixed-questions';

describe('agentic interview engine', () => {
  it('detects agentic delivery mode from question metadata', () => {
    const mode = detectDeliveryMode([
      {
        metadata: {
          kind: 'question',
          tag: 'triple_rating',
          index: 0,
          phase: 'people',
          deliveryMode: 'agentic',
        },
      },
    ]);

    expect(mode).toBe('agentic');
  });

  it('falls back to scripted when no delivery mode marker exists', () => {
    const mode = detectDeliveryMode([
      {
        metadata: {
          kind: 'question',
          tag: 'triple_rating',
          index: 0,
          phase: 'people',
        },
      },
    ]);

    expect(mode).toBe('scripted');
  });

  it('frames the commercial lens differently for commercial, operations, and product leaders', () => {
    const ccoGuidance = buildRoleGuidance('Chief Commercial Officer', 'Revenue', 'commercial').join(' ');
    const cooGuidance = buildRoleGuidance('Chief Operating Officer', 'Operations', 'commercial').join(' ');
    const cpoGuidance = buildRoleGuidance('Chief Product Officer', 'Product', 'commercial').join(' ');

    expect(ccoGuidance).toContain('ICP fit');
    expect(ccoGuidance).toContain('pipeline quality');

    expect(cooGuidance).toContain('support or constrain sales');
    expect(cooGuidance).toContain('promises made to customers');

    expect(cpoGuidance).toContain('roadmap choices');
    expect(cpoGuidance).toContain('market fit');
  });

  it('infers useful guidance for less obvious titles', () => {
    const strategyGuidance = buildRoleGuidance('VP Corporate Development', 'Strategy', 'commercial').join(' ');
    const peopleGuidance = buildRoleGuidance('Head of Talent', 'People', 'people').join(' ');
    const customerGuidance = buildRoleGuidance('Director of Customer Experience', 'Customer Experience', 'operations').join(' ');

    expect(strategyGuidance).toContain('market choices');
    expect(strategyGuidance).toContain('growth logic');

    expect(peopleGuidance).toContain('capability');
    expect(peopleGuidance).toContain('leadership behaviour');

    expect(customerGuidance).toContain('customer experience');
    expect(customerGuidance).toContain('onboarding');
  });

  it('compresses voice prompts more aggressively than text prompts', () => {
    const prompt = 'What are the two or three biggest reasons that the organisation struggles to turn demand into value consistently, and where does that show up most clearly in your day-to-day work with customers and internal teams?';

    const voice = compressPromptForMode(prompt, 'VOICE');
    const text = compressPromptForMode(prompt, 'TEXT');

    expect(voice.length).toBeLessThan(text.length);
    expect(voice.length).toBeLessThanOrEqual(160);
    expect(text.length).toBeLessThanOrEqual(220);
  });

  it('extracts today, target, and do-nothing scores from the opener answer', () => {
    // Scale is 1–5; values outside that range are rejected by parseScoreNearLabel.
    expect(
      extractTripleRatings('Today 2, target 5, if we do nothing 1'),
    ).toEqual({
      today: 2,
      target: 5,
      doNothing: 1,
    });
  });

  it('formats triple rating questions with explicit 1 to 5 instructions', () => {
    expect(
      formatTripleRatingPrompt('Across recent wins and losses, where is consistency today, where should it be, and where will it be if nothing changes?'),
    ).toContain('Please give me three scores from 1 to 5');
  });

  it('does not advance to the next lens immediately after the opener answer', async () => {
    const questionsByPhase: Record<string, FixedQuestion[]> = {
      people: [
        { text: 'People opener', tag: 'triple_rating' },
        { text: 'What helps you do your best work?', tag: 'strengths' },
        { text: 'Where do you feel unsupported?', tag: 'gaps' },
      ],
      operations: [
        { text: 'Operations opener', tag: 'triple_rating' },
      ],
      summary: [{ text: 'Thanks for your time.', tag: 'closing' }],
    };

    const turn = await generateAgenticTurn({
      openai: null as unknown as OpenAI | null,
      sessionStartedAt: new Date(Date.now() - 3 * 60 * 1000),
      currentPhase: 'people',
      phaseOrder: ['people', 'operations', 'summary'],
      questionsByPhase,
      sessionMessages: [
        {
          role: 'AI',
          content: 'People opener',
          phase: 'people',
          metadata: {
            kind: 'question',
            tag: 'triple_rating',
            index: 0,
            phase: 'people',
            deliveryMode: 'agentic',
          },
        },
        {
          role: 'PARTICIPANT',
          // 1–5 scale: bare-number extraction picks up 2, 5, 1 → today=2 (weak).
          // buildRatingsDrivenProbe checks today<=3 first, returning the weak-state probe.
          content:
            'Today feels like a 2, we need to be at a 5, and if we do nothing it probably drops to 1 because our teams work hard but capability and alignment are uneven.',
          phase: 'people',
        },
      ],
      workshopContext: 'Discovery for a services business.',
      workshopName: 'Demo Workshop',
      participantName: 'Alex',
      participantRole: 'Chief Operating Officer',
      participantDepartment: 'Operations',
      includeRegulation: false,
      preferredInteractionMode: 'VOICE',
    });

    expect(turn.nextPhase).toBe('people');
    expect(turn.metadata).toMatchObject({
      kind: 'question',
      phase: 'people',
      index: 1,
      deliveryMode: 'agentic',
    });
    // today=2 (<=3) → weak-state probe fires before ambition-gap check
    expect(turn.assistantMessage).toBe('What is the clearest sign in practice that this area is weaker than it needs to be?');
  });

  it('changes the first probe when the opener shows a weak current state and decline risk', async () => {
    const questionsByPhase: Record<string, FixedQuestion[]> = {
      commercial: [
        { text: 'Commercial opener', tag: 'triple_rating' },
        { text: 'What creates value today?', tag: 'strengths' },
      ],
      summary: [{ text: 'Thanks for your time.', tag: 'closing' }],
    };

    const turn = await generateAgenticTurn({
      openai: null as unknown as OpenAI | null,
      sessionStartedAt: new Date(Date.now() - 2 * 60 * 1000),
      currentPhase: 'commercial',
      phaseOrder: ['commercial', 'summary'],
      questionsByPhase,
      sessionMessages: [
        {
          role: 'AI',
          content: 'Commercial opener',
          phase: 'commercial',
          metadata: {
            kind: 'question',
            tag: 'triple_rating',
            index: 0,
            phase: 'commercial',
            deliveryMode: 'agentic',
          },
        },
        {
          role: 'PARTICIPANT',
          content: 'Today 2, target 8, if we do nothing 1. We are not winning the right work consistently.',
          phase: 'commercial',
        },
      ],
      workshopContext: 'Discovery for a B2B services business.',
      workshopName: 'Demo Workshop',
      participantName: 'Alex',
      participantRole: 'Chief Commercial Officer',
      participantDepartment: 'Revenue',
      includeRegulation: false,
      preferredInteractionMode: 'VOICE',
    });

    expect(turn.nextPhase).toBe('commercial');
    expect(turn.assistantMessage).toBe(
      'What is the clearest sign today that the commercial model is not working as it should?',
    );
  });

  it('advances to the next lens after sufficient coverage without calling a model', async () => {
    const questionsByPhase: Record<string, FixedQuestion[]> = {
      intro: [{ text: 'Intro opener', tag: 'context' }],
      people: [
        { text: 'People opener', tag: 'triple_rating' },
        { text: 'What helps you do your best work?', tag: 'strengths' },
      ],
      operations: [
        { text: 'Operations opener', tag: 'triple_rating' },
        { text: 'Where is the biggest workflow friction?', tag: 'friction' },
      ],
      prioritization: [{ text: 'Which area matters most?', tag: 'high_impact' }],
      summary: [{ text: 'Thanks for your time.', tag: 'closing' }],
    };

    const turn = await generateAgenticTurn({
      openai: null as unknown as OpenAI | null,
      sessionStartedAt: new Date(Date.now() - 10 * 60 * 1000),
      currentPhase: 'people',
      phaseOrder: ['intro', 'people', 'operations', 'prioritization', 'summary'],
      questionsByPhase,
      sessionMessages: [
        {
          role: 'AI',
          content: 'People opener',
          phase: 'people',
          metadata: {
            kind: 'question',
            tag: 'triple_rating',
            index: 0,
            phase: 'people',
            deliveryMode: 'agentic',
          },
        },
        {
          role: 'PARTICIPANT',
          content:
            'Current 6, target 8, projected 4. We have decent people but the handoffs between teams and capability gaps slow us down regularly. In practice that means commercial, operations, and service teams all define success differently, approvals come late, ownership is often ambiguous, and the work gets re-explained several times before anything moves. The effect is slower response, weaker confidence, and too much effort spent chasing alignment instead of delivering value.',
          phase: 'people',
        },
        {
          role: 'AI',
          content: 'What helps you do your best work?',
          phase: 'people',
          metadata: {
            kind: 'question',
            tag: 'strengths',
            index: 1,
            phase: 'people',
            deliveryMode: 'agentic',
          },
        },
        {
          role: 'PARTICIPANT',
          content:
            'Clear goals and fast access to decision makers help. The biggest gap is cross-functional coordination and uneven support from tools and process. When goals are explicit and leaders make tradeoffs quickly, teams collaborate well and problems get solved. When they do not, people protect their own area, work queues build, escalations multiply, and the customer experience becomes inconsistent because nobody feels accountable for the whole flow.',
          phase: 'people',
        },
        {
          role: 'AI',
          content: 'What should change most in how teams work together?',
          phase: 'people',
          metadata: {
            kind: 'question',
            tag: 'future',
            index: 2,
            phase: 'people',
            deliveryMode: 'agentic',
          },
        },
        {
          role: 'PARTICIPANT',
          content:
            'We need much clearer ownership between teams, faster decisions, and stronger support between operations and the commercial side so the service model can actually keep up with what is being sold. Right now the organisation can promise outcomes faster than it can consistently deliver them, and that creates strain on frontline teams, avoidable friction between functions, and a gap between strategic ambition and operational reality.',
          phase: 'people',
        },
      ],
      workshopContext: 'Discovery for a services business.',
      workshopName: 'Demo Workshop',
      participantName: 'Alex',
      participantRole: 'Chief Operating Officer',
      participantDepartment: 'Operations',
      includeRegulation: false,
      preferredInteractionMode: 'VOICE',
    });

    expect(turn.nextPhase).toBe('operations');
    expect(turn.assistantMessage).toBe(
      "When looking specifically at Operations, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation's operating model, processes, and decision flow help you do your job\n\nPlease give me three scores from 1 to 5: where things are today, where they should be, and where they will be if nothing changes.",
    );
    expect(turn.metadata).toMatchObject({
      kind: 'question',
      tag: 'triple_rating',
      index: 0,
      phase: 'operations',
      deliveryMode: 'agentic',
    });
  });
});

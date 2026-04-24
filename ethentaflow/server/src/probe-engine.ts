// Probe engine - speculative and synchronous probe generation.

import Anthropic from '@anthropic-ai/sdk';
import type { ConversationState, ProbeCandidate, ProbeStrategy, SignalType } from './types.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, '..', '..', 'prompts', 'probe-generator.md');

function loadSystemPrompt(): string {
  const md = readFileSync(PROMPT_PATH, 'utf-8');
  const match = md.match(/## System prompt\s*```([\s\S]*?)```/);
  if (!match) throw new Error('Could not parse system prompt from probe-generator.md');
  return match[1].trim();
}

const SYSTEM_PROMPT = loadSystemPrompt();

// Fallback templates keyed by signal + strategy-bucket
const FALLBACK_PROBES: Record<SignalType, { drill: string; example: string }> = {
  people_issue: {
    drill: "What specifically about the team isn't working?",
    example: "Can you walk me through a recent moment when that became obvious?",
  },
  growth_goal: {
    drill: "What does that growth actually look like in numbers?",
    example: "What's the biggest single thing standing between you and that number?",
  },
  icp_definition: {
    drill: "Who buys from you most consistently, and why them?",
    example: "Can you walk me through your last two or three closed deals?",
  },
  channel_problem: {
    drill: "Where exactly does the lead flow break down?",
    example: "What did the last month of pipeline actually look like?",
  },
  constraint: {
    drill: "What's actually blocking it, in concrete terms?",
    example: "When did you last hit that block, and what happened?",
  },
  partnership: {
    drill: "What would a good partner actually deliver for you?",
    example: "Which partnership has worked best for you, and what made it work?",
  },
  tech_gap: {
    drill: "Which part of the stack is the real bottleneck?",
    example: "Can you walk me through a workflow that breaks today?",
  },
  operational_friction: {
    drill: "Where does the handoff actually fall over?",
    example: "What happened the last time that process went wrong?",
  },
  commercial_model: {
    drill: "What about the commercial model isn't landing?",
    example: "Can you tell me about a deal where the pricing became the issue?",
  },
  market_position: {
    drill: "Who do you actually lose to, and why?",
    example: "What was the last deal you lost to a competitor, and what did you hear?",
  },
};

const OPENER_FILLER_RE = /^(great|interesting|i see|okay|ok|so|right|well|alright|perfect|thanks|hmm|mhm|yeah),?\s/i;

// Confusion detection — things people say when they don't understand what this conversation is
const CONFUSION_RE = /\b(i don'?t (know|understand|get it)|what (is this|are you talking|'?s this)|i have no idea|confused|huh|sorry\??|not sure what|what do you mean|what('?s| is) (going on|happening)|i('?m| am) lost)\b/i;

/** Returns true if this utterance signals the participant is confused or disengaged */
export function isConfused(text: string): boolean {
  if (!text.trim()) return true;
  const words = text.trim().split(/\s+/);
  if (words.length <= 3) return true; // too short to be substantive
  return CONFUSION_RE.test(text);
}

/** Extract a first name from a natural response like "I'm Andrew" / "Andrew Hall" / "My name is Sarah" */
export function extractName(utterance: string): string | null {
  const t = utterance.trim().replace(/[.,!?]+$/, '');
  // Strip common preambles
  const stripped = t
    .replace(/^(my name is|i'?m|i am|it'?s|they call me|people call me|call me)\s+/i, '')
    .trim();
  if (!stripped) return null;
  // Take first 1-2 words that start with a capital or are short proper nouns
  const words = stripped.split(/\s+/).slice(0, 2);
  const name = words.join(' ');
  // Sanity: at least 2 chars, not a common non-name word
  if (name.length < 2) return null;
  const nonNames = /^(yes|no|sure|fine|okay|ok|hi|hey|hello|good|great|well|um|uh)$/i;
  if (nonNames.test(words[0])) return null;
  // Capitalise first letter of each word
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

/** Returns true if the utterance is a positive consent (yes, sure, fine, of course…) */
export function isConsentYes(utterance: string): boolean {
  return /\b(yes|yeah|yep|sure|fine|of course|absolutely|go ahead|that'?s fine|no problem|happy to|ok|okay)\b/i.test(utterance);
}

// Onboarding questions — spoken in sequence before GTM discovery begins
export const ONBOARDING_WELCOME =
  "Welcome to DREAM. I am Dream Flow, here to have a conversation with you about you and your business. Before we dive in, could I ask — what's your name?";

export const ONBOARDING_ASK_CONSENT = (name: string) =>
  `Lovely to meet you, ${name}. Are you happy for me to use your name during our conversation?`;

export const ONBOARDING_ASK_JOB_TITLE = (name: string | null, consented: boolean) =>
  consented && name
    ? `Thanks ${name}. And what's your job title?`
    : "No problem at all. What's your job title?";

export const ONBOARDING_ASK_LOVES_JOB = (title: string) =>
  `${title} — brilliant. What do you love most about your work?`;

export const ONBOARDING_ASK_FRUSTRATIONS = (name: string | null, consented: boolean) => {
  const address = consented && name ? `, ${name}` : '';
  return `That's great to hear. And what frustrates you about it${address}? What gets in the way?`;
};

export const ONBOARDING_TRANSITION =
  "I really appreciate you sharing that. Now, let's talk about the bigger picture of your business. What's the biggest challenge you're trying to solve right now?";

// Hardcoded opening and reorient probes — fast, no LLM needed
const OPENING_PROBE = ONBOARDING_WELCOME;

const REORIENT_PROBES = [
  "Let me give you some context. I'm Dream Flow, and I'm here to understand the commercial side of your business — things like customers, growth, the team, what's blocking you. Think of it as a structured thinking session. To kick things off: what's one thing that's not working the way it should be?",
  "I realise I jumped in without much context. I'm Dream Flow, and I'm here to help think through your business challenges — growth, customers, the team, whatever's front of mind. Don't overthink it. What's the thing that's keeping you up at night right now?",
  "Let's slow down. Dream Flow is here to understand what's actually difficult in your business. It might be customers, hiring, revenue, competition — anything you'd want to get clearer on. What would be most useful to dig into today?",
];

const ENCOURAGE_PROBES = [
  "There's no wrong answer here. Even if things feel fine, there's usually one area that could be sharper. What comes to mind?",
  "Take your time. What's one area of your business where you'd love to have more clarity or confidence?",
  "If you had to pick one thing to fix or figure out by the end of the year, what would it be?",
];

export class ProbeEngine {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /** Get the hardcoded opening probe text (no LLM needed). */
  getOpeningProbe(): string { return OPENING_PROBE; }

  /** Get a reorient probe for the given confusion count (0-indexed). */
  getReorientProbe(confusionCount: number): string {
    return REORIENT_PROBES[Math.min(confusionCount, REORIENT_PROBES.length - 1)];
  }

  /** Get an encourage probe for stubborn silence/short responses. */
  getEncourageProbe(confusionCount: number): string {
    return ENCOURAGE_PROBES[Math.min(confusionCount, ENCOURAGE_PROBES.length - 1)];
  }

  async generate(state: ConversationState, strategy: ProbeStrategy, mode: 'speculative' | 'sync'): Promise<ProbeCandidate> {
    const startedAt = Date.now();
    const triggerUtterance = state.liveUtterance || state.turns[state.turns.length - 1]?.finalTranscript || '';

    // Opening/reorient/encourage strategies use hardcoded text — no LLM
    if (strategy === 'open_context') {
      return { text: OPENING_PROBE, targetSignal: null, strategy, generatedBy: 'template_fallback', tokenLatencyMs: 0, generatedAt: Date.now(), triggerUtterance };
    }

    try {
      const text = await this.callHaiku(state, strategy, mode === 'sync' ? 800 : 3000);
      const validated = this.validate(text);
      if (validated) {
        return {
          text: validated,
          targetSignal: state.currentSignal?.type ?? null,
          strategy,
          generatedBy: mode === 'sync' ? 'haiku_sync' : 'haiku_speculative',
          tokenLatencyMs: Date.now() - startedAt,
          generatedAt: Date.now(),
          triggerUtterance,
        };
      }
    } catch (err) {
      console.error('probe generation failed, using fallback', err);
    }

    // Fallback
    const fallback = this.fallbackProbe(state.currentSignal?.type ?? 'constraint', strategy);
    return {
      text: fallback,
      targetSignal: state.currentSignal?.type ?? null,
      strategy,
      generatedBy: 'template_fallback',
      tokenLatencyMs: Date.now() - startedAt,
      generatedAt: Date.now(),
      triggerUtterance,
    };
  }

  private async callHaiku(state: ConversationState, strategy: ProbeStrategy, timeoutMs: number): Promise<string> {
    const history = state.turns.slice(-4)
      .map(t => `${t.speaker === 'user' ? 'User' : 'System'}: ${t.finalTranscript}`)
      .join('\n') || '(none)';
    const userMessage = [
      `Current lens: ${state.currentLens}`,
      `Current primary signal: ${state.currentSignal?.type ?? 'none'}`,
      `Current depth score: ${state.depthScore}`,
      `Example provided: ${state.exampleProvided}`,
      `Strategy to apply: ${strategy}`,
      '',
      'Recent conversation history (most recent last):',
      history,
      '',
      `User's latest utterance (may be mid-sentence for speculative generation):`,
      `"${state.liveUtterance || state.turns[state.turns.length - 1]?.finalTranscript || ''}"`,
      '',
      'Generate ONE probe following the strategy above. Return only the probe text.',
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }, { signal: controller.signal });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Returns validated probe text or null if invalid. */
  private validate(raw: string): string | null {
    let text = raw.trim();

    // Strip wrapping quotes if any
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1).trim();
    }

    // Must end with a question mark
    if (!text.endsWith('?')) return null;

    // Exactly one question mark
    const qmCount = (text.match(/\?/g) || []).length;
    if (qmCount !== 1) return null;

    // No filler opening
    if (OPENER_FILLER_RE.test(text)) return null;

    // Word count
    const words = text.split(/\s+/);
    if (words.length < 6 || words.length > 22) return null;

    // No em dash or en dash (Andrew's preference)
    if (text.includes('—') || text.includes('–')) return null;

    return text;
  }

  private fallbackProbe(signal: SignalType | null, strategy: ProbeStrategy): string {
    const key = signal ?? 'constraint';
    const bucket = strategy === 'request_example' ? 'example' : 'drill';
    return FALLBACK_PROBES[key][bucket];
  }
}

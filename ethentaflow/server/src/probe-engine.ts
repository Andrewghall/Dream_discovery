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

export class ProbeEngine {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(state: ConversationState, strategy: ProbeStrategy, mode: 'speculative' | 'sync'): Promise<ProbeCandidate> {
    const startedAt = Date.now();
    const triggerUtterance = state.liveUtterance || state.turns[state.turns.length - 1]?.finalTranscript || '';

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

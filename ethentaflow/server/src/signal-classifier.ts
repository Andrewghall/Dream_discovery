// Signal classifier - Haiku on partials.
// Debounced: one in-flight per session.

import OpenAI from 'openai';
import type { Signal, SignalType, ConversationState } from './types.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, '..', '..', 'prompts', 'signal-classifier.md');

// Extract the system prompt block from the markdown
function loadSystemPrompt(): string {
  const md = readFileSync(PROMPT_PATH, 'utf-8');
  // Pull the first ``` ... ``` block after "## System prompt"
  const match = md.match(/## System prompt\s*```([\s\S]*?)```/);
  if (!match) throw new Error('Could not parse system prompt from signal-classifier.md');
  return match[1].trim();
}

const SYSTEM_PROMPT = loadSystemPrompt();

export class SignalClassifier {
  private client: OpenAI;
  private inFlight = false;
  private pendingUtterance: string | null = null;
  private lastTriggerLength = 0;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /** Classify an utterance. Debounced: discards intermediate calls if one in flight. */
  async classify(
    state: ConversationState,
    onResult: (signals: Signal[], triggerUtterance: string) => void,
  ): Promise<void> {
    const utterance = state.liveUtterance;

    // Skip if we classified this exact utterance or very close to it
    if (utterance.length - this.lastTriggerLength < 3) return;

    if (this.inFlight) {
      this.pendingUtterance = utterance;
      return;
    }

    this.inFlight = true;
    this.lastTriggerLength = utterance.length;

    try {
      const signals = await this.callHaiku(state, utterance);
      onResult(signals, utterance);
    } catch (err) {
      console.error('signal classifier error', err);
    } finally {
      this.inFlight = false;
      // Process any queued utterance
      if (this.pendingUtterance && this.pendingUtterance !== utterance) {
        const nextUtterance = this.pendingUtterance;
        this.pendingUtterance = null;
        // Recursively classify the queued one
        const nextState = { ...state, liveUtterance: nextUtterance };
        this.classify(nextState, onResult);
      }
    }
  }

  private async callHaiku(state: ConversationState, utterance: string): Promise<Signal[]> {
    const history = this.formatHistory(state);
    const userMessage = `Recent conversation history (most recent last):\n${history}\n\nCurrent utterance (may be incomplete):\n"${utterance}"\n\nReturn JSON only.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';

    return this.parseSignals(text);
  }

  private parseSignals(raw: string): Signal[] {
    try {
      // Extract first JSON object
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed.signals)) return [];

      const now = Date.now();
      const signals: Signal[] = [];
      for (const s of parsed.signals) {
        if (!isValidSignalType(s.type)) continue;
        if (typeof s.confidence !== 'number') continue;
        if (s.confidence < 0.4) continue;
        signals.push({
          type: s.type,
          confidence: s.confidence,
          detectedAt: now,
          sourceSpan: typeof s.source_span === 'string' ? s.source_span : '',
        });
      }
      return signals;
    } catch {
      return [];
    }
  }

  private formatHistory(state: ConversationState): string {
    const recent = state.turns.slice(-3);
    if (recent.length === 0) return '(none)';
    return recent
      .map(t => `${t.speaker === 'user' ? 'User' : 'System'}: ${t.finalTranscript}`)
      .join('\n');
  }
}

const VALID_SIGNAL_TYPES: SignalType[] = [
  'people_issue', 'growth_goal', 'icp_definition', 'channel_problem',
  'constraint', 'partnership', 'tech_gap', 'operational_friction',
  'commercial_model', 'market_position'
];

function isValidSignalType(t: unknown): t is SignalType {
  return typeof t === 'string' && (VALID_SIGNAL_TYPES as string[]).includes(t);
}

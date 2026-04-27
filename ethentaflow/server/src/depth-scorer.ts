// Depth scorer - deterministic pre-check + Haiku fallback.
// See docs/06-depth-model.md.

import OpenAI from 'openai';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, '..', '..', 'prompts', 'depth-scorer.md');

function loadSystemPrompt(): string {
  const md = readFileSync(PROMPT_PATH, 'utf-8');
  const match = md.match(/## System prompt\s*```([\s\S]*?)```/);
  if (!match) throw new Error('Could not parse system prompt from depth-scorer.md');
  return match[1].trim();
}

const SYSTEM_PROMPT = loadSystemPrompt();

export interface DepthScore {
  depth: 0 | 1 | 2 | 3;
  exampleProvided: boolean;
  reasoning: string;
}

const EXAMPLE_MARKERS = [
  /\b(last|the other|recent(ly)?|yesterday|this (week|month|quarter|year))\b/i,
  /\bfor example\b/i,
  /\bfor instance\b/i,
  /\bwalked? (in|me) through\b/i,
  /\btook? (us|me) through\b/i,
  /\bthere was (this|a|one) (time|deal|moment|client|customer)\b/i,
];

function hasExampleMarker(text: string): boolean {
  return EXAMPLE_MARKERS.some(rx => rx.test(text));
}

function hasSpecificity(text: string): boolean {
  const hasNumber = /\b\d+([,.]\d+)?\s*(%|percent|k|m|million|thousand|quarters?|weeks?|months?|years?|days?|pounds?|dollars?|euros?)\b/i.test(text)
    || /£\d+/.test(text) || /\$\d+/.test(text) || /€\d+/.test(text);
  // Proper noun heuristic (rough): capitalised word that isn't at sentence start
  const hasProperNoun = /(?:\. |\? |! |, )[A-Z][a-z]{2,}\b/.test(text)
    || /^[A-Z][a-z]{2,}\s+[A-Z][a-z]+/.test(text);
  return hasNumber || hasProperNoun;
}

export function preCheckDepth(turnText: string):
  | { depth: 0 | 1 | 2 | 3; exampleProvided: boolean; reasoning: string }
  | { depth: 'ambiguous'; exampleProvided: boolean } {
  const text = turnText.trim();
  const words = text.split(/\s+/);

  if (words.length < 4) {
    return { depth: 0, exampleProvided: false, reasoning: 'too short' };
  }

  const exampleMarker = hasExampleMarker(text);
  const specificity = hasSpecificity(text);

  if (exampleMarker && specificity) {
    return { depth: 3, exampleProvided: true, reasoning: 'example + specificity' };
  }

  if (specificity && !exampleMarker) {
    return { depth: 2, exampleProvided: false, reasoning: 'specificity without example' };
  }

  if (exampleMarker) {
    return { depth: 'ambiguous', exampleProvided: true };
  }

  return { depth: 'ambiguous', exampleProvided: false };
}

export class DepthScorer {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async score(turnText: string, currentSignal: string | null, lastProbe: string | null): Promise<DepthScore> {
    const pre = preCheckDepth(turnText);
    if (pre.depth !== 'ambiguous') {
      return {
        depth: pre.depth,
        exampleProvided: pre.exampleProvided,
        reasoning: pre.reasoning,
      };
    }

    // LLM fallback
    try {
      return await this.callHaiku(turnText, currentSignal, lastProbe);
    } catch (err) {
      console.error('depth scorer LLM fallback failed', err);
      return { depth: 1, exampleProvided: pre.exampleProvided, reasoning: 'llm fallback error' };
    }
  }

  private async callHaiku(turnText: string, currentSignal: string | null, lastProbe: string | null): Promise<DepthScore> {
    const userMessage = [
      `Signal being drilled: ${currentSignal ?? 'none'}`,
      '',
      'Most recent probe asked:',
      `"${lastProbe ?? '(opening)'}"`,
      '',
      `User's answer:`,
      `"${turnText}"`,
      '',
      'Score this answer. Return JSON only.',
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }, { signal: controller.signal });

      const text = response.choices[0]?.message?.content ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('no JSON in response');
      const parsed = JSON.parse(match[0]);

      const depth = Number(parsed.depth);
      if (![0, 1, 2, 3].includes(depth)) throw new Error('invalid depth');

      return {
        depth: depth as 0 | 1 | 2 | 3,
        exampleProvided: Boolean(parsed.example_provided),
        reasoning: String(parsed.reasoning ?? ''),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

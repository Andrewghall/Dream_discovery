// Probe engine - speculative and synchronous probe generation.

import OpenAI from 'openai';
import type { ConversationState, EndpointingMode, ExpectedAnswerType, Lens, MaturityRating, ProbeCandidate, ProbeStrategy, SignalType } from './types.js';
import { DEFAULT_LENS_SEQUENCE } from './lens-controller.js';
import { getLensFramework } from './framework.js';
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

// FALLBACK_PROBES (generic signal×strategy table) removed — the static canned text
// produced the same strings every time the LLM timed out, breaking immersion.
// Fallbacks are now built dynamically in fallbackProbe() using the participant's
// own last utterance so they never repeat verbatim and always stay grounded.

// Fallback templates for challenge/steer — keyed by lens
// Derived from each lens's probe_patterns, grounded in deal reality.
const CHALLENGE_FALLBACKS: Partial<Record<Lens, string>> = {
  people: "You've described the team but haven't given me a real example yet. Walk me through a loss where how someone behaved actually cost you the deal.",
  operations: "You've talked about delivery but I'm not hearing a specific case. Tell me about a deal where execution broke down after the sale.",
  technology: "You've described capability but nothing proven in a deal. Where have competitors actually called out a gap in front of a buyer?",
  commercial: "You've described your market but I'm not hearing what makes the difference. Walk me through a recent win and what that buyer was actually paying for.",
  risk_compliance: "You've mentioned risk but not when it actually hits. Tell me about a deal that collapsed under procurement or compliance pressure.",
  partners: "You've described your partner relationships but not what they do in live deals. Walk me through a win that a partner actually enabled.",
};

const STEER_FALLBACKS: Partial<Record<Lens, string>> = {
  people: "We haven't looked at where behaviour creates or destroys trust in real deals yet. Walk me through a recent win where someone on your team made the real difference.",
  operations: "We haven't looked at where delivery limits what you can actually sell. Which types of work become unstable once you're into delivery?",
  technology: "We haven't looked at where tech credibility is tested in live deals. Walk me through a win where the technology you demonstrated was a real factor.",
  commercial: "We haven't looked at the pattern in your wins yet. Walk me through what your last two or three wins actually had in common.",
  risk_compliance: "We haven't looked at where risk surfaces in deals. Walk me through a situation where risk or compliance pressure came in and reshaped the outcome.",
  partners: "We haven't looked at what partners actually do in your live deals. Tell me about a win that couldn't have happened without a specific partner.",
};

// Sideways pivot fallbacks — used when a thread has been drilled 3+ times.
// These open a different angle within the same lens without announcing a section change.
const SIDEWAYS_FALLBACKS: Partial<Record<Lens, string[]>> = {
  people: [
    "Let me look at this from a different angle. Where does inconsistency in your people actually show up in front of a buyer?",
    "Staying with people, where do you see the biggest gap between your strongest and weakest performer in a live deal?",
    "That gives me the talent picture. Where does leadership behaviour specifically change the outcome in a deal?",
  ],
  operations: [
    "Let me take that in a different direction. Where does the gap between what you sell and what you deliver actually surface?",
    "Staying with operations, which types of engagement become fragile once you're three months into delivery?",
    "That explains the delivery side. Where do your processes specifically limit what you can credibly commit to in a deal?",
  ],
  technology: [
    "Let me look at a different part of the technology picture. Where have you had to ask a buyer to trust capability you haven't fully proven yet?",
    "Staying with technology, where does the gap between your roadmap and your live demonstration actually matter to a buyer?",
    "That covers what you can show. Where have competitors exposed a gap in front of your buyers?",
  ],
  commercial: [
    "Let me go sideways for a moment. When you look at your losses, what do they have in common?",
    "Staying with commercial positioning, who are you actually losing to and why?",
    "That covers the wins side. Where are you still chasing work you shouldn't be pursuing?",
  ],
  risk_compliance: [
    "Let me look at a different angle here. Where does risk surface too late and catch you off guard in a deal?",
    "Staying with risk, where does compliance pressure specifically change what you can offer or how fast you can move?",
    "That covers the risk you manage. Where is risk actually protecting you from bad work?",
  ],
  partners: [
    "Let me look at a different part of the partner picture. Where does partner dependency create risk for you in a live deal?",
    "Staying with partners, which relationships exist on paper but don't actually perform when you need them?",
    "That covers your strongest partnerships. Where are you over-reliant on a partner who isn't fully committed?",
  ],
};

// Generation-sequence fallbacks — sharp, executive-grade, anchored to the 1-5 rating gap.
const GAP_PROBE_FALLBACKS: Partial<Record<Lens, string>> = {
  people:          "Why are you at that score and not a 5? What's specifically missing?",
  operations:      "What's stopping delivery from being a genuine differentiator right now?",
  technology:      "Where does your technology actually fall short in front of a real buyer?",
  commercial:      "Why isn't commercial positioning converting more of the right deals?",
  risk_compliance: "Where does risk actually slow or kill a deal for you?",
  partners:        "Why aren't your partners delivering more in live deals?",
};

const EVIDENCE_PROBE_FALLBACKS: Partial<Record<Lens, string>> = {
  people:          "Give me a real deal where a people gap cost you.",
  operations:      "Walk me through a delivery failure that hurt a client outcome.",
  technology:      "Which deal did you lose because of a technology credibility gap?",
  commercial:      "Tell me about the last deal you lost that you should have won.",
  risk_compliance: "Give me a deal where risk or compliance reshaped the outcome.",
  partners:        "Which deal couldn't have happened without a specific partner?",
};

const BARRIER_PROBE_FALLBACKS: Partial<Record<Lens, string>> = {
  people:          "What's actually blocking capability improvement — hiring, coaching, or leadership?",
  operations:      "What's the root cause of the delivery gap — process, ownership, or scale?",
  technology:      "What would actually close the technology credibility gap?",
  commercial:      "What's stopping you from targeting better-fit deals consistently?",
  risk_compliance: "What would it take to get ahead of risk earlier in the sales cycle?",
  partners:        "What would a genuinely committed partner actually look like?",
};

const IMPACT_PROBE_FALLBACKS: Partial<Record<Lens, string>> = {
  people:          "What has that capability gap actually cost — deals, margin, or client trust?",
  operations:      "What has the delivery gap cost you in real terms — relationships, margin, or pipeline?",
  technology:      "What has the technology gap cost — deals lost, risk taken on, or credibility damaged?",
  commercial:      "What are the wrong deals costing you — time, margin, or opportunity?",
  risk_compliance: "What has a late risk discovery actually cost in deal terms?",
  partners:        "What has poor partner performance cost in real deals?",
};

const OPENER_FILLER_RE = /^(great|interesting|i see|okay|ok|so|right|well|alright|perfect|thanks|hmm|mhm|yeah),?\s/i;

/** Derive the endpointing lane from the probe strategy. GTM probes are always long_thought. */
function laneForStrategy(strategy: ProbeStrategy): { endpointingMode: EndpointingMode; expectedAnswerType: ExpectedAnswerType } {
  switch (strategy) {
    case 'onboarding':
      return { endpointingMode: 'normal', expectedAnswerType: 'bounded_fact' };
    case 'reorient':
    case 'encourage':
      return { endpointingMode: 'normal', expectedAnswerType: 'open_explanation' };
    case 'measure':
    case 'challenge':
    case 'steer':
    case 'sideways':
    case 'gap_probe':
    case 'evidence_probe':
    case 'barrier_probe':
    case 'impact_probe':
    case 'close':
      return { endpointingMode: 'long_thought', expectedAnswerType: 'open_explanation' };
    default:
      return { endpointingMode: 'long_thought', expectedAnswerType: 'open_explanation' };
  }
}

// Confusion detection — things people say when they don't understand what this conversation is
const CONFUSION_RE = /\b(i don'?t (know|understand|get it)|what (is this|are you talking|'?s this)|i have no idea|confused|not sure what|what do you mean|what('?s| is) (going on|happening)|i('?m| am) lost)\b/i;

// Short utterances that signal readiness or clear intent — NOT confusion, even though they're brief
const READY_RE = /^(yes|yeah|no|nope|sure|ok|okay|right|ready|go|let'?s go|go ahead|start|begin|let'?s start|fire away|yep|absolutely|sounds good|good|perfect|fine|got it|understood|clear|makes sense|makes sense to me|i'?m? ready)[\s.,!]*$/i;

/** Returns true if this utterance signals the participant is confused or disengaged.
 *  Short but clear affirmatives/readiness phrases are NOT confusion. */
export function isConfused(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Short readiness/affirmative signals are clear, not confused
  if (READY_RE.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  // Very short utterances that aren't clear affirmatives — treat as confusion/noise
  if (words.length <= 2) return true;
  return CONFUSION_RE.test(text);
}


// Human-readable labels for each lens (spoken, not shown as IDs)
const LENS_SPOKEN_LABELS: Record<Exclude<Lens, 'open'>, string> = {
  people:           'people and capability',
  operations:       'operations and delivery',
  technology:       'technology credibility',
  commercial:       'commercial positioning',
  customer:         'customer relationships',
  risk_compliance:  'risk and compliance',
  partners:         'partner relationships',
};

function formatLensListForSpeech(lenses: Exclude<Lens, 'open'>[]): string {
  const labels = lenses.map(l => LENS_SPOKEN_LABELS[l]);
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  const last = labels[labels.length - 1];
  const rest = labels.slice(0, -1).join(', ');
  return `${rest} and ${last}`;
}

/**
 * Build the opening welcome with a clear structural frame.
 * The participant hears exactly what the session covers so they know
 * it's a focused diagnostic, not an open-ended chat.
 */
export function buildWelcome(name?: string, lenses: Exclude<Lens, 'open'>[] = DEFAULT_LENS_SEQUENCE): string {
  const lensCount = lenses.length;
  const lensListText = formatLensListForSpeech(lenses);
  const firstName = name?.split(' ')[0] ?? name;
  const greeting = firstName ? `Hi ${firstName}` : 'Hi';
  const countWord = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'][lensCount] ?? String(lensCount);
  return `${greeting}, thanks for joining. This session runs twenty to thirty minutes. We're going to work through ${countWord} areas — ${lensListText}. For each one, we'll look at where things genuinely stand today, where they need to get to, and what's actually getting in the way. We'll use your real wins, losses, and live deals as the evidence, not just opinions. Any questions before we get into it?`;
}

export const ONBOARDING_WELCOME = buildWelcome();

// Hardcoded opening and reorient probes — fast, no LLM needed
const OPENING_PROBE = ONBOARDING_WELCOME;

const REORIENT_PROBES = [
  "Let me give you a bit of context. I'm here to understand the commercial side of your business and explore where the real challenges are. Think of it as a structured thinking session. What's one thing that isn't working the way it should be?",
  "Let me step back. I'm here to help you think through your business challenges and figure out where the real leverage is. Don't overthink it. What's keeping you up at night right now?",
  "Let's slow down. This session is about understanding what's actually hard in your business and figuring out what's worth digging into. What would be most useful to explore today?",
];

const ENCOURAGE_PROBES = [
  "There's no wrong answer here. Even if things feel fine, there's usually one area that could be sharper. What comes to mind?",
  "Take your time. What's one area of your business where you'd love to have more clarity or confidence?",
  "If you had to pick one thing to fix or figure out by the end of the year, what would it be?",
];

export class ProbeEngine {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
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

  async generate(state: ConversationState, strategy: ProbeStrategy, mode: 'speculative' | 'sync', elapsedMinutes = 0, maturityRating?: MaturityRating): Promise<ProbeCandidate> {
    const startedAt = Date.now();
    const triggerUtterance = state.liveUtterance || state.turns[state.turns.length - 1]?.finalTranscript || '';

    // Opening/reorient/encourage strategies use hardcoded text — no LLM
    if (strategy === 'open_context') {
      const lane = laneForStrategy(strategy);
      return { text: OPENING_PROBE, targetSignal: null, strategy, generatedBy: 'template_fallback', tokenLatencyMs: 0, generatedAt: Date.now(), triggerUtterance, ...lane };
    }

    const lane = laneForStrategy(strategy);

    try {
      const text = await this.callHaiku(state, strategy, mode === 'sync' ? 1500 : 3000, elapsedMinutes, maturityRating);
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
          ...lane,
        };
      }
    } catch (err) {
      console.error('probe generation failed, using fallback', err);
    }

    // Fallback — pass the trigger utterance so the fallback can anchor to the
    // participant's own words instead of firing static canned text.
    const fallback = this.fallbackProbe(state.currentSignal?.type ?? 'constraint', strategy, state.currentLens, triggerUtterance);
    return {
      text: fallback,
      targetSignal: state.currentSignal?.type ?? null,
      strategy,
      generatedBy: 'template_fallback',
      tokenLatencyMs: Date.now() - startedAt,
      generatedAt: Date.now(),
      triggerUtterance,
      ...lane,
    };
  }

  private async callHaiku(state: ConversationState, strategy: ProbeStrategy, timeoutMs: number, elapsedMinutes = 0, maturityRating?: MaturityRating): Promise<string> {
    const history = state.turns.slice(-4)
      .map(t => `${t.speaker === 'user' ? 'User' : 'System'}: ${t.finalTranscript}`)
      .join('\n') || '(none)';

    const timingLine = elapsedMinutes >= 22
      ? `Session timing: ${Math.round(elapsedMinutes)} minutes elapsed. Session ends at 20-30 min. Start bridging toward a close — prioritise depth on what's already been raised rather than opening new topics.`
      : elapsedMinutes >= 18
      ? `Session timing: ${Math.round(elapsedMinutes)} minutes elapsed. We're in the final stretch. Focus on the most important thread still open.`
      : '';

    const ratingLine = maturityRating
      ? `Current maturity rating: ${maturityRating.current}/5 (target: ${maturityRating.target}/5, trajectory: ${maturityRating.trajectory})`
      : '';

    const lensCtx = getLensFramework(state.currentLens);
    const lensContextLines: string[] = [];
    if (lensCtx) {
      lensContextLines.push(
        'Interrogation intent for this lens:',
        ...lensCtx.interrogationIntent.map(i => `- ${i}`),
        '',
        'Probe patterns to draw from (pick the most relevant given the conversation):',
        ...lensCtx.probePatterns.map(p => `- ${p}`),
        '',
        'What a strong answer looks like (evidence targets):',
        ...lensCtx.evidenceTargets.map(t => `- ${t}`),
        '',
        'When to keep pushing (failure signals present in user\'s last utterance):',
        ...lensCtx.failureSignals.map(s => `- ${s}`),
      );
    }

    const userMessage = [
      `Current lens: ${state.currentLens}`,
      `Current primary signal: ${state.currentSignal?.type ?? 'none'}`,
      `Current depth score: ${state.depthScore}`,
      `Example provided: ${state.exampleProvided}`,
      `Strategy to apply: ${strategy}`,
      ratingLine,
      timingLine,
      lensContextLines.length > 0 ? '' : null,
      ...lensContextLines,
      '',
      'Recent conversation history (most recent last):',
      history,
      '',
      `User's latest utterance (may be mid-sentence for speculative generation):`,
      `"${state.liveUtterance || state.turns[state.turns.length - 1]?.finalTranscript || ''}"`,
      '',
      'Generate ONE probe following the strategy above. Return only the probe text.',
    ].filter(line => line !== null && line !== undefined && line !== '').join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }, { signal: controller.signal });

      const text = (response.choices[0]?.message?.content ?? '').trim();
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

    // Word count — minimum 4 allows punchy probes like "Why hasn't that been fixed?"
    const words = text.split(/\s+/);
    if (words.length < 4 || words.length > 25) return null;

    // No em dash or en dash (Andrew's preference)
    if (text.includes('—') || text.includes('–')) return null;

    return text;
  }

  /**
   * Extract the most recent meaningful phrase from a participant utterance.
   * Used to anchor fallback probes in the participant's own language.
   * Returns a short quoted excerpt (5–8 words) or empty string if unavailable.
   */
  private static extractLastPhrase(utterance: string): string {
    const cleaned = utterance.trim().replace(/[.!?,;:]+$/, '');
    if (!cleaned) return '';
    const ws = cleaned.split(/\s+/);
    // Take last 5 words; skip if the utterance is too short to be meaningful
    if (ws.length < 4) return '';
    return ws.slice(-5).join(' ');
  }

  /**
   * Pick variant index deterministically from the trigger utterance so the
   * same participant phrase always produces the same fallback (consistent), but
   * different utterances rotate through the variants (no repetition).
   */
  private static variantIndex(utterance: string, n: number): number {
    // Simple hash of character codes
    let h = 0;
    for (let i = 0; i < utterance.length; i++) h = (h * 31 + utterance.charCodeAt(i)) >>> 0;
    return h % n;
  }

  private fallbackProbe(signal: SignalType | null, strategy: ProbeStrategy, lens?: Lens, triggerUtterance = ''): string {
    const phrase = ProbeEngine.extractLastPhrase(triggerUtterance);
    const anchor = phrase ? `you mentioned "${phrase}"` : 'what you described';
    const vi = (variants: string[]) =>
      variants[ProbeEngine.variantIndex(triggerUtterance, variants.length)]!;

    if (strategy === 'challenge') {
      const lensKey = lens as Lens | undefined;
      const base = lensKey ? CHALLENGE_FALLBACKS[lensKey] : undefined;
      return base ?? vi([
        `${anchor.charAt(0).toUpperCase() + anchor.slice(1)}, but I haven't heard a real deal yet. Walk me through a loss where that actually cost you.`,
        `That's a pattern I'm hearing, but no example yet. Which specific deal did that show up in?`,
        `You've described it but I need evidence. Give me the last time that actually hurt a client outcome.`,
      ]);
    }

    if (strategy === 'steer') {
      const lensKey = lens as Lens | undefined;
      const base = lensKey ? STEER_FALLBACKS[lensKey] : undefined;
      return base ?? vi([
        `We haven't looked at where ${anchor} connects to real deal outcomes yet. Where does it surface?`,
        `There's ground we haven't covered. Where does ${anchor} actually show up in front of a buyer?`,
        `Let me push into a different angle. What specifically hasn't come up that should?`,
      ]);
    }

    if (strategy === 'sideways') {
      const lensKey = lens as Lens | undefined;
      const options = lensKey ? SIDEWAYS_FALLBACKS[lensKey] : undefined;
      if (options && options.length > 0) {
        return options[ProbeEngine.variantIndex(triggerUtterance, options.length)]!;
      }
      return vi([
        `Let me take that in a different direction. What's the angle on this we haven't looked at?`,
        `Staying in this space, what's the part of the story that hasn't come up yet?`,
        `Different angle — where does ${anchor} create the most friction in practice?`,
      ]);
    }

    if (strategy === 'gap_probe') {
      const lensKey = lens as Lens | undefined;
      const base = lensKey ? GAP_PROBE_FALLBACKS[lensKey] : undefined;
      return base ?? vi([
        `Why are you at that score and not a 5? What's specifically missing?`,
        `${anchor.charAt(0).toUpperCase() + anchor.slice(1)} — what's actually holding that back from where it needs to be?`,
        `That gap exists for a reason. What's the real constraint preventing progress?`,
      ]);
    }

    if (strategy === 'evidence_probe') {
      const lensKey = lens as Lens | undefined;
      const base = lensKey ? EVIDENCE_PROBE_FALLBACKS[lensKey] : undefined;
      return base ?? vi([
        `Give me a real deal where ${anchor} showed up.`,
        `Walk me through the last time ${anchor} actually cost you something.`,
        `Which specific deal does ${anchor} show up in most clearly?`,
      ]);
    }

    if (strategy === 'barrier_probe') {
      const lensKey = lens as Lens | undefined;
      const base = lensKey ? BARRIER_PROBE_FALLBACKS[lensKey] : undefined;
      return base ?? vi([
        `What's actually blocking it — is it process, people, or something structural?`,
        `Why hasn't ${anchor} been fixed? What's the real blocker?`,
        `What would have to change for ${anchor} to close?`,
      ]);
    }

    if (strategy === 'impact_probe') {
      const lensKey = lens as Lens | undefined;
      const base = lensKey ? IMPACT_PROBE_FALLBACKS[lensKey] : undefined;
      return base ?? vi([
        `What has ${anchor} actually cost — time, a deal, or client trust?`,
        `In real terms, what has that pattern cost you?`,
        `How much revenue has ${anchor} touched — roughly?`,
      ]);
    }

    // Generic drill/example fallback (replaces deleted FALLBACK_PROBES table)
    const isDrillStrategy = strategy !== 'request_example';
    return isDrillStrategy
      ? vi([
          `What specifically about ${anchor} isn't working the way it should?`,
          `Break that down for me — where exactly does ${anchor} fall over?`,
          `What's the clearest sign that ${anchor} is a real problem?`,
        ])
      : vi([
          `Walk me through a real moment when ${anchor} became obvious.`,
          `Give me a specific deal or situation where ${anchor} showed up.`,
          `When was the last time ${anchor} actually cost you something concrete?`,
        ]);
  }
}

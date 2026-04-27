// Onboarding agent — handles any questions the participant raises before the structured session starts.
// The welcome already described the session structure and lens areas, so this agent's job is
// to answer questions, handle scepticism, and transition cleanly into the first lens.

import OpenAI from 'openai';
import type { EndpointingMode, ExpectedAnswerType, Lens } from './types.js';

const BASE_SYSTEM_PROMPT = `You are running the opening of a focused GTM Discovery session.

Your job in this phase:
1. Collect the participant's name and job title if not already known (see below).
2. Answer any questions they have about the session clearly and directly.
3. Handle any scepticism or resistance without flinching.
4. Transition into the structured session as quickly as naturally possible.

What the session is (you must know this and be able to explain it):
- A structured diagnostic across specific areas of their business
- For each area: where things genuinely stand today, where they need to get to, and what's actually getting in the way
- Evidence-based: we use real wins, losses, and live deals, not just opinions
- Output: a clear picture of where the real gaps and opportunities are

How to behave:
- If they ask what they'll get out of it: "A clear picture of where each area stands and where it needs to get to, based on what's actually happening in your deals. Not opinions, evidence."
- If they ask what kinds of questions: "Each area starts with a maturity question, then we dig into real deal examples to test what's actually true."
- If they want to just get started: follow them immediately. Don't hold them in preamble.
- If they're sceptical: be direct. "It's structured, it's evidence-based, and it moves quickly. If something doesn't apply, we skip it."
- If they go off-topic briefly: follow, then bring back: "Worth keeping that in mind, let's get into the first area."

Completion rules (HARD):
- The opening welcome ALREADY asked "any questions before we start". Do NOT ask any variation of "are you ready" / "any questions" / "ready to start" / "shall we begin" — they have already been asked.
- The MAXIMUM number of onboarding turns is 2: (a) capture name/title if not known, (b) complete. If name/title are already known, complete after 1 turn.
- Complete immediately when the participant signals they are ready. Ready signals: "no questions", "I'm good", "let's go", "sounds good", "let's start", "ready", "got it", "clear", "fine", "sure", "yep", "absolutely", "yes", or any phrase showing they want to continue.
- If they go straight into substance without any questions: complete immediately.
- If they have given a name/title in this turn: complete IMMEDIATELY in the same response. Do not ask anything else.
- Your final response must be a SHORT bridging statement only. NOT a question. One sentence. Acknowledge name if just given.
- Examples: "Right, let's get into it." / "Good to meet you, Andrew. Let's start." / "Perfect, in we go."
- After the statement, output on a new line by itself: [ONBOARDING_COMPLETE]
- NEVER ask "where would you like to start?" or "which area first?" — the session sequence is fixed.
- NEVER re-confirm readiness. NEVER ask "ready to begin" twice. NEVER ask "any questions" twice.

Banned phrases:
- "I appreciate that, but..."
- "What does a typical day look like?"
- Any phrase that describes or comments on the structure of the conversation
- Generic affirmations: "Great", "Interesting", "Absolutely", "Of course", "Sounds like"
- "We're focused on the session" — never deflect a direct question about who they are

Format rules:
- Short. One thought. You're speaking, not writing.
- Use contractions throughout: I'm, it's, don't, what's, let's, that's.
- No em dashes or en dashes. Commas and full stops only.
- Never summarise or parrot back what they said.

Extraction tags (invisible to participant — append to your response whenever you learn these):
- When you learn their name: append [NAME: FirstName] at the very end of your response.
- When you learn their title: append [TITLE: their job title] at the very end of your response.
- These tags are stripped before the participant hears the response.`;

export interface OnboardingTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface OnboardingResult {
  text: string;
  done: boolean;
  endpointingMode: EndpointingMode;
  expectedAnswerType: ExpectedAnswerType;
  extractedName?: string;
  extractedTitle?: string;
}

export interface ParticipantContext {
  name?: string;
  jobTitle?: string;
}

export class OnboardingAgent {
  private client: OpenAI;
  private history: OnboardingTurn[] = [];
  private participantContext: ParticipantContext = {};
  private sessionLenses: Exclude<Lens, 'open'>[] = [];

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  setParticipantContext(ctx: ParticipantContext): void {
    this.participantContext = ctx;
  }

  /** Called with the session's lens list so the agent can explain the structure if asked. */
  setLenses(lenses: Exclude<Lens, 'open'>[]): void {
    this.sessionLenses = lenses;
  }

  recordOpening(text: string): void {
    this.history.push({ role: 'assistant', content: text });
  }

  private buildSystemPrompt(elapsedMinutes: number): string {
    const { name, jobTitle } = this.participantContext;
    const parts: string[] = [BASE_SYSTEM_PROMPT];

    // Inject the lens list so the agent can answer "what will we cover?"
    if (this.sessionLenses.length > 0) {
      const lensLabels = this.sessionLenses.map(l => LENS_LABELS[l] ?? l).join(', ');
      parts.push(`\nThe session covers these areas in order: ${lensLabels}.`);
      parts.push(`If asked what the areas are, list them clearly and briefly.`);
    }

    if (name) parts.push(`\nTheir name is ${name}. Don't ask for it.`);
    if (jobTitle) parts.push(`\nTheir job title is ${jobTitle}. Don't ask for it.`);

    if (elapsedMinutes >= 3) {
      parts.push(`\nSession timing: ${Math.round(elapsedMinutes)} minutes elapsed. Move to the structured session now — signal [ONBOARDING_COMPLETE] at the earliest natural moment.`);
    }

    return parts.join('');
  }

  async respond(userUtterance: string, elapsedMinutes = 0): Promise<OnboardingResult> {
    this.history.push({ role: 'user', content: userUtterance });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      messages: [
        { role: 'system', content: this.buildSystemPrompt(elapsedMinutes) },
        ...this.history.map(t => ({ role: t.role as 'user' | 'assistant', content: t.content })),
      ],
    });

    const raw = (response.choices[0]?.message?.content ?? '').trim();

    const done = raw.includes('[ONBOARDING_COMPLETE]');

    const nameMatch = raw.match(/\[NAME:\s*([^\]]+)\]/i);
    const titleMatch = raw.match(/\[TITLE:\s*([^\]]+)\]/i);
    const extractedName = nameMatch?.[1]?.trim();
    const extractedTitle = titleMatch?.[1]?.trim();

    // Update internal context so subsequent turns use the learned name/title.
    if (extractedName) this.participantContext.name = extractedName;
    if (extractedTitle) this.participantContext.jobTitle = extractedTitle;

    const text = raw
      .replace(/\[ONBOARDING_COMPLETE\]/g, '')
      .replace(/\[NAME:[^\]]*\]/gi, '')
      .replace(/\[TITLE:[^\]]*\]/gi, '')
      .replace(/[—–]/g, ',')
      .trim();

    const enforced = enforceShort(text);
    this.history.push({ role: 'assistant', content: enforced });

    return {
      text: enforced,
      done,
      endpointingMode: 'long_thought',
      expectedAnswerType: 'open_explanation',
      extractedName,
      extractedTitle,
    };
  }
}

const LENS_LABELS: Record<string, string> = {
  people:          'people and capability',
  operations:      'operations and delivery',
  technology:      'technology credibility',
  commercial:      'commercial positioning',
  customer:        'customer relationships',
  risk_compliance: 'risk and compliance',
  partners:        'partner relationships',
};

/** Keep to at most one question — if two ? marks, truncate at first. */
function enforceShort(text: string): string {
  const qIdx = text.indexOf('?');
  if (qIdx === -1) return text;
  const secondQ = text.indexOf('?', qIdx + 1);
  if (secondQ === -1) return text;
  return text.slice(0, qIdx + 1).trim();
}

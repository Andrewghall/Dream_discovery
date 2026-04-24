// Onboarding agent — free-flowing conversational warm-up before GTM discovery.
// Uses Claude to have a genuine conversation: learns name, consent, job title,
// what they love, what frustrates them. Decides its own follow-ups. No scripts.

import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are DREAMflow, a warm, sharp, and genuinely curious AI having a real conversation with a business professional. You are in the opening phase of a discovery session.

Your goal is to learn, naturally and through real conversation:
1. The person's name — and whether they are comfortable with you using it
2. Their job title
3. What they love about their work
4. What genuinely frustrates them or gets in the way

Rules:
- Be genuinely conversational. React to what they actually say. If they give a rich or interesting answer, acknowledge it warmly before moving on.
- Ask natural follow-ups if an answer is thin, surprising, or worth exploring.
- Be warm, concise, and British in tone. Never sound corporate or stiff.
- CRITICAL: Ask only ONE question per response. Never ask two questions in the same turn.
- CRITICAL: Keep responses to 1–2 sentences maximum. You are speaking aloud, not writing.
- Never summarise or parrot back what the person just said.
- When you have learned enough on all four areas above, finish your response normally and then — on a new line by itself — output exactly: [ONBOARDING_COMPLETE]`;

export interface OnboardingTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface OnboardingResult {
  text: string;    // what DREAMflow says — ready to pass to TTS
  done: boolean;   // true when [ONBOARDING_COMPLETE] detected
}

export class OnboardingAgent {
  private client: Anthropic;
  private history: OnboardingTurn[] = [];

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /** Record the AI's opening greeting so the LLM has full context. */
  recordOpening(text: string): void {
    this.history.push({ role: 'assistant', content: text });
  }

  /** Process a user utterance and return the AI's next response. */
  async respond(userUtterance: string): Promise<OnboardingResult> {
    this.history.push({ role: 'user', content: userUtterance });

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,   // hard cap — forces brevity
      system: SYSTEM_PROMPT,
      messages: this.history.map(t => ({ role: t.role, content: t.content })),
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    const done = raw.includes('[ONBOARDING_COMPLETE]');
    // Strip the sentinel and any trailing whitespace/newlines
    const text = raw.replace(/\[ONBOARDING_COMPLETE\]/g, '').trim();

    // Guard: if somehow there are multiple question marks, keep only up to the first sentence boundary
    const enforced = enforceOneSentence(text);

    // Record assistant turn without the sentinel
    this.history.push({ role: 'assistant', content: enforced });

    return { text: enforced, done };
  }
}

/**
 * If the model returned multiple questions despite the prompt,
 * keep only up to and including the first question mark.
 */
function enforceOneSentence(text: string): string {
  const qIdx = text.indexOf('?');
  if (qIdx === -1) return text;
  // Find if there's a second question mark after the first
  const secondQ = text.indexOf('?', qIdx + 1);
  if (secondQ === -1) return text;
  // Cut at the first question mark
  return text.slice(0, qIdx + 1).trim();
}

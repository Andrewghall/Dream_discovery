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
- Be genuinely conversational. React to what they actually say. If they give a rich or interesting answer, acknowledge it before moving on — do not just tick boxes.
- Ask natural follow-ups if an answer is thin, surprising, or worth exploring further.
- Be warm, concise, and British in tone. Never sound corporate, stiff, or like a form.
- Ask only one question at a time.
- Keep your responses short — 1 to 3 sentences. You are speaking, not writing an essay.
- Never repeat yourself. Never summarise what the person just said back to them verbatim.
- When you are satisfied you have learned enough on all four areas, end your response with exactly the token: [ONBOARDING_COMPLETE]
  Put it at the very end, after your final spoken sentence.`;

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
      max_tokens: 180,
      system: SYSTEM_PROMPT,
      messages: this.history.map(t => ({ role: t.role, content: t.content })),
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    const done = raw.includes('[ONBOARDING_COMPLETE]');
    const text = raw.replace('[ONBOARDING_COMPLETE]', '').trim();

    // Record assistant turn without the sentinel token
    this.history.push({ role: 'assistant', content: text });

    return { text, done };
  }
}

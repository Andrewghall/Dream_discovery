import { ConversationPhase } from '@/lib/types/conversation';

export const PHASE_ORDER: ConversationPhase[] = [
  'intro',
  'people',
  'corporate',
  'customer',
  'technology',
  'regulation',
  'prioritization',
  'summary',
];

export function getPhaseOrder(includeRegulation: boolean): ConversationPhase[] {
  return includeRegulation ? PHASE_ORDER : PHASE_ORDER.filter((p) => p !== 'regulation');
}

export function getIntroMessage(includeRegulation: boolean): string {
  return "Please briefly describe your role, how long you've been in the organisation and your core responsibilities. What drives your work?";
}

export function getPrioritizationAreaList(includeRegulation: boolean): string {
  const areas = ['People', 'Corporate', 'Customer', 'Technology'];
  if (includeRegulation) areas.push('Regulation');
  return areas.join(', ');
}

export type FixedQuestionTag =
  | 'context'
  | 'current_score'
  | 'future_score'
  | 'confidence_score'
  | 'strengths'
  | 'gaps'
  | 'future'
  | 'support'
  | 'helpful'
  | 'friction'
  | 'barrier'
  | 'working'
  | 'pain_points'
  | 'constraint'
  | 'awareness_current'
  | 'awareness_future'
  | 'optimism'
  | 'biggest_constraint'
  | 'high_impact'
  | 'final_thoughts'
  | 'closing';

export interface FixedQuestion {
  text: string;
  tag: FixedQuestionTag;
}

export const FIXED_QUESTIONS: Record<ConversationPhase, FixedQuestion[]> = {
  intro: [
    {
      text: "Please briefly describe your role, how long you've been in the organisation and your core responsibilities. What drives your work?",
      tag: 'context',
    },
  ],
  people: [
    {
      text: "On a scale of 1–10, how would you rate your team's current capacity and capability to meet your objectives? (1 = severely lacking, 10 = excellent)",
      tag: 'current_score',
    },
    {
      text: "Where should your team's capacity and skills be in 1.5 years on that same 1–10 scale?",
      tag: 'future_score',
    },
    {
      text: "How confident are you that the organisation will enable that future level of capacity and capability? (1 = not confident, 10 = very confident)",
      tag: 'confidence_score',
    },
    {
      text: 'What specific strengths or behaviours within your team help you succeed today (e.g., collaboration, resilience, expertise)?',
      tag: 'strengths',
    },
    {
      text: 'What specific gaps or cultural challenges hold your team back (e.g., misaligned incentives, skill gaps, siloed knowledge)?',
      tag: 'gaps',
    },
    {
      text: 'How would you like the culture and roles to evolve over the next 1.5 years? To what extent should AI augment or automate roles versus empower people?',
      tag: 'future',
    },
    {
      text: 'What support (training, resources, new roles) would accelerate progress toward that vision?',
      tag: 'support',
    },
  ],
  corporate: [
    {
      text: 'On a scale of 1–10, how effective are our current governance, policies and decision-making processes in enabling you to perform your role?',
      tag: 'current_score',
    },
    {
      text: 'Where would you like our organisational effectiveness to be in 1.5 years?',
      tag: 'future_score',
    },
    {
      text: 'How confident are you that changes in corporate policies and structures will enable that level?',
      tag: 'confidence_score',
    },
    {
      text: 'Which processes or structures genuinely help you do your job (e.g., clear accountability, rapid decision-making, cross-functional alignment)?',
      tag: 'helpful',
    },
    {
      text: 'Where do policies or governance structures slow you down or create friction? Please provide examples.',
      tag: 'friction',
    },
    {
      text: 'What is the main barrier preventing better organisational effectiveness (e.g., risk aversion, bureaucracy, unclear ownership)?',
      tag: 'barrier',
    },
    {
      text: 'Looking ahead 1.5 years, how should governance and decision-making adapt to support innovation, collaboration and compliance (e.g., decentralised decision authority, integrated oversight)?',
      tag: 'future',
    },
  ],
  customer: [
    {
      text: 'On a scale of 1–10, how would you rate our current ability to meet and exceed customer needs and expectations?',
      tag: 'current_score',
    },
    {
      text: 'Where should our ability to deliver customer experience be in 1.5 years?',
      tag: 'future_score',
    },
    {
      text: 'How confident are you that our organisation will achieve that customer experience vision?',
      tag: 'confidence_score',
    },
    {
      text: 'What do customers currently appreciate about our services or interactions?',
      tag: 'working',
    },
    {
      text: 'Where do customers struggle or get frustrated with our service or communications? Please provide examples.',
      tag: 'pain_points',
    },
    {
      text: 'What is preventing the organisation from delivering a consistently excellent customer experience (e.g., processes, technology, policies, mindset)?',
      tag: 'barrier',
    },
    {
      text: 'In 1.5 years, how would you like customers to describe their experience with us (e.g., seamless, personalised, proactive)? What innovations or approaches will get us there?',
      tag: 'future',
    },
  ],
  technology: [
    {
      text: 'On a scale of 1–10, how would you rate our current technology, data systems and tools in terms of reliability, integration and usability?',
      tag: 'current_score',
    },
    {
      text: 'Where should our technology capability be in 1.5 years on the same 1–10 scale (think of ideal integration, automation and AI augmentation)?',
      tag: 'future_score',
    },
    {
      text: 'How confident are you that our technology strategy and investments will enable that future state?',
      tag: 'confidence_score',
    },
    {
      text: 'Which systems or tools genuinely empower you to do your job effectively today?',
      tag: 'helpful',
    },
    {
      text: 'What are the most significant technology frustrations or gaps you face (e.g., manual processes, lack of integration, poor data quality)?',
      tag: 'gaps',
    },
    {
      text: "What's the main barrier preventing technology improvements (e.g., budget, legacy systems, governance)?",
      tag: 'barrier',
    },
    {
      text: 'Looking 1.5 years ahead, what technology capabilities or AI-driven tools would you like to have? Should AI replace humans in certain tasks, augment decisions or both? Please elaborate.',
      tag: 'future',
    },
  ],
  regulation: [
    {
      text: 'Do current regulations or compliance requirements materially constrain your ability to operate or scale? If yes, please explain how.',
      tag: 'constraint',
    },
    {
      text: 'On a scale of 1–10, how would you rate your awareness of upcoming regulations that could materially affect our business?',
      tag: 'awareness_current',
    },
    {
      text: 'Where should that awareness level be in 1.5 years?',
      tag: 'awareness_future',
    },
    {
      text: "How confident are you that our processes for regulatory monitoring and compliance will support the business's future ambitions?",
      tag: 'confidence_score',
    },
    {
      text: 'Do regulatory requirements create significant cost, delay or operational workarounds? Please describe.',
      tag: 'barrier',
    },
    {
      text: 'Are regulatory impacts assessed early enough to influence strategy, product or delivery decisions? Provide an example.',
      tag: 'friction',
    },
    {
      text: 'Could a regulatory change cause material financial, operational or reputational risk if not anticipated? What improvements would help mitigate this risk?',
      tag: 'future',
    },
  ],
  prioritization: [
    {
      text: 'Among People, Corporate/Organisational, Customer, Technology and Regulation, which one area constrains your day-to-day work the most?',
      tag: 'biggest_constraint',
    },
    {
      text: 'Which area, if improved significantly, would have the biggest positive impact on your ability to deliver value?',
      tag: 'high_impact',
    },
    {
      text: "Overall, are you optimistic, neutral or skeptical about the organisation's ability to change? What would increase your optimism?",
      tag: 'optimism',
    },
    {
      text: 'What other insights, stories or context would you like to share that you think would help shape our vision and the upcoming Dream session?',
      tag: 'final_thoughts',
    },
  ],
  summary: [
    {
      text: 'Thank you for candidly sharing your experiences. Your input will help shape the Dream session, and you will receive a summary report based on what you shared.',
      tag: 'closing',
    },
  ],
};

export function getNextPhase(current: ConversationPhase, includeRegulation: boolean = true): ConversationPhase {
  const order = getPhaseOrder(includeRegulation);
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)];
}

export function getPhaseProgressPercent(phase: ConversationPhase, answeredCount: number): number {
  const total = FIXED_QUESTIONS[phase].length;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((answeredCount / total) * 100)));
}

export function getFixedQuestion(
  phase: ConversationPhase,
  index: number,
  includeRegulation: boolean
): string {
  if (phase === 'intro') return getIntroMessage(includeRegulation);

  const q = FIXED_QUESTIONS[phase]?.[index];
  if (!q) return '';

  if (phase === 'prioritization' && index === 0) {
    return `Among ${getPrioritizationAreaList(includeRegulation)}, which one area constrains your day-to-day work the most?`;
  }

  return q.text;
}

export function getFixedQuestionObject(
  phase: ConversationPhase,
  index: number,
  includeRegulation: boolean
): FixedQuestion | null {
  if (phase === 'intro') {
    return {
      text: getIntroMessage(includeRegulation),
      tag: 'context',
    };
  }

  if (phase === 'prioritization' && index === 0) {
    return {
      text: `Among ${getPrioritizationAreaList(includeRegulation)}, which one area constrains your day-to-day work the most?`,
      tag: 'biggest_constraint',
    };
  }

  return FIXED_QUESTIONS[phase]?.[index] ?? null;
}

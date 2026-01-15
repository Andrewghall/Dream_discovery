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
  return "Please describe your role, how long you've been in the organisation, and what you spend most of your time doing.";
}

export function getPrioritizationAreaList(includeRegulation: boolean): string {
  const areas = ['People', 'Processes', 'Customer', 'Technology'];
  if (includeRegulation) areas.push('Regulation');
  return areas.join(', ');
}

export type FixedQuestionTag =
  | 'context'
  | 'triple_rating'
  | 'target_score'
  | 'projected_score'
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
  | 'optimism'
  | 'biggest_constraint'
  | 'high_impact'
  | 'final_thoughts'
  | 'lessons_learned'
  | 'missing_question'
  | 'closing';

export interface FixedQuestion {
  text: string;
  tag: FixedQuestionTag;
}

export const FIXED_QUESTIONS: Record<ConversationPhase, FixedQuestion[]> = {
  intro: [
    {
      text: "Please describe your role, how long you've been in the organisation, and what you spend most of your time doing.",
      tag: 'context',
    },
    {
      text: 'What is the best thing about working here? What keeps you going?',
      tag: 'working',
    },
    {
      text: "And what is the single most frustrating thing? I appreciate your honesty. Let's dig into some specific areas, starting with people and skills.",
      tag: 'pain_points',
    },
  ],
  people: [
    {
      text: "This section is about how well-equipped you and your colleagues are to do your jobs. Rate how well-equipped you and your colleagues are to do your jobs effectively. Provide three scores: Current (today), Target (in 18 months), and Projected (in 18 months if nothing changes).",
      tag: 'triple_rating',
    },
    {
      text: 'What helps you do your best work here? Think of a specific time when everything came together and the job went well.',
      tag: 'strengths',
    },
    {
      text: "Where do you feel unsupported or under-skilled for what's expected of you? What's missing?",
      tag: 'gaps',
    },
    {
      text: 'If you could change one thing about how people work together here, what would it be?',
      tag: 'future',
    },
    {
      text: "How do you think AI and automation will change your work over the next few years? What parts of your job should stay human? Now let's talk about how things get done around here — decisions, processes, approvals.",
      tag: 'future',
    },
  ],
  corporate: [
    {
      text: "This section is about decisions, processes, and getting things done. Rate how well the organisation's processes and decision-making help you do your job. Provide three scores: Current (today), Target (in 18 months), and Projected (in 18 months if nothing changes).",
      tag: 'triple_rating',
    },
    {
      text: "Describe something that should be simple but isn't. What makes it harder than it needs to be?",
      tag: 'friction',
    },
    {
      text: "Are there rules or processes you work around to get things done? What does that tell us?",
      tag: 'friction',
    },
    {
      text: "If you could fix one thing about how decisions get made or work gets approved, what would it be? Let's shift to thinking about customers and their experience.",
      tag: 'future',
    },
  ],
  customer: [
    {
      text: 'This section is about how customers experience the organisation. Rate how well the organisation meets customer needs and expectations. Provide three scores: Current (today), Target (in 18 months), and Projected (in 18 months if nothing changes).',
      tag: 'triple_rating',
    },
    {
      text: 'Think of a time when a customer had a great experience. What made it work?',
      tag: 'working',
    },
    {
      text: 'Think of a time when a customer had a poor experience. What went wrong and why?',
      tag: 'pain_points',
    },
    {
      text: "What do customers have to do that they shouldn't have to? Where is their time or effort wasted?",
      tag: 'pain_points',
    },
    {
      text: "If customers could describe their ideal experience with us in 18 months, what would they say? Now let's talk about the tools and systems you work with every day.",
      tag: 'future',
    },
  ],
  technology: [
    {
      text: 'This section is about the systems and information you work with. Rate the technology, systems, and tools you use in terms of reliability and ease of use. Provide three scores: Current (today), Target (in 18 months), and Projected (in 18 months if nothing changes).',
      tag: 'triple_rating',
    },
    {
      text: 'Which system or tool genuinely makes your job easier? What works well?',
      tag: 'working',
    },
    {
      text: 'What manual task or workaround wastes the most of your time? How often do you have to do it?',
      tag: 'pain_points',
    },
    {
      text: 'What information do you need but struggle to get? What suffers as a result?',
      tag: 'gaps',
    },
    {
      text: "If you could automate or fix one thing about your tools tomorrow, what would make the biggest difference? A few questions about regulation and compliance — if they don't apply to your role, you can reply 'skip'.",
      tag: 'future',
    },
  ],
  regulation: [
    {
      text: 'Rate how well the organisation handles regulatory and compliance requirements. Provide three scores: Current (today), Target (in 18 months), and Projected (in 18 months if nothing changes).',
      tag: 'triple_rating',
    },
    {
      text: 'Do compliance or regulatory requirements make your job harder? How?',
      tag: 'constraint',
    },
    {
      text: 'Have you experienced a situation where a regulatory change caught the organisation off-guard? What happened?',
      tag: 'friction',
    },
    {
      text: "Is there a rule or compliance requirement that doesn't make sense to you? What is it and why? Nearly there. Just a few final questions to wrap up.",
      tag: 'future',
    },
  ],
  prioritization: [
    {
      text: 'Of the five areas (People, Processes, Customer, Technology, Regulation), which one gets in the way of your work the most?',
      tag: 'biggest_constraint',
    },
    {
      text: 'Which area, if fixed, would make the biggest positive difference to your ability to do your job?',
      tag: 'high_impact',
    },
    {
      text: 'Overall, do you believe this organisation can genuinely change for the better? What makes you think that?',
      tag: 'optimism',
    },
    {
      text: "Has the organisation tried to improve things before that didn't work? What happened and what should we learn from it?",
      tag: 'lessons_learned',
    },
    {
      text: "What else should we know? What question should we have asked but didn't?",
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

export function getTotalQuestionCount(includeRegulation: boolean): number {
  const phases = getPhaseOrder(includeRegulation).filter((p) => p !== 'summary');
  return phases.reduce((sum, phase) => sum + (FIXED_QUESTIONS[phase]?.length || 0), 0);
}

export function getOverallQuestionNumber(
  phase: ConversationPhase,
  index: number,
  includeRegulation: boolean
): number | null {
  if (phase === 'summary') return null;

  const phases = getPhaseOrder(includeRegulation).filter((p) => p !== 'summary');
  let offset = 0;
  for (const p of phases) {
    if (p === phase) return offset + index + 1;
    offset += FIXED_QUESTIONS[p]?.length || 0;
  }

  return null;
}

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
  const q = FIXED_QUESTIONS[phase]?.[index];
  if (!q) return '';

  return q.text;
}

export function getFixedQuestionObject(
  phase: ConversationPhase,
  index: number,
  includeRegulation: boolean
): FixedQuestion | null {
  return FIXED_QUESTIONS[phase]?.[index] ?? null;
}

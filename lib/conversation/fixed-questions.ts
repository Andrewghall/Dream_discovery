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
  const areas = ['People', 'Corporate', 'Customer', 'Technology'];
  if (includeRegulation) areas.push('Regulation');
  return `This will take about 15 minutes. We'll cover ${areas.join(', ')}. To start, what's your role in the business?`;
}

export function getPrioritizationAreaList(includeRegulation: boolean): string {
  const areas = ['People', 'Corporate', 'Customer', 'Technology'];
  if (includeRegulation) areas.push('Regulation');
  return areas.join(', ');
}

export const FIXED_QUESTIONS: Record<ConversationPhase, string[]> = {
  intro: [
    "This will take about 15 minutes. We'll cover People, Corporate, Customer, Technology, and Regulation. To start, what's your role in the business?",
  ],
  people: [
    "Let's look at People - capacity, skills, roles, and culture. On a scale of 1-10, how would you rate your team's capacity and capability today?",
    "What's working well with people and teamwork?",
    "What's the biggest people-related challenge you face?",
    "What's the main thing holding back improvement in this area?",
    "In 3 years, how should your team work together differently?",
    "How confident are you that this will improve? Rate 1-10.",
  ],
  corporate: [
    "Now Corporate / Organisational - policies, governance, and decision-making. On a scale of 1-10, how would you rate organizational effectiveness and decision-making?",
    "What organizational processes or structures actually help you?",
    "What's the biggest organizational or governance challenge you face?",
    "What's the main thing holding back better organizational effectiveness?",
    "In 3 years, how should the organization work differently?",
    "How confident are you that this will improve? Rate 1-10.",
  ],
  customer: [
    "Now Customer - expectations, needs, and experience. On a scale of 1-10, how would you rate your ability to meet customer needs?",
    "What's working well with customers?",
    "What's the biggest customer-related challenge you face?",
    "What's the main thing preventing you from better meeting customer needs?",
    "In 3 years, what should customers say about the organization?",
    "How confident are you that customer experience will improve? Rate 1-10.",
  ],
  technology: [
    "Now Technology - systems, data, and tools. On a scale of 1-10, how would you rate your technology and systems?",
    "Which systems or tools genuinely help you do your job?",
    "What's the biggest technology challenge you face?",
    "What's the main technology barrier holding you back?",
    "In 3 years, what technology should exist that doesn't today?",
    "How confident are you that technology will improve? Rate 1-10.",
  ],
  regulation: [
    "Do current regulations materially constrain how the business operates or scales?",
    "Are regulatory requirements creating cost, delay, or operational workarounds?",
    "Do you have clear visibility of upcoming regulation that will materially affect the business?",
    "Is regulatory impact assessed early enough to influence strategy, product, or delivery decisions?",
    "Could a regulatory change cause material financial, operational, or reputational risk if not anticipated?",
  ],
  prioritization: [
    "That's really helpful. Of People, Corporate, Customer, Technology, and Regulation - which ONE area constrains you most day to day?",
    "Which ONE area would have the biggest impact if improved?",
    "Overall, are you optimistic or skeptical about change happening?",
  ],
  summary: [
    "Does that capture everything accurately?",
    "Is there anything you'd like to add or clarify?",
    "Thank you for sharing your insights. Your perspective will help shape our workshop discussion and ensure we focus on what matters most."
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

  const raw = FIXED_QUESTIONS[phase][index];
  if (!raw) return '';

  if (phase === 'prioritization' && index === 0) {
    return `That's really helpful. Of ${getPrioritizationAreaList(includeRegulation)} - which ONE area constrains you most day to day?`;
  }

  return raw;
}

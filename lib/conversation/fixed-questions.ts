import { ConversationPhase, normalizeConversationPhase } from '@/lib/types/conversation';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';
import {
  CANONICAL_LENS_NAMES,
  canonicalizeConversationPhase,
  canonicalizeLensName,
  type CanonicalConversationPhase,
} from '@/lib/workshop/canonical-lenses';

export const PHASE_ORDER: ConversationPhase[] = [
  'intro',
  'people',
  'operations',
  'technology',
  'commercial',
  'customer',
  'risk_compliance',
  'partners',
  'prioritization',
  'summary',
];

export function getPhaseOrder(_includeRegulation: boolean): ConversationPhase[] {
  return PHASE_ORDER;
}

export function getIntroMessage(_includeRegulation: boolean): string {
  return "Please describe your role, how long you've been in the organisation, and what you spend most of your time doing.";
}

export function getPrioritizationAreaList(_includeRegulation: boolean): string {
  return CANONICAL_LENS_NAMES.join(', ');
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
  maturityScale?: string[];
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
      text: 'And what is the single most frustrating thing?',
      tag: 'pain_points',
    },
  ],
  people: [
    {
      text:
        'When looking specifically at People, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well-equipped you and your colleagues are to do your jobs effectively',
      tag: 'triple_rating',
      maturityScale: [
        "Skills gaps everywhere. People leave frequently. Teams don't talk to each other.",
        'Roles defined but overlap confusing. Some training exists. Collaboration when pushed.',
        'Clear expectations and development paths. People work across teams. Learning encouraged.',
        'Skills planning proactive. AI helps with routine work. Continuous learning normal.',
        'People and AI work seamlessly. Humans focus on judgement and relationships.',
      ],
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
      text: 'How do you think AI and automation will change your work over the next few years? What parts of your job should stay human?',
      tag: 'future',
    },
  ],
  operations: [
    {
      text:
        "When looking specifically at Operations, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation's operating model, processes, and decision flow help you do your job",
      tag: 'triple_rating',
      maturityScale: [
        'Work is fragmented. Handoffs fail. Ownership unclear. Constant firefighting.',
        'Core processes exist but execution is inconsistent. Bottlenecks are common.',
        'Roles and workflows are clear. Delivery is reasonably reliable and accountable.',
        'Operations adapt quickly. Governance helps decisions move with control.',
        'Execution is seamless. The operating model scales without unnecessary friction.',
      ],
    },
    {
      text: "Describe something operational that should be simple but isn't. What makes it harder than it needs to be?",
      tag: 'friction',
    },
    {
      text: 'Where do handoffs, approvals, or process rules create avoidable friction? What does that tell us?',
      tag: 'friction',
    },
    {
      text: 'If you could fix one thing about how work flows or decisions get made, what would it be?',
      tag: 'future',
    },
  ],
  technology: [
    {
      text:
        'When looking specifically at Technology, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the technology, systems, and tools you use in terms of reliability and ease of use',
      tag: 'triple_rating',
      maturityScale: [
        'Old systems everywhere. Manual workarounds constant. Data unreliable.',
        'Core systems work but inflexible. Some automation. Data improving but patchy.',
        'Systems talk to each other. Data trustworthy. AI handles routine tasks.',
        'Modern flexible systems. AI assists decisions. Self-service works.',
        'Technology just works. AI handles complexity. Innovation fast.',
      ],
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
      text: 'If you could automate or fix one thing about your tools tomorrow, what would make the biggest difference?',
      tag: 'future',
    },
  ],
  commercial: [
    {
      text:
        'When looking specifically at Commercial, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation converts customer need into value, growth, and commercial performance',
      tag: 'triple_rating',
      maturityScale: [
        'Value is leaking. Customer demand is poorly understood. Growth feels reactive.',
        'There is some commercial discipline, but pricing, proposition, and demand signals are inconsistent.',
        'Customer value and commercial outcomes are mostly aligned. Teams can see what drives performance.',
        'The organisation anticipates demand, sharpens value delivery, and makes better commercial decisions quickly.',
        'Commercial strategy is clear, evidence-led, and consistently translated into sustainable growth.',
      ],
    },
    {
      text: 'Where does the organisation create clear value today, and what makes that work commercially?',
      tag: 'working',
    },
    {
      text: 'Where is value leaking through pricing, proposition, retention, conversion, or demand? What is driving that?',
      tag: 'pain_points',
    },
    {
      text: 'What customer or market signals should influence decisions more strongly than they do today?',
      tag: 'gaps',
    },
    {
      text: 'If the commercial model was working brilliantly in 18 months, what would be visibly different?',
      tag: 'future',
    },
  ],
  customer: [
    {
      text:
        'When looking specifically at Customer, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation understands customer needs, delivers the experience promised, and earns long-term trust',
      tag: 'triple_rating',
      maturityScale: [
        'Customer needs are poorly understood. Experience is inconsistent. Trust is fragile and easily lost.',
        'Some customer insight exists, but journeys break down and service quality varies too much.',
        'The organisation understands core customer needs and usually delivers a dependable experience.',
        'Customer insight shapes decisions quickly. Journeys improve proactively and trust is strengthened deliberately.',
        'The organisation is deeply customer-led. Experience, loyalty, and advocacy reinforce each other consistently.',
      ],
    },
    {
      text: 'Where do customers experience the business at its best today, and what makes that feel different?',
      tag: 'working',
    },
    {
      text: 'Where does the customer experience break down, create effort, or damage trust most often?',
      tag: 'pain_points',
    },
    {
      text: 'What do customers need or expect that the organisation still does not understand well enough?',
      tag: 'gaps',
    },
    {
      text: 'If the customer experience was genuinely stronger in 18 months, what would customers notice first?',
      tag: 'future',
    },
  ],
  risk_compliance: [
    {
      text:
        'When looking specifically at Risk / Compliance, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation manages compliance obligations, controls, and material risk',
      tag: 'triple_rating',
      maturityScale: [
        'Compliance reactive. Regulatory changes surprise us. Control gaps emerge too late.',
        'A framework exists, but oversight and accountability are inconsistent.',
        'Risks and obligations are tracked systematically. Controls are usually embedded into delivery.',
        'Changes are anticipated. Assurance is timely. Control burden is better targeted.',
        'Risk and compliance are disciplined, transparent, and built into how the organisation operates.',
      ],
    },
    {
      text: 'Where do risk or compliance requirements create friction, delay, or uncertainty in practice?',
      tag: 'constraint',
    },
    {
      text: 'Have you experienced a situation where a control gap, risk event, or compliance issue caught the organisation off-guard? What happened?',
      tag: 'friction',
    },
    {
      text: 'What would stronger risk and compliance management look like without creating unnecessary bureaucracy?',
      tag: 'future',
    },
  ],
  partners: [
    {
      text:
        'When looking specifically at Partners, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation works with external partners, suppliers, and ecosystem dependencies that materially affect outcomes',
      tag: 'triple_rating',
      maturityScale: [
        'Critical external dependencies are poorly managed. Partner performance creates repeated surprises.',
        'Key partners are known, but accountability, integration, and escalation are inconsistent.',
        'Important partners are managed with reasonable clarity, governance, and visibility.',
        'The organisation works with partners strategically and resolves dependency issues early.',
        'Partner ecosystems operate as an aligned extension of the business with clear value, accountability, and control.',
      ],
    },
    {
      text: 'Which external partners or suppliers materially affect your ability to deliver outcomes today?',
      tag: 'context',
    },
    {
      text: 'Where do partner incentives, capability, or dependency risks create friction for the organisation?',
      tag: 'constraint',
    },
    {
      text: 'What would a stronger partner model or ecosystem relationship look like in practice?',
      tag: 'future',
    },
  ],
  prioritization: [
    {
      text: 'Of the seven areas (People, Operations, Technology, Commercial, Customer, Risk / Compliance, Partners), which one gets in the way of your work the most?',
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

export function getQuestionsForWorkshop(
  workshopCustomQuestions: Record<string, { text: string; tag: string; maturityScale?: string[] }[]> | null,
  questionSetVersion: string | null,
): Record<ConversationPhase, FixedQuestion[]> {
  if (workshopCustomQuestions) {
    const result: Record<string, FixedQuestion[]> = {};
    for (const [phase, questions] of Object.entries(workshopCustomQuestions)) {
      result[phase] = questions.map((q) => ({
        text: q.text,
        tag: q.tag as FixedQuestionTag,
        maturityScale: q.maturityScale,
      }));
    }
    return result as Record<ConversationPhase, FixedQuestion[]>;
  }
  return fixedQuestionsForVersion(questionSetVersion);
}

export function fixedQuestionsForVersion(questionSetVersion: string | null | undefined): typeof FIXED_QUESTIONS {
  const v = (questionSetVersion || '').trim().toLowerCase();
  if (v === 'v2') return FIXED_QUESTIONS_V2;
  return FIXED_QUESTIONS;
}

export const FIXED_QUESTIONS_V2: typeof FIXED_QUESTIONS = {
  ...FIXED_QUESTIONS,
  intro: [
    {
      ...FIXED_QUESTIONS.intro[0],
      text: "Follow-up: since the last session, what has changed in your role, priorities, or the organisation?",
    },
    ...FIXED_QUESTIONS.intro.slice(1),
  ],
};

export function getTotalQuestionCount(includeRegulation: boolean, questionSetVersion?: string | null): number {
  const qs = fixedQuestionsForVersion(questionSetVersion);
  const phases = getPhaseOrder(includeRegulation).filter((p) => p !== 'summary');
  return phases.reduce((sum, phase) => sum + (qs[phase]?.length || 0), 0);
}

export function getOverallQuestionNumber(
  phase: ConversationPhase,
  index: number,
  includeRegulation: boolean,
  questionSetVersion?: string | null,
): number | null {
  if (phase === 'summary') return null;

  const qs = fixedQuestionsForVersion(questionSetVersion);
  const phases = getPhaseOrder(includeRegulation).filter((p) => p !== 'summary');
  let offset = 0;

  for (const current of phases) {
    if (current === phase) return offset + index + 1;
    offset += qs[current]?.length || 0;
  }

  return null;
}

export function getNextPhase(current: ConversationPhase, includeRegulation: boolean = true): ConversationPhase {
  const order = getPhaseOrder(includeRegulation);
  const normalized = normalizeConversationPhase(current);
  const idx = order.indexOf(normalized);
  return order[Math.min(idx + 1, order.length - 1)];
}

export function getPhaseProgressPercent(
  phase: ConversationPhase,
  answeredCount: number,
  questionSetVersion?: string | null,
): number {
  const qs = fixedQuestionsForVersion(questionSetVersion);
  const total = qs[phase].length;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((answeredCount / total) * 100)));
}

export function getFixedQuestion(
  phase: ConversationPhase,
  index: number,
  includeRegulation: boolean,
  questionSetVersion?: string | null,
): string {
  const q = fixedQuestionsForVersion(questionSetVersion)[phase]?.[index];
  if (!q) return '';
  return q.text;
}

export function getFixedQuestionObject(
  phase: ConversationPhase,
  index: number,
  includeRegulation: boolean,
  questionSetVersion?: string | null,
): FixedQuestion | null {
  return fixedQuestionsForVersion(questionSetVersion)[phase]?.[index] ?? null;
}

const LENS_NAME_TO_PHASE: Record<string, ConversationPhase> = {
  People: 'people',
  Operations: 'operations',
  Organisation: 'operations',
  Technology: 'technology',
  Commercial: 'commercial',
  Customer: 'customer',
  'Customer Experience': 'customer',
  'Risk/Compliance': 'risk_compliance',
  Regulation: 'risk_compliance',
  Partners: 'partners',
};

export function getPhaseOrderFromBlueprint(
  blueprint: WorkshopBlueprint,
): ConversationPhase[] {
  const lensPhases: ConversationPhase[] = [];

  for (const lens of blueprint.lenses) {
    const canonicalLens = canonicalizeLensName(lens.name);
    const phase = canonicalLens
      ? LENS_NAME_TO_PHASE[canonicalLens]
      : LENS_NAME_TO_PHASE[lens.name];
    if (phase && !lensPhases.includes(phase)) {
      lensPhases.push(phase);
    }
  }

  if (lensPhases.length === 0) return PHASE_ORDER;
  return ['intro', ...lensPhases, 'prioritization', 'summary'];
}

export function buildQuestionsFromBlueprint(
  blueprint: WorkshopBlueprint,
  questionSetVersion?: string | null,
): Record<string, FixedQuestion[]> | null {
  const lensPhases: ConversationPhase[] = [];
  const lensLabels: string[] = [];

  for (const lens of blueprint.lenses) {
    const canonicalLens = canonicalizeLensName(lens.name);
    const canonicalLabel = canonicalLens ?? lens.name;
    const phase = canonicalLens
      ? LENS_NAME_TO_PHASE[canonicalLabel]
      : LENS_NAME_TO_PHASE[lens.name];
    if (phase && !lensPhases.includes(phase)) {
      lensPhases.push(phase);
      lensLabels.push(canonicalLabel);
    }
  }

  if (lensPhases.length === 0) return null;

  const base = fixedQuestionsForVersion(questionSetVersion);
  const result: Record<string, FixedQuestion[]> = {};
  result.intro = [...base.intro];

  for (const phase of lensPhases) {
    result[phase] = [...base[phase]];
  }

  result.prioritization = [
    {
      text: `Of the areas we have discussed (${lensLabels.join(', ')}), which one gets in the way of your work the most?`,
      tag: 'biggest_constraint',
    },
    ...base.prioritization.slice(1),
  ];

  result.summary = [...base.summary];
  return result;
}

export function includeRegulationFromBlueprint(
  blueprint: WorkshopBlueprint,
): boolean {
  return blueprint.lenses.some((lens) => canonicalizeLensName(lens.name) === 'Risk/Compliance');
}

export function buildQuestionsFromDiscoverySet(
  discoveryQuestions: any,
): Record<string, FixedQuestion[]> | null {
  if (!discoveryQuestions?.lenses?.length) return null;

  const result: Record<string, FixedQuestion[]> = {};
  result.intro = [...FIXED_QUESTIONS.intro];

  for (const lens of discoveryQuestions.lenses) {
    const phaseKey = canonicalizeConversationPhase(lens.key) ?? String(lens.key || '').trim().toLowerCase();
    result[phaseKey] = lens.questions.map((q: any) => ({
      text: q.text,
      tag: (q.tag || 'context') as FixedQuestionTag,
      maturityScale: q.maturityScale,
    }));
  }

  const lensLabels = discoveryQuestions.lenses.map((lens: any) => lens.label).join(', ');
  result.prioritization = [
    {
      text: `Of the areas we have discussed (${lensLabels}), which one gets in the way of your work the most?`,
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
      text: "What else should we know? What question should we have asked but didn't?",
      tag: 'final_thoughts',
    },
  ];
  result.summary = [...FIXED_QUESTIONS.summary];
  return result;
}

export function getPhaseOrderForDiscovery(
  discoveryQuestions: any,
): string[] {
  if (!discoveryQuestions?.lenses?.length) return PHASE_ORDER as string[];

  const lensKeys = discoveryQuestions.lenses
    .map((lens: any) => canonicalizeConversationPhase(lens.key) ?? String(lens.key || '').trim().toLowerCase())
    .filter(Boolean);

  return ['intro', ...lensKeys, 'prioritization', 'summary'];
}

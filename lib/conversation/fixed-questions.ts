import { ConversationPhase } from '@/lib/types/conversation';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';

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
  corporate: [
    {
      text:
        "When looking specifically at Corporate/Organisational, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation's processes and decision-making help you do your job",
      tag: 'triple_rating',
      maturityScale: [
        'Decisions take forever. Nobody knows who owns what. Constant firefighting.',
        'Some structure exists but applied inconsistently. Approval is hit-or-miss.',
        'Clear accountability. Policies make sense. Decisions happen at reasonable speed.',
        'Governance adapts to context. Decisions with guardrails. AI informs choices.',
        'Organisation runs smoothly. Policies evolve. Trust high. Bureaucracy minimal.',
      ],
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
      text: 'If you could fix one thing about how decisions get made or work gets approved, what would it be?',
      tag: 'future',
    },
  ],
  customer: [
    {
      text:
        'When looking specifically at Customer, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation meets customer needs and expectations',
      tag: 'triple_rating',
      maturityScale: [
        'Inconsistent experiences. Complaints pile up. No clear view of customer history.',
        'Basic systems in place. Some visibility across channels. Service recovery reactive.',
        'Single view of customer. Consistent across channels. AI helps with common queries.',
        'Customer needs anticipated. Personalised service. AI and humans seamless.',
        'Effortless experience. Issues resolved before noticed. Customers love us.',
      ],
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
      text: 'If customers could describe their ideal experience with us in 18 months, what would they say?',
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
  regulation: [
    {
      text:
        'When looking specifically at Regulation, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the organisation handles regulatory and compliance requirements',
      tag: 'triple_rating',
      maturityScale: [
        'Compliance reactive. Regulatory changes surprise us. Fines happen.',
        'Framework exists. Some horizon scanning. Training available but basic.',
        'Regulations tracked systematically. Compliance built into processes.',
        'Changes anticipated. Compliance automated where possible.',
        'Compliance invisible and embedded. AI monitors. Organisation shapes conversation.',
      ],
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
      text: "Is there a rule or compliance requirement that doesn't make sense to you? What is it and why?",
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

/**
 * Returns the question set for a workshop, using custom (tailored) questions
 * when available, falling back to the standard versioned question set.
 */
export function getQuestionsForWorkshop(
  workshopCustomQuestions: Record<string, { text: string; tag: string; maturityScale?: string[] }[]> | null,
  questionSetVersion: string | null,
): Record<ConversationPhase, FixedQuestion[]> {
  if (workshopCustomQuestions) {
    // Convert tailored questions back to FixedQuestion format
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
  questionSetVersion?: string | null
): number | null {
  if (phase === 'summary') return null;

  const qs = fixedQuestionsForVersion(questionSetVersion);

  const phases = getPhaseOrder(includeRegulation).filter((p) => p !== 'summary');
  let offset = 0;
  for (const p of phases) {
    if (p === phase) return offset + index + 1;
    offset += qs[p]?.length || 0;
  }

  return null;
}

export function getNextPhase(current: ConversationPhase, includeRegulation: boolean = true): ConversationPhase {
  const order = getPhaseOrder(includeRegulation);
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)];
}

export function getPhaseProgressPercent(
  phase: ConversationPhase,
  answeredCount: number,
  questionSetVersion?: string | null
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
  questionSetVersion?: string | null
): string {
  const q = fixedQuestionsForVersion(questionSetVersion)[phase]?.[index];
  if (!q) return '';

  return q.text;
}

export function getFixedQuestionObject(
  phase: ConversationPhase,
  index: number,
  includeRegulation: boolean,
  questionSetVersion?: string | null
): FixedQuestion | null {
  return fixedQuestionsForVersion(questionSetVersion)[phase]?.[index] ?? null;
}

// ── Blueprint-driven Discovery helpers ────────────────────────

/**
 * Maps standard blueprint lens names to conversation phase keys.
 * When a blueprint lens name is not in this map it is silently ignored,
 * which means research-overridden non-standard lens names (e.g.
 * "Agent Experience") gracefully fall through to the legacy path.
 */
const LENS_NAME_TO_PHASE: Record<string, ConversationPhase> = {
  People: 'people',
  Operations: 'corporate',
  Organisation: 'corporate',
  Customer: 'customer',
  Technology: 'technology',
  Regulation: 'regulation',
};

/**
 * Derive the conversation phase order from blueprint lenses.
 * Wraps the mapped lens phases with intro, prioritization, and summary.
 * If no lenses map to standard phases, returns a safe default without
 * regulation.
 */
export function getPhaseOrderFromBlueprint(
  blueprint: WorkshopBlueprint,
): ConversationPhase[] {
  const lensPhases: ConversationPhase[] = [];
  for (const lens of blueprint.lenses) {
    const phase = LENS_NAME_TO_PHASE[lens.name];
    if (phase && !lensPhases.includes(phase)) {
      lensPhases.push(phase);
    }
  }
  if (lensPhases.length === 0) {
    return PHASE_ORDER.filter((p) => p !== 'regulation');
  }
  return ['intro', ...lensPhases, 'prioritization', 'summary'];
}

/**
 * Build a question set by filtering FIXED_QUESTIONS to only the phases
 * that match the blueprint's active lenses.
 *
 * Returns null when none of the blueprint lens names map to standard
 * conversation phases (e.g. research-overridden custom dimension names).
 * In that case the caller should fall through to legacy FIXED_QUESTIONS.
 *
 * Prioritization questions are rebuilt dynamically to list the blueprint
 * lens names rather than the hardcoded area list.
 */
export function buildQuestionsFromBlueprint(
  blueprint: WorkshopBlueprint,
  questionSetVersion?: string | null,
): Record<string, FixedQuestion[]> | null {
  const lensPhases: ConversationPhase[] = [];
  const lensLabels: string[] = [];

  for (const lens of blueprint.lenses) {
    const phase = LENS_NAME_TO_PHASE[lens.name];
    if (phase && !lensPhases.includes(phase)) {
      lensPhases.push(phase);
      lensLabels.push(lens.name);
    }
  }

  // If no blueprint lenses map to standard phases, gracefully degrade
  if (lensPhases.length === 0) return null;

  const base = fixedQuestionsForVersion(questionSetVersion);
  const result: Record<string, FixedQuestion[]> = {};

  // Always include intro
  result.intro = [...base.intro];

  // Include only phases matching blueprint lenses
  for (const phase of lensPhases) {
    result[phase] = [...base[phase]];
  }

  // Build prioritization with dynamic area list from blueprint lenses
  const areaList = lensLabels.join(', ');
  result.prioritization = [
    {
      text: `Of the areas we have discussed (${areaList}), which one gets in the way of your work the most?`,
      tag: 'biggest_constraint' as FixedQuestionTag,
    },
    ...base.prioritization.slice(1),
  ];

  // Always include summary
  result.summary = [...base.summary];

  return result;
}

/**
 * Derive includeRegulation from blueprint lenses.
 * Returns true if a lens named 'Regulation' is present.
 */
export function includeRegulationFromBlueprint(
  blueprint: WorkshopBlueprint,
): boolean {
  return blueprint.lenses.some((l) => l.name === 'Regulation');
}

// ── Custom Discovery question helpers ─────────────────────────

/**
 * Build a questions record from the workshop's discoveryQuestions JSON.
 * Maps lens-based questions into phase-compatible format.
 * Returns null if discoveryQuestions is not set or has no lenses.
 */
export function buildQuestionsFromDiscoverySet(
  discoveryQuestions: any,
): Record<string, FixedQuestion[]> | null {
  if (!discoveryQuestions?.lenses?.length) return null;

  const result: Record<string, FixedQuestion[]> = {};

  // Intro phase - standard intro questions
  result.intro = [
    {
      text: "Please describe your role, how long you've been in the organisation, and what you spend most of your time doing.",
      tag: 'context' as FixedQuestionTag,
    },
    {
      text: 'What is the best thing about working here? What keeps you going?',
      tag: 'working' as FixedQuestionTag,
    },
    {
      text: 'And what is the single most frustrating thing?',
      tag: 'pain_points' as FixedQuestionTag,
    },
  ];

  // Map each lens to a phase
  for (const lens of discoveryQuestions.lenses) {
    result[lens.key] = lens.questions.map((q: any) => ({
      text: q.text,
      tag: (q.tag || 'context') as FixedQuestionTag,
      maturityScale: q.maturityScale,
    }));
  }

  // Prioritization phase - dynamically list the lens labels
  const lensLabels = discoveryQuestions.lenses.map((l: any) => l.label).join(', ');
  result.prioritization = [
    {
      text: `Of the areas we have discussed (${lensLabels}), which one gets in the way of your work the most?`,
      tag: 'biggest_constraint' as FixedQuestionTag,
    },
    {
      text: 'Which area, if fixed, would make the biggest positive difference to your ability to do your job?',
      tag: 'high_impact' as FixedQuestionTag,
    },
    {
      text: 'Overall, do you believe this organisation can genuinely change for the better? What makes you think that?',
      tag: 'optimism' as FixedQuestionTag,
    },
    {
      text: "What else should we know? What question should we have asked but didn't?",
      tag: 'final_thoughts' as FixedQuestionTag,
    },
  ];

  // Summary phase
  result.summary = [
    {
      text: 'Thank you for candidly sharing your experiences. Your input will help shape the workshop, and you will receive a summary report based on what you shared.',
      tag: 'closing' as FixedQuestionTag,
    },
  ];

  return result;
}

/**
 * Get the phase order for a workshop with custom Discovery questions.
 * Returns lens keys wrapped with intro, prioritization, summary.
 */
export function getPhaseOrderForDiscovery(
  discoveryQuestions: any,
): string[] {
  if (!discoveryQuestions?.lenses?.length) return PHASE_ORDER as string[];

  const lensKeys = discoveryQuestions.lenses.map((l: any) => l.key);
  return ['intro', ...lensKeys, 'prioritization', 'summary'];
}

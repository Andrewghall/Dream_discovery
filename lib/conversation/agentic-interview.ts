// Agentic turn engine — CANONICAL implementation for the Next.js REST API path
// (app/api/conversation). The real-time WebSocket voice path uses
// ethentaflow/server/src/agentic-turn.ts, which was ported from this file.
// Both files intentionally duplicate the rating-parsing helpers (parseScoreNearLabel,
// summarizeTripleRatings, extractTripleRatings) because the two packages cannot share
// code at runtime. Keep them in sync: rating scale is 1–5 in both.
import OpenAI from 'openai';
import {
  getFixedQuestionObject,
  type FixedQuestion,
} from '@/lib/conversation/fixed-questions';

export type DeliveryMode = 'scripted' | 'agentic';
export type PreferredInteractionMode = 'VOICE' | 'TEXT';

type SessionMessage = {
  role: 'AI' | 'PARTICIPANT';
  content: string;
  phase?: string | null;
  metadata?: unknown;
  createdAt?: Date | string | null;
};

type AgenticTurnParams = {
  openai: OpenAI | null;
  sessionStartedAt: Date;
  currentPhase: string;
  phaseOrder: string[];
  questionsByPhase: Record<string, FixedQuestion[]>;
  sessionMessages: SessionMessage[];
  workshopContext: string | null | undefined;
  workshopName: string | null | undefined;
  participantName: string | null | undefined;
  participantRole: string | null | undefined;
  participantDepartment: string | null | undefined;
  includeRegulation: boolean;
  preferredInteractionMode: PreferredInteractionMode;
};

export type AgenticTurnResult = {
  assistantMessage: string;
  nextPhase: string;
  metadata: Record<string, unknown> | undefined;
  phaseProgress: number;
  completeSession: boolean;
};

type AgenticDecision = {
  move?: 'probe' | 'advance';
  assistant_message?: string;
  guide_question_index?: number | null;
  sufficiency?: number | null;
  rationale?: string;
};

type TripleRatings = {
  today: number | null;
  target: number | null;
  doNothing: number | null;
};

export function formatTripleRatingPrompt(questionText: string): string {
  const trimmed = questionText.trim();
  const explicitInstruction = 'Please give me three scores from 1 to 5: where things are today, where they should be, and where they will be if nothing changes.';
  if (!trimmed) return explicitInstruction;
  if (/1\s*(?:to|-|–)\s*5/i.test(trimmed) && /today/i.test(trimmed) && /nothing changes|do nothing/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}\n\n${explicitInstruction}`;
}

function canonicalTripleRatingQuestion(phase: string): FixedQuestion | null {
  const canonicalPhases = new Set([
    'people',
    'operations',
    'technology',
    'commercial',
    'risk_compliance',
    'partners',
  ]);
  if (!canonicalPhases.has(phase)) return null;
  return getFixedQuestionObject(phase as any, 0, true, 'v1');
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = (raw || '').trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function questionMetaFromMessage(meta: unknown): { kind: 'question'; tag: string; index: number; phase: string } | null {
  if (!meta || typeof meta !== 'object') return null;
  const rec = meta as Record<string, unknown>;
  if (rec.kind !== 'question') return null;
  if (typeof rec.tag !== 'string' || typeof rec.phase !== 'string' || typeof rec.index !== 'number') return null;
  return { kind: 'question', tag: rec.tag, phase: rec.phase, index: rec.index };
}

export function detectDeliveryMode(messages: Array<{ metadata?: unknown }>): DeliveryMode {
  const firstQuestionMeta = messages
    .map((message) => {
      const meta = message.metadata;
      return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null;
    })
    .find((meta) => meta?.kind === 'question');

  return firstQuestionMeta?.deliveryMode === 'agentic' ? 'agentic' : 'scripted';
}

function words(texts: string[]): number {
  return texts
    .join(' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function parseScoreNearLabel(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const direct = new RegExp(`${label}\\s*[:=-]?\\s*(\\d{1,2})`, 'i').exec(text);
    if (direct) {
      const value = Number(direct[1]);
      // Enforce 1–5 scale — the spoken contract is explicit; reject anything outside
      if (value >= 1 && value <= 5) return value;
    }
  }
  return null;
}

export function extractTripleRatings(text: string): TripleRatings {
  const normalized = text.trim();
  const today = parseScoreNearLabel(normalized, ['today', 'current', 'now']);
  const target = parseScoreNearLabel(normalized, ['target', 'should be', 'ambition', 'future']);
  const doNothing = parseScoreNearLabel(normalized, ['projected', 'do nothing', 'if nothing changes', 'if we do nothing']);

  if (today !== null || target !== null || doNothing !== null) {
    return { today, target, doNothing };
  }

  const bareNumbers = [...normalized.matchAll(/\b([1-5])\b/g)].map((match) => Number(match[1]));
  if (bareNumbers.length >= 3) {
    return {
      today: bareNumbers[0] ?? null,
      target: bareNumbers[1] ?? null,
      doNothing: bareNumbers[2] ?? null,
    };
  }

  return { today: null, target: null, doNothing: null };
}

function summarizeTripleRatings(ratings: TripleRatings): string[] {
  const cues: string[] = [];
  if (ratings.today !== null && ratings.today <= 3) {
    cues.push('The participant sees the current state as weak, so probe pain, drag, and what is failing in practice.');
  } else if (ratings.today !== null && ratings.today >= 4) {
    // 4–5 on a 1–5 scale = strong
    cues.push('The participant sees the current state as comparatively strong, so probe what genuinely works, why it works, and where hidden fragility still exists.');
  }

  if (ratings.today !== null && ratings.target !== null) {
    const ambitionGap = ratings.target - ratings.today;
    if (ambitionGap >= 3) {
      cues.push('There is a large ambition gap, so probe what would have to change materially to close it.');
    } else if (ambitionGap <= 1) {
      cues.push('The target is close to today, so probe whether ambition is constrained or whether the participant sees the area as already near enough.');
    }
  }

  if (ratings.today !== null && ratings.doNothing !== null) {
    const drift = ratings.today - ratings.doNothing;
    if (drift >= 2) {
      cues.push('The participant expects decline if nothing changes, so probe risk, urgency, and what deterioration they are already seeing.');
    } else if (drift <= 0) {
      cues.push('The participant does not expect meaningful decline if nothing changes, so probe whether the issue is lower priority or whether the current model is more resilient than it appears.');
    }
  }

  return cues;
}

type RoleArchetype =
  | 'leadership'
  | 'commercial'
  | 'operations'
  | 'product_technology'
  | 'finance_risk'
  | 'people'
  | 'customer'
  | 'strategy';

const ROLE_ARCHETYPE_RULES: Array<{ archetype: RoleArchetype; pattern: RegExp }> = [
  {
    archetype: 'commercial',
    pattern: /\b(sales|commercial|revenue|marketing|growth|customer success|account|bid|proposal|partnerships?|demand generation|business development|go to market|gtm)\b/,
  },
  {
    archetype: 'operations',
    pattern: /\b(operations|service|delivery|support|process|transformation|quality|supply chain|fulfilment|contact centre|customer service|implementation|programme|program|project|pmo)\b/,
  },
  {
    archetype: 'product_technology',
    pattern: /\b(product|design|innovation|roadmap|ux|engineering|technology|data|digital|software|platform|architecture|architect|information|it)\b/,
  },
  {
    archetype: 'finance_risk',
    pattern: /\b(finance|risk|compliance|legal|procurement|governance|audit|security|privacy|controls?|regulat)\b/,
  },
  {
    archetype: 'people',
    pattern: /\b(people|hr|human resources|talent|learning|culture|organisation development|organizational development|l&d|recruitment)\b/,
  },
  {
    archetype: 'customer',
    pattern: /\b(customer experience|cx|customer|client success|service design|voice of customer|voc)\b/,
  },
  {
    archetype: 'strategy',
    pattern: /\b(strategy|strategic|planning|planning office|transformation office|corporate development|m&a|portfolio)\b/,
  },
];

function inferRoleArchetypes(text: string): RoleArchetype[] {
  const archetypes = new Set<RoleArchetype>();

  if (/\b(chief|officer|director|vp|vice president|head of|general manager|managing director|founder|owner|president|ceo|coo|cfo|cpo|cto|cio)\b/.test(text)) {
    archetypes.add('leadership');
  }

  for (const rule of ROLE_ARCHETYPE_RULES) {
    if (rule.pattern.test(text)) archetypes.add(rule.archetype);
  }

  return [...archetypes];
}

function buildPhaseRoleHooks(phase: string, archetypes: RoleArchetype[]): string[] {
  const hooks: string[] = [];
  const has = (archetype: RoleArchetype) => archetypes.includes(archetype);

  switch (phase) {
    case 'commercial':
      if (has('commercial')) {
        hooks.push('Probe GTM, ICP fit, proposition clarity, conversion quality, buyer objections, renewal signals, and what helps or hinders growth.');
      }
      if (has('operations')) {
        hooks.push('Ask how operations, delivery, service quality, and internal handoffs support or constrain sales, value delivery, and the promises made to customers.');
      }
      if (has('product_technology')) {
        hooks.push('Ask how roadmap choices, product design, data, and technical capability shape market fit, differentiation, and the ability to deliver the promised outcome.');
      }
      if (has('finance_risk')) {
        hooks.push('Ask how pricing discipline, investment choices, commercial guardrails, procurement, risk, or compliance affect deal quality and growth.');
      }
      if (has('people')) {
        hooks.push('Ask how capability, incentives, hiring, leadership behaviour, and ways of working strengthen or weaken commercial execution.');
      }
      if (has('customer')) {
        hooks.push('Ask what customers actually value, where trust is won or lost, and how the lived customer experience matches the commercial promise.');
      }
      if (has('strategy')) {
        hooks.push('Ask how market choices, focus, and strategic bets connect to ICP definition, value proposition, and growth logic.');
      }
      if (has('leadership')) {
        hooks.push('Take an enterprise view: strategic coherence, cross-functional alignment, tradeoffs, and the gap between ambition and market reality.');
      }
      break;
    case 'operations':
      if (has('commercial')) {
        hooks.push('Ask how sales commitments, client mix, and demand patterns affect delivery flow, service quality, and the ability to execute consistently.');
      }
      if (has('operations')) {
        hooks.push('Probe operating rhythm, throughput, handoffs, decision latency, service consistency, and where the work breaks down in practice.');
      }
      if (has('product_technology')) {
        hooks.push('Ask how product, systems, and process design support or slow execution, fulfilment, and service delivery.');
      }
      if (has('finance_risk')) {
        hooks.push('Ask where control, procurement, approvals, or policy create necessary discipline versus avoidable drag in the operating model.');
      }
      if (has('people')) {
        hooks.push('Ask how capability, management habits, staffing, and role clarity affect execution quality and operational resilience.');
      }
      if (has('customer')) {
        hooks.push('Ask how the operational model shows up in the customer experience, onboarding, responsiveness, and trust.');
      }
      if (has('strategy')) {
        hooks.push('Ask whether the operating model is genuinely aligned to the strategic priorities or still optimised for yesterday\'s business.');
      }
      break;
    case 'technology':
      if (has('commercial')) {
        hooks.push('Ask how systems, tooling, and data help or hinder pipeline quality, customer insight, proposition delivery, and revenue confidence.');
      }
      if (has('operations')) {
        hooks.push('Ask where technology removes friction, where it creates workarounds, and how well systems support delivery and service flow.');
      }
      if (has('product_technology')) {
        hooks.push('Probe roadmap quality, architectural constraints, data health, integration, automation, and what the future-state platform needs to enable.');
      }
      if (has('finance_risk')) {
        hooks.push('Ask how controls, security, risk, and compliance shape technology choices, speed, and trust.');
      }
      if (has('people')) {
        hooks.push('Ask whether teams have the capability, adoption, and behaviours required to use technology well.');
      }
      if (has('customer')) {
        hooks.push('Ask how technology quality shows up in customer experience, usability, responsiveness, and service confidence.');
      }
      if (has('strategy')) {
        hooks.push('Ask whether the technology estate supports the company\'s north star or traps it in fragmented local optimisation.');
      }
      break;
    case 'people':
      if (has('commercial')) {
        hooks.push('Ask how leadership, incentives, capability, and collaboration affect the ability to win the right work and deliver against the promise.');
      }
      if (has('operations')) {
        hooks.push('Ask how role clarity, management routines, capacity, and ways of working affect service reliability and execution.');
      }
      if (has('product_technology')) {
        hooks.push('Ask whether the organisation has the capability, product thinking, and cross-functional habits needed to design the future well.');
      }
      if (has('finance_risk')) {
        hooks.push('Ask how accountability, governance habits, and decision rights affect control without freezing momentum.');
      }
      if (has('people')) {
        hooks.push('Probe capability, culture, incentives, leadership behaviour, and whether the organisation is set up to learn and adapt.');
      }
      if (has('customer')) {
        hooks.push('Ask whether teams truly understand customer needs and whether internal behaviours reinforce or erode customer trust.');
      }
      if (has('strategy')) {
        hooks.push('Ask whether the organisation has the leadership alignment and capability to execute the chosen strategy.');
      }
      break;
    case 'risk_compliance':
      hooks.push('Keep the conversation practical: where risk, regulation, control, or governance protects the business versus where it creates avoidable drag.');
      if (has('commercial')) {
        hooks.push('Ask how risk or compliance affects deal shape, buyer confidence, sales cycle length, and the customers the business can credibly serve.');
      }
      if (has('operations')) {
        hooks.push('Ask where control, approvals, and policy help or hinder delivery, quality, and operational flow.');
      }
      if (has('product_technology')) {
        hooks.push('Ask how security, data, privacy, and product governance shape design choices and delivery speed.');
      }
      break;
    case 'partners':
      hooks.push('Ask how external partners, suppliers, channels, or dependencies strengthen or weaken outcomes in this lens.');
      break;
    case 'prioritization':
      hooks.push('Force tradeoffs: ask what matters most now, why it matters, and what the business should stop, fix, or commit to first.');
      break;
    default:
      break;
  }

  return hooks;
}

export function buildRoleGuidance(role: string | null | undefined, department: string | null | undefined, phase: string): string[] {
  const text = `${role ?? ''} ${department ?? ''}`.toLowerCase();
  const guidance: string[] = [];
  const archetypes = inferRoleArchetypes(text);

  if (role || department) {
    guidance.push(
      `Interpret the participant's title and department to understand their real world: what they own, what decisions they influence, what they are measured on, what dependencies they manage, and what outcomes they care about.`
    );
  }

  if (/\b(chief|officer|director|vp|vice president|head of|general manager|managing director|founder|owner|president)\b/.test(text)) {
    guidance.push('Treat them as senior leadership: probe enterprise tradeoffs, alignment, resource choices, strategic coherence, and how their function shapes performance.');
  }
  if (/\b(manager|lead|supervisor)\b/.test(text)) {
    guidance.push('Treat them as translating strategy into execution: probe handoffs, delivery friction, local performance realities, and the gap between policy and practice.');
  }
  if (/\b(analyst|specialist|associate|coordinator|executive|partner manager|product manager|designer|engineer|architect)\b/.test(text)) {
    guidance.push('Treat them as close to the work: probe actual workflows, tool friction, decision latency, customer or internal stakeholder pain, and concrete examples.');
  }

  if (archetypes.includes('commercial')) {
    guidance.push('Assume proximity to demand and customer value. Probe ICP fit, proposition clarity, conversion quality, retention, and what helps or hinders growth.');
  }
  if (archetypes.includes('operations')) {
    guidance.push('Assume proximity to execution and service flow. Probe operating rhythm, capacity, handoffs, service quality, and support for commercial goals.');
  }
  if (archetypes.includes('product_technology')) {
    guidance.push('Assume proximity to product and future-state design. Probe roadmap choices, customer need, adoption, feasibility, data, and north-star alignment.');
  }
  if (archetypes.includes('finance_risk')) {
    guidance.push('Assume proximity to control and stewardship. Probe where financial discipline, risk posture, compliance burden, and commercial agility reinforce or conflict.');
  }
  if (archetypes.includes('people')) {
    guidance.push('Assume proximity to capability, culture, incentives, and leadership behaviour. Probe whether the organisation is set up to learn, adapt, and support the strategy.');
  }
  if (archetypes.includes('customer')) {
    guidance.push('Assume proximity to lived customer experience. Probe trust, retention, service quality, feedback loops, and whether what is sold matches what customers experience.');
  }
  if (archetypes.includes('strategy')) {
    guidance.push('Assume proximity to enterprise direction and change. Probe strategic choices, sequencing, ambition, and whether operating reality supports the intended destination.');
  }

  if (/\b(cco|chief commercial officer|cmo|chief marketing officer|cro|chief revenue officer|sales director|head of sales|commercial director)\b/.test(text)) {
    guidance.push('Prioritise GTM, ICP fit, proposition clarity, sales friction, pipeline quality, retention, and commercial value creation.');
  }
  if (/\b(coo|chief operating officer|operations director|head of operations)\b/.test(text)) {
    guidance.push('Anchor on how operations, delivery, service quality, and internal handoffs support or constrain commercial performance and customer outcomes.');
  }
  if (/\b(cpo|chief product officer|product director|head of product)\b/.test(text)) {
    guidance.push('Focus on how product strategy, roadmap choices, customer need, and north-star design connect to ICP fit and end-value delivery.');
  }
  if (/\b(ceo|chief executive officer|md|managing director|founder|owner)\b/.test(text)) {
    guidance.push('Take an enterprise view: strategic coherence, cross-functional alignment, tradeoffs, and the gap between ambition and operating reality.');
  }

  guidance.push(...buildPhaseRoleHooks(phase, archetypes));

  if (phase === 'commercial' && guidance.length === 0) {
    guidance.push('Bring the lens back to customer need, value creation, proposition fit, and how this function influences demand or commercial outcomes.');
  }
  if (phase === 'operations' && guidance.length === 0) {
    guidance.push('Probe how execution, handoffs, governance, and service flow affect the participant’s ability to support the wider business.');
  }
  if (phase === 'technology' && guidance.length === 0) {
    guidance.push('Probe how tools, data, systems, and automation help or hinder the participant’s world.');
  }

  if (guidance.length === 0) {
    guidance.push('Keep the probe grounded in this participant’s day-to-day responsibilities, decisions, and view of the organisation.');
  }

  return guidance;
}

function buildPhaseObjective(questions: FixedQuestion[], phase: string): string {
  const hints = questions
    .slice(1)
    .map((question) => question.text.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (hints.length === 0) {
    return `Explore the ${phase} lens through the participant's real experience.`;
  }

  return `Use these themes as guidance, not a script: ${hints.join(' | ')}`;
}

function desiredTurnsForPhase(phase: string, averageWords: number): number {
  if (phase === 'intro') return 1;
  if (phase === 'prioritization') return 2;
  if (phase === 'summary') return 1;
  if (averageWords >= 120) return 2;
  if (averageWords >= 70) return 3;
  return 4;
}

function buildFallbackProbe(guideQuestion: FixedQuestion | null, phase: string): string {
  switch (guideQuestion?.tag) {
    case 'strengths':
      return 'What specifically makes that work when it works well?';
    case 'gaps':
      return 'Where does that break down most often in practice?';
    case 'future':
      return 'What would need to change first to make that real?';
    case 'friction':
    case 'barrier':
    case 'constraint':
      return 'Where does that friction show up most sharply day to day?';
    case 'working':
      return 'What tells you that is genuinely working rather than just being managed around?';
    case 'pain_points':
      return 'What is the hardest part of that in your world right now?';
    case 'support':
    case 'helpful':
      return 'Who or what makes the biggest difference there?';
    default:
      break;
  }

  switch (phase) {
    case 'people':
      return 'What sits underneath that from a people, capability, or ways-of-working point of view?';
    case 'operations':
      return 'What does that look like in practice in the way work flows or decisions get made?';
    case 'technology':
      return 'How do the systems, tools, or data around that help or get in the way?';
    case 'commercial':
      return 'How does that affect customer value, proposition fit, or commercial performance?';
    case 'risk_compliance':
      return 'Where does risk or compliance show up most sharply in that picture?';
    case 'partners':
      return 'How do external partners or dependencies influence that outcome?';
    case 'prioritization':
      return 'If you had to choose one area to tackle first, where would you focus and why?';
    default:
      return 'Can you give me a concrete example of that from your own world?';
  }
}

function buildRatingsDrivenProbe(
  ratings: TripleRatings,
  phase: string,
  guideQuestion: FixedQuestion | null,
): string | null {
  const ambitionGap =
    ratings.today !== null && ratings.target !== null
      ? ratings.target - ratings.today
      : null;
  const declineRisk =
    ratings.today !== null && ratings.doNothing !== null
      ? ratings.today - ratings.doNothing
      : null;

  if (ratings.today !== null && ratings.today <= 3) {
    switch (phase) {
      case 'commercial':
        return 'What is the clearest sign today that the commercial model is not working as it should?';
      case 'operations':
        return 'Where does that weakness show up most obviously in the day-to-day flow of work?';
      case 'technology':
        return 'Where do the systems or data make that weakness harder to fix?';
      default:
        return 'What is the clearest sign in practice that this area is weaker than it needs to be?';
    }
  }

  if (ambitionGap !== null && ambitionGap >= 3) {
    return 'What would have to change most materially to move from today to the level you actually want?';
  }

  if (declineRisk !== null && declineRisk >= 2) {
    return 'What gets worse first if nothing changes here?';
  }

  if (ratings.today !== null && ratings.today >= 4) {
    // 4–5 on a 1–5 scale = strong
    return guideQuestion?.tag === 'strengths'
      ? 'What is genuinely making that work well today, rather than just holding it together?'
      : 'What is the real reason this area is performing relatively well today?';
  }

  return null;
}

export function compressPromptForMode(text: string, mode: PreferredInteractionMode): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  if (mode === 'VOICE') {
    const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0] || trimmed;
    return firstSentence.length <= 160 ? firstSentence : `${firstSentence.slice(0, 157).trim()}...`;
  }

  return trimmed.length <= 220 ? trimmed : `${trimmed.slice(0, 217).trim()}...`;
}

function getNextPhase(currentPhase: string, phaseOrder: string[]): string {
  const idx = phaseOrder.indexOf(currentPhase);
  if (idx < 0) return phaseOrder[phaseOrder.length - 1] || 'summary';
  return phaseOrder[Math.min(idx + 1, phaseOrder.length - 1)] || 'summary';
}

function parseCreatedAt(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildTransitionMessage(nextPhase: string, questionsByPhase: Record<string, FixedQuestion[]>): {
  assistantMessage: string;
  metadata: Record<string, unknown> | undefined;
} {
  const nextQuestions = questionsByPhase[nextPhase] || [];
  const opener = nextQuestions[0] || null;
  const canonicalOpener = opener?.tag === 'triple_rating'
    ? canonicalTripleRatingQuestion(nextPhase)
    : null;
  const resolvedOpener = canonicalOpener || opener;

  if (!resolvedOpener) {
    return {
      assistantMessage: '',
      metadata: undefined,
    };
  }

  return {
    assistantMessage: resolvedOpener.tag === 'triple_rating'
      ? formatTripleRatingPrompt(resolvedOpener.text)
      : resolvedOpener.text,
    metadata: {
      kind: 'question',
      tag: resolvedOpener.tag,
      index: 0,
      phase: nextPhase,
      maturityScale: resolvedOpener.maturityScale,
      deliveryMode: 'agentic',
      exactOpener: true,
    },
  };
}

async function askModelForDecision(params: {
  openai: OpenAI;
  currentPhase: string;
  phaseQuestions: FixedQuestion[];
  participantAnswers: string[];
  guideCandidates: Array<{ index: number; question: FixedQuestion }>;
  roleGuidance: string[];
  phaseObjective: string;
  participantRole: string | null | undefined;
  participantDepartment: string | null | undefined;
  workshopContext: string | null | undefined;
  workshopName: string | null | undefined;
  participantName: string | null | undefined;
  elapsedMinutes: number;
  remainingMinutes: number;
  shouldBiasToClose: boolean;
  preferredInteractionMode: PreferredInteractionMode;
  tripleRatings: TripleRatings;
  tripleRatingGuidance: string[];
}): Promise<AgenticDecision | null> {
  const prompt = {
    lens: params.currentPhase,
    workshop_name: params.workshopName ?? null,
    participant_name: params.participantName ?? null,
    participant_role: params.participantRole ?? null,
    participant_department: params.participantDepartment ?? null,
    workshop_context: params.workshopContext ?? null,
    elapsed_minutes: Number(params.elapsedMinutes.toFixed(1)),
    remaining_minutes: Number(params.remainingMinutes.toFixed(1)),
    should_bias_to_close: params.shouldBiasToClose,
    preferred_interaction_mode: params.preferredInteractionMode,
    opener_ratings: params.tripleRatings,
    opener_rating_guidance: params.tripleRatingGuidance,
    phase_objective: params.phaseObjective,
    role_guidance: params.roleGuidance,
    participant_answers_in_this_lens: params.participantAnswers,
    guide_questions: params.guideCandidates.map((candidate) => ({
      index: candidate.index,
      tag: candidate.question.tag,
      text: candidate.question.text,
    })),
  };

  const completion = await params.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.35,
    response_format: { type: 'json_object' } as any,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert discovery interviewer. You are running a free-flow but bounded business interview. ' +
          'The exact maturity opener has already been asked for this lens. ' +
          'Use the guide questions only as themes and probes, not as a script. ' +
          'Ask exactly one concise next question in natural spoken language. ' +
          'Make it role-aware, commercially intelligent, and grounded in the participant\'s world. ' +
          'Do not repeat a guide question verbatim. Build on what the participant just said, and challenge soft assumptions when useful. ' +
          'Prefer concrete probes, examples, tradeoffs, tensions, and evidence over generic prompts. ' +
          'Use the opener ratings as control signals. Low today scores should produce different probes from high today scores. Large target gaps and strong do-nothing decline signals should increase urgency and change the follow-up. ' +
          'If the title is unfamiliar, infer likely ownership, metrics, dependencies, and decision rights from the title and department before asking the next question. ' +
          'Interpret each lens through that real-world ownership instead of asking generic maturity questions. ' +
          'Do not stack multiple questions together or repeat the documented opener. ' +
          'If preferred_interaction_mode is VOICE, keep the question short, direct, and easy to answer aloud. ' +
          'If preferred_interaction_mode is TEXT, you may be slightly more explicit, but still ask only one compact question. ' +
          'When the lens is sufficiently covered or time is tight, choose move="advance". ' +
          'Return JSON only with keys: move, assistant_message, guide_question_index, sufficiency, rationale.',
      },
      {
        role: 'user',
        content: JSON.stringify(prompt),
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '';
  const parsed = parseJsonObject(raw);
  if (!parsed) return null;

  return {
    move:
      parsed.move === 'advance' || parsed.move === 'probe'
        ? (parsed.move as 'advance' | 'probe')
        : undefined,
    assistant_message:
      typeof parsed.assistant_message === 'string' ? parsed.assistant_message.trim() : undefined,
    guide_question_index:
      typeof parsed.guide_question_index === 'number' ? parsed.guide_question_index : null,
    sufficiency:
      typeof parsed.sufficiency === 'number' ? parsed.sufficiency : null,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.trim() : undefined,
  };
}

export async function generateAgenticTurn(params: AgenticTurnParams): Promise<AgenticTurnResult> {
  const phaseQuestions = params.questionsByPhase[params.currentPhase] || [];
  const phaseMessages = params.sessionMessages.filter((message) => message.phase === params.currentPhase);
  const participantAnswers = phaseMessages
    .filter((message) => message.role === 'PARTICIPANT')
    .filter((message) => {
      const meta = message.metadata && typeof message.metadata === 'object'
        ? (message.metadata as Record<string, unknown>)
        : null;
      return meta?.kind !== 'clarification';
    })
    .map((message) => message.content.trim())
    .filter(Boolean);

  const averageWords = participantAnswers.length > 0
    ? Math.round(words(participantAnswers) / participantAnswers.length)
    : 0;

  const targetTurns = desiredTurnsForPhase(params.currentPhase, averageWords);
  const elapsedMinutes = (Date.now() - params.sessionStartedAt.getTime()) / 60000;
  const totalTargetMinutes = params.includeRegulation ? 28 : 24;
  const remainingMinutes = Math.max(0, totalTargetMinutes - elapsedMinutes);
  const shouldBiasToClose = remainingMinutes <= 4;
  const phaseStartedAtMs = phaseMessages
    .map((message) => parseCreatedAt(message.createdAt))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0] ?? params.sessionStartedAt.getTime();
  const phaseElapsedMinutes = Math.max(0, (Date.now() - phaseStartedAtMs) / 60000);

  const phaseQuestionMetas = phaseMessages
    .filter((message) => message.role === 'AI')
    .map((message) => questionMetaFromMessage(message.metadata))
    .filter((meta): meta is NonNullable<typeof meta> => meta !== null);
  const usedGuideIndexes = new Set(phaseQuestionMetas.map((meta) => meta.index));
  const hasAskedGuideQuestion = phaseQuestionMetas.some((meta) => meta.index > 0);
  const requiresLensProbeBeforeAdvance = !['intro', 'prioritization', 'summary'].includes(params.currentPhase);
  const canAdvanceFromCurrentLens = !requiresLensProbeBeforeAdvance || (hasAskedGuideQuestion && participantAnswers.length >= 2);

  const guideCandidates = phaseQuestions
    .map((question, index) => ({ index, question }))
    .filter((candidate) => candidate.index > 0 && !usedGuideIndexes.has(candidate.index));
  const openerAnswer = participantAnswers[0] || '';
  const tripleRatings = extractTripleRatings(openerAnswer);
  const tripleRatingGuidance = summarizeTripleRatings(tripleRatings);

  const shouldAdvanceDeterministically =
    params.currentPhase === 'summary' ||
    (params.currentPhase === 'intro' && participantAnswers.length >= 1) ||
    (params.currentPhase === 'prioritization' && participantAnswers.length >= 2) ||
    (requiresLensProbeBeforeAdvance && phaseElapsedMinutes >= 5) ||
    (canAdvanceFromCurrentLens && participantAnswers.length >= targetTurns) ||
    (canAdvanceFromCurrentLens && participantAnswers.length >= 3 && averageWords >= 35) ||
    (canAdvanceFromCurrentLens && participantAnswers.length >= 2 && averageWords >= 150);

  if (shouldAdvanceDeterministically) {
    const nextPhase = getNextPhase(params.currentPhase, params.phaseOrder);
    const transition = buildTransitionMessage(nextPhase, params.questionsByPhase);
    const completeSession = nextPhase === 'summary';
    const summaryOnly = params.currentPhase === 'summary' || transition.assistantMessage.length === 0;

    return {
      assistantMessage: summaryOnly
        ? (phaseQuestions[0]?.text || 'Thank you. That completes the interview.')
        : transition.assistantMessage,
      nextPhase: summaryOnly ? params.currentPhase : nextPhase,
      metadata: summaryOnly
        ? {
            kind: 'question',
            tag: phaseQuestions[0]?.tag || 'closing',
            index: 0,
            phase: params.currentPhase,
            deliveryMode: 'agentic',
          }
        : transition.metadata,
      phaseProgress: summaryOnly ? 100 : Math.max(0, Math.min(100, Math.round((1 / Math.max((params.questionsByPhase[nextPhase] || []).length, 1)) * 100))),
      completeSession,
    };
  }

  const roleGuidance = buildRoleGuidance(params.participantRole, params.participantDepartment, params.currentPhase);
  const phaseObjective = buildPhaseObjective(phaseQuestions, params.currentPhase);

  let modelDecision: AgenticDecision | null = null;
  if (params.openai) {
    modelDecision = await askModelForDecision({
      openai: params.openai,
      currentPhase: params.currentPhase,
      phaseQuestions,
      participantAnswers,
      guideCandidates,
      roleGuidance,
      phaseObjective,
      participantRole: params.participantRole,
      participantDepartment: params.participantDepartment,
      workshopContext: params.workshopContext,
      workshopName: params.workshopName,
      participantName: params.participantName,
      elapsedMinutes,
      remainingMinutes,
      shouldBiasToClose,
      preferredInteractionMode: params.preferredInteractionMode,
      tripleRatings,
      tripleRatingGuidance,
    }).catch(() => null);
  }

  if (modelDecision?.move === 'advance' && canAdvanceFromCurrentLens) {
    const nextPhase = getNextPhase(params.currentPhase, params.phaseOrder);
    const transition = buildTransitionMessage(nextPhase, params.questionsByPhase);
    return {
      assistantMessage: transition.assistantMessage || phaseQuestions[0]?.text || 'Thank you. Let’s move on.',
      nextPhase,
      metadata: transition.metadata,
      phaseProgress: Math.max(0, Math.min(100, Math.round((1 / Math.max((params.questionsByPhase[nextPhase] || []).length, 1)) * 100))),
      completeSession: nextPhase === 'summary',
    };
  }

  const preferredGuideIndex =
    typeof modelDecision?.guide_question_index === 'number' && guideCandidates.some((candidate) => candidate.index === modelDecision?.guide_question_index)
      ? modelDecision.guide_question_index
      : (guideCandidates[0]?.index ?? 1);
  const selectedGuideQuestion = phaseQuestions[preferredGuideIndex] || null;
  const ratingsDrivenProbe = hasAskedGuideQuestion
    ? null
    : buildRatingsDrivenProbe(tripleRatings, params.currentPhase, selectedGuideQuestion);
  const assistantMessage =
    (typeof modelDecision?.assistant_message === 'string' && modelDecision.assistant_message.trim())
      ? modelDecision.assistant_message.trim()
      : ratingsDrivenProbe
        ? ratingsDrivenProbe
      : buildFallbackProbe(selectedGuideQuestion, params.currentPhase);

  const phaseProgress = Math.max(
    0,
    Math.min(95, Math.round(((participantAnswers.length + 1) / Math.max(targetTurns, 1)) * 100)),
  );

  return {
    assistantMessage: compressPromptForMode(assistantMessage, params.preferredInteractionMode),
    nextPhase: params.currentPhase,
    metadata: selectedGuideQuestion
      ? {
          kind: 'question',
          tag: selectedGuideQuestion.tag,
          index: preferredGuideIndex,
          phase: params.currentPhase,
          maturityScale: selectedGuideQuestion.maturityScale,
          deliveryMode: 'agentic',
          rationale: modelDecision?.rationale ?? null,
        }
      : {
          kind: 'question',
          tag: 'context',
          index: 1,
          phase: params.currentPhase,
          deliveryMode: 'agentic',
          rationale: modelDecision?.rationale ?? null,
        },
    phaseProgress,
    completeSession: false,
  };
}

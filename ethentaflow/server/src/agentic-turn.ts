// Agentic turn engine — CANONICAL implementation for the real-time WebSocket voice path
// (ethentaflow/server). Originally ported from lib/conversation/agentic-interview.ts,
// which remains the canonical implementation for the Next.js REST API path.
// Both files intentionally duplicate the rating-parsing helpers (parseScoreNearLabel,
// summarizeTripleRatings, extractTripleRatings) because the two packages cannot share
// code at runtime. Keep them in sync: rating scale is 1–5 in both.
//
// Replaces the deterministic 5×5 InterviewController with a free-flowing
// LLM-driven conversation. The model decides whether to probe deeper or
// advance to the next lens, guided by role archetype, triple ratings, and
// phase context.
//
// Key exports:
//   generateAgenticTurn()       — main per-turn decision function
//   agenticGenerateFinalSynthesis() — produces the spoken session summary
//   extractTripleRatings()      — parses today/target/doNothing from an answer
//   formatTripleRatingPrompt()  — ensures Q1 always asks for three scores

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import OpenAI from 'openai';
import { PHASE_QUESTIONS } from './phase-questions.js';
import type { FixedQuestion } from './phase-questions.js';

// ── Probe strategy prompt (loaded once at module init) ───────────────────────
// Reads ethentaflow/prompts/probe-generator.md and extracts the system-prompt
// section (between the first pair of ``` fences). Falls back to '' if missing.
const _PROBE_GENERATOR_SYSTEM = (() => {
  try {
    const mdPath = join(dirname(fileURLToPath(import.meta.url)), '../../prompts/probe-generator.md');
    const md = readFileSync(mdPath, 'utf-8');
    const match = md.match(/```\n([\s\S]*?)\n```/);
    return match?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
})();

// Model for the per-turn agentic decision — higher quality than gpt-4o-mini
// used elsewhere. Override via DECISION_MODEL env var if needed.
const DECISION_MODEL = process.env.DECISION_MODEL ?? 'gpt-4o';

export type PreferredInteractionMode = 'VOICE' | 'TEXT';

export type SessionMessage = {
  role: 'AI' | 'PARTICIPANT';
  content: string;
  phase?: string | null;
  metadata?: unknown;
  createdAt?: Date | string | null;
};

export type AgenticTurnParams = {
  openai: OpenAI | null;
  sessionStartedAt: Date;
  currentPhase: string;
  phaseOrder: string[];
  sessionMessages: SessionMessage[];
  workshopContext?: string | null;
  workshopName?: string | null;
  participantName?: string | null;
  participantRole?: string | null;
  participantDepartment?: string | null;
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

export type TripleRatings = {
  today: number | null;
  target: number | null;
  doNothing: number | null;
};

// ── Triple rating helpers ────────────────────────────────────────────────────

export function formatTripleRatingPrompt(questionText: string): string {
  const trimmed = questionText.trim();
  const explicitInstruction =
    'Please give me three scores from 1 to 5: where things are today, where they should be, and where they will be if nothing changes.';
  if (!trimmed) return explicitInstruction;
  if (
    /1\s*(?:to|-|–)\s*5/i.test(trimmed) &&
    /today/i.test(trimmed) &&
    /nothing changes|do nothing/i.test(trimmed)
  ) {
    return trimmed;
  }
  return `${trimmed}\n\n${explicitInstruction}`;
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
  const doNothing = parseScoreNearLabel(normalized, [
    'projected',
    'do nothing',
    'if nothing changes',
    'if we do nothing',
  ]);

  if (today !== null || target !== null || doNothing !== null) {
    return { today, target, doNothing };
  }

  const bareNumbers = [...normalized.matchAll(/\b([1-5])\b/g)].map((match) =>
    Number(match[1]),
  );
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
    cues.push(
      'The participant sees the current state as weak, so probe pain, drag, and what is failing in practice.',
    );
  } else if (ratings.today !== null && ratings.today >= 4) {
    // 4–5 on a 1–5 scale = strong; the old threshold of >=7 was unreachable
    cues.push(
      'The participant sees the current state as comparatively strong, so probe what genuinely works, why it works, and where hidden fragility still exists.',
    );
  }

  if (ratings.today !== null && ratings.target !== null) {
    const ambitionGap = ratings.target - ratings.today;
    if (ambitionGap >= 3) {
      cues.push('There is a large ambition gap, so probe what would have to change materially to close it.');
    } else if (ambitionGap <= 1) {
      cues.push(
        'The target is close to today, so probe whether ambition is constrained or whether the participant sees the area as already near enough.',
      );
    }
  }

  if (ratings.today !== null && ratings.doNothing !== null) {
    const drift = ratings.today - ratings.doNothing;
    if (drift >= 2) {
      cues.push(
        'The participant expects decline if nothing changes, so probe risk, urgency, and what deterioration they are already seeing.',
      );
    } else if (drift <= 0) {
      cues.push(
        'The participant does not expect meaningful decline if nothing changes, so probe whether the issue is lower priority or whether the current model is more resilient than it appears.',
      );
    }
  }

  return cues;
}

// ── Role archetype inference ─────────────────────────────────────────────────

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
    pattern:
      /\b(sales|commercial|revenue|marketing|growth|customer success|account|bid|proposal|partnerships?|demand generation|business development|go to market|gtm)\b/,
  },
  {
    archetype: 'operations',
    pattern:
      /\b(operations|service|delivery|support|process|transformation|quality|supply chain|fulfilment|contact centre|customer service|implementation|programme|program|project|pmo)\b/,
  },
  {
    archetype: 'product_technology',
    pattern:
      /\b(product|design|innovation|roadmap|ux|engineering|technology|data|digital|software|platform|architecture|architect|information|it)\b/,
  },
  {
    archetype: 'finance_risk',
    pattern:
      /\b(finance|risk|compliance|legal|procurement|governance|audit|security|privacy|controls?|regulat)\b/,
  },
  {
    archetype: 'people',
    pattern:
      /\b(people|hr|human resources|talent|learning|culture|organisation development|organizational development|l&d|recruitment)\b/,
  },
  {
    archetype: 'customer',
    pattern:
      /\b(customer experience|cx|customer|client success|service design|voice of customer|voc)\b/,
  },
  {
    archetype: 'strategy',
    pattern:
      /\b(strategy|strategic|planning|planning office|transformation office|corporate development|m&a|portfolio)\b/,
  },
];

function inferRoleArchetypes(text: string): RoleArchetype[] {
  const archetypes = new Set<RoleArchetype>();

  if (
    /\b(chief|officer|director|vp|vice president|head of|general manager|managing director|founder|owner|president|ceo|coo|cfo|cpo|cto|cio)\b/.test(
      text,
    )
  ) {
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
      if (has('commercial'))
        hooks.push(
          'Probe GTM, ICP fit, proposition clarity, conversion quality, buyer objections, renewal signals, and what helps or hinders growth.',
        );
      if (has('operations'))
        hooks.push(
          'Ask how operations, delivery, service quality, and internal handoffs support or constrain sales, value delivery, and the promises made to customers.',
        );
      if (has('product_technology'))
        hooks.push(
          'Ask how roadmap choices, product design, data, and technical capability shape market fit, differentiation, and the ability to deliver the promised outcome.',
        );
      if (has('finance_risk'))
        hooks.push(
          'Ask how pricing discipline, investment choices, commercial guardrails, procurement, risk, or compliance affect deal quality and growth.',
        );
      if (has('people'))
        hooks.push(
          'Ask how capability, incentives, hiring, leadership behaviour, and ways of working strengthen or weaken commercial execution.',
        );
      if (has('customer'))
        hooks.push(
          'Ask what customers actually value, where trust is won or lost, and how the lived customer experience matches the commercial promise.',
        );
      if (has('strategy'))
        hooks.push(
          'Ask how market choices, focus, and strategic bets connect to ICP definition, value proposition, and growth logic.',
        );
      if (has('leadership'))
        hooks.push(
          'Take an enterprise view: strategic coherence, cross-functional alignment, tradeoffs, and the gap between ambition and market reality.',
        );
      break;
    case 'operations':
      if (has('commercial'))
        hooks.push(
          'Ask how sales commitments, client mix, and demand patterns affect delivery flow, service quality, and the ability to execute consistently.',
        );
      if (has('operations'))
        hooks.push(
          'Probe operating rhythm, throughput, handoffs, decision latency, service consistency, and where the work breaks down in practice.',
        );
      if (has('product_technology'))
        hooks.push(
          'Ask how product, systems, and process design support or slow execution, fulfilment, and service delivery.',
        );
      if (has('finance_risk'))
        hooks.push(
          'Ask where control, procurement, approvals, or policy create necessary discipline versus avoidable drag in the operating model.',
        );
      if (has('people'))
        hooks.push(
          'Ask how capability, management habits, staffing, and role clarity affect execution quality and operational resilience.',
        );
      if (has('customer'))
        hooks.push(
          'Ask how the operational model shows up in the customer experience, onboarding, responsiveness, and trust.',
        );
      if (has('strategy'))
        hooks.push(
          "Ask whether the operating model is genuinely aligned to the strategic priorities or still optimised for yesterday's business.",
        );
      break;
    case 'technology':
      if (has('commercial'))
        hooks.push(
          'Ask how systems, tooling, and data help or hinder pipeline quality, customer insight, proposition delivery, and revenue confidence.',
        );
      if (has('operations'))
        hooks.push(
          'Ask where technology removes friction, where it creates workarounds, and how well systems support delivery and service flow.',
        );
      if (has('product_technology'))
        hooks.push(
          'Probe roadmap quality, architectural constraints, data health, integration, automation, and what the future-state platform needs to enable.',
        );
      if (has('finance_risk'))
        hooks.push('Ask how controls, security, risk, and compliance shape technology choices, speed, and trust.');
      if (has('people'))
        hooks.push('Ask whether teams have the capability, adoption, and behaviours required to use technology well.');
      if (has('customer'))
        hooks.push(
          'Ask how technology quality shows up in customer experience, usability, responsiveness, and service confidence.',
        );
      if (has('strategy'))
        hooks.push(
          "Ask whether the technology estate supports the company's north star or traps it in fragmented local optimisation.",
        );
      break;
    case 'people':
      if (has('commercial'))
        hooks.push(
          'Ask how leadership, incentives, capability, and collaboration affect the ability to win the right work and deliver against the promise.',
        );
      if (has('operations'))
        hooks.push(
          'Ask how role clarity, management routines, capacity, and ways of working affect service reliability and execution.',
        );
      if (has('product_technology'))
        hooks.push(
          'Ask whether the organisation has the capability, product thinking, and cross-functional habits needed to design the future well.',
        );
      if (has('finance_risk'))
        hooks.push(
          'Ask how accountability, governance habits, and decision rights affect control without freezing momentum.',
        );
      if (has('people'))
        hooks.push(
          'Probe capability, culture, incentives, leadership behaviour, and whether the organisation is set up to learn and adapt.',
        );
      if (has('customer'))
        hooks.push(
          'Ask whether teams truly understand customer needs and whether internal behaviours reinforce or erode customer trust.',
        );
      if (has('strategy'))
        hooks.push(
          'Ask whether the organisation has the leadership alignment and capability to execute the chosen strategy.',
        );
      break;
    case 'risk_compliance':
      hooks.push(
        'Keep the conversation practical: where risk, regulation, control, or governance protects the business versus where it creates avoidable drag.',
      );
      if (has('commercial'))
        hooks.push(
          'Ask how risk or compliance affects deal shape, buyer confidence, sales cycle length, and the customers the business can credibly serve.',
        );
      if (has('operations'))
        hooks.push(
          'Ask where control, approvals, and policy help or hinder delivery, quality, and operational flow.',
        );
      if (has('product_technology'))
        hooks.push(
          'Ask how security, data, privacy, and product governance shape design choices and delivery speed.',
        );
      break;
    case 'partners':
      hooks.push('Ask how external partners, suppliers, channels, or dependencies strengthen or weaken outcomes in this lens.');
      break;
    default:
      break;
  }

  return hooks;
}

function buildRoleGuidance(
  role: string | null | undefined,
  department: string | null | undefined,
  phase: string,
): string[] {
  const text = `${role ?? ''} ${department ?? ''}`.toLowerCase();
  const guidance: string[] = [];
  const archetypes = inferRoleArchetypes(text);

  if (role || department) {
    guidance.push(
      "Interpret the participant's title and department to understand their real world: what they own, what decisions they influence, what they are measured on, what dependencies they manage, and what outcomes they care about.",
    );
  }

  if (
    /\b(chief|officer|director|vp|vice president|head of|general manager|managing director|founder|owner|president)\b/.test(
      text,
    )
  ) {
    guidance.push(
      'Treat them as senior leadership: probe enterprise tradeoffs, alignment, resource choices, strategic coherence, and how their function shapes performance.',
    );
  }
  if (/\b(manager|lead|supervisor)\b/.test(text)) {
    guidance.push(
      'Treat them as translating strategy into execution: probe handoffs, delivery friction, local performance realities, and the gap between policy and practice.',
    );
  }
  if (
    /\b(analyst|specialist|associate|coordinator|executive|partner manager|product manager|designer|engineer|architect)\b/.test(
      text,
    )
  ) {
    guidance.push(
      'Treat them as close to the work: probe actual workflows, tool friction, decision latency, customer or internal stakeholder pain, and concrete examples.',
    );
  }

  if (archetypes.includes('commercial')) {
    guidance.push(
      'Assume proximity to demand and customer value. Probe ICP fit, proposition clarity, conversion quality, retention, and what helps or hinders growth.',
    );
  }
  if (archetypes.includes('operations')) {
    guidance.push(
      'Assume proximity to execution and service flow. Probe operating rhythm, capacity, handoffs, service quality, and support for commercial goals.',
    );
  }
  if (archetypes.includes('product_technology')) {
    guidance.push(
      'Assume proximity to product and future-state design. Probe roadmap choices, customer need, adoption, feasibility, data, and north-star alignment.',
    );
  }
  if (archetypes.includes('finance_risk')) {
    guidance.push(
      'Assume proximity to control and stewardship. Probe where financial discipline, risk posture, compliance burden, and commercial agility reinforce or conflict.',
    );
  }
  if (archetypes.includes('people')) {
    guidance.push(
      'Assume proximity to capability, culture, incentives, and leadership behaviour. Probe whether the organisation is set up to learn, adapt, and support the strategy.',
    );
  }
  if (archetypes.includes('customer')) {
    guidance.push(
      'Assume proximity to lived customer experience. Probe trust, retention, service quality, feedback loops, and whether what is sold matches what customers experience.',
    );
  }
  if (archetypes.includes('strategy')) {
    guidance.push(
      'Assume proximity to enterprise direction and change. Probe strategic choices, sequencing, ambition, and whether operating reality supports the intended destination.',
    );
  }

  if (
    /\b(cco|chief commercial officer|cmo|chief marketing officer|cro|chief revenue officer|sales director|head of sales|commercial director)\b/.test(
      text,
    )
  ) {
    guidance.push(
      'Prioritise GTM, ICP fit, proposition clarity, sales friction, pipeline quality, retention, and commercial value creation.',
    );
  }
  if (/\b(coo|chief operating officer|operations director|head of operations)\b/.test(text)) {
    guidance.push(
      'Anchor on how operations, delivery, service quality, and internal handoffs support or constrain commercial performance and customer outcomes.',
    );
  }
  if (/\b(cpo|chief product officer|product director|head of product)\b/.test(text)) {
    guidance.push(
      'Focus on how product strategy, roadmap choices, customer need, and north-star design connect to ICP fit and end-value delivery.',
    );
  }
  if (/\b(ceo|chief executive officer|md|managing director|founder|owner)\b/.test(text)) {
    guidance.push(
      'Take an enterprise view: strategic coherence, cross-functional alignment, tradeoffs, and the gap between ambition and operating reality.',
    );
  }

  guidance.push(...buildPhaseRoleHooks(phase, archetypes));

  if (phase === 'commercial' && guidance.length === 0) {
    guidance.push(
      'Bring the lens back to customer need, value creation, proposition fit, and how this function influences demand or commercial outcomes.',
    );
  }
  if (phase === 'operations' && guidance.length === 0) {
    guidance.push(
      "Probe how execution, handoffs, governance, and service flow affect the participant's ability to support the wider business.",
    );
  }
  if (phase === 'technology' && guidance.length === 0) {
    guidance.push('Probe how tools, data, systems, and automation help or hinder the participant\'s world.');
  }

  if (guidance.length === 0) {
    guidance.push(
      "Keep the probe grounded in this participant's day-to-day responsibilities, decisions, and view of the organisation.",
    );
  }

  return guidance;
}

function buildPhaseObjective(questions: FixedQuestion[], phase: string): string {
  const hints = questions
    .slice(1)
    .map((q) => q.text.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (hints.length === 0) {
    return `Explore the ${phase} lens through the participant's real experience.`;
  }

  return `Use these themes as guidance, not a script: ${hints.join(' | ')}`;
}

// desiredTurnsForPhase removed — lens advancement is now decided by lensSufficiencyCheck (LLM)
// rather than word-count / turn-count heuristics.

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
    ratings.today !== null && ratings.target !== null ? ratings.target - ratings.today : null;
  const declineRisk =
    ratings.today !== null && ratings.doNothing !== null ? ratings.today - ratings.doNothing : null;

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

  if (ratings.today !== null && ratings.today >= 7) {
    return guideQuestion?.tag === 'strengths'
      ? 'What is genuinely making that work well today, rather than just holding it together?'
      : 'What is the real reason this area is performing relatively well today?';
  }

  return null;
}

/** Strip em dashes and en dashes — they sound terrible when spoken aloud. */
function stripDashes(text: string): string {
  // Replace em/en dash with comma-space when surrounded by words, otherwise just remove
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .trim();
}

export function compressPromptForMode(text: string, mode: PreferredInteractionMode): string {
  const trimmed = stripDashes(text.trim());
  if (!trimmed) return trimmed;

  if (mode === 'VOICE') {
    const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0] || trimmed;
    return firstSentence.length <= 160 ? firstSentence : `${firstSentence.slice(0, 157).trim()}...`;
  }

  return trimmed.length <= 220 ? trimmed : `${trimmed.slice(0, 217).trim()}...`;
}

// ── Live answer evaluation (runs in pause callback, not post-hoc) ─────────────
//
// Fires at EVERY natural speech pause via the endpoint detector's pause callback.
// This is real-time: the speaker may still be mid-thought.
//
// Returns:
//   complete  — false means the answer is unfinished; caller returns 'wait'
//   verdict   — quality signal; 'ok' means proceed normally
//   probe     — pre-generated challenge/redirect to speak immediately if verdict != 'ok'
//               Cached by the caller — endpoint handler uses it with zero latency.
//
// Single LLM call replaces the old chain:
//   SemanticCompletenessChecker → DepthScorer → ProbeEngine (3 calls)
//   + post-hoc evaluateAnswer (4th call)
// Now: one gpt-4o-mini call does it all.

export type AnswerVerdict = 'ok' | 'challenge' | 'non_answer' | 'off_topic';

export interface LiveEval {
  complete: boolean;
  verdict: AnswerVerdict;
  probe?: string;
}

const LIVE_EVAL_OK: LiveEval = { complete: true, verdict: 'ok' };

// Regex fast-paths — no LLM needed
const NON_ANSWER_RE = /^(pass|skip|next|nothing|no idea|don'?t know|not (sure|applicable)|n\/a|none|nope)[\s.,!]*$/i;
const DEFLECTION_RE = /\b(i don'?t (want to|wish to) (answer|discuss)|no comment|i('?d| would) rather not|that'?s (private|confidential|not relevant)|not (going to|gonna) (answer|discuss)|prefer not to (say|answer|discuss))\b/i;

/**
 * Live evaluation at each speech pause — combines completeness + quality + probe
 * into a single fast LLM call. Designed to run inside the endpoint detector's
 * pause callback so the result is ready before the endpoint fires.
 *
 * Returns LIVE_EVAL_OK immediately for:
 *   - Triple rating answers (bare numbers are always valid)
 *   - Answers > 60 words (clearly substantive)
 *   - Timeout / LLM error (fail open — never block the conversation)
 */
export async function liveEval(
  openai: OpenAI | null,
  question: string,
  transcript: string,
  phase: string,
  priorAnswers: string[],
  isTripleRating: boolean,
): Promise<LiveEval> {

  const trimmed = transcript.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  // Skip evaluation for triple ratings — bare numbers are always valid answers
  if (isTripleRating) return LIVE_EVAL_OK;

  // Fast-path: obvious non-answer without needing LLM
  if (wordCount <= 3 && NON_ANSWER_RE.test(trimmed)) {
    return {
      complete: true,
      verdict: 'non_answer',
      probe: buildNonAnswerRedirect(question, phase),
    };
  }

  // Fast-path: explicit deflection
  if (DEFLECTION_RE.test(trimmed.toLowerCase())) {
    return {
      complete: true,
      verdict: 'non_answer',
      probe: `Fine. Let me come at it from a different angle. ${buildFallbackProbe(null, phase)}`,
    };
  }

  // Skip LLM for clearly substantive answers (> 60 words) — trust the content
  if (!openai || wordCount > 60) return LIVE_EVAL_OK;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const prior = priorAnswers.length > 0
      ? priorAnswers.slice(-2).join(' | ')
      : null;

    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 100,
        response_format: { type: 'json_object' } as any,
        messages: [
          {
            role: 'system',
            content:
              'You are a real-time voice interview monitor. The speaker just paused — evaluate their answer so far.\n\n' +
              'Return JSON with three fields:\n' +
              '"complete": true if they have finished their thought; false if clearly mid-sentence or mid-explanation\n' +
              '"verdict": "ok" | "challenge" | "off_topic" | "non_answer"\n' +
              '"probe": one short spoken follow-up sentence (no em dashes) — only when verdict is not "ok"\n\n' +
              'Rules:\n' +
              '- complete=false if sentence ends with a dangling clause, preposition, or partial thought\n' +
              '- verdict="ok" for any substantive, relevant answer — do not over-challenge\n' +
              '- verdict="challenge" only when the answer is demonstrably vague, evasive, or contradicts prior answers — be specific in the probe\n' +
              '- verdict="off_topic" when the answer ignores the question entirely\n' +
              '- verdict="non_answer" for refusals or content-free responses\n' +
              '- On any uncertainty: return complete=true + verdict="ok"\n' +
              '- Never start probe with "Can you" or "Could you". No em dashes.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              lens: phase,
              question,
              answer_so_far: trimmed,
              prior_answers: prior,
            }),
          },
        ],
      },
      { signal: controller.signal },
    );

    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = parseJsonObject(raw);
    if (!parsed) return LIVE_EVAL_OK;

    const complete = parsed.complete !== false; // default true on parse failure
    const verdict = (['ok', 'challenge', 'off_topic', 'non_answer'].includes(parsed.verdict as string)
      ? parsed.verdict
      : 'ok') as AnswerVerdict;

    if (verdict === 'ok') return { complete, verdict: 'ok' };

    const rawProbe = typeof parsed.probe === 'string' ? parsed.probe.trim() : '';
    const probe = rawProbe ? stripDashes(rawProbe) : buildNonAnswerRedirect(question, phase);

    return { complete, verdict, probe };

  } catch {
    return LIVE_EVAL_OK; // fail open — never block the conversation
  } finally {
    clearTimeout(timer);
  }
}

function buildNonAnswerRedirect(question: string, phase: string): string {
  const q = question.trim().replace(/^(walk me through|give me|tell me|describe|think about)\s+/i, '');
  const short = q.length > 80 ? q.slice(0, 77).trim() + '...' : q;
  if (short.length > 10) return `Come back to the question — ${short}`;
  return buildFallbackProbe(null, phase);
}

function getNextPhase(currentPhase: string, phaseOrder: string[]): string {
  const idx = phaseOrder.indexOf(currentPhase);
  if (idx < 0) return phaseOrder[phaseOrder.length - 1] || 'summary';
  return phaseOrder[Math.min(idx + 1, phaseOrder.length - 1)] || 'summary';
}

function parseCreatedAt(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value as string);
  return Number.isFinite(timestamp) ? timestamp : null;
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
  return PHASE_QUESTIONS[phase]?.[0] ?? null;
}

function buildTransitionMessage(
  nextPhase: string,
  questionsByPhase: Record<string, FixedQuestion[]>,
): { assistantMessage: string; metadata: Record<string, unknown> | undefined } {
  const nextQuestions = questionsByPhase[nextPhase] || [];
  const opener = nextQuestions[0] || null;
  const canonicalOpener = opener?.tag === 'triple_rating' ? canonicalTripleRatingQuestion(nextPhase) : null;
  const resolvedOpener = canonicalOpener || opener;

  if (!resolvedOpener) {
    return { assistantMessage: '', metadata: undefined };
  }

  return {
    assistantMessage:
      resolvedOpener.tag === 'triple_rating'
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

function questionMetaFromMessage(
  meta: unknown,
): { kind: 'question'; tag: string; index: number; phase: string } | null {
  if (!meta || typeof meta !== 'object') return null;
  const rec = meta as Record<string, unknown>;
  if (rec.kind !== 'question') return null;
  if (typeof rec.tag !== 'string' || typeof rec.phase !== 'string' || typeof rec.index !== 'number') return null;
  return { kind: 'question', tag: rec.tag, phase: rec.phase, index: rec.index };
}

function words(texts: string[]): number {
  return texts
    .join(' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

/**
 * Bigram Jaccard similarity — cheap synchronous dedup check.
 * Returns 0 (no overlap) to 1 (identical content).
 */
function ngramJaccard(a: string, b: string, n = 2): number {
  const makeGrams = (text: string): Set<string> => {
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    const grams = new Set<string>();
    for (let i = 0; i <= tokens.length - n; i++) {
      grams.add(tokens.slice(i, i + n).join(' '));
    }
    return grams;
  };
  const aGrams = makeGrams(a);
  const bGrams = makeGrams(b);
  if (aGrams.size === 0 && bGrams.size === 0) return 1;
  if (aGrams.size === 0 || bGrams.size === 0) return 0;
  let intersection = 0;
  for (const g of aGrams) if (bGrams.has(g)) intersection++;
  const union = aGrams.size + bGrams.size - intersection;
  return intersection / union;
}

/**
 * LLM sufficiency gate — gpt-4o-mini, temp 0.1.
 * Decides whether the current lens has enough evidence to advance.
 * Runs from turn 2+ so the model has real answers to judge.
 * Returns shouldAdvance=false on timeout/error (fail-closed: prefer probing over skipping).
 */
async function lensSufficiencyCheck(
  openai: OpenAI,
  params: {
    lens: string;
    participantAnswers: string[];
    tripleRatings: TripleRatings;
    phaseObjective: string;
  },
): Promise<{ shouldAdvance: boolean; reasoning: string; missingEvidence?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' } as any,
        messages: [
          {
            role: 'system',
            content:
              'You are a quality gate for an executive discovery interview. ' +
              'Decide whether the current lens has been covered well enough to move to the next topic.\n\n' +
              'A lens IS sufficiently covered when the participant has:\n' +
              '1. Given context on their ratings (today / target / 18-month drift).\n' +
              '2. Given at least one concrete example, deal reference, or specific instance.\n' +
              '3. Explained the root cause or key driver — not just the symptom.\n\n' +
              'A lens is NOT sufficiently covered when:\n' +
              '- Answers are only opinions or generalities with no specific deal/example/evidence.\n' +
              '- The root cause is vague or unaddressed.\n' +
              '- A strong signal (e.g. "we lost a major client") was mentioned but never explored.\n' +
              '- Very low today score or large decline risk with no explanation of why.\n\n' +
              'Return JSON only: { "shouldAdvance": boolean, "reasoning": "one concise sentence", ' +
              '"missingEvidence": "what is still missing — omit this key if shouldAdvance is true" }',
          },
          {
            role: 'user',
            content: JSON.stringify({
              lens: params.lens,
              phase_objective: params.phaseObjective,
              opener_ratings: params.tripleRatings,
              participant_answers: params.participantAnswers,
            }),
          },
        ],
      },
      { signal: controller.signal },
    );

    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = parseJsonObject(raw);
    if (!parsed) return { shouldAdvance: false, reasoning: 'parse error — holding' };

    return {
      shouldAdvance: parsed.shouldAdvance === true,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '',
      missingEvidence: typeof parsed.missingEvidence === 'string' ? parsed.missingEvidence.trim() : undefined,
    };
  } catch {
    // Timeout or API error — fail-closed: keep probing rather than skipping.
    return { shouldAdvance: false, reasoning: 'sufficiency check failed — holding' };
  } finally {
    clearTimeout(timer);
  }
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
    guide_questions: params.guideCandidates.map((c) => ({
      index: c.index,
      tag: c.question.tag,
      text: c.question.text,
    })),
  };

  // Build the decision system prompt from the probe-generator.md strategy guide
  // (tone, rules, strategies, gap-driven intensity) with JSON output format appended.
  // The probe-generator.md original ends with "Return ONLY the probe text" — we override
  // that here with a JSON schema so the model also decides advance vs probe.
  const baseStrategy = _PROBE_GENERATOR_SYSTEM
    // Strip the plain-text output rule — we replace it with our JSON schema below
    .replace(/^Output rules:[\s\S]*$/m, '').trim();

  const systemPrompt = [
    baseStrategy,
    '',
    '── Role & context ──',
    'You are running a real-time voice discovery interview. The maturity-scale opener for this lens has ALREADY been asked and answered.',
    'Your primary job is to work through the prepared guide questions for this lens in order, adapting each one slightly to reflect what the participant just said.',
    'Never repeat the opener. Never stack multiple questions. Never use em dashes (—) or en dashes (–) — use commas instead.',
    'If preferred_interaction_mode is VOICE: one concise spoken sentence, max 18 words. No preamble.',
    'If preferred_interaction_mode is TEXT: one compact question, max 22 words.',
    "If the participant's role is unfamiliar, infer their likely ownership, metrics, and decision rights from their title and department.",
    '',
    '── Question strategy ──',
    'PRIMARY: Use the guide questions provided. Deliver them in order. You may adapt the wording slightly to reference something the participant just said, but the substance must stay true to the guide question.',
    'SECONDARY: If the participant raises a genuinely new signal (a specific deal, a named problem, a concrete example) that no guide question yet covers, you may ask ONE follow-up that digs into that specific signal before returning to the next guide question.',
    'NEVER drill the same angle twice. If you asked about a blocker and they answered it, move to the next guide question — do not re-ask the blocker in different words.',
    'NEVER generate a generic drilling question ("What specifically is holding you back?", "Can you elaborate?", "What is blocking that?"). Only guide questions or a single sharp follow-up on a named signal.',
    '',
    '── ASR transcript hygiene ──',
    'Numbers in the participant\'s transcript may be automatic speech recognition (ASR) artefacts — the STT engine can convert filler words ("to", "for", "then") into digits.',
    'Rule: if a number appears that is outside the 1–5 maturity scale and has no clear supporting context (e.g. no mention of headcount, revenue, years, or percentage), treat it as a likely transcription error.',
    'In that case: do NOT quote the number back in your probe. Instead ask a brief confirming question to clarify what they actually meant (e.g. "You mentioned a number — was that a score or something else?").',
    'Always trust 1–5 scale numbers when they appear with adjacent rating context (today/target/nothing changes). Never second-guess those.',
    '',
    '── Banned language (absolutely forbidden) ──',
    'Never start with or include: "let\'s drill down", "let\'s dive in", "let\'s dig into", "let\'s dig deeper",',
    '"let\'s explore", "let\'s unpack", "let me push on that", "building on that", "that\'s interesting",',
    '"let me probe", "let\'s probe", "let me dig into", "let\'s get into", "let\'s look at",',
    '"going deeper", "drilling into", "diving into".',
    'These phrases are consulting clichés. Nobody talks like that in real life. Write like a sharp person in an actual conversation.',
    '',
    '── Weak vs sharp probe examples ──',
    'WEAK (forbidden): "What specifically is holding you at a three?"',
    'WEAK (forbidden): "Can you tell me more about the challenges?"',
    'WEAK (forbidden): "How do you feel about the current state?"',
    'WEAK (forbidden): "Let\'s drill down on that."',
    'WEAK (forbidden): "Let\'s dive into the specifics."',
    'WEAK (forbidden): "Let me dig into that a bit more."',
    '',
    'GOOD (guide question, lightly adapted): participant said morale is low after acquisition → "What would actually help people do their best work here, given everything that is happening?"',
    'GOOD (single follow-up on named signal): participant named a specific lost deal → "Walk me through that deal — what actually happened?"',
    'GOOD (next guide question): all signals on current area covered → move to next guide question verbatim or near-verbatim.',
    'GOOD (natural pivot): "The acquisition sounds like it\'s still unsettled. How is that landing with customers?"',
    '',
    '── Output ──',
    'Return JSON only. Keys:',
    '  move: "probe" (stay in this lens) or "advance" (move to the next lens)',
    '  assistant_message: the guide question (adapted) or the single signal follow-up',
    '  guide_question_index: the index of the guide question you are addressing (integer, or null if this is a signal follow-up)',
    '  sufficiency: 0–100 integer — how thoroughly this lens has been covered so far',
    '  rationale: one short sentence explaining your probe choice',
    '',
    'Choose move="advance" when all guide questions have been asked OR sufficiency >= 80 OR time is critically short.',
    'Never advance mid-lens if a named deal or concrete example was just raised and has not been explored at all.',
    '',
    '── Critical guardrails ──',
    'The maturity scale is 1 to 5 (1=poor, 5=market-leading). Numbers outside this range are ASR errors — do not quote them back.',
    'Do not ask any variant of a question already asked in this session.',
    'Never ask the same angle twice — if they answered it, move on.',
  ].join('\n');

  // Expose the last 2–3 verbatim answers prominently so the model anchors its probe
  // to what the participant actually said, not just the abstract ratings.
  const recentVerbatim = params.participantAnswers.slice(-3);

  const completion = await params.openai.chat.completions.create({
    model: DECISION_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' } as any,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify({
          ...prompt,
          // Surface the most recent answers explicitly so the model can echo
          // the participant's own language back into the probe.
          recent_verbatim_answers: recentVerbatim,
        }),
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
    sufficiency: typeof parsed.sufficiency === 'number' ? parsed.sufficiency : null,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.trim() : undefined,
  };
}

// ── Clarification rephrasing ─────────────────────────────────────────────────

/** Patterns that mean "I didn't understand your last question" — not session confusion */
const CLARIFICATION_RE =
  /\b(what do you mean|what('?s| is) that mean|can you (explain|rephrase|clarify|say that again|be more specific)|what are you asking|i('?m| am) not sure (what|how)|what('?s| is) the question|could you (explain|clarify|rephrase)|not sure what you('?re| are) (asking|after)|don'?t (follow|get) (the question|what you|that question)|what (exactly|specifically) (are|do) you mean)\b/i;

/** Returns true when the utterance is asking to clarify the last question (not session confusion) */
export function isClarificationRequest(text: string): boolean {
  return CLARIFICATION_RE.test(text);
}

/**
 * Rephrase the last probe in simpler, more direct terms.
 * Uses gpt-4o-mini with a 4s timeout. Falls back to a template if it fails.
 */
export async function rephraseLastProbe(
  openai: OpenAI | null,
  lastProbeText: string,
  phase: string,
): Promise<string> {
  const fallback = buildClarificationFallback(lastProbeText, phase);
  if (!openai || !lastProbeText.trim()) return fallback;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content:
              'The participant asked for clarification on the last question. ' +
              'Rephrase the question in plainer, simpler language. ' +
              'One short sentence only. No em dashes. No "Can you" or "Could you" starters. ' +
              'Do not add new concepts — just make the original question easier to answer aloud.',
          },
          {
            role: 'user',
            content: `Rephrase this question more simply: "${lastProbeText}"`,
          },
        ],
      },
      { signal: controller.signal },
    );

    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    if (text.length > 10) return stripDashes(text);
  } catch {
    // timeout or error
  } finally {
    clearTimeout(timer);
  }

  return fallback;
}

function buildClarificationFallback(lastProbeText: string, _phase: string): string {
  // Strip the question down to the core noun phrase and re-ask simply
  // e.g. "Walk me through your current ICP..." → "Put simply — who are you selling to today, and what makes them the right fit?"
  const lower = lastProbeText.toLowerCase();
  if (/icp|ideal customer|who are you selling/i.test(lower))
    return "Put simply — who are you selling to today, and what makes them a good fit?";
  if (/gtm|go.to.market/i.test(lower))
    return "In plain terms — how do you take your product to market and win customers?";
  if (/scale.*1.*5|rate.*today|where.*you.*today/i.test(lower))
    return "Give me three numbers on a scale of 1 to 5: where things are today, where they need to be, and where you end up if nothing changes.";
  if (/root cause|actually blocking|what broke/i.test(lower))
    return "What is the single thing that is causing this problem?";
  if (/cost|revenue.*leav|leaving.*table/i.test(lower))
    return "What has this actually cost you — in money, a deal, or a relationship?";
  // Generic fallback
  return `Let me put that differently. ${lastProbeText}`;
}

// ── Main turn generator ──────────────────────────────────────────────────────

export async function generateAgenticTurn(params: AgenticTurnParams): Promise<AgenticTurnResult> {
  const questionsByPhase = PHASE_QUESTIONS;
  const phaseQuestions = questionsByPhase[params.currentPhase] || [];
  const phaseMessages = params.sessionMessages.filter((m) => m.phase === params.currentPhase);
  const participantAnswers = phaseMessages
    .filter((m) => m.role === 'PARTICIPANT')
    .filter((m) => {
      const meta = m.metadata && typeof m.metadata === 'object'
        ? (m.metadata as Record<string, unknown>)
        : null;
      return meta?.kind !== 'clarification';
    })
    .map((m) => m.content.trim())
    .filter(Boolean);

  const elapsedMinutes = (Date.now() - params.sessionStartedAt.getTime()) / 60000;
  const totalTargetMinutes = params.includeRegulation ? 28 : 24;
  const remainingMinutes = Math.max(0, totalTargetMinutes - elapsedMinutes);
  const shouldBiasToClose = remainingMinutes <= 4;
  const phaseStartedAtMs =
    phaseMessages
      .map((m) => parseCreatedAt(m.createdAt))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)[0] ?? params.sessionStartedAt.getTime();
  const phaseElapsedMinutes = Math.max(0, (Date.now() - phaseStartedAtMs) / 60000);

  const phaseQuestionMetas = phaseMessages
    .filter((m) => m.role === 'AI')
    .map((m) => questionMetaFromMessage(m.metadata))
    .filter((meta): meta is NonNullable<typeof meta> => meta !== null);
  const usedGuideIndexes = new Set(phaseQuestionMetas.map((m) => m.index));
  const hasAskedGuideQuestion = phaseQuestionMetas.some((m) => m.index > 0);
  const requiresLensProbeBeforeAdvance = !['prioritization', 'summary'].includes(params.currentPhase);
  // Must have asked at least 2 guide questions and received at least 3 participant answers
  // (Q1 + 2 exploration answers minimum) before advancing.
  const guidesAskedCount = phaseQuestionMetas.filter((m) => m.index > 0).length;
  const canAdvanceFromCurrentLens = !requiresLensProbeBeforeAdvance ||
    (hasAskedGuideQuestion && guidesAskedCount >= 2 && participantAnswers.length >= 3);

  const guideCandidates = phaseQuestions
    .map((q, index) => ({ index, question: q }))
    .filter((c) => c.index > 0 && !usedGuideIndexes.has(c.index));
  const openerAnswer = participantAnswers[0] || '';
  const tripleRatings = extractTripleRatings(openerAnswer);
  const tripleRatingGuidance = summarizeTripleRatings(tripleRatings);

  // Compute phase context here so it's available for both sufficiency check and model call.
  const roleGuidance = buildRoleGuidance(params.participantRole, params.participantDepartment, params.currentPhase);
  const phaseObjective = buildPhaseObjective(phaseQuestions, params.currentPhase);

  // ── Structural shortcuts — no LLM needed ────────────────────────────────
  // summary: always close immediately.
  if (params.currentPhase === 'summary') {
    return {
      assistantMessage: phaseQuestions[0]?.text || 'Thank you. That completes the interview.',
      nextPhase: params.currentPhase,
      metadata: { kind: 'question', tag: phaseQuestions[0]?.tag || 'closing', index: 0, phase: params.currentPhase, deliveryMode: 'agentic' },
      phaseProgress: 100,
      completeSession: false,
    };
  }
  // prioritization: advance after 2 answers (it's a ranking exercise, not a discovery lens).
  if (params.currentPhase === 'prioritization' && participantAnswers.length >= 2) {
    const nextPhase = getNextPhase(params.currentPhase, params.phaseOrder);
    const transition = buildTransitionMessage(nextPhase, questionsByPhase);
    return {
      assistantMessage: transition.assistantMessage || 'Thank you.',
      nextPhase,
      metadata: transition.metadata,
      phaseProgress: 100,
      completeSession: nextPhase === 'summary',
    };
  }

  // ── Timer gate: transition at end of answer once lens hits 4 minutes ────────
  // The LLM drives the conversation freely. Once 4 minutes have elapsed on this
  // lens, the NEXT answer to complete triggers a transition — so we never cut
  // someone off mid-sentence, but we don't linger beyond the target window.
  // Exception: if the last answer was thin (< 20 words) let the LLM probe
  // further rather than advancing on a non-answer.
  const lastAnswerWordCount =
    participantAnswers.length > 0
      ? (participantAnswers[participantAnswers.length - 1] ?? '').trim().split(/\s+/).filter(Boolean).length
      : 0;
  const isLastAnswerThin = lastAnswerWordCount < 20;
  const LENS_TARGET_MINUTES = 4;

  if (phaseElapsedMinutes >= LENS_TARGET_MINUTES && canAdvanceFromCurrentLens && !isLastAnswerThin) {
    console.log(
      `[budget] timer gate: ${phaseElapsedMinutes.toFixed(1)}m elapsed in ${params.currentPhase}` +
      `, last=${lastAnswerWordCount}w — transitioning at end of answer`,
    );
    const nextPhase = getNextPhase(params.currentPhase, params.phaseOrder);
    const transition = buildTransitionMessage(nextPhase, questionsByPhase);
    return {
      assistantMessage: transition.assistantMessage || "Okay.",
      nextPhase,
      metadata: transition.metadata,
      phaseProgress: Math.max(0, Math.min(100, Math.round((1 / Math.max((questionsByPhase[nextPhase] || []).length, 1)) * 100))),
      completeSession: nextPhase === 'summary',
    };
  }

  // ── 8-minute safety floor (only remaining hard timer gate) ────────────────
  const LENS_MAX_MINUTES = 8;
  if (requiresLensProbeBeforeAdvance && phaseElapsedMinutes >= LENS_MAX_MINUTES) {
    console.log(`[sufficiency] 8-min floor for ${params.currentPhase} (${phaseElapsedMinutes.toFixed(1)}m) — forcing advance`);
    const nextPhase = getNextPhase(params.currentPhase, params.phaseOrder);
    const transition = buildTransitionMessage(nextPhase, questionsByPhase);
    return {
      assistantMessage: transition.assistantMessage || "",
      nextPhase,
      metadata: transition.metadata,
      phaseProgress: Math.max(0, Math.min(100, Math.round((1 / Math.max((questionsByPhase[nextPhase] || []).length, 1)) * 100))),
      completeSession: nextPhase === 'summary',
    };
  }

  // ── LLM sufficiency check (gpt-4o-mini, temp 0.1) ─────────────────────────
  // Runs from turn 4+ (Q1 opener + at least 3 exploration answers) AND requires
  // at least 2 guide questions asked. This prevents a 1-answer advance where the
  // model decides it has "enough" after the opening rating answer alone.
  const MIN_ANSWERS_BEFORE_SUFFICIENCY = 4;
  const usedGuideCount = usedGuideIndexes.size - (usedGuideIndexes.has(0) ? 1 : 0); // exclude opener
  const enoughGuidesCovered = usedGuideCount >= 2;
  if (params.openai && participantAnswers.length >= MIN_ANSWERS_BEFORE_SUFFICIENCY &&
      requiresLensProbeBeforeAdvance && enoughGuidesCovered) {
    const sufficiency = await lensSufficiencyCheck(params.openai, {
      lens: params.currentPhase,
      participantAnswers,
      tripleRatings,
      phaseObjective,
    }).catch(() => null);

    if (sufficiency) {
      const missingNote = sufficiency.missingEvidence ? ` | missing: "${sufficiency.missingEvidence}"` : '';
      console.log(
        `[sufficiency] lens=${params.currentPhase} answers=${participantAnswers.length}` +
        ` shouldAdvance=${sufficiency.shouldAdvance} | "${sufficiency.reasoning}"${missingNote}`,
      );
      if (sufficiency.shouldAdvance && canAdvanceFromCurrentLens) {
        const nextPhase = getNextPhase(params.currentPhase, params.phaseOrder);
        const transition = buildTransitionMessage(nextPhase, questionsByPhase);
        return {
          assistantMessage: transition.assistantMessage || "",
          nextPhase,
          metadata: transition.metadata,
          phaseProgress: Math.max(0, Math.min(100, Math.round((1 / Math.max((questionsByPhase[nextPhase] || []).length, 1)) * 100))),
          completeSession: nextPhase === 'summary',
        };
      }
    }
  }

  // ── LLM turn decision (gpt-4o) ─────────────────────────────────────────────
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
    const transition = buildTransitionMessage(nextPhase, questionsByPhase);
    return {
      assistantMessage:
        transition.assistantMessage || phaseQuestions[0]?.text || "Thank you. Let's move on.",
      nextPhase,
      metadata: transition.metadata,
      phaseProgress: Math.max(
        0,
        Math.min(
          100,
          Math.round((1 / Math.max((questionsByPhase[nextPhase] || []).length, 1)) * 100),
        ),
      ),
      completeSession: nextPhase === 'summary',
    };
  }

  const preferredGuideIndex =
    typeof modelDecision?.guide_question_index === 'number' &&
    guideCandidates.some((c) => c.index === modelDecision?.guide_question_index)
      ? modelDecision.guide_question_index
      : (guideCandidates[0]?.index ?? 1);
  const selectedGuideQuestion = phaseQuestions[preferredGuideIndex] || null;
  const ratingsDrivenProbe = hasAskedGuideQuestion
    ? null
    : buildRatingsDrivenProbe(tripleRatings, params.currentPhase, selectedGuideQuestion);
  const rawAssistantMessage =
    typeof modelDecision?.assistant_message === 'string' && modelDecision.assistant_message.trim()
      ? modelDecision.assistant_message.trim()
      : ratingsDrivenProbe
        ? ratingsDrivenProbe
        : buildFallbackProbe(selectedGuideQuestion, params.currentPhase);
  // ── Fallback cascade when model failed or produced no probe ─────────────
  // If rawAssistantMessage is empty after all attempts, cascade gracefully
  // rather than returning empty or a generic "tell me more".
  let resolvedMessage = rawAssistantMessage;
  if (!resolvedMessage.trim()) {
    if (guideCandidates.length > 0 && guideCandidates[0]) {
      console.log('[fallback] empty model output — using next guide candidate');
      resolvedMessage = buildFallbackProbe(guideCandidates[0].question, params.currentPhase);
    } else if (canAdvanceFromCurrentLens) {
      console.log('[fallback] empty model output + no guide candidates — advancing');
      const nextPhase = getNextPhase(params.currentPhase, params.phaseOrder);
      const transition = buildTransitionMessage(nextPhase, questionsByPhase);
      return {
        assistantMessage: transition.assistantMessage || "Okay.",
        nextPhase,
        metadata: transition.metadata,
        phaseProgress: Math.max(0, Math.min(100, Math.round((1 / Math.max((questionsByPhase[nextPhase] || []).length, 1)) * 100))),
        completeSession: nextPhase === 'summary',
      };
    } else {
      console.log('[fallback] empty model output + cannot advance — using generic probe');
      resolvedMessage = 'What else can you tell me about that?';
    }
  }

  // ── Probe dedup: bigram Jaccard against last 3 AI messages ──────────────
  // If the proposed probe is too similar to a recent question, force advance
  // (or pick an alternate guide) rather than re-asking.
  // Stem-stripping normalises paraphrases ("Why are you at X" ≈ "What keeps you at X").
  const DEDUP_THRESHOLD = 0.45;
  const QUESTION_STEM_RE = /^(why( are you| do you)?|what (specific(ally)?( factors)?)?|what (makes|keeps|stops|causes|drives)|tell me|can you|how (do|does|did|about)|where|when|who|could you|walk me through|give me)\s+/i;
  const stripStem = (t: string) => t.trim().toLowerCase().replace(QUESTION_STEM_RE, '').trim();
  const strippedProposed = stripStem(resolvedMessage);
  const recentAiContent = params.sessionMessages
    .filter((m) => m.role === 'AI')
    .map((m) => m.content)
    .slice(-3);
  const dupMatch = recentAiContent.find((prior) => ngramJaccard(strippedProposed, stripStem(prior)) > DEDUP_THRESHOLD);
  if (dupMatch) {
    console.warn(
      `[dedup] probe collision (Jaccard > ${DEDUP_THRESHOLD}) — discarding duplicate\n` +
        `  PROPOSED: "${resolvedMessage.slice(0, 80)}"\n` +
        `  PRIOR:    "${dupMatch.slice(0, 80)}"`,
    );
    if (canAdvanceFromCurrentLens) {
      const nextPhase = getNextPhase(params.currentPhase, params.phaseOrder);
      const transition = buildTransitionMessage(nextPhase, questionsByPhase);
      return {
        assistantMessage: transition.assistantMessage || "Okay.",
        nextPhase,
        metadata: transition.metadata,
        phaseProgress: Math.max(0, Math.min(100, Math.round((1 / Math.max((questionsByPhase[nextPhase] || []).length, 1)) * 100))),
        completeSession: nextPhase === 'summary',
      };
    }
    // Can't advance yet — pick the first alternate guide candidate (not already used)
    const altCandidate = guideCandidates.find(
      (c) => ngramJaccard(buildFallbackProbe(c.question, params.currentPhase), dupMatch) <= DEDUP_THRESHOLD,
    );
    if (altCandidate) {
      resolvedMessage = buildFallbackProbe(altCandidate.question, params.currentPhase);
      console.log(`[dedup] using alternate guide candidate index=${altCandidate.index}`);
    }
  }

  const assistantMessage = stripDashes(resolvedMessage);

  // Progress estimate: answers so far vs typical lens depth (4 exploration turns).
  // Capped at 95 — only LLM sufficiency or 8-min floor can push to 100.
  const phaseProgress = Math.max(
    0,
    Math.min(95, Math.round(((participantAnswers.length + 1) / 5) * 100)),
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

// ── Final synthesis ──────────────────────────────────────────────────────────

const PHASE_DISPLAY_NAMES: Record<string, string> = {
  people: 'People',
  operations: 'Operations',
  technology: 'Technology',
  commercial: 'Commercial',
  risk_compliance: 'Risk & Compliance',
  partners: 'Partners',
};

function buildFallbackSynthesis(
  sessionMessages: SessionMessage[],
  phaseOrder: string[],
  participantName?: string | null,
): string {
  const lines: string[] = [];
  const name = participantName ? `, ${participantName}` : '';
  lines.push(`Thank you${name}. Here is a brief summary of what we covered.`);

  for (const phase of phaseOrder.filter((p) => p !== 'summary')) {
    const answers = sessionMessages
      .filter((m) => m.role === 'PARTICIPANT' && m.phase === phase)
      .map((m) => m.content.trim())
      .filter(Boolean);
    if (answers.length === 0) continue;
    const label = PHASE_DISPLAY_NAMES[phase] ?? phase;
    // Extract any numbers from first answer as a score proxy
    const firstAnswer = answers[0] ?? '';
    const nums = [...firstAnswer.matchAll(/\b([1-5])\b/g)].map((m) => parseInt(m[1]!, 10));
    if (nums.length >= 1) {
      lines.push(`${label}: ${nums[0]} today${nums.length >= 2 ? `, target ${nums[1]}` : ''}.`);
    } else {
      lines.push(`${label}: covered.`);
    }
  }

  lines.push("That's the full diagnostic. A written summary will follow.");
  return lines.join(' ');
}

export async function agenticGenerateFinalSynthesis(
  openai: OpenAI | null,
  sessionMessages: SessionMessage[],
  phaseOrder: string[],
  participantName?: string | null,
): Promise<string> {
  if (!openai) return buildFallbackSynthesis(sessionMessages, phaseOrder, participantName);

  // Build context from participant answers, grouped by phase
  const contextLines: string[] = [];
  for (const phase of phaseOrder.filter((p) => p !== 'summary')) {
    const answers = sessionMessages
      .filter((m) => m.role === 'PARTICIPANT' && m.phase === phase)
      .map((m) => m.content.trim())
      .filter(Boolean);
    if (answers.length === 0) continue;
    const label = PHASE_DISPLAY_NAMES[phase] ?? phase;
    contextLines.push(`## ${label}`);
    contextLines.push(answers.slice(0, 5).join('\n\n'));
  }

  if (contextLines.length === 0) {
    return buildFallbackSynthesis(sessionMessages, phaseOrder, participantName);
  }

  const nameClause = participantName ? ` with ${participantName}` : '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content: `You are a business diagnostic interviewer summarising a voice interview${nameClause}.

Produce a concise spoken synthesis that covers:
1. A brief scores line per lens where ratings were given (e.g. "People: 2 today, target 4, declining trajectory")
2. The biggest gap or pain point per lens, in one short phrase
3. Any specific deal, event, or example mentioned
4. Three priority actions implied by the conversation

Rules:
- This will be spoken aloud — no markdown, no bullet points, no headers
- Keep each point to one short sentence
- End with exactly: "That's the full diagnostic. A written summary will follow."
- Do not use filler phrases, cheerleading, or condescending reactions
- Do not start sentences with "So", "And", "Well", "Actually"`,
          },
          {
            role: 'user',
            content: `Diagnostic data:\n${contextLines.join('\n')}\n\nProduce the spoken synthesis.`,
          },
        ],
      },
      { signal: controller.signal },
    );

    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    if (text.length > 20) return stripDashes(text);
  } catch {
    // timeout or error — use template fallback
  } finally {
    clearTimeout(timer);
  }

  return buildFallbackSynthesis(sessionMessages, phaseOrder, participantName);
}

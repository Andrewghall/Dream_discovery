// agent-v2: ChatGPT-quality conversational agent for DREAMflow.
//
// One LLM call per user turn does all the understanding and decision-making:
// - Understands what the participant said (no regex extraction).
// - Decides what to ask next.
// - Captures ratings and signals via tool calls.
// - Decides when to advance lenses or end the session.
//
// No watchdogs, settle windows, recovery cascades, signal classifiers,
// depth scorers, regex rating extractors, or speculative pre-fires.
// The model is the brain. The voice loop just transports audio in/out.

import OpenAI from 'openai';
import type { Lens } from './types.js';
import { getDiscoveryQuestion } from './discovery-questions.js';

// ── Lenses & sequence ────────────────────────────────────────────────────────

export const DEFAULT_LENS_SEQUENCE: Lens[] = [
  'people',
  'operations',
  'technology',
  'commercial',
  'customer',
  'partners',
];

const LENS_LABELS: Record<string, string> = {
  people: 'People & Capability',
  operations: 'Operations & Delivery',
  technology: 'Technology & Credibility',
  commercial: 'Commercial Positioning',
  customer: 'Customer Relationships',
  partners: 'Partner Relationships',
  risk_compliance: 'Risk & Compliance',
};

export function lensLabel(lens: string): string {
  return LENS_LABELS[lens] ?? lens;
}

function firstNameOf(fullName: string | undefined): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0]!;
}

// ── Role archetypes ─────────────────────────────────────────────────────────
// Each role has a unique vantage on GTM/ICP. The system prompt injects the
// archetype's per-lens angles so the agent probes what THIS role is uniquely
// positioned to know — and avoids asking what they wouldn't have direct sight
// of.

interface RoleArchetype {
  key: string;
  name: string;
  matchPatterns: RegExp;
  vantage: string; // one-line summary of unique perspective
  byLens: Partial<Record<Lens, string>>;
}

const ROLE_ARCHETYPES: RoleArchetype[] = [
  {
    key: 'cro',
    name: 'CRO / VP Sales / Chief Sales Officer',
    matchPatterns: /\b(cro|chief revenue|chief sales|vp\s*(of\s*)?sales|sales (vp|leader|director|head)|head of sales|svp sales)\b/i,
    vantage: 'Owns the sales motion. Sharpest opinions on rep skill, deal mechanics, win/loss, ICP fit at deal level.',
    byLens: {
      people: 'Probe sales team capability, ramp time, bench depth, manager coaching, where reps fall short. They\'ll have direct view on which rep profile wins ICP deals.',
      operations: 'Pipeline mechanics, forecasting accuracy, deal-stage discipline, MQL→SQL handover, sales-to-CS handoff. Where deals stall and why.',
      technology: 'CRM hygiene, sales engagement tooling, what data they don\'t trust, attribution gaps from sales\' side.',
      commercial: 'Discount discipline, ASP trends, win rates by segment, deal economics, contract velocity. They\'ll know exactly which deals were unhealthy.',
      customer: 'ICP-fit by closed deal, churn signals visible at handover, what made the best customers easy to win.',
      partners: 'Co-sell motion, channel revenue contribution, partner-influenced deals.',
      risk_compliance: 'Security reviews, procurement processes, contract negotiations that gate deals.',
    },
  },
  {
    key: 'cmo',
    name: 'CMO / VP Marketing',
    matchPatterns: /\b(cmo|chief marketing|vp\s*(of\s*)?marketing|head of marketing|marketing (vp|director|leader|head))\b/i,
    vantage: 'Owns demand and positioning. Sharpest on ICP definition at message level, top-of-funnel quality, market signal.',
    byLens: {
      people: 'Brand, demand-gen, content, ABM, product-marketing team capability. Where the marketing skill bench is thin.',
      operations: 'MQL→SQL conversion, lead routing, attribution model, marketing-to-sales handoff.',
      technology: 'Marketing automation, CDP, intent data, web analytics, ABM tooling.',
      commercial: 'Pricing positioning vs competitors, packaging stories, win/loss themes from marketing\'s side.',
      customer: 'ICP definition at the persona/segmentation level, voice-of-customer research, customer story library.',
      partners: 'Co-marketing programmes, ABM with partners, ecosystem positioning.',
      risk_compliance: 'GDPR/CCPA in campaigns, regulated content, marketing claims compliance.',
    },
  },
  {
    key: 'coo',
    name: 'COO / Chief Operating Officer',
    matchPatterns: /\b(coo|chief operating|chief operations|operations (chief|director|head|leader))\b/i,
    vantage: 'Owns the GTM machine end-to-end. Sharpest on cross-functional alignment, scaling friction, where the operating model breaks.',
    byLens: {
      people: 'Cross-functional GTM org design, hiring plan, leadership bench across functions. Where alignment fails.',
      operations: 'End-to-end GTM machine: pipeline → close → CS handover → expansion. Quality of every handoff. Where the machine stalls.',
      technology: 'GTM systems integration, data flow across CRM/CS/finance, where systems don\'t talk to each other.',
      commercial: 'Deal desk, contract ops, billing, revenue ops. Where commercial machinery is brittle.',
      customer: 'Customer journey across departments, friction points the customer feels but no single function owns.',
      partners: 'Partner enablement at scale, partner ops infrastructure, ecosystem operating model.',
      risk_compliance: 'Enterprise risk including GTM exposure, control framework across the GTM stack.',
    },
  },
  {
    key: 'cco_customer',
    name: 'CCO (Chief Customer Officer) / VP Customer Success',
    matchPatterns: /\b(chief customer|cco.*customer|vp\s*(of\s*)?customer|head of customer|customer success (vp|leader|chief|head|director))\b/i,
    vantage: 'Owns post-sale. Sharpest on retention, expansion, churn signals, what makes ICPs stay.',
    byLens: {
      people: 'CS team capability, AM/CSM skill, customer-facing communication quality.',
      operations: 'Onboarding, expansion playbooks, renewal motion, churn save process, sales-to-CS handover from the CS side.',
      technology: 'CS platforms, health scoring, voice-of-customer tooling, integration with product.',
      commercial: 'Expansion revenue mechanics, NRR drivers, renewal pricing, NPS-to-NRR linkage.',
      customer: 'Deepest perspective in the room. Retention themes, churn patterns, expansion triggers, what ICPs love and where they\'re fragile.',
      partners: 'Customer-facing partner programmes, integration partners affecting customer outcomes.',
      risk_compliance: 'Customer data, contractual obligations to customers, SLA exposure.',
    },
  },
  {
    key: 'cco_commercial',
    name: 'CCO (Chief Commercial Officer)',
    matchPatterns: /\b(chief commercial|cco$|cco\b(?!.*customer))\b/i,
    vantage: 'Owns the commercial engine — sales + marketing + customer success blended. Sharpest on commercial strategy, pricing, GTM coherence.',
    byLens: {
      people: 'GTM leadership bench across sales/marketing/CS, where talent is thin, what skills are missing for the next stage.',
      operations: 'Cross-GTM operating rhythm, forecasting discipline, alignment between sales/marketing/CS leadership.',
      technology: 'GTM stack rationalisation, where data quality breaks, what they\'re investing in.',
      commercial: 'Pricing strategy, packaging architecture, contract structures, deal economics. They own the commercial model.',
      customer: 'ICP definition at strategy level, segmentation by economics, expansion vs new logo mix.',
      partners: 'Partner programme strategy, channel mix, alliance economics.',
      risk_compliance: 'Commercial risk: contract terms, regional exposure, deal compliance.',
    },
  },
  {
    key: 'ceo',
    name: 'CEO / Founder',
    matchPatterns: /\b(ceo|chief executive|founder|co.?founder|managing director|md\b)\b/i,
    vantage: 'Owns the whole picture. Sharpest on strategic positioning, ICP-as-bet, capital allocation, where they\'ve placed their chips.',
    byLens: {
      people: 'GTM leadership bench, talent magnetism, strategic hiring plan, where they need a different kind of leader.',
      operations: 'Scaling the GTM machine, capital efficiency, where they\'re burning cash they shouldn\'t be.',
      technology: 'Build vs buy strategic decisions, where tech investment is paying back.',
      commercial: 'Pricing strategy as positioning, business model architecture, unit economics.',
      customer: 'ICP definition at the strategic level — who they\'re betting on, who they\'re explicitly NOT serving, market expansion thesis.',
      partners: 'Strategic alliances, M&A signals, market expansion through partners.',
      risk_compliance: 'Strategic and existential risk including regulatory exposure to GTM.',
    },
  },
  {
    key: 'cfo',
    name: 'CFO / VP Finance',
    matchPatterns: /\b(cfo|chief financial|vp\s*(of\s*)?finance|finance (chief|director|head))\b/i,
    vantage: 'Owns the numbers. Sharpest on GTM efficiency ratios, unit economics, capital allocation across GTM functions.',
    byLens: {
      people: 'GTM productivity metrics — revenue per rep, cost-per-MQL, CS-to-ARR ratios. Where productivity is breaking.',
      operations: 'Forecasting accuracy, pipeline coverage, capital deployment by GTM function, unit economics health.',
      technology: 'Tech ROI, GTM stack costs, what they\'re paying for vs what they\'re using.',
      commercial: 'Deal economics, discount governance, CAC payback, LTV/CAC by segment, gross margin by ICP.',
      customer: 'Revenue retention, NRR, gross margin by customer segment, expansion economics.',
      partners: 'Partner economics, channel margin, co-sell economics.',
      risk_compliance: 'Revenue recognition, audit, financial controls in GTM motions.',
    },
  },
  {
    key: 'revops',
    name: 'Head of RevOps / VP RevOps',
    matchPatterns: /\b(rev\s*ops|revenue operations|head of (rev|revenue) ops)\b/i,
    vantage: 'Owns the GTM data and mechanics. Sharpest on pipeline truth, attribution reality, where dashboards lie.',
    byLens: {
      people: 'GTM team productivity by metric, where coaching has measurable ROI, gap between what leaders think and what data says.',
      operations: 'Pipeline mechanics, forecasting models, deal stage discipline, sales-marketing alignment data.',
      technology: 'Full GTM stack — what works, what\'s tape and chewing gum, data quality reality.',
      commercial: 'Deal mechanics in detail, pricing operationalisation, discount approval flows.',
      customer: 'Retention/churn/expansion data, segmentation by economics, attribution into NRR.',
      partners: 'Partner-attributed pipeline, channel data quality.',
      risk_compliance: 'Audit trails, data lineage, control automation.',
    },
  },
  {
    key: 'partnerships',
    name: 'Head of Partnerships / VP Alliances',
    matchPatterns: /\b(partnerships?|alliances?|channel|biz dev|business development|bd)\b/i,
    vantage: 'Owns the partner motion. Sharpest on channel economics, alliance leverage, joint go-to-market reality.',
    byLens: {
      partners: 'Deepest perspective in the room. Partner economics, channel mix, joint pipeline, alliance leverage, where partners help vs hurt.',
      customer: 'Partner-influenced deal patterns, ICPs that come through channel vs direct.',
      commercial: 'Partner economics, channel margin, deal-influence value.',
      operations: 'Partner enablement, deal-reg flow, channel conflict management.',
      people: 'Partner-facing team capability, alliance leadership bench.',
      technology: 'PRM, partner portals, deal-reg systems, joint-attribution tooling.',
      risk_compliance: 'Channel compliance, partner contract risk, regional partner exposure.',
    },
  },
];

function inferRoleArchetype(title: string | undefined): RoleArchetype | null {
  if (!title) return null;
  for (const role of ROLE_ARCHETYPES) {
    if (role.matchPatterns.test(title)) return role;
  }
  return null;
}

// ── State ────────────────────────────────────────────────────────────────────

export interface LensRating {
  today?: number;
  target?: number;
  drift?: number;
  reason?: string;
}

export interface AgentState {
  participantName?: string;
  participantTitle?: string;
  participantEmail?: string;
  /** Company / organisation the participant works for. Used for natural
   * references ("your role for Capita"). Passed in via URL or DREAM. */
  participantCompany?: string;
  /** 'voice' (default) or 'text' — controls whether we use Deepgram + TTS. */
  mode: 'voice' | 'text';
  /** Free-form description of the participant's actual responsibilities, in
   * their words. Captured at session start via capture_role_description. */
  participantRoleDescription?: string;
  /** True once the participant has confirmed their title is correct. */
  roleConfirmed?: boolean;
  lensSequence: Lens[];
  currentLens: Lens;
  ratings: Map<Lens, LensRating>;
  evidence: Map<Lens, string[]>;
  conversation: ConversationTurn[];
  startedAt: number;
  complete: boolean;
  /** Wall-clock when each lens became current. Used for per-lens pacing. */
  lensStartedAt: Map<Lens, number>;
  /** Wall-clock when each lens completed (advance_lens fired). 0 = still in progress. */
  lensEndedAt: Map<Lens, number>;
  /** Total session budget in minutes — derived from lens count (6→25, 7→30, otherwise count*4). */
  totalBudgetMinutes: number;
  /** Cumulative paused milliseconds, so elapsed-time math excludes pauses. */
  pausedMs: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function createInitialState(args: {
  participantName?: string;
  participantTitle?: string;
  participantCompany?: string;
  participantEmail?: string;
  mode?: 'voice' | 'text';
  lenses?: Lens[];
}): AgentState {
  const lensSequence = args.lenses && args.lenses.length > 0 ? args.lenses : DEFAULT_LENS_SEQUENCE;
  // 6 lenses → 25 min, 7 lenses (incl. regulation) → 30 min,
  // otherwise ~4 minutes per lens.
  const totalBudgetMinutes =
    lensSequence.length === 6 ? 25 : lensSequence.length === 7 ? 30 : lensSequence.length * 4;
  const now = Date.now();
  const lensStartedAt = new Map<Lens, number>();
  const lensEndedAt = new Map<Lens, number>();
  lensStartedAt.set(lensSequence[0]!, now);
  return {
    participantName: args.participantName,
    participantTitle: args.participantTitle,
    participantCompany: args.participantCompany,
    participantEmail: args.participantEmail,
    mode: args.mode ?? 'voice',
    lensSequence,
    currentLens: lensSequence[0]!,
    ratings: new Map(),
    evidence: new Map(),
    conversation: [],
    startedAt: now,
    complete: false,
    lensStartedAt,
    lensEndedAt,
    totalBudgetMinutes,
    pausedMs: 0,
  };
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'ask_rating',
      description:
        'Display the visual 1-5 rating card to the participant. Call this RIGHT BEFORE you speak the rating question for the current lens. ' +
        'Call it ONCE per lens, when transitioning into the rating ask. Do not call it during the welcome before you actually pose the rating question.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_participant_info',
      description:
        'Capture the participant\'s name and/or title from their voice introduction. ' +
        'Call this AS SOON AS they say "I\'m [name], the [title]" or any equivalent — extract both. ' +
        'You can pass null for either field if it wasn\'t mentioned.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'], description: 'Their full name as spoken.' },
          title: { type: ['string', 'null'], description: 'Their job title as spoken.' },
        },
        required: ['name', 'title'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirm_role',
      description:
        'Mark the participant\'s title as confirmed (after they explicitly say yes / that\'s right / correct to your "is that correct?" question). ' +
        'If they correct the title (e.g. "actually I\'m the COO not CRO"), pass the corrected title in correctedTitle.',
      parameters: {
        type: 'object',
        properties: {
          correctedTitle: { type: ['string', 'null'], description: 'The corrected title if they corrected it; null if they confirmed the original title.' },
        },
        required: ['correctedTitle'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_role_description',
      description:
        'Record the participant\'s description of their role in their own words, given right after the welcome. ' +
        'Call this AS SOON AS they describe what they do (one sentence is enough). Use the captured description to anchor your questions throughout the session.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'A one-sentence summary of their role and remit, in their own words.' },
        },
        required: ['description'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_rating',
      description:
        'Record the participant\'s triple-rating for the current lens once they have given today / target / drift values (1–5 scale). ' +
        'Call this AS SOON AS all three numbers are stated, even if loosely phrased ("we\'re a three, want to be five, would drop to two"). ' +
        'You can also call this with partial values if only some are clear; pass null for missing slots.',
      parameters: {
        type: 'object',
        properties: {
          today: { type: ['integer', 'null'], minimum: 1, maximum: 5, description: 'Where they are today (1–5).' },
          target: { type: ['integer', 'null'], minimum: 1, maximum: 5, description: 'Where they want to be (1–5).' },
          drift: { type: ['integer', 'null'], minimum: 1, maximum: 5, description: 'Where they end up if nothing changes (1–5).' },
          reason: { type: ['string', 'null'], description: 'Brief paraphrase of why they gave those numbers, if stated.' },
        },
        required: ['today', 'target', 'drift'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_evidence',
      description:
        'Record a substantive piece of evidence the participant gave — a real example, a deal, a specific event, a clear opinion. ' +
        'Call this when they say something concrete and reusable for later synthesis. Skip generic answers.',
      parameters: {
        type: 'object',
        properties: {
          statement: { type: 'string', description: 'A one-sentence summary in their words.' },
        },
        required: ['statement'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'advance_lens',
      description:
        'Advance to the next lens. Call this when the current lens has its triple-rating captured AND at least one substantive reason / piece of evidence. ' +
        'Do not drill more than one follow-up per topic — breadth over depth.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'end_session',
      description:
        'End the discovery session. Call this once all lenses are covered, or if the participant asks to stop, or after the welcome / onboarding when the session has reached a natural close. ' +
        'Always include a short closing remark to speak.',
      parameters: {
        type: 'object',
        properties: {
          closing: { type: 'string', description: 'A brief spoken closing line.' },
        },
        required: ['closing'],
        additionalProperties: false,
      },
    },
  },
];

// ── System prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(state: AgentState): string {
  const lensList = state.lensSequence.map(l => `- ${lensLabel(l)} (${l})`).join('\n');

  const captured = state.lensSequence
    .map(l => {
      const r = state.ratings.get(l);
      const e = state.evidence.get(l) ?? [];
      const ratingStr = r
        ? `today=${r.today ?? '–'}, target=${r.target ?? '–'}, drift=${r.drift ?? '–'}`
        : 'not yet captured';
      return `  ${lensLabel(l)}: ${ratingStr}; evidence=${e.length}`;
    })
    .join('\n');

  const elapsedMs = Date.now() - state.startedAt - state.pausedMs;
  const elapsedMin = Math.round(elapsedMs / 60000);
  const perLensBudgetMin = +(state.totalBudgetMinutes / state.lensSequence.length).toFixed(1);
  const lensStartedMs = state.lensStartedAt.get(state.currentLens) ?? state.startedAt;
  const lensElapsedMin = +(((Date.now() - lensStartedMs) / 60000)).toFixed(1);
  const lensTimeRemainingMin = +(perLensBudgetMin - lensElapsedMin).toFixed(1);
  const totalRemainingMin = +(state.totalBudgetMinutes - elapsedMin).toFixed(1);

  const identityNote = state.participantName
    ? `The participant's name is ${state.participantName}${state.participantTitle ? `, ${state.participantTitle}` : ''}. Use their first name occasionally, naturally.`
    : 'You do not yet know the participant\'s name. Ask for it ONCE in the welcome turn — name and job title together — then proceed.';

  const role = inferRoleArchetype(state.participantTitle);
  const currentRoleAngle = role?.byLens[state.currentLens];
  const ownDescriptionLine = state.participantRoleDescription
    ? `\nParticipant's own description of their role (their words, captured at session start): "${state.participantRoleDescription}"`
    : '';
  const roleBlock = role
    ? `\n# ROLE PERSPECTIVE — ${role.name}\n` +
      `Vantage: ${role.vantage}\n` +
      ownDescriptionLine +
      `\n\nWhat THIS role uniquely sees on the current lens (${lensLabel(state.currentLens)}):\n` +
      `${currentRoleAngle ?? 'No specific angle for this role on this lens — probe generally but stay GTM/ICP-focused.'}\n\n` +
      `Probing principle: ask what THEY are uniquely positioned to know. Avoid asking what someone in another seat would have a clearer view of. If they reach for an answer that\'s not really their domain ("I think marketing knows that better"), accept that and pivot to what IS their domain.\n\n` +
      `Cross-role check: the same lens looks different to different roles. A CRO\'s view of "people" is sales bench depth; a CMO\'s is brand+demand team capability; a COO\'s is cross-functional alignment. Use the angle above + their own description to shape your questions.`
    : (state.participantTitle
      ? `\n# ROLE PERSPECTIVE\nThe participant's title is "${state.participantTitle}" — no exact archetype match.${ownDescriptionLine ? ownDescriptionLine + '\n' : ''} Infer their likely vantage and probe what THIS role is uniquely positioned to know on the current lens.`
      : (ownDescriptionLine ? `\n# ROLE PERSPECTIVE${ownDescriptionLine}` : ''));

  const currentQuestion = getDiscoveryQuestion(state.currentLens);
  const currentEvidence = state.evidence.get(state.currentLens) ?? [];
  const ratingForCurrent = state.ratings.get(state.currentLens);
  const ratingCaptured =
    !!ratingForCurrent && ratingForCurrent.today != null && ratingForCurrent.target != null;

  const currentLensQuestionBlock = currentQuestion
    ? `\n# Canonical material for the current lens — ${lensLabel(state.currentLens)}\n\n` +
      `## Rating prompt (use this as the SUBSTANCE; paraphrase conversationally for voice):\n` +
      `"${currentQuestion.text}"\n\n` +
      `## 1–5 maturity scale (shown on the rating card — don't read it out loud, just refer to it implicitly):\n` +
      currentQuestion.maturityScale.map((d, i) => `  ${i + 1}. ${d}`).join('\n') +
      `\n\n## Follow-up exploration topics (work through these in sequence — paraphrase each into a natural question shaped by what the participant just said):\n` +
      currentQuestion.followUps
        .map((f, i) => `  ${i + 1}. [${f.topic}] "${f.prompt}"`)
        .join('\n') +
      `\n\n## Status for this lens\n` +
      `  Rating captured: ${ratingCaptured ? `YES — today=${ratingForCurrent!.today}, target=${ratingForCurrent!.target}, drift=${ratingForCurrent!.drift ?? '–'}` : 'NO — must be captured first via ask_rating + capture_rating'}\n` +
      `  Evidence pieces gathered: ${currentEvidence.length}` +
      (currentEvidence.length > 0
        ? `\n  Recent evidence: ${currentEvidence.slice(-3).map(e => `"${e}"`).join('; ')}`
        : '')
    : '';

  return `You are DREAMflow, an AI conducting a focused 25-minute Go-To-Market (GTM) and Ideal Customer Profile (ICP) discovery interview by VOICE.
${identityNote}
${roleBlock}

# THE FRAME (NON-NEGOTIABLE)
Everything in this conversation is in service of understanding the participant's Go-To-Market motion and their Ideal Customer Profile. Every lens, every rating, every follow-up, every drill — must connect back to G.T.M. and I.C.P.

CRITICAL — DUAL PERSPECTIVE: Each rating asks about TWO things in one go: (a) the lens within their own function, AND (b) the lens across the broader business. NEVER narrow it to just their function (e.g. "your sales team", "your marketing team"). The rating must be framed as "when you consider [LENS] within your function AND the broader business, how would you rate..." or equivalent. The participant has a unique vantage on both — that's exactly why we ask them and not just any single seat.

Each lens, framed for G.T.M.:
- People: people and capability — within their function AND across the GTM machine (sellers, BD, marketing, customer success, RevOps, GTM leadership) and the broader business.
- Operations: G.T.M. operations within their function AND across the broader operating model — pipeline, deal handoffs, sales-to-CS handover, lead routing, forecasting cadence.
- Technology: G.T.M. tech within their function AND across the broader business — CRM, marketing automation, attribution, sales enablement, data quality, pipeline tooling.
- Commercial: G.T.M. commercial model within their function AND across the wider commercial engine — pricing, packaging, deal structures, discounting, contract motion, sales cycle economics.
- Customer: I.C.P. and customer experience as part of G.T.M. — within their function's view AND across the whole business' relationship with the ideal customer.
- Partners: G.T.M. partnerships within their function AND across the broader ecosystem — channel partners, alliances, joint go-to-market.
- Risk & Compliance: what affects G.T.M. execution — within their function AND at enterprise level.

If a participant's answer drifts into general business topics that aren't GTM/ICP, gently steer back: "Bring that back to your go-to-market — how does that show up in how you win or keep customers?"

If at any point the participant explicitly tells you to refocus on GTM or ICP ("come back to GTM", "focus on the ICP", "this isn't about [X], it's about how we sell"), acknowledge in one sentence and immediately re-anchor your next question on the GTM/ICP angle of the current lens. Do not get defensive. Do not apologise at length. One short acknowledgement, then a sharper GTM/ICP-focused question.

You should reference ICP explicitly multiple times across the session — at least once per lens where it's relevant. Examples: "How does that affect how you win your ICP?" "Is that the same picture for your ideal customer or different?" "Walk me through that for an ICP deal you closed recently."
${currentLensQuestionBlock}

# What this session does
You take the participant through ${state.lensSequence.length} lenses of their business. For each lens you do this in order:
  1. Capture the triple-rating on the 1–5 maturity scale: today / target / drift if nothing changes.
  2. Work through that lens's follow-up exploration topics (listed below per lens). For each topic, get a real, specific answer — a concrete example, deal, event, person, situation, number — not a generic opinion.
  3. When you hear something concrete, drill into it: ask why, ask for an example of when it bit them, ask what it cost them, ask what they tried to fix it. Pull on the thread until you understand the underlying mechanism, not just the surface.
  4. Advance to the next lens only when you've worked through at least 3 of that lens's follow-up topics with substantive answers (real evidence, not vague "yes that's an issue" responses).

# Depth rules (this is how a good interviewer sounds, not a survey)
- After capturing a rating, the lens is NOT done. You then have a real conversation about it.
- Aim for 4–7 substantive turns per lens after the rating ask.
- When the participant gives a thin answer ("we should do better", "it's fine", "we won some awards"), drill: "What kind?" "What does that signal?" "What's the next step?"
- When they give a rich answer with a specific example, follow it: "How often does that happen?" "What did you do about it?" "What's the cost when it goes wrong?"
- Use the lens's follow-up list (below) as a guide for what topics to cover, but adapt the wording to flow naturally from what they just said.
- Never check boxes. Never say "let's move on to the next topic" mechanically. The conversation should feel like a thoughtful colleague probing.
- Only call advance_lens when you genuinely have rich, specific evidence on at least 3 of the follow-up topics — and you can summarise back to them what you've learned about this lens. If you can't, you haven't dug deep enough.

# Lens sequence
${lensList}

# Coverage so far
Current lens: ${lensLabel(state.currentLens)} (${state.currentLens})
Total elapsed: ~${elapsedMin} of ${state.totalBudgetMinutes} minutes (${totalRemainingMin} minutes remaining across ${state.lensSequence.filter(l => !state.ratings.get(l)?.today).length} unfinished lenses)
Time on current lens: ${lensElapsedMin} min of ${perLensBudgetMin} min budget (${lensTimeRemainingMin >= 0 ? `${lensTimeRemainingMin} min left` : `over budget by ${Math.abs(lensTimeRemainingMin)} min`})

${captured}

# Pacing rules (use the budget — don't overrun, don't rush)
Per-lens budget is ${perLensBudgetMin} minutes.
- If you're at <50% budget: keep exploring, drill into examples.
- If you're at 70-100% budget AND have rating + 3 evidence pieces: wrap this lens with a one-sentence summary and call advance_lens.
- If you're past budget AND have rating + at least 1 evidence piece: advance now, you've overrun.
- If you're past budget AND don't yet have a rating: that's a problem — give the rating ask one more clear try, then accept whatever you get and move on.

# How to behave (this is the most important section)

You are speaking, not writing. Short, direct, conversational. Use contractions: "you're", "we'll", "that's". One question per turn. Never em-dashes — only commas and full stops. No bullet lists in spoken output.

You are warm but grounded. Curious. Not chatty. Not coaching. Not summarising what they just said back to them. Not "great", "interesting", "absolutely". Just listening and asking the next sharp thing.

The participant's transcript may be imperfect — automatic speech recognition fuses spoken numbers ("three five two" → "352"), drops words, mishears. If you see "352" near the rating prompt, treat it as 3 / 5 / 2. If something is incoherent, ask a quick clarification — never drill on garbage.

NEVER ask the same question twice in this session. NEVER re-confirm something they've already said. NEVER ask "are you ready to start" — the welcome already covered that. NEVER ask "any questions before we begin" twice.

If the participant says they already answered ("I gave you that", "I told you", "say again"), they have. Look back at the conversation, find what they meant, and proceed — don't re-ask.

When all three rating numbers are clear (even loosely phrased — "we're a three, want to be a five, drift to two") call the capture_rating tool IN THE SAME TURN as your spoken response. Use record_evidence whenever the participant gives you a concrete, reusable insight — a specific example, a real deal, a clear opinion, a number, a moment in time.

Do NOT advance_lens until you've covered at least 3 of the lens's follow-up topics with specific evidence. After capturing a rating, your next several turns are exploration — pull on threads, ask for examples, drill into specifics. The participant should feel listened to, not surveyed.

When you DO advance, you MUST call the advance_lens tool BEFORE you speak the next lens's rating question — in the same turn. The visual rating card depends on this tool call to update. Speaking "let's move to operations" in your text WITHOUT calling advance_lens leaves the system thinking you're still on the previous lens. Always: advance_lens tool call FIRST, then speak the one-sentence summary, then speak the next lens's rating question.

When the participant has been through all lenses, call end_session with a short, warm closing.

# Welcome turn (the FIRST turn only — when the conversation array is empty)
This is read aloud by a TTS engine, so it MUST scan as natural spoken English — not a dense written paragraph. Short sentences. Plain words. Never use jargon like "drift" — say "where it's heading if nothing changes". Avoid stacked clauses with multiple commas.

${state.participantName
  ? `Use the first name "${firstNameOf(state.participantName)}" only — never the full name. Speak roughly this welcome (vary the wording slightly so it doesn't sound canned, but keep the structure, pacing, and these EXACT phrasings where shown):

  "Hi ${firstNameOf(state.participantName)}, I'm DREAMflow. Over the next 25 minutes we'll work through ${state.lensSequence.length} areas of your business. For each one I'll ask you to rate it on a scale of one to five — where you are today, where you need to be, and where it's heading if nothing changes. Then we'll dig into a real example. You can pause anytime and pick up when you're ready."

CRITICAL: write "where you are today" — NEVER "where you're today" (that contraction reads wrong out loud). Same rule applies whenever the structure is "where SUBJECT VERB X" — keep "you are" / "we are" / "they are" expanded in those positions.

End on a full stop, no question. The next turn (role confirmation) fires automatically. Do NOT ask the rating question here. Do NOT call ask_rating. Do NOT name the first lens.`
  : `Speak roughly this welcome (vary the wording slightly so it doesn't sound canned, but keep the structure and pacing):

  "Hi, I'm DREAMflow. Over the next 25 minutes we'll work through ${state.lensSequence.length} areas of your business. For each one I'll ask you to rate it on a scale of one to five — where you are today, where you need to be, and where it's heading if nothing changes. Then we'll dig into a real example. You can pause anytime and pick up when you're ready."

CRITICAL: write "where you are today" — NEVER "where you're today" (that contraction reads wrong out loud). Same rule applies whenever the structure is "where SUBJECT VERB X" — keep "you are" / "we are" / "they are" expanded in those positions.

Then ask for their name and job title in ONE clean question. Do NOT ask the rating yet.`}

# Critical: ALWAYS speak
Every turn you take MUST include a spoken response (the text you write). When you call a tool, you ALSO say something out loud — never call a tool silently. After capturing a rating, say something brief that reflects what they shared and asks the next question (or moves to the next lens). After advancing lenses, speak the next lens's rating prompt. The participant must hear from you on every turn.

# When to call ask_rating
Call ask_rating IMMEDIATELY BEFORE you speak the rating question for any lens — and ONLY then. This displays the visual 1-5 rating card to the participant in sync with your spoken question.
- Do NOT call ask_rating during the opening welcome (you haven't started asking the rating yet).
- Do NOT call ask_rating during follow-up exploration questions (the card is for the rating moment only).
- Do call ask_rating when transitioning into a new lens's rating question, in the same turn as you speak it.

# Output format
Speak naturally. The text you produce will be read aloud verbatim by a TTS engine. Keep it under ~3 sentences per turn (the welcome turn can be slightly longer but still tight). Do NOT include stage directions, markdown, or lists.

# Voice tone
You sound like a thoughtful, grounded interviewer. Not excited. Not chipper. Not coaching. Steady, curious, measured. Avoid exclamation marks. Banned words: "great", "awesome", "wonderful", "fantastic", "love that", "amazing", "perfect". Don't reward answers with affect.

When you acknowledge, blend the acknowledgement INTO the next sentence rather than punctuating it as its own beat. Bad (TTS amplifies the punctuation): "Got it. Thanks. Now tell me about..." Good (flows): "Right, that helps. Thinking about operations now,..." Or: "OK, that's useful context. On operations,..." Single short word + comma + the next thought, no full stop after the acknowledgement.

# Strict rules for the rating question (for EVERY lens, not just the first)
The rating question MUST be framed as DUAL perspective — within their function AND the broader business. Pattern (use this template every lens, only varying the lens noun):

  "When you consider [LENS TOPIC] within your function and the broader business, how would you rate where things stand today, where they need to be, and where they're heading if nothing changes?"

BANNED phrasings for the rating question (these all narrow to one function and miss the dual perspective):
  - "your sales team"
  - "your marketing team"
  - "your operations team"
  - "your team"
  - "your department"
  - "your function" alone (without "and the broader business")
  - "thinking about operations now," / "thinking about commercial now," etc. — too thin

Even if the participant is the C.R.O., the rating question is NEVER scoped to sales. It's people-and-capability, or operations, or technology, etc. — across function AND the wider business. Their unique vantage on both perspectives is exactly the point. This rule applies to every lens equally.

# Strict speech rules
- COMPLETE SENTENCES ONLY. Never produce fragments like "how operations are shaping up." or "and a bit more." that don't start with a subject and verb. Every sentence must be grammatically self-contained: "Thinking about how operations are shaping up..." is fine; "how operations are shaping up." standalone is NOT. The TTS reads each sentence aloud — fragments sound like errors.
- Contractions you MUST avoid (they sound wrong when spoken aloud):
    "where you're [X]"  → write "where you are [X]"
    "ready when you're" → write "ready when you are"
    "what you're [X]"   → write "what you are [X]"
  Generally: in the structure "where/what/how/when SUBJECT is/are SOMETHING", keep "you are" / "we are" / "they are" expanded. Contractions are fine in normal verb position ("you're working with..." is OK, "where you're working" is OK as a question form, but "where you're today" is NOT).
- One question per turn. Never ask two questions in the same turn.
- Never repeat a question you already asked in this session, even reworded.
- On lens transitions: a single sentence summary of what you heard, then the new lens's rating ask. Do not greet again. Do not say "let's move on" twice. The card will appear automatically on lens change — you don't need to call ask_rating again, just speak the rating question.`;
}

// ── Run a turn ──────────────────────────────────────────────────────────────

export interface AgentTurnResult {
  text: string;
  toolCalls: ToolCall[];
}

export type ToolCall =
  | { type: 'ask_rating' }
  | { type: 'capture_participant_info'; name: string | null; title: string | null }
  | { type: 'confirm_role'; correctedTitle: string | null }
  | { type: 'capture_role_description'; description: string }
  | { type: 'capture_rating'; today: number | null; target: number | null; drift: number | null; reason?: string | null }
  | { type: 'record_evidence'; statement: string }
  | { type: 'advance_lens' }
  | { type: 'end_session'; closing: string };

export async function runAgentTurn(args: {
  client: OpenAI;
  state: AgentState;
  userTranscript: string | null; // null = welcome turn (no user input yet)
  model?: string;
  /** Called once per complete sentence as the model streams. Lets the caller
   *  start TTS on sentence 1 while sentence 2 is still being generated. */
  onSentence?: (sentence: string) => Promise<void> | void;
}): Promise<AgentTurnResult> {
  const conversation = args.state.conversation.slice();
  if (args.userTranscript !== null) {
    conversation.push({ role: 'user', content: args.userTranscript });
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(args.state) },
    ...conversation.map(t => ({ role: t.role, content: t.content })),
  ];

  // First-turn welcome: no user message; nudge the model to greet.
  if (args.userTranscript === null && conversation.length === 0) {
    messages.push({ role: 'user', content: '[session is starting — speak the opening 3-sentence welcome turn now. No questions, no rating ask.]' });
  } else if (args.userTranscript === null && conversation.length > 0) {
    // Chained transition turn — pure enquiry, NEVER an assumption.
    if (!args.state.roleConfirmed) {
      // Step A: confirm the title politely, as a question.
      const titlePhrase = args.state.participantTitle
        ? `Their stated title is "${args.state.participantTitle}".`
        : `You do not have a title yet — ask them to share it.`;
      messages.push({
        role: 'user',
        content: `[the welcome was just spoken. ${titlePhrase} Now ASK them to confirm — do NOT assume. ONE short polite question, enquiry style, framed as: "I understand you are the [TITLE], is that correct?" If you don't have the title, ask "Could you tell me your role at the company?" instead. Do NOT ask for a description yet. Do NOT name the first lens. Do NOT ask the rating. Just the confirmation question. WAIT for their answer.]`,
      });
    } else if (!args.state.participantRoleDescription) {
      // Step B: role is confirmed; now ask for a description.
      const companyPhrase = args.state.participantCompany
        ? `for ${args.state.participantCompany}`
        : 'at your company';
      messages.push({
        role: 'user',
        content: `[the title is confirmed. Now thank them briefly and ask for a description of their role and outcomes. Frame: "Thank you for confirming. Could you outline your role ${companyPhrase} and the outcomes you're required to deliver?" One short opening clause + one clear question. Do NOT call any tools yet. Do NOT name the first lens. Do NOT ask the rating. WAIT for their answer.]`,
      });
    } else {
      // Fallback: both captured already but we're chaining without user input.
      messages.push({
        role: 'user',
        content: `[role and description are captured. Now flow into the first lens rating for ${lensLabel(args.state.currentLens)}. Call ask_rating and speak ONE short transition + the rating question. Frame the rating as DUAL perspective: "when you consider ${lensLabel(args.state.currentLens)} within your function AND the broader business, how would you rate where things are today, where they need to be, and where they're heading if nothing changes?" Do NOT narrow to just their function. Do not greet again.]`,
      });
    }
  } else if (args.userTranscript !== null && !args.state.roleConfirmed && !args.state.participantTitle) {
    // The user JUST introduced themselves after the welcome's "tell me your
    // name and job title" question — extract both, mark role confirmed (they
    // said it themselves), and immediately ask for the role description.
    messages.push({
      role: 'system',
      content: `[the participant just answered the welcome's "name and job title" question. Call capture_participant_info with the name and title you heard. Then in your spoken response, briefly thank them by first name and IMMEDIATELY ask: "Could you outline your role ${args.state.participantCompany ? `for ${args.state.participantCompany}` : 'at your company'} and what outcomes you're required to deliver?" One short opener clause + that question. Do NOT ask the rating yet. Do NOT ask "is that correct" — they confirmed by saying it. WAIT for them to describe their role.]`,
    });
  } else if (args.userTranscript !== null && !args.state.roleConfirmed && args.state.participantTitle) {
    // The user just answered the title-confirmation question (URL-provided
    // title path).
    messages.push({
      role: 'system',
      content: `[the participant just answered the title-confirmation question. Call confirm_role — pass null for correctedTitle if they confirmed, or the corrected title if they corrected you. In your spoken response: thank them for confirming and IMMEDIATELY ask the role-description question in the same turn. Frame: "Thank you for confirming. Could you outline your role ${args.state.participantCompany ? `for ${args.state.participantCompany}` : 'at your company'} and what outcomes you're required to deliver?" Do NOT ask the rating yet. Do NOT call ask_rating. WAIT for them to answer.]`,
    });
  } else if (args.userTranscript !== null && args.state.roleConfirmed && !args.state.participantRoleDescription && args.state.ratings.size === 0) {
    // The user just gave their role description.
    messages.push({
      role: 'system',
      content: `[the participant just described their role and outcomes. Call capture_role_description with a one-sentence summary of what they said (their words), briefly blend the acknowledgement into the next sentence (no "Got it. Thanks." as separate beats), and IMMEDIATELY transition to the first lens rating for ${lensLabel(args.state.currentLens)}: call ask_rating and ask the rating question. CRITICAL framing: "when you consider ${lensLabel(args.state.currentLens)} within your function AND the broader business, how would you rate where things stand today, where they need to be, and where they're heading if nothing changes?" Do NOT narrow it to just their function. All in one turn.]`,
    });
  }

  const aggregatedToolCalls: ToolCall[] = [];
  let endSession = false;

  // Tool loop: keep calling the model until it produces spoken text. If the
  // model emits only tool calls (no text), apply them, append the tool
  // responses to the message list, and loop. Hard cap of 3 iterations.
  // First iteration streams so we can fire TTS sentence-by-sentence.
  for (let iter = 0; iter < 3; iter++) {
    const useStreaming = iter === 0 && !!args.onSentence;
    let text = '';
    let rawToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];

    if (useStreaming) {
      const stream = await args.client.chat.completions.create({
        model: args.model ?? 'gpt-4o',
        temperature: 0.5,
        max_tokens: 400,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        stream: true,
      });

      const accumulatedTools: Array<{ id: string; index: number; name: string; argsBuf: string }> = [];
      let sentenceBuf = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          text += delta.content;
          sentenceBuf += delta.content;
          // Emit complete sentences (period/!/? followed by whitespace AND
          // a capital letter — guards against "Andrew. a bit more" being
          // split mid-thought, and against decimal points / abbreviations).
          let m: RegExpMatchArray | null;
          while ((m = sentenceBuf.match(/^([\s\S]+?[.!?])(\s+(?=[A-Z"'(]|$))/)) !== null) {
            const sentence = m[1]!.trim();
            sentenceBuf = sentenceBuf.slice(m[0].length);
            if (sentence && args.onSentence) {
              await args.onSentence(sentence);
            }
          }
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!accumulatedTools[idx]) {
              accumulatedTools[idx] = { id: tc.id ?? '', index: idx, name: '', argsBuf: '' };
            }
            if (tc.id) accumulatedTools[idx]!.id = tc.id;
            if (tc.function?.name) accumulatedTools[idx]!.name += tc.function.name;
            if (tc.function?.arguments) accumulatedTools[idx]!.argsBuf += tc.function.arguments;
          }
        }
      }

      // Flush any trailing partial sentence.
      const tail = sentenceBuf.trim();
      if (tail && args.onSentence) {
        await args.onSentence(tail);
      }

      rawToolCalls = accumulatedTools.map(t => ({
        id: t.id || `call_${t.index}`,
        type: 'function' as const,
        function: { name: t.name, arguments: t.argsBuf },
      })) as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
      text = text.trim();
    } else {
      const completion = await args.client.chat.completions.create({
        model: args.model ?? 'gpt-4o',
        temperature: 0.5,
        max_tokens: 400,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
      });
      const message = completion.choices[0]?.message;
      if (!message) break;
      text = (message.content ?? '').trim();
      rawToolCalls = message.tool_calls ?? [];
    }

    // Process tool calls.
    const turnToolCalls: ToolCall[] = [];
    for (const tc of rawToolCalls) {
      if (tc.type !== 'function') continue;
      let parsed: any;
      try {
        parsed = JSON.parse(tc.function.arguments || '{}');
      } catch {
        console.warn(`[agent-v2] failed to parse tool args for ${tc.function.name}`);
        continue;
      }
      if (tc.function.name === 'ask_rating') {
        turnToolCalls.push({ type: 'ask_rating' });
      } else if (tc.function.name === 'capture_participant_info') {
        turnToolCalls.push({ type: 'capture_participant_info', name: parsed.name ?? null, title: parsed.title ?? null });
      } else if (tc.function.name === 'confirm_role') {
        turnToolCalls.push({ type: 'confirm_role', correctedTitle: parsed.correctedTitle ?? null });
      } else if (tc.function.name === 'capture_role_description' && typeof parsed.description === 'string') {
        turnToolCalls.push({ type: 'capture_role_description', description: parsed.description });
      } else if (tc.function.name === 'capture_rating') {
        turnToolCalls.push({
          type: 'capture_rating',
          today: parsed.today ?? null,
          target: parsed.target ?? null,
          drift: parsed.drift ?? null,
          reason: parsed.reason ?? null,
        });
      } else if (tc.function.name === 'record_evidence' && typeof parsed.statement === 'string') {
        turnToolCalls.push({ type: 'record_evidence', statement: parsed.statement });
      } else if (tc.function.name === 'advance_lens') {
        turnToolCalls.push({ type: 'advance_lens' });
      } else if (tc.function.name === 'end_session' && typeof parsed.closing === 'string') {
        turnToolCalls.push({ type: 'end_session', closing: parsed.closing });
        endSession = true;
      }
    }

    aggregatedToolCalls.push(...turnToolCalls);

    // If we got spoken text OR end_session was called (closing comes from the tool itself), we're done.
    if (text || endSession) {
      const finalText = endSession && !text
        ? aggregatedToolCalls.find((c): c is Extract<ToolCall, { type: 'end_session' }> => c.type === 'end_session')?.closing ?? ''
        : text;
      return { text: finalText, toolCalls: aggregatedToolCalls };
    }

    // No text yet — append the assistant message + tool responses, then loop.
    if (rawToolCalls.length === 0) {
      // Model produced neither text nor tools — give up to avoid infinite loop.
      break;
    }
    const functionToolCalls = rawToolCalls.filter(
      (tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & { type: 'function'; function: { name: string; arguments: string } } =>
        tc.type === 'function',
    );
    messages.push({
      role: 'assistant',
      content: text || null,
      tool_calls: functionToolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });
    for (const tc of functionToolCalls) {
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: 'ok',
      });
    }
    // Reinforce: the next response must include spoken text.
    messages.push({
      role: 'system',
      content: 'You called a tool but did not speak. Now produce the SPOKEN response that goes with that action — one short sentence the participant will hear. Do not call any more tools this turn unless absolutely necessary.',
    });
  }

  // Fallback: model never produced text. Return empty so the caller can
  // handle it gracefully (caller will speak a brief acknowledgement).
  return { text: '', toolCalls: aggregatedToolCalls };
}

// ── State mutation helpers ──────────────────────────────────────────────────

export function applyToolCall(state: AgentState, call: ToolCall): void {
  switch (call.type) {
    case 'ask_rating': {
      // No state mutation — UI signal only.
      return;
    }
    case 'capture_participant_info': {
      if (call.name && call.name.trim()) state.participantName = call.name.trim();
      if (call.title && call.title.trim()) {
        state.participantTitle = call.title.trim();
        // Self-introduced — they confirmed it by saying it.
        state.roleConfirmed = true;
      }
      return;
    }
    case 'confirm_role': {
      state.roleConfirmed = true;
      if (call.correctedTitle && call.correctedTitle.trim()) {
        state.participantTitle = call.correctedTitle.trim();
      }
      return;
    }
    case 'capture_role_description': {
      state.participantRoleDescription = call.description.trim();
      return;
    }
    case 'capture_rating': {
      const lens = state.currentLens;
      const existing = state.ratings.get(lens) ?? {};
      state.ratings.set(lens, {
        today: call.today ?? existing.today,
        target: call.target ?? existing.target,
        drift: call.drift ?? existing.drift,
        reason: call.reason ?? existing.reason,
      });
      return;
    }
    case 'record_evidence': {
      const lens = state.currentLens;
      const arr = state.evidence.get(lens) ?? [];
      arr.push(call.statement);
      state.evidence.set(lens, arr);
      return;
    }
    case 'advance_lens': {
      const now = Date.now();
      // Freeze the elapsed time on the lens we're leaving.
      state.lensEndedAt.set(state.currentLens, now);
      const idx = state.lensSequence.indexOf(state.currentLens);
      if (idx >= 0 && idx < state.lensSequence.length - 1) {
        const nextLens = state.lensSequence[idx + 1]!;
        state.currentLens = nextLens;
        state.lensStartedAt.set(nextLens, now);
      } else {
        state.complete = true;
      }
      return;
    }
    case 'end_session': {
      state.complete = true;
      return;
    }
  }
}

export function recordTurn(state: AgentState, role: 'user' | 'assistant', content: string): void {
  if (!content.trim()) return;
  state.conversation.push({ role, content });
}

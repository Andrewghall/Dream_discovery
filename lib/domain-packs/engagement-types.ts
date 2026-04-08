/**
 * Engagement Type Configuration
 *
 * Defines the different engagement types available for workshops.
 * Each engagement type configures the diagnostic approach, output emphasis,
 * and suggested session mix for field discovery.
 *
 * Three agent-facing fields drive runtime behaviour:
 *   researchAngle         — injected into the Research Agent system prompt
 *   questionDesignPrinciple — injected into the Discovery Question Agent system prompt
 *   synthesisInstruction  — injected into the Synthesis prompt
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionMixSuggestion {
  captureType: string;
  minSessions: number;
  idealSessions: number;
  description: string;
}

export interface EngagementTypeConfig {
  key: string;
  label: string;
  description: string;
  diagnosticFocus: string;
  outputEmphasis: string[];
  suggestedSessionMix: SessionMixSuggestion[];
  typicalDurationDays: number;
  typicalInterviewCount: string; // e.g. "30-50"
  /** Injected into the Research Agent prompt — tells it what angle to research from */
  researchAngle: string;
  /** Injected into the Discovery Question Agent prompt — tells it how to design questions */
  questionDesignPrinciple: string;
  /** Injected into the Synthesis prompt — tells GPT-4o what to emphasise in the output */
  synthesisInstruction: string;
}

// ---------------------------------------------------------------------------
// Engagement Type Definitions
// ---------------------------------------------------------------------------

const DIAGNOSTIC_BASELINE: EngagementTypeConfig = {
  key: 'diagnostic_baseline',
  label: 'Diagnostic Baseline',
  description: 'Establish a clear picture of current state across all lenses before any transformation begins',
  diagnosticFocus: 'Current state assessment with evidence-based severity scoring',
  outputEmphasis: [
    'Per-lens maturity scores',
    'Severity-ranked findings',
    'Quick win candidates',
    'Baseline metrics for tracking',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 3, idealSessions: 5, description: 'Senior leadership perspective' },
    { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Middle management operational view' },
    { captureType: 'operational_interview', minSessions: 10, idealSessions: 25, description: 'Front-line staff reality' },
    { captureType: 'walkaround', minSessions: 2, idealSessions: 5, description: 'Physical observation and ad-hoc capture' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '30-50',
  researchAngle: `ENGAGEMENT TYPE: Diagnostic Baseline
This workshop is establishing a current-state baseline — before any transformation begins. Your research must answer: "Where does this company actually stand today?"

Research priorities:
- Industry maturity benchmarks: what does "good" look like in this sector for each lens? Find published maturity frameworks, benchmark studies, or analyst assessments.
- Comparable companies at similar maturity stages — what were their baseline findings and what changed?
- Any available data on this company's current performance vs industry peers (analyst reports, press, job postings that signal operational reality).
- Evidence of gaps between what the company says about itself (website, press releases) and what external signals suggest (reviews, hiring patterns, financial data).
- Identify which lenses are most likely to show the widest gap between self-perception and reality.

The facilitator needs to walk in knowing the benchmark. Don't just describe the company — show where they sit on a maturity curve.`,

  questionDesignPrinciple: `ENGAGEMENT TYPE: Diagnostic Baseline
This session is establishing a current-state baseline. Every question must generate a measurable, comparable signal.

Question design rules for this engagement type:
- The triple-rating maturity question (current / target / projected) is the centrepiece of every lens — it IS the baseline. Make the scales precise, specific, and anchored in real operational indicators for this industry.
- Exploratory questions should surface EVIDENCE for the rating: "What does your current [lens area] look like day to day — what are you proud of, and what keeps you up at night?"
- Avoid hypotheticals. This is a diagnostic, not a visioning session. Keep questions firmly in "what is true today."
- Design questions that will surface gaps between what leadership believes and what frontline staff experience — these perception gaps ARE the diagnostic finding.
- Every question should help the facilitator score severity: is this a minor friction, a significant constraint, or a critical blocker?`,

  synthesisInstruction: `ENGAGEMENT TYPE: Diagnostic Baseline — output must read as a maturity assessment, not a general workshop report.

Specific output requirements:
- discoveryOutput: Lead with maturity signals per lens. For each domain, the truths should establish WHERE the organisation is today with evidence-backed severity labels (Critical / Significant / Minor). The _aiSummary must describe the overall maturity profile and the biggest perception gaps found.
- constraintsContent: Frame every constraint with a severity score and evidence. Separate structural constraints (hard limits) from operational constraints (addressable).
- potentialSolution: Focus on quick wins that prove the baseline can shift. What can move in 90 days without major investment?
- summaryContent: Must include a maturity verdict per lens — where the organisation is now, where it needs to be, and the priority gap to close first.
- pathForward steps: Sequence by impact/effort. Step 1 should always be the highest-severity, most addressable constraint.`,
};

const OPERATIONAL_DEEP_DIVE: EngagementTypeConfig = {
  key: 'operational_deep_dive',
  label: 'Operational Deep Dive',
  description: 'Focused investigation into specific operational pain points with root cause analysis',
  diagnosticFocus: 'Root cause analysis of operational friction and process breakdowns',
  outputEmphasis: [
    'Process friction maps',
    'Root cause chains',
    'Workaround inventory',
    'Operational quick wins with effort/impact scoring',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 2, idealSessions: 3, description: 'Strategic context and priorities' },
    { captureType: 'manager_interview', minSessions: 5, idealSessions: 8, description: 'Process ownership and constraints' },
    { captureType: 'operational_interview', minSessions: 15, idealSessions: 30, description: 'Detailed operational experience' },
    { captureType: 'walkaround', minSessions: 3, idealSessions: 8, description: 'Observe processes in action' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '35-55',
  researchAngle: `ENGAGEMENT TYPE: Operational Deep Dive
This workshop is a focused investigation into operational pain points. Your research must answer: "Where are the root causes of the operational friction in this organisation?"

Research priorities:
- Industry-specific operational failure patterns: what processes break most commonly in this sector and why? Find case studies, analyst reports, operational benchmarks.
- Known operational challenges at this company specifically — search for customer complaints, employee reviews (Glassdoor, Indeed), operational news, leadership statements about challenges.
- Process and technology benchmarks: what do leading operators in this industry do differently at the process level?
- Identify which operational dimensions (people, process, technology, governance) tend to be the root cause vs symptom in this industry.
- Search for any recent operational incidents, service failures, or press about operational performance at this company.
- Workaround culture signals: job postings asking for people to "manage competing priorities" or "work in a fast-changing environment" often signal broken processes.

The facilitator needs to walk in with hypotheses about WHERE the root causes are — not just a list of known challenges.`,

  questionDesignPrinciple: `ENGAGEMENT TYPE: Operational Deep Dive
This session is hunting for root causes of operational friction — not symptoms. Questions must dig beneath the surface.

Question design rules for this engagement type:
- Frame questions around specific processes, not general topics: "Walk me through what happens when [specific process] breaks" beats "How are your operations performing?"
- Use causal framing: "When X goes wrong, what usually caused it?" and "What do you have to do to work around Y?"
- Surface workarounds explicitly — workarounds are the most honest signal of where the process has broken. Every lens should have at least one question that hunts for the workaround.
- Probe for the gap between how a process is supposed to work and how it actually works.
- Ask about frequency and impact: "How often does this happen, and what does it cost when it does?"
- The maturity scale should anchor on process consistency and reliability — not aspiration.`,

  synthesisInstruction: `ENGAGEMENT TYPE: Operational Deep Dive — output must read as a root cause analysis, not a general diagnostic.

Specific output requirements:
- discoveryOutput: Organise truths around process friction points. For each domain, surface the specific process breakdowns with evidence from participant signals. The _aiSummary must identify the primary root cause cluster — what underlying condition is driving most of the friction?
- constraintsContent: Lead with the deepest root causes, not the most visible symptoms. Each constraint should be labelled: Root Cause / Amplifier / Symptom. Avoid listing symptoms as if they are causes.
- potentialSolution: Every proposed solution must connect directly to a named root cause. "Fix the root cause of X" not "improve X generally." Include effort/impact scoring.
- summaryContent: The narrative must tell the causal story — what is producing the friction, what is amplifying it, and what breaks first if nothing changes.
- pathForward steps: Sequence by root cause priority. Address upstream causes before downstream symptoms.`,
};

const AI_ENABLEMENT: EngagementTypeConfig = {
  key: 'ai_enablement',
  label: 'AI Enablement',
  description: 'Assess readiness for AI adoption and identify high-value automation opportunities',
  diagnosticFocus: 'AI readiness assessment with use case identification and feasibility scoring',
  outputEmphasis: [
    'AI readiness per function',
    'Use case catalogue with feasibility scores',
    'Data readiness assessment',
    'Change readiness and cultural barriers',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 3, idealSessions: 5, description: 'AI strategy and investment appetite' },
    { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Operational AI use case identification' },
    { captureType: 'operational_interview', minSessions: 10, idealSessions: 20, description: 'Task-level automation candidates' },
    { captureType: 'walkaround', minSessions: 2, idealSessions: 4, description: 'Observe manual processes ripe for AI' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '25-45',
  researchAngle: `ENGAGEMENT TYPE: AI Enablement
This workshop is assessing AI readiness and identifying high-value automation opportunities. Your research must answer: "What is this company's actual AI starting point, and where is the highest-value AI opportunity?"

Research priorities:
- What AI tools, platforms, or initiatives does this company already have in place? Search specifically for their technology stack, vendor relationships, job postings for AI/data roles, press releases about technology investments.
- Industry AI adoption landscape: which AI use cases are proving ROI in this sector? Find published case studies and analyst reports on AI deployment in this industry.
- Competitor AI posture: are peers ahead or behind? What are they deploying? This is critical context for where this company sits on the adoption curve.
- Data infrastructure signals: search for what data systems, CRMs, or platforms this company uses — data readiness determines AI feasibility.
- Change readiness indicators: search for evidence of past technology transformations — were they successful? What resistance emerged?
- Regulatory considerations for AI in this sector — what constraints exist on what can be automated?

The facilitator needs to walk in knowing the AI landscape in this industry AND this company's realistic starting point. Don't just describe AI generally — map it to this company's specific context.`,

  questionDesignPrinciple: `ENGAGEMENT TYPE: AI Enablement
This session is identifying AI readiness and use case candidates. Every question must surface signals about automation opportunity, data availability, and change readiness.

Question design rules for this engagement type:
- For every lens, there must be an AI angle: "Where in [lens area] are people doing repetitive, rules-based work today that a machine could handle?"
- The maturity scale should anchor on AI/automation readiness — from "manual, no data" to "AI-native, continuously learning."
- Surface data readiness explicitly: "What data do you capture today that you aren't using? What data do you wish you had?"
- Ask about past technology experiences: "Have you tried automating anything before? What happened?" — this reveals the change readiness reality.
- Ask about fear and appetite: "Where would automation feel threatening to people in your team, and where would they welcome it?"
- Every question should help the facilitator score a potential use case: Is the process defined? Is the data available? Is the business case clear? Is the organisation ready?`,

  synthesisInstruction: `ENGAGEMENT TYPE: AI Enablement — output must read as an AI readiness assessment and use case prioritisation, not a general diagnostic.

Specific output requirements:
- discoveryOutput: For each domain, truths must include signals about current automation level, manual process volume, and data availability. The _aiSummary must describe the overall AI readiness profile — where is the organisation on the automation curve, and which functions are most and least ready?
- reimagineContent: The reimagine visions must be AI-forward — what does this function look like when well-automated? Be specific about what AI does vs what humans do.
- constraintsContent: Separate technical constraints (data, integration, infrastructure) from human constraints (change readiness, skills, fear) from governance constraints (regulatory, policy). These need different interventions.
- potentialSolution: This should read as a use case catalogue. For each proposed solution, specify: the use case, the estimated feasibility (High/Medium/Low based on data readiness and process clarity), and the expected impact. Prioritise by feasibility × impact.
- summaryContent: Must include an AI readiness verdict — where the organisation is ready to move now vs where it needs to build foundations first.
- pathForward steps: Phase 1 = foundation building (data, governance, skills). Phase 2 = high-feasibility quick wins. Phase 3 = higher-complexity, higher-value deployments.`,
};

const TRANSFORMATION_SPRINT: EngagementTypeConfig = {
  key: 'transformation_sprint',
  label: 'Transformation Sprint',
  description: 'Rapid diagnostic and solution design for time-critical transformation programmes',
  diagnosticFocus: 'Fast-cycle diagnostic with immediate action planning',
  outputEmphasis: [
    '30/60/90 day action plan',
    'Critical path dependencies',
    'Risk register with mitigations',
    'Stakeholder alignment map',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 3, idealSessions: 6, description: 'Transformation vision and governance' },
    { captureType: 'manager_interview', minSessions: 8, idealSessions: 15, description: 'Implementation reality and blockers' },
    { captureType: 'operational_interview', minSessions: 10, idealSessions: 20, description: 'Change impact and readiness' },
    { captureType: 'walkaround', minSessions: 2, idealSessions: 4, description: 'Current state observation' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '30-50',
  researchAngle: `ENGAGEMENT TYPE: Transformation Sprint
This workshop is a fast-cycle diagnostic for a time-critical transformation. Your research must answer: "What does this company need to move on immediately, and what will block them?"

Research priorities:
- What transformation programmes has this company already attempted? Search for announcements, leadership quotes, press coverage of strategic initiatives. What succeeded and what stalled?
- Industry transformation velocity: what pace of change is realistic in this sector? What do successful transformations look like here — what were the critical path decisions?
- Blockers and risk factors specific to this industry and company size/type — regulatory, union/workforce, technology debt, financial.
- Competitor transformation posture: are peers moving faster? Is there competitive urgency that creates a burning platform?
- Stakeholder landscape: who are the key players in this company's transformation governance? Search for leadership team, board composition, recent executive hires (signals of transformation intent).
- Search for any signals of transformation fatigue — failed programmes, leadership changes mid-initiative, employee sentiment about change.

The facilitator needs to walk in with a realistic view of what can move in 30/60/90 days — and what the likely blockers to momentum are. Speed and sequencing are everything in a sprint.`,

  questionDesignPrinciple: `ENGAGEMENT TYPE: Transformation Sprint
This session is time-critical. Every question must generate an actionable signal with a time horizon. Abstract insight is less valuable than concrete next steps.

Question design rules for this engagement type:
- Every exploratory question should have a time horizon: "In the next 90 days, what ONE thing would make the biggest difference to [lens area]?"
- Surface the blockers to velocity: "What would stop us moving fast on this?" and "Who would slow this down, and why?"
- Identify dependencies: "What needs to happen before [lens area] can change?" — the facilitator needs the critical path.
- Ask about stakeholder alignment: "Who in the organisation is most aligned behind this change? Who is most resistant?"
- The maturity scale should anchor on transformation readiness and velocity — from "not started / no mandate" to "fully mobilised / actively delivering."
- Avoid long-horizon visioning questions. This engagement is about what moves now — keep questions grounded in the next 3-6 months.`,

  synthesisInstruction: `ENGAGEMENT TYPE: Transformation Sprint — output must read as an action plan, not a diagnostic report. Urgency and velocity are the frame for everything.

Specific output requirements:
- discoveryOutput: Truths should be organised around transformation readiness signals — what's ready to move, what's blocked, what's not yet started. The _aiSummary must describe the transformation readiness profile and the primary velocity blockers.
- reimagineContent: Visions must be achievable within 12 months — no 5-year horizons. Frame each vision as a sprint destination: "In 90 days, [this function] should look like..."
- constraintsContent: Every constraint must be categorised as: Can be resolved in 30 days / Requires 60-90 days / Structural (longer than 90 days). The facilitator needs to know which blockers to tackle now vs park.
- potentialSolution: This must be a prioritised sprint plan. Lead with the 30-day actions — what can start immediately with resources in the room. Then 60-day and 90-day commitments. Include owners and dependencies for each.
- summaryContent: The narrative must convey urgency and momentum. What is the burning platform? What happens if the sprint stalls? What does success look like at the 90-day mark?
- pathForward steps: MUST be structured as Now (week 1-2) / Next (30 days) / Later (60-90 days). Each step needs an owner type and a blocker that must be cleared first.`,
};

const CULTURAL_ALIGNMENT: EngagementTypeConfig = {
  key: 'cultural_alignment',
  label: 'Cultural Alignment',
  description: 'Diagnose cultural gaps, leadership alignment, and organisational values in practice',
  diagnosticFocus: 'Culture assessment with leadership-frontline perception gap analysis',
  outputEmphasis: [
    'Values-in-practice assessment',
    'Leadership vs frontline perception gaps',
    'Cultural enablers and blockers',
    'Engagement and psychological safety indicators',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 3, idealSessions: 6, description: 'Leadership values and expectations' },
    { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Culture translation and implementation' },
    { captureType: 'operational_interview', minSessions: 15, idealSessions: 30, description: 'Lived cultural experience' },
    { captureType: 'walkaround', minSessions: 3, idealSessions: 6, description: 'Observe cultural artefacts and behaviours' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '35-55',
  researchAngle: `ENGAGEMENT TYPE: Cultural Alignment
This workshop is diagnosing cultural gaps and leadership-frontline alignment. Your research must answer: "What does the culture look like from the outside, and where does the gap between stated values and lived reality appear?"

Research priorities:
- Employee sentiment: search Glassdoor, Indeed, LinkedIn reviews for this company. What do employees say about leadership, culture, communication, recognition? These are gold — they tell the real story.
- Leadership team composition and stability: how long has the leadership team been in place? High churn signals cultural dysfunction. Search for executive departures and appointments.
- The company's stated values and culture narrative (website, annual report, employer brand) — the facilitator needs to know what the company claims before walking in.
- Any evidence of culture programmes, engagement surveys, or culture change initiatives — both as signals of intent AND as evidence of what hasn't worked.
- Industry culture benchmarks: what does "good" culture look like in this sector? What are the known cultural failure modes?
- Psychological safety signals: search for anything about how this company handles failure, speaks about mistakes, or describes its management approach.

The facilitator needs to walk in with a hypothesis about the gap between the culture the leadership believes they have and the culture employees are experiencing. That gap IS the workshop finding.`,

  questionDesignPrinciple: `ENGAGEMENT TYPE: Cultural Alignment
This session is surfacing the gap between stated culture and lived culture. Questions must create the space for people to tell the truth.

Question design rules for this engagement type:
- Ask about values in practice, not values in principle: "When you see someone living the values here, what does that actually look like?" not "What are the company values?"
- Surface perception gaps by asking the same question at different levels — the facilitator will cross-reference executive and frontline answers.
- Use indirect framing to reduce defensiveness: "If a new starter joined your team tomorrow, what would surprise them after 3 months?" surfaces real culture more honestly than direct questions.
- Psychological safety questions are essential: "Can people here say when something isn't working without it going against them?" — watch for hesitation even if the answer is yes.
- Ask about recognition and accountability: "What behaviours get rewarded here, formally and informally?" The real culture lives in what gets rewarded.
- The maturity scale should anchor on cultural health — from "fragmented, fear-based" to "cohesive, psychologically safe, values-led."
- Avoid corporate language. Culture questions need conversational, human framing.`,

  synthesisInstruction: `ENGAGEMENT TYPE: Cultural Alignment — output must read as a culture diagnosis, centred on perception gaps and values-in-practice, not a general organisational report.

Specific output requirements:
- discoveryOutput: Truths must surface perception gaps explicitly — where do leadership signals and frontline signals diverge? The _aiSummary must describe the dominant cultural reality as experienced by participants — what is the lived culture, and where does it deviate from the stated culture?
- reimagineContent: Visions must describe the desired cultural state — what does it feel like to work here when culture is aligned? Frame in human terms: how people communicate, how decisions are made, how mistakes are handled.
- constraintsContent: Cultural constraints need different framing — they are about beliefs, norms, and unwritten rules, not processes or systems. Label each: Leadership behaviour constraint / Middle management translation gap / Systemic cultural barrier / Historical trust deficit.
- potentialSolution: Solutions must be cultural interventions, not process fixes. Focus on: what leadership must do differently (visibly), what needs to be said publicly, what symbols or rituals must change, and what must be stopped.
- summaryContent: The narrative must honestly name the perception gap — "Leadership believes X. The organisation experiences Y. The gap between these two realities is the primary cultural risk." Be direct.
- pathForward steps: Cultural change is slow. Sequence steps around visibility and credibility: Step 1 = what leadership must do publicly to signal intent. Step 2 = what structures enable or block the change. Step 3 = what embeds the change over time.`,
};

// ---------------------------------------------------------------------------
// Registry map + lookup
// ---------------------------------------------------------------------------

export const ENGAGEMENT_TYPES: Record<string, EngagementTypeConfig> = {
  diagnostic_baseline: DIAGNOSTIC_BASELINE,
  operational_deep_dive: OPERATIONAL_DEEP_DIVE,
  ai_enablement: AI_ENABLEMENT,
  transformation_sprint: TRANSFORMATION_SPRINT,
  cultural_alignment: CULTURAL_ALIGNMENT,
};

/**
 * Get an engagement type config by key. Returns null if unknown.
 * Accepts both uppercase Prisma enum values (DIAGNOSTIC_BASELINE)
 * and lowercase registry keys (diagnostic_baseline).
 */
export function getEngagementType(key: string): EngagementTypeConfig | null {
  return ENGAGEMENT_TYPES[key.toLowerCase()] ?? null;
}

/**
 * List all available engagement type keys with labels.
 */
export function listEngagementTypes(): Array<{ key: string; label: string }> {
  return Object.values(ENGAGEMENT_TYPES).map((et) => ({
    key: et.key,
    label: et.label,
  }));
}

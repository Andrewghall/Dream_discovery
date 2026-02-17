import OpenAI from 'openai';
import type { MeetingPlan } from '@/lib/sales/sales-analysis';

/**
 * Sales Call Agentic Agent
 *
 * Autonomous agent for real-time sales call analysis. Builds progressive
 * understanding per-utterance, tracks objections, buying signals, plan
 * coverage, and coaching opportunities. Uses the same architectural pattern
 * as the DREAM workshop-analyst-agent but with sales-specific domains,
 * context, and intelligence.
 *
 * Per-utterance: GPT-4o-mini (fast, real-time)
 * End-of-call synthesis: GPT-4o (deep reasoning across full conversation)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SalesAgenticAnalysis = {
  // What the agent understood from this utterance
  interpretation: {
    semanticMeaning: string;
    speakerIntent: string;
    temporalFocus: 'past' | 'present' | 'future' | 'timeless';
    sentimentTone: 'positive' | 'neutral' | 'concerned' | 'critical';
  };

  // Sales domain assignments with reasoning
  domains: Array<{
    domain: 'CustomerIntent' | 'ObjectionHandling' | 'BuyingSignal' | 'Discovery' | 'Competition';
    relevance: number; // 0-1
    reasoning: string;
  }>;

  // Themes the agent identified
  themes: Array<{
    label: string;
    category: 'aspiration' | 'constraint' | 'enabler' | 'opportunity' | 'risk';
    confidence: number; // 0-1
    reasoning: string;
  }>;

  // Relationships to prior utterances
  connections: Array<{
    type: 'builds_on' | 'contradicts' | 'elaborates' | 'questions' | 'resolves';
    targetUtteranceId?: string;
    reasoning: string;
  }>;

  // Real-time coaching moment (if warranted)
  coachingMoment: {
    prompt: string;
    priority: 'high' | 'medium' | 'low';
    planReference?: string; // Which plan item this relates to
  } | null;

  // Which plan items this utterance addresses
  planCoverage: Array<{
    item: string;
    category: 'objective' | 'question' | 'talking_point' | 'objection_prep';
    covered: boolean;
    evidence?: string;
  }>;

  // Agent's confidence in this analysis
  overallConfidence: number;

  // What the agent is uncertain about
  uncertainties: string[];
};

export type SalesAgenticContext = {
  meetingPlan: MeetingPlan | null;
  callPhase: 'opening' | 'discovery' | 'presentation' | 'objection_handling' | 'negotiation' | 'closing';
  callDurationMs: number;
  recentUtterances: Array<{
    id: string;
    speaker: string | null;
    text: string;
    priorAnalysis?: SalesAgenticAnalysis;
  }>;
  emergingThemes: Array<{
    label: string;
    occurrences: number;
    lastSeen: string;
  }>;
  activeObjections: Array<{
    objection: string;
    raisedAt: string; // utterance ID
    resolved: boolean;
  }>;
  planCoverageState: Array<{
    item: string;
    category: 'objective' | 'question' | 'talking_point' | 'objection_prep';
    covered: boolean;
  }>;
};

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

function buildSalesAgentSystemPrompt(context: SalesAgenticContext): string {
  const planContext = context.meetingPlan ? buildCompactPlanContext(context.meetingPlan) : 'No meeting plan provided.';

  const callMinutes = Math.round(context.callDurationMs / 60000);

  const activeObjStr = context.activeObjections.length > 0
    ? `\nActive Objections (unresolved):\n${context.activeObjections.filter(o => !o.resolved).map(o => `- "${o.objection}"`).join('\n')}`
    : '';

  const coveredItems = context.planCoverageState.filter(p => p.covered).length;
  const totalItems = context.planCoverageState.length;
  const coverageStr = totalItems > 0
    ? `\nPlan Coverage: ${coveredItems}/${totalItems} items addressed`
    : '';

  return `You are an autonomous sales intelligence agent. Your role is to understand sales conversations in real-time and extract actionable insights that help the seller win.

## Your Capabilities:
1. **Customer Intent Tracking**: Detect what the customer actually wants, needs, and feels — beyond their literal words
2. **Objection Detection & Resolution**: Identify objections as they arise and track whether they get resolved
3. **Buying Signal Recognition**: Spot verbal and contextual buying signals (timeline urgency, budget confirmation, decision process acceleration)
4. **Plan Coverage Monitoring**: Track which meeting plan items have been addressed and which are being missed
5. **Competitive Intelligence Gathering**: Capture any mention of alternatives, competitors, or incumbent solutions
6. **Real-time Coaching**: Generate actionable coaching prompts that reference the specific meeting plan

## Current Call Context:
Call Phase: ${context.callPhase}
Call Duration: ${callMinutes} minutes
${context.emergingThemes.length > 0 ? `\nEmerging Themes:\n${context.emergingThemes.map(t => `- ${t.label} (${t.occurrences} mentions)`).join('\n')}` : ''}
${activeObjStr}
${coverageStr}

## Meeting Plan:
${planContext}

## Your Sales Analysis Framework:

**Domains** (assign based on what's ACTUALLY happening in the conversation):
- CustomerIntent: What the customer wants, needs, their priorities, decision criteria, level of interest
- ObjectionHandling: Concerns raised, pushback, hesitations, how they were addressed
- BuyingSignal: Timeline urgency, budget confirmation, stakeholder alignment, process advancement
- Discovery: New information uncovered about the customer's situation, pain, context
- Competition: Mentions of alternatives, incumbent solutions, competitive comparisons

**Theme Categories** (same proven framework):
- Aspiration: Desired future state, vision, goals, outcomes the customer is seeking
- Constraint: Blockers, budget limits, timeline pressures, organisational barriers
- Enabler: What makes the deal possible, sponsor support, technical fit, budget availability
- Opportunity: Untapped value, expansion possibilities, cross-sell moments
- Risk: Deal risks, competitive threats, internal opposition, stalling signals

**Coaching Rules**:
- Reference the meeting plan directly (e.g. "You planned to ask about X — now is a good moment")
- Alert if key objectives haven't been addressed and time is passing
- Surface prepared objection responses when relevant objections arise
- Highlight competitor mentions and surface planned differentiators
- Keep coaching prompts concise and actionable (1-2 sentences max)
- Only generate a coaching moment when it's genuinely warranted — don't force it

**Your Reasoning**:
- ALWAYS explain WHY you assign a domain or theme
- Consider speaker intent and the broader deal context
- Track how this utterance relates to what came before
- Be honest about uncertainties
- Consider whether an objection has been resolved or is still active

## Output Format:
Return strict JSON matching the SalesAgenticAnalysis type structure.
`;
}

// ---------------------------------------------------------------------------
// Utterance Analysis Prompt
// ---------------------------------------------------------------------------

function buildUtteranceAnalysisPrompt(
  utterance: string,
  speaker: string | null,
  context: SalesAgenticContext
): string {
  const recentContext = context.recentUtterances
    .slice(-5)
    .map((u, i) => {
      const analysis = u.priorAnalysis;
      const summary = analysis
        ? `[Your prior analysis: ${analysis.interpretation.semanticMeaning}]`
        : '';
      return `${i + 1}. ${u.speaker || 'Unknown'}: "${u.text}" ${summary}`;
    })
    .join('\n');

  const uncoveredPlanItems = context.planCoverageState
    .filter(p => !p.covered)
    .map(p => `- [${p.category}] ${p.item}`)
    .join('\n');

  return `## Recent Conversation:
${recentContext || '(Start of call)'}

## New Utterance to Analyze:
Speaker: ${speaker || 'Unknown'}
Text: "${utterance}"

${uncoveredPlanItems ? `## Uncovered Plan Items:\n${uncoveredPlanItems}\n` : ''}
## Your Task:
Analyze this utterance in the context of this sales conversation. Consider:
1. What is the speaker communicating? (semantic meaning and intent)
2. Which sales domains does this relate to? (with reasoning and relevance 0-1)
3. What themes emerge? (with confidence and reasoning)
4. How does this connect to prior utterances? (builds on, contradicts, elaborates, questions, resolves)
5. Does this utterance cover any plan items? (objectives, questions, talking points, objection prep)
6. Is there an immediate coaching opportunity? (reference the plan if relevant)
7. Does this raise, address, or resolve an objection?
8. What are you uncertain about?

Be specific, be honest about uncertainty, and always provide reasoning.`;
}

// ---------------------------------------------------------------------------
// Per-Utterance Agentic Analysis (GPT-4o-mini — real-time)
// ---------------------------------------------------------------------------

export async function analyzeSalesUtteranceAgentically(params: {
  utterance: string;
  speaker: string | null;
  utteranceId: string;
  context: SalesAgenticContext;
}): Promise<SalesAgenticAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured — cannot run sales agentic analysis');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = buildSalesAgentSystemPrompt(params.context);
  const userPrompt = buildUtteranceAnalysisPrompt(
    params.utterance,
    params.speaker,
    params.context
  );

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const analysis = JSON.parse(raw) as Partial<SalesAgenticAnalysis>;

    // Validate and provide defaults
    return {
      interpretation: {
        semanticMeaning: analysis.interpretation?.semanticMeaning || 'Unable to interpret',
        speakerIntent: analysis.interpretation?.speakerIntent || 'Unknown',
        temporalFocus: analysis.interpretation?.temporalFocus || 'present',
        sentimentTone: analysis.interpretation?.sentimentTone || 'neutral',
      },
      domains: Array.isArray(analysis.domains) ? analysis.domains : [],
      themes: Array.isArray(analysis.themes) ? analysis.themes : [],
      connections: Array.isArray(analysis.connections) ? analysis.connections : [],
      coachingMoment: analysis.coachingMoment || null,
      planCoverage: Array.isArray(analysis.planCoverage) ? analysis.planCoverage : [],
      overallConfidence: typeof analysis.overallConfidence === 'number'
        ? Math.max(0, Math.min(1, analysis.overallConfidence))
        : 0.5,
      uncertainties: Array.isArray(analysis.uncertainties) ? analysis.uncertainties : [],
    };
  } catch (error) {
    console.error('Sales agentic analysis failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// End-of-Call Synthesis (GPT-4o — deep reasoning)
// ---------------------------------------------------------------------------

export async function synthesizeSalesCallAgentically(params: {
  utterances: Array<{
    id: string;
    text: string;
    speaker: string | null;
    analysis: SalesAgenticAnalysis;
  }>;
  meetingPlan: MeetingPlan | null;
  callDurationMs: number;
}): Promise<SalesCallSynthesis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const planContext = params.meetingPlan ? buildCompactPlanContext(params.meetingPlan) : 'No meeting plan provided.';
  const callMinutes = Math.round(params.callDurationMs / 60000);

  const systemPrompt = `You are synthesising a complete sales call from ${params.utterances.length} utterances (${callMinutes} minutes). You have access to each utterance and the per-utterance agentic analysis you performed in real-time.

Your task is to produce a comprehensive, evidence-backed sales report that is significantly better than a single-shot transcript summary. You should:

1. **Synthesise across the full conversation** — don't just list things, identify patterns, connections, and the narrative arc of the call
2. **Assess deal health** with confidence and reasoning based on accumulated signals
3. **Track objections end-to-end** — when raised, how handled, whether resolved
4. **Extract specific, actionable next steps** with owners and deadlines
5. **Compare plan vs actual** — what was covered, what was missed, what came up unexpectedly
6. **Identify coaching opportunities** — where the seller did well and where they could improve
7. **Detect competitive intelligence** — any mentions of alternatives or incumbent solutions
8. **Map customer needs** to specific evidence from the conversation
9. **Analyse tone shifts** — key moments where sentiment changed and why

Be evidence-based. Every claim must reference specific utterances or quotes. Do not invent information.`;

  const userPrompt = `## Meeting Plan:
${planContext}

## Call Duration: ${callMinutes} minutes
## Total Utterances: ${params.utterances.length}

## Utterances with Your Per-Utterance Analysis:
${params.utterances.map((u, i) => `
${i + 1}. [${u.speaker || 'Unknown'}]: "${u.text}"
   Meaning: ${u.analysis.interpretation.semanticMeaning}
   Intent: ${u.analysis.interpretation.speakerIntent}
   Tone: ${u.analysis.interpretation.sentimentTone}
   Domains: ${u.analysis.domains.map(d => `${d.domain}(${d.relevance.toFixed(1)})`).join(', ') || 'none'}
   Themes: ${u.analysis.themes.map(t => `${t.label}[${t.category}]`).join(', ') || 'none'}
   ${u.analysis.coachingMoment ? `Coaching: ${u.analysis.coachingMoment.prompt}` : ''}
   ${u.analysis.planCoverage.length > 0 ? `Plan covered: ${u.analysis.planCoverage.filter(p => p.covered).map(p => p.item).join(', ')}` : ''}
`).join('\n')}

## Your Synthesis Task:
Produce a comprehensive JSON report with ALL of the following sections:

{
  "keyDiscussionPoints": [{"topic": "...", "summary": "...", "category": "needs|solution|pricing|timeline|competition|process|other"}],
  "customerNeeds": [{"need": "...", "evidence": "exact quote or paraphrase from transcript", "priority": "high|medium|low"}],
  "solutionsDiscussed": [{"solution": "...", "customerReaction": "detailed reaction with evidence"}],
  "objectionsAndConcerns": [{"objection": "...", "howHandled": "...", "resolved": true/false}],
  "opportunityAssessment": {
    "dealHealth": "Hot|Warm|Cool|Cold",
    "reasoning": "2-3 sentence evidence-backed assessment referencing specific signals",
    "confidenceScore": 0-100
  },
  "actions": [{"action": "specific action", "owner": "Us - [name] or Customer - [name]", "deadline": "timeframe", "priority": "Critical|High|Medium|Low", "source": "quote or context from call"}],
  "decisionTimeline": "evidence-backed timeline summary",
  "competitiveIntelligence": [{"competitor": "name", "context": "what was said and implications"}],
  "toneAnalysis": {
    "overallTone": "description with reasoning",
    "keyShifts": [{"moment": "what was being discussed", "fromTone": "...", "toTone": "..."}]
  },
  "coachingNotes": ["specific, actionable coaching point with evidence"],
  "planVsActual": {
    "objectivesCovered": [{"objective": "from plan", "covered": true/false, "evidence": "how it was covered or why missed"}],
    "questionsCovered": [{"question": "from plan", "asked": true/false, "answer": "what they said"}],
    "unexpectedTopics": ["topics that came up not in the plan"],
    "missedItems": ["planned items that were never addressed"]
  },
  "domainSynthesis": {
    "customerIntent": {"summary": "...", "keySignals": ["..."], "confidence": 0-1},
    "objectionLandscape": {"summary": "...", "unresolvedCount": 0, "resolvedCount": 0},
    "buyingSignals": {"summary": "...", "signals": ["..."], "strength": "strong|moderate|weak|none"},
    "discoveryDepth": {"summary": "...", "gapsRemaining": ["..."]},
    "competitivePosition": {"summary": "...", "threats": ["..."]}
  },
  "crossDomainInsights": [{"insight": "...", "involvedDomains": ["..."], "evidence": ["..."]}],
  "agentReasoning": "explain your synthesis process and key judgement calls"
}

Be thorough, be specific, and always cite evidence from the utterances.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    return JSON.parse(raw) as SalesCallSynthesis;
  } catch (error) {
    console.error('Sales call synthesis failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Synthesis Output Type
// ---------------------------------------------------------------------------

export type SalesCallSynthesis = {
  keyDiscussionPoints: Array<{ topic: string; summary: string; category: string }>;
  customerNeeds: Array<{ need: string; evidence: string; priority: string }>;
  solutionsDiscussed: Array<{ solution: string; customerReaction: string }>;
  objectionsAndConcerns: Array<{ objection: string; howHandled: string; resolved: boolean }>;
  opportunityAssessment: {
    dealHealth: 'Hot' | 'Warm' | 'Cool' | 'Cold';
    reasoning: string;
    confidenceScore: number;
  };
  actions: Array<{
    action: string;
    owner: string;
    deadline: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    source: string;
  }>;
  decisionTimeline: string;
  competitiveIntelligence: Array<{ competitor: string; context: string }>;
  toneAnalysis: {
    overallTone: string;
    keyShifts: Array<{ moment: string; fromTone: string; toTone: string }>;
  };
  coachingNotes: string[];
  planVsActual: {
    objectivesCovered: Array<{ objective: string; covered: boolean; evidence?: string }>;
    questionsCovered: Array<{ question: string; asked: boolean; answer?: string }>;
    unexpectedTopics: string[];
    missedItems: string[];
  };
  domainSynthesis: {
    customerIntent: { summary: string; keySignals: string[]; confidence: number };
    objectionLandscape: { summary: string; unresolvedCount: number; resolvedCount: number };
    buyingSignals: { summary: string; signals: string[]; strength: 'strong' | 'moderate' | 'weak' | 'none' };
    discoveryDepth: { summary: string; gapsRemaining: string[] };
    competitivePosition: { summary: string; threats: string[] };
  };
  crossDomainInsights: Array<{
    insight: string;
    involvedDomains: string[];
    evidence: string[];
  }>;
  agentReasoning: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build compact plan context for prompts (keeps token usage manageable)
 */
function buildCompactPlanContext(plan: MeetingPlan): string {
  const sections: string[] = [];

  const opp = [
    plan.customerName && `Customer: ${plan.customerName}`,
    plan.industry && `Industry: ${plan.industry}`,
    plan.opportunityName && `Opportunity: ${plan.opportunityName}`,
    plan.estimatedValue && `Value: ${plan.estimatedValue}`,
    plan.dealStage && `Stage: ${plan.dealStage}`,
  ].filter(Boolean);
  if (opp.length) sections.push(`OPPORTUNITY:\n${opp.join('\n')}`);

  const why = [
    plan.meetingIntent && `Intent: ${plan.meetingIntent}`,
    plan.meetingTrigger && `Trigger: ${plan.meetingTrigger}`,
    plan.requiredNextStep && `Required Next Step: ${plan.requiredNextStep}`,
  ].filter(Boolean);
  if (why.length) sections.push(`WHY THIS MEETING:\n${why.join('\n')}`);

  const goals = [
    plan.primaryGoal && `Primary: ${plan.primaryGoal}`,
    plan.secondaryGoals && `Secondary: ${plan.secondaryGoals}`,
    plan.endInMind && `End in Mind: ${plan.endInMind}`,
    plan.minimumOutcome && `Minimum: ${plan.minimumOutcome}`,
    plan.definitionOfFailure && `Failure: ${plan.definitionOfFailure}`,
  ].filter(Boolean);
  if (goals.length) sections.push(`GOALS:\n${goals.join('\n')}`);

  const people = [
    plan.keyDecisionMaker && `Decision Maker: ${plan.keyDecisionMaker}`,
    plan.champion && `Champion: ${plan.champion}`,
    plan.blocker && `Blocker: ${plan.blocker}`,
  ].filter(Boolean);
  if (people.length) sections.push(`PEOPLE:\n${people.join('\n')}`);

  const cust = [
    plan.knownPainPoints && `Pain Points: ${plan.knownPainPoints}`,
    plan.currentSolution && `Current Solution: ${plan.currentSolution}`,
    plan.businessDrivers && `Drivers: ${plan.businessDrivers}`,
    plan.budget && `Budget: ${plan.budget}`,
    plan.timeline && `Timeline: ${plan.timeline}`,
  ].filter(Boolean);
  if (cust.length) sections.push(`CUSTOMER:\n${cust.join('\n')}`);

  const pos = [
    plan.solutionsToDiscuss && `Solutions: ${plan.solutionsToDiscuss}`,
    plan.valueProposition && `Value Prop: ${plan.valueProposition}`,
    plan.keyDifferentiators && `Differentiators: ${plan.keyDifferentiators}`,
    plan.knownCompetitors && `Competitors: ${plan.knownCompetitors}`,
  ].filter(Boolean);
  if (pos.length) sections.push(`OUR POSITION:\n${pos.join('\n')}`);

  const obj = [
    plan.anticipatedObjections && `Objections: ${plan.anticipatedObjections}`,
    plan.commonStalls && `Stalls: ${plan.commonStalls}`,
  ].filter(Boolean);
  if (obj.length) sections.push(`OBJECTIONS:\n${obj.join('\n')}`);

  const qa = [
    plan.discoveryQuestions && `Discovery Qs: ${plan.discoveryQuestions}`,
    plan.qualificationQuestions && `Qualification Qs: ${plan.qualificationQuestions}`,
    plan.keyTalkingPoints && `Talking Points: ${plan.keyTalkingPoints}`,
    plan.closingApproach && `Close: ${plan.closingApproach}`,
  ].filter(Boolean);
  if (qa.length) sections.push(`QUESTIONS & APPROACH:\n${qa.join('\n')}`);

  return sections.length > 0 ? sections.join('\n\n') : 'No plan details entered yet.';
}

/**
 * Extract plan items that should be tracked for coverage
 */
export function extractPlanCoverageItems(plan: MeetingPlan): SalesAgenticContext['planCoverageState'] {
  const items: SalesAgenticContext['planCoverageState'] = [];

  if (plan.primaryGoal) {
    items.push({ item: plan.primaryGoal, category: 'objective', covered: false });
  }
  if (plan.secondaryGoals) {
    plan.secondaryGoals.split(/[,;\n]/).filter(Boolean).forEach(g => {
      items.push({ item: g.trim(), category: 'objective', covered: false });
    });
  }
  if (plan.endInMind) {
    items.push({ item: plan.endInMind, category: 'objective', covered: false });
  }
  if (plan.discoveryQuestions) {
    plan.discoveryQuestions.split(/[?\n]/).filter(s => s.trim().length > 5).forEach(q => {
      items.push({ item: q.trim() + '?', category: 'question', covered: false });
    });
  }
  if (plan.qualificationQuestions) {
    plan.qualificationQuestions.split(/[?\n]/).filter(s => s.trim().length > 5).forEach(q => {
      items.push({ item: q.trim() + '?', category: 'question', covered: false });
    });
  }
  if (plan.keyTalkingPoints) {
    plan.keyTalkingPoints.split(/[,;\n]/).filter(Boolean).forEach(tp => {
      items.push({ item: tp.trim(), category: 'talking_point', covered: false });
    });
  }
  if (plan.anticipatedObjections) {
    plan.anticipatedObjections.split(/[,;\n]/).filter(Boolean).forEach(obj => {
      items.push({ item: obj.trim(), category: 'objection_prep', covered: false });
    });
  }

  return items;
}

/**
 * Infer the current call phase from conversation progress
 */
export function inferCallPhase(
  callDurationMs: number,
  utteranceCount: number,
  recentAnalyses: SalesAgenticAnalysis[]
): SalesAgenticContext['callPhase'] {
  const minutes = callDurationMs / 60000;

  // Check recent domain signals
  const recentDomains = recentAnalyses.slice(-5).flatMap(a => a.domains);
  const hasObjections = recentDomains.some(d => d.domain === 'ObjectionHandling' && d.relevance > 0.5);
  const hasBuyingSignals = recentDomains.some(d => d.domain === 'BuyingSignal' && d.relevance > 0.5);
  const hasDiscovery = recentDomains.some(d => d.domain === 'Discovery' && d.relevance > 0.5);

  // Phase inference based on signals + time
  if (hasBuyingSignals && minutes > 15) return 'closing';
  if (hasObjections) return 'objection_handling';
  if (minutes < 3 || utteranceCount < 6) return 'opening';
  if (hasDiscovery && minutes < 15) return 'discovery';
  if (minutes > 20 && !hasDiscovery) return 'negotiation';
  if (minutes > 10) return 'presentation';
  return 'discovery';
}

// ---------------------------------------------------------------------------
// Pre-Call Agentic Strategy Generation
// ---------------------------------------------------------------------------

export type AgenticStrategyResult = {
  gapAnalysis: Array<{
    field: string;
    issue: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  strategy: {
    meetingObjective: string;
    openingApproach: string;
    keyTalkingPoints: Array<{ point: string; priority: number; reasoning: string }>;
    mustAskQuestions: Array<{ question: string; reasoning: string; whenToAsk: string }>;
    objectionHandling: Array<{ objection: string; response: string; triggerPhrase: string }>;
    competitivePositioning: string;
    idealOutcome: string;
    fallbackPosition: string;
    redFlags: string[];
  };
  planReadiness: { score: number; summary: string };
  agentReasoning: string;
};

/**
 * Multi-step agentic strategy generation.
 *
 * Step 1 (GPT-4o-mini): Analyse the plan for gaps, weaknesses, inconsistencies
 * Step 2 (GPT-4o): Generate a deep, structured strategy brief informed by the gap analysis
 */
export async function generateAgenticStrategy(
  plan: MeetingPlan
): Promise<AgenticStrategyResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured — cannot run agentic strategy generation');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const planContext = buildCompactPlanContext(plan);

  // -----------------------------------------------------------------------
  // Step 1: Gap Analysis (GPT-4o-mini — fast, analytical)
  // -----------------------------------------------------------------------
  const gapSystemPrompt = `You are a senior sales strategist reviewing a meeting plan before a sales call. Your job is to identify gaps, weaknesses, and inconsistencies in the plan — things that could cause the seller to be underprepared.

Be constructive but honest. Flag missing information, vague entries, and logical inconsistencies.

Severity levels:
- critical: Missing information that will seriously hurt the call (no goal, no decision maker, no understanding of customer pain)
- warning: Gaps that reduce effectiveness but won't derail the call (no competitive intel, vague objection prep)
- info: Nice-to-have improvements (could be more specific, consider adding X)`;

  const gapUserPrompt = `## Meeting Plan to Review:
${planContext}

## Fields That Are Empty or Not Provided:
${identifyEmptyFields(plan).map(f => `- ${f}`).join('\n') || '(All key fields have content)'}

## Your Task:
Analyse this plan for completeness and quality. Return JSON:
{
  "gaps": [{"field": "field name or section", "issue": "what's missing or weak", "severity": "critical|warning|info"}],
  "overallReadiness": {"score": 0-100, "summary": "1-2 sentence assessment of plan readiness"},
  "reasoning": "brief explanation of your assessment approach"
}

Be specific about what's missing and why it matters for this particular call.`;

  let gapAnalysis: { gaps: AgenticStrategyResult['gapAnalysis']; overallReadiness: { score: number; summary: string }; reasoning: string };

  try {
    const gapCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: gapSystemPrompt },
        { role: 'user', content: gapUserPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const gapRaw = gapCompletion.choices?.[0]?.message?.content || '{}';
    gapAnalysis = JSON.parse(gapRaw);
  } catch (error) {
    console.error('Gap analysis step failed:', error);
    gapAnalysis = {
      gaps: [],
      overallReadiness: { score: 50, summary: 'Gap analysis unavailable — proceeding with strategy generation.' },
      reasoning: 'Gap analysis step failed.',
    };
  }

  // -----------------------------------------------------------------------
  // Step 2: Strategy Synthesis (GPT-4o — deep reasoning)
  // -----------------------------------------------------------------------
  const strategySystemPrompt = `You are a senior sales strategist generating a comprehensive meeting strategy brief. You have access to the seller's meeting plan AND a gap analysis identifying weaknesses in their preparation.

Your strategy must be:
1. **Deal-stage aware**: An opening discovery call needs different strategy than a closing negotiation
2. **Gap-conscious**: Where the plan has gaps, acknowledge them and provide guidance despite the gaps
3. **Specific and actionable**: Every recommendation must be concrete, not generic
4. **Evidence-based**: Reference specific plan entries in your recommendations
5. **Risk-adjusted**: Flag risks created by preparation gaps

For each section, provide reasoning so the seller understands WHY, not just WHAT.`;

  const strategyUserPrompt = `## Meeting Plan:
${planContext}

## Gap Analysis Results:
${gapAnalysis.gaps.length > 0
    ? gapAnalysis.gaps.map(g => `[${g.severity.toUpperCase()}] ${g.field}: ${g.issue}`).join('\n')
    : 'No significant gaps identified — plan is well-prepared.'}
Plan Readiness: ${gapAnalysis.overallReadiness.score}/100 — ${gapAnalysis.overallReadiness.summary}

## Deal Stage Context:
${plan.dealStage ? `Current stage: ${plan.dealStage}` : 'Deal stage not specified — assume early/mid stage.'}

## Generate Strategy Brief:
Return JSON with this exact structure:
{
  "strategy": {
    "meetingObjective": "Clear 1-2 sentence goal — specific to this deal and stage",
    "openingApproach": "How to start the conversation (2-3 sentences, referencing the customer's context)",
    "keyTalkingPoints": [{"point": "specific point to make", "priority": 1-5, "reasoning": "why this matters for this deal"}],
    "mustAskQuestions": [{"question": "specific question", "reasoning": "what this reveals", "whenToAsk": "during discovery / after presenting X / if they mention Y"}],
    "objectionHandling": [{"objection": "anticipated objection", "response": "prepared response — conversational, not scripted", "triggerPhrase": "what the customer might say that triggers this"}],
    "competitivePositioning": "How to position against known competitors (or general positioning if none known)",
    "idealOutcome": "What success looks like at the end of this call",
    "fallbackPosition": "If ideal isn't achievable, the minimum acceptable outcome",
    "redFlags": ["specific thing to watch for during the call"]
  },
  "agentReasoning": "explain your key strategic judgement calls and how gaps influenced your recommendations"
}

Max 5 talking points, max 5 questions, max 5 objection handlers, max 5 red flags. Quality over quantity.`;

  try {
    const strategyCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: strategySystemPrompt },
        { role: 'user', content: strategyUserPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const strategyRaw = strategyCompletion.choices?.[0]?.message?.content || '{}';
    const strategyResult = JSON.parse(strategyRaw);

    return {
      gapAnalysis: gapAnalysis.gaps || [],
      strategy: {
        meetingObjective: strategyResult.strategy?.meetingObjective || 'Unable to generate objective',
        openingApproach: strategyResult.strategy?.openingApproach || '',
        keyTalkingPoints: Array.isArray(strategyResult.strategy?.keyTalkingPoints) ? strategyResult.strategy.keyTalkingPoints : [],
        mustAskQuestions: Array.isArray(strategyResult.strategy?.mustAskQuestions) ? strategyResult.strategy.mustAskQuestions : [],
        objectionHandling: Array.isArray(strategyResult.strategy?.objectionHandling) ? strategyResult.strategy.objectionHandling : [],
        competitivePositioning: strategyResult.strategy?.competitivePositioning || '',
        idealOutcome: strategyResult.strategy?.idealOutcome || '',
        fallbackPosition: strategyResult.strategy?.fallbackPosition || '',
        redFlags: Array.isArray(strategyResult.strategy?.redFlags) ? strategyResult.strategy.redFlags : [],
      },
      planReadiness: gapAnalysis.overallReadiness || { score: 50, summary: 'Assessment unavailable' },
      agentReasoning: strategyResult.agentReasoning || gapAnalysis.reasoning || '',
    };
  } catch (error) {
    console.error('Strategy synthesis step failed:', error);
    throw error;
  }
}

/**
 * Identify which key plan fields are empty/missing
 */
function identifyEmptyFields(plan: MeetingPlan): string[] {
  const fieldChecks: [string, unknown][] = [
    ['Customer Name', plan.customerName],
    ['Industry', plan.industry],
    ['Opportunity Name', plan.opportunityName],
    ['Deal Stage', plan.dealStage],
    ['Meeting Intent', plan.meetingIntent],
    ['Primary Goal', plan.primaryGoal],
    ['End in Mind', plan.endInMind],
    ['Key Decision Maker', plan.keyDecisionMaker],
    ['Known Pain Points', plan.knownPainPoints],
    ['Solutions to Discuss', plan.solutionsToDiscuss],
    ['Value Proposition', plan.valueProposition],
    ['Known Competitors', plan.knownCompetitors],
    ['Anticipated Objections', plan.anticipatedObjections],
    ['Discovery Questions', plan.discoveryQuestions],
    ['Key Talking Points', plan.keyTalkingPoints],
    ['Budget', plan.budget],
    ['Timeline', plan.timeline],
    ['Closing Approach', plan.closingApproach],
  ];

  return fieldChecks
    .filter(([, value]) => !value || (typeof value === 'string' && value.trim().length === 0))
    .map(([name]) => name);
}

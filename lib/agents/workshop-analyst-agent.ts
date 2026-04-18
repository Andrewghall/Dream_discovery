import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';

/**
 * True Agentic Workshop Analyst
 *
 * This agent autonomously analyzes workshop transcripts in real-time,
 * building understanding of themes, domains, and relationships without
 * relying on hardcoded keyword patterns.
 */

type DataPointPrimaryType =
  | 'VISIONARY'
  | 'OPPORTUNITY'
  | 'CONSTRAINT'
  | 'RISK'
  | 'ENABLER'
  | 'ACTION'
  | 'QUESTION'
  | 'INSIGHT';

function safePrimaryType(v: unknown): DataPointPrimaryType {
  const upper = String(v || '').toUpperCase();
  const allowed: Record<string, DataPointPrimaryType> = {
    VISIONARY: 'VISIONARY',
    OPPORTUNITY: 'OPPORTUNITY',
    CONSTRAINT: 'CONSTRAINT',
    RISK: 'RISK',
    ENABLER: 'ENABLER',
    ACTION: 'ACTION',
    QUESTION: 'QUESTION',
    INSIGHT: 'INSIGHT',
  };
  return allowed[upper] || 'INSIGHT';
}

export type AgenticAnalysis = {
  // Primary classification of this utterance
  primaryType: DataPointPrimaryType;

  // What the agent understood from this utterance
  interpretation: {
    semanticMeaning: string;
    speakerIntent: string;
    temporalFocus: 'past' | 'present' | 'future' | 'timeless';
    sentimentTone: 'positive' | 'neutral' | 'concerned' | 'critical';
  };

  // Domain assignments with reasoning
  domains: Array<{
    domain: 'People' | 'Operations' | 'Customer' | 'Technology' | 'Regulation';
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

  // Business actors/roles mentioned in this utterance
  actors: Array<{
    name: string;           // e.g., "Customer", "Agent", "Executive", "Supplier"
    role: string;           // brief description of their role in context
    interactions: Array<{
      withActor: string;    // who they interact with
      action: string;       // what happens: "contacts", "escalates to", "approves"
      sentiment: string;    // how it feels: "frustrated", "smooth", "delayed"
      context: string;      // from the utterance
    }>;
  }>;

  // Agent's confidence in this analysis
  overallConfidence: number;

  // What the agent is uncertain about
  uncertainties: string[];
};

export type AgenticContext = {
  workshopGoal: string;
  currentPhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';
  recentUtterances: Array<{
    id: string;
    speaker: string | null;
    text: string;
    priorAnalysis?: AgenticAnalysis;
  }>;
  emergingThemes: Array<{
    label: string;
    occurrences: number;
    lastSeen: string;
  }>;
};

/**
 * The Agent's System Prompt - Its Core Intelligence
 */
function buildAgentSystemPrompt(context: AgenticContext): string {
  return `You are an autonomous workshop analysis agent. Your role is to understand workshop conversations in real-time and extract meaningful insights.

## Your Capabilities:
1. **Semantic Understanding**: You understand what people mean, not just what they say
2. **Context Building**: You track conversation flow and how ideas evolve
3. **Theme Detection**: You identify emerging patterns without keyword matching
4. **Relationship Mapping**: You see how utterances connect and build on each other
5. **Uncertainty Recognition**: You know when you're unsure and seek clarification

## Current Context:
Workshop Goal: ${context.workshopGoal}
Current Phase: ${context.currentPhase}
${context.emergingThemes.length > 0 ? `\nEmerging Themes You've Detected:\n${context.emergingThemes.map(t => `- ${t.label} (${t.occurrences} mentions)`).join('\n')}` : ''}

## Your Analysis Framework:

**Domain Assignment (EthentaFlow rule)**:
Assign the PRIMARY domain based on WHERE AN INTERVENTION WOULD NEED TO OCCUR to resolve the issue — not where the problem is observed or felt.

- People: The fix requires changing human capability, culture, skills, behaviour, or team dynamics
- Operations: The fix requires changing processes, workflows, governance, or decision structures
- Customer: The fix requires redesigning the customer experience or journey itself (NOT just "customers are affected")
- Technology: The fix requires changing systems, data, platforms, automation, or tooling
- Regulation: The fix requires addressing compliance, risk controls, or legal requirements

Outcome surfaces (Customer, Revenue) CANNOT be primary unless the statement is explicitly about designing or managing that domain. A customer complaint is not a Customer domain issue — it is a symptom. Find where the fix lives.

Secondary domains (max 2): only direct causal contributors to the root issue, not surfaces where effects are felt.

**Theme Categories**:
- Aspiration: Desired future state, vision, goals, outcomes sought
- Constraint: Blockers, limits, risks, dependencies, challenges
- Enabler: What makes things possible, capabilities needed, foundational elements
- Opportunity: Potential improvements, chances to create value, untapped possibilities

**Classification** (assign exactly ONE primaryType based on overall intent):
- VISIONARY: Aspirational statements about a desired future state, goals, or transformational ideas
- OPPORTUNITY: Identifying potential improvements, untapped possibilities, chances to create value
- CONSTRAINT: Explicit blockers, limitations, dependencies, or things that PREVENT progress
- RISK: Threats, concerns, or things that could go wrong
- ENABLER: Things that make progress possible — capabilities, tools, foundations, positive conditions
- ACTION: Specific next steps, commitments, or things to do
- QUESTION: Direct questions or requests for clarification
- INSIGHT: Observations, reflections, descriptions of current/past state, sharing experience/knowledge

Classification rules:
- Speech arrives in real-time fragments. Read the conversation context to understand the speaker's FULL intent.
- Describing past experience, current reality, or how things work = INSIGHT, not CONSTRAINT
- Positive or collaborative statements = INSIGHT or ENABLER, not CONSTRAINT
- Only classify as CONSTRAINT when the speaker is explicitly identifying something that blocks, limits, or prevents progress
- When uncertain, prefer INSIGHT (the safest, most neutral classification)

**Actors** (extract any business roles/personas mentioned):
- Identify every actor/role referenced (e.g., Customer, Agent, Executive, Supplier, New Starter, Team Lead, Analyst, Auditor, Manager, System)
- For each actor, describe their role in context
- Map how actors interact with each other (who does what to/for whom)
- Note the sentiment of each interaction (frustrated, smooth, delayed, empowered, etc.)
- "System" or "Platform" can be an actor when it mediates interactions
- Risk: Threats, concerns, things that could go wrong

**Your Reasoning**:
- ALWAYS explain WHY you assign a domain or theme
- Consider speaker intent and context, not just literal words
- Track how this utterance relates to what came before
- Be honest about uncertainties

## Output Format:
Return strict JSON matching the AgenticAnalysis type structure.
`;
}

/**
 * Build the agent's prompt for analyzing a specific utterance
 */
function buildUtteranceAnalysisPrompt(
  utterance: string,
  speaker: string | null,
  context: AgenticContext
): string {
  const recentContext = context.recentUtterances
    .slice(-5) // Last 5 utterances
    .map((u, i) => {
      const analysis = u.priorAnalysis;
      const summary = analysis
        ? `[You previously understood this as: ${analysis.interpretation.semanticMeaning}]`
        : '';
      return `${i + 1}. ${u.speaker || 'Unknown'}: "${u.text}" ${summary}`;
    })
    .join('\n');

  return `## Recent Conversation:
${recentContext}

## New Utterance to Analyze:
Speaker: ${speaker || 'Unknown'}
Text: "${utterance}"

## Your Task:
Analyze this utterance in the context of the conversation. Consider:
1. What is the speaker trying to communicate? (semantic meaning)
2. What is their intent? (inform, propose, challenge, build on, etc.)
3. Which domains does this meaningfully relate to? (with reasoning)
4. What themes emerge from this? (with confidence and reasoning)
5. How does this connect to prior utterances? (builds on, contradicts, elaborates, etc.)
6. What business actors/roles are mentioned or implied? (customer, agent, executive, supplier, etc.)
   - How do they interact with each other?
   - What is the sentiment of each interaction?
7. What are you uncertain about in your analysis?
8. Classify this utterance with a single primaryType from: VISIONARY, OPPORTUNITY, CONSTRAINT, RISK, ENABLER, ACTION, QUESTION, INSIGHT. Follow the classification rules strictly.

Be specific, be honest about uncertainty, and always provide reasoning.`;
}

/**
 * The core agent function - autonomously analyzes an utterance
 */
export async function analyzeUtteranceAgentically(params: {
  utterance: string;
  speaker: string | null;
  utteranceId: string;
  context: AgenticContext;
}): Promise<AgenticAnalysis> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured - cannot run agentic analysis');
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const systemPrompt = buildAgentSystemPrompt(params.context);
  const userPrompt = buildUtteranceAnalysisPrompt(
    params.utterance,
    params.speaker,
    params.context
  );

  try {
    const completion = await openAiBreaker.execute(() => openai.chat.completions.create({
      model: 'gpt-4o-mini', // Can upgrade to gpt-4o for better reasoning
      temperature: 0.3, // Lower for more consistent analysis
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }));

    const raw = completion.choices?.[0]?.message?.content || '{}';
    console.log('[Agentic Agent] OpenAI raw response length:', raw.length, 'first 500 chars:', raw.substring(0, 500));

    const analysis = JSON.parse(raw) as Partial<AgenticAnalysis>;

    console.log('[Agentic Agent] Parsed analysis keys:', Object.keys(analysis), 'has interpretation:', !!analysis.interpretation);

    // Validate and provide defaults
    return {
      primaryType: safePrimaryType(analysis.primaryType),
      interpretation: {
        semanticMeaning: analysis.interpretation?.semanticMeaning || 'Unable to interpret',
        speakerIntent: analysis.interpretation?.speakerIntent || 'Unknown',
        temporalFocus: analysis.interpretation?.temporalFocus || 'present',
        sentimentTone: analysis.interpretation?.sentimentTone || 'neutral',
      },
      domains: Array.isArray(analysis.domains) ? analysis.domains : [],
      themes: Array.isArray(analysis.themes) ? analysis.themes : [],
      connections: Array.isArray(analysis.connections) ? analysis.connections : [],
      actors: Array.isArray(analysis.actors) ? analysis.actors : [],
      overallConfidence: typeof analysis.overallConfidence === 'number'
        ? Math.max(0, Math.min(1, analysis.overallConfidence))
        : 0.5,
      uncertainties: Array.isArray(analysis.uncertainties) ? analysis.uncertainties : [],
    };
  } catch (error) {
    console.error('[Agentic Agent] Analysis failed:', error instanceof Error ? error.message : error);
    console.error('[Agentic Agent] Full error:', error);
    throw error;
  }
}

/**
 * Multi-turn agent conversation for complex synthesis
 * The agent can ask itself questions and refine understanding
 */
export async function synthesizeThemesAgentically(params: {
  utterances: Array<{
    id: string;
    text: string;
    speaker: string | null;
    analysis: AgenticAnalysis;
  }>;
  workshopGoal: string;
  currentPhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';
}): Promise<{
  synthesizedThemes: Array<{
    domain: 'People' | 'Operations' | 'Customer' | 'Technology' | 'Regulation';
    aspirations: Array<{ label: string; evidence: string[]; confidence: number }>;
    constraints: Array<{ label: string; evidence: string[]; confidence: number }>;
    enablers: Array<{ label: string; evidence: string[]; confidence: number }>;
    opportunities: Array<{ label: string; evidence: string[]; confidence: number }>;
  }>;
  crossDomainInsights: Array<{
    insight: string;
    involvedDomains: string[];
    evidence: string[];
  }>;
  agentReasoning: string;
}> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const systemPrompt = `You are synthesizing themes from a workshop conversation.

You have access to ${params.utterances.length} utterances, each with your prior individual analysis.

Your task is to:
1. Identify coherent themes that emerged across multiple utterances
2. Organize themes by domain (People, Operations, Customer, Technology, Regulation)
3. Categorize as: aspirations, constraints, enablers, or opportunities
4. Find cross-domain insights (patterns that span multiple domains)
5. Provide evidence (actual quotes) for each theme
6. Assess confidence in each theme

Be critical - only surface themes with real evidence. Avoid inventing themes that aren't clearly present.`;

  const userPrompt = `## Workshop Context:
Goal: ${params.workshopGoal}
Phase: ${params.currentPhase}
Utterances analyzed: ${params.utterances.length}

## Utterances with Your Prior Analysis:
${params.utterances.map((u, i) => `
${i + 1}. ${u.speaker || 'Unknown'}: "${u.text}"
   Your analysis: ${u.analysis.interpretation.semanticMeaning}
   Themes you detected: ${u.analysis.themes.map(t => `${t.label} (${t.category})`).join(', ')}
`).join('\n')}

## Your Synthesis Task:
Look across ALL utterances. What coherent themes emerged? How do they relate?
Organize by domain and category. Be specific about evidence.

Return JSON with:
- synthesizedThemes: array of domains with categorized themes
- crossDomainInsights: patterns spanning multiple domains
- agentReasoning: explain your synthesis process`;

  try {
    const completion = await openAiBreaker.execute(() => openai.chat.completions.create({
      model: 'gpt-4o', // Use stronger model for synthesis
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }));

    const raw = completion.choices?.[0]?.message?.content || '{}';
    return JSON.parse(raw) as any;
  } catch (error) {
    console.error('Agentic synthesis failed:', error);
    throw error;
  }
}

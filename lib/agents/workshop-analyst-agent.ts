import OpenAI from 'openai';
import { env } from '@/lib/env';

/**
 * True Agentic Workshop Analyst
 *
 * This agent autonomously analyzes workshop transcripts in real-time,
 * building understanding of themes, domains, and relationships without
 * relying on hardcoded keyword patterns.
 */

export type AgenticAnalysis = {
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

**Domains** (assign based on what's ACTUALLY discussed, not keywords):
- People: Human capability, culture, skills, team dynamics, organizational behavior
- Operations: Processes, workflows, decision-making, governance, coordination
- Customer: Experience, needs, journeys, value delivery, service quality
- Technology: Systems, data, platforms, automation, integration, tools
- Regulation: Compliance, risk management, controls, legal requirements, standards

**Theme Categories**:
- Aspiration: Desired future state, vision, goals, outcomes sought
- Constraint: Blockers, limits, risks, dependencies, challenges
- Enabler: What makes things possible, capabilities needed, foundational elements
- Opportunity: Potential improvements, chances to create value, untapped possibilities
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
6. What are you uncertain about in your analysis?

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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Can upgrade to gpt-4o for better reasoning
      temperature: 0.3, // Lower for more consistent analysis
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const analysis = JSON.parse(raw) as Partial<AgenticAnalysis>;

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
      overallConfidence: typeof analysis.overallConfidence === 'number'
        ? Math.max(0, Math.min(1, analysis.overallConfidence))
        : 0.5,
      uncertainties: Array.isArray(analysis.uncertainties) ? analysis.uncertainties : [],
    };
  } catch (error) {
    console.error('Agentic analysis failed:', error);
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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Use stronger model for synthesis
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    return JSON.parse(raw) as any;
  } catch (error) {
    console.error('Agentic synthesis failed:', error);
    throw error;
  }
}

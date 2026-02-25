/**
 * DREAM Research Agent
 *
 * A GPT-4o-mini tool-calling agent that researches the client company
 * using public knowledge. Runs during workshop prep, NOT during the live session.
 *
 * Agentic loop pattern: builds system prompt → enters tool-calling loop →
 * autonomously decides what to research → commits findings.
 *
 * When a real web search API (Tavily/Serper) is configured, the
 * search tools will hit external APIs. For now, they use GPT-4o-mini's
 * parametric knowledge to produce research.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { WorkshopPrepResearch, PrepContext, AgentConversationCallback, AgentReview } from './agent-types';
import type { GuidanceState } from '../guidance-state';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 6;        // More iterations than live — research is thorough
const LOOP_TIMEOUT_MS = 30_000;  // 30s — research takes longer
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const RESEARCH_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_company_info',
      description:
        'Search for public information about the company. Returns structured company data based on publicly available knowledge. Use different queries to explore different aspects: overview, financials, strategy, digital transformation, etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'What to search for — e.g. "Tesco company overview", "Tesco digital strategy", "Tesco recent challenges"',
          },
          focus: {
            type: 'string',
            enum: ['overview', 'strategy', 'challenges', 'digital', 'competitors', 'news'],
            description: 'The aspect to focus on',
          },
        },
        required: ['query', 'focus'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_industry_trends',
      description:
        'Search for industry trends and challenges relevant to the client. Returns analysis of industry dynamics, common pain points, and strategic shifts.',
      parameters: {
        type: 'object',
        properties: {
          industry: {
            type: 'string',
            description: 'The industry to research — e.g. "UK Retail", "Financial Services"',
          },
          focus: {
            type: 'string',
            description:
              'Specific area to explore — e.g. "digital transformation challenges", "regulatory pressures", "workforce trends"',
          },
        },
        required: ['industry'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_domain_challenges',
      description:
        'Search for specific challenges and best practices in a business domain. Only use when DREAM track is Domain.',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The business domain — e.g. "Customer Operations", "Supply Chain"',
          },
          industry: {
            type: 'string',
            description: 'Industry context for the domain research',
          },
          question: {
            type: 'string',
            description: 'Specific question about the domain — e.g. "common CRM challenges in retail"',
          },
        },
        required: ['domain', 'industry'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_research',
      description:
        'Commit your research findings. Call this when you have gathered enough information. This ends your research loop.',
      parameters: {
        type: 'object',
        properties: {
          companyOverview: {
            type: 'string',
            description:
              'Comprehensive overview: what the company does, size, market position, key products/services, recent performance.',
          },
          industryContext: {
            type: 'string',
            description:
              'Industry landscape: trends, challenges, outlook, transformation drivers relevant to this company.',
          },
          keyPublicChallenges: {
            type: 'array',
            items: { type: 'string' },
            description: 'Known challenges facing the company from public information.',
          },
          recentDevelopments: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recent news, initiatives, strategic changes.',
          },
          competitorLandscape: {
            type: 'string',
            description: 'Key competitors and how the company positions against them.',
          },
          domainInsights: {
            type: 'string',
            description:
              'Domain-specific insights if DREAM track is Domain. Null if Enterprise track.',
          },
          sourceUrls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URLs or references used (public knowledge sources).',
          },
        },
        required: [
          'companyOverview',
          'industryContext',
          'keyPublicChallenges',
          'recentDevelopments',
          'competitorLandscape',
          'sourceUrls',
        ],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

/**
 * Execute a research tool. Currently uses GPT-4o-mini's parametric knowledge.
 * When a web search API is configured, search_company_info and search_industry_trends
 * will be upgraded to call external APIs (Tavily/Serper).
 */
async function executeResearchTool(
  openai: OpenAI,
  toolName: string,
  args: Record<string, unknown>,
  context: PrepContext,
): Promise<{ result: string; summary: string }> {
  switch (toolName) {
    case 'search_company_info': {
      const query = String(args.query || '');
      const focus = String(args.focus || 'overview');

      // Use a focused GPT-4o-mini call to generate research from parametric knowledge
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content: `You are a business research analyst. Provide factual, publicly available information about companies. If you're not confident about specific facts, say "based on publicly available information" or "this may need verification". Be specific with numbers, dates, and facts where you can. Do NOT invent or fabricate data.`,
          },
          {
            role: 'user',
            content: `Research query about ${context.clientName || 'the company'} (${context.industry || 'unknown industry'}${context.companyWebsite ? `, website: ${context.companyWebsite}` : ''}):\n\nQuery: ${query}\nFocus: ${focus}\n\nProvide a concise, factual response. If this is a well-known company, provide specific details. If not well-known, provide general industry context and note what would need further investigation.`,
          },
        ],
      });

      const content = res.choices[0]?.message?.content || 'No information found.';
      return {
        result: JSON.stringify({ query, focus, findings: content }),
        summary: `**Researched: ${focus}**\n${content}`,
      };
    }

    case 'search_industry_trends': {
      const industry = String(args.industry || context.industry || 'general');
      const focus = String(args.focus || 'key trends');

      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content: `You are an industry analyst. Provide factual analysis of industry trends, challenges, and dynamics. Focus on recent developments and forward-looking challenges. Be specific where possible.`,
          },
          {
            role: 'user',
            content: `Industry analysis for: ${industry}\nFocus area: ${focus}\n\nProvide a concise analysis of current trends, challenges, and outlook.`,
          },
        ],
      });

      const content = res.choices[0]?.message?.content || 'No trends data available.';
      return {
        result: JSON.stringify({ industry, focus, analysis: content }),
        summary: `**Industry Trends: ${industry}**\n${content}`,
      };
    }

    case 'search_domain_challenges': {
      const domain = String(args.domain || context.targetDomain || '');
      const industry = String(args.industry || context.industry || '');
      const question = String(args.question || `challenges in ${domain}`);

      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content: `You are a business operations consultant specialising in specific business domains. Provide practical insights about domain-specific challenges and best practices within industry contexts.`,
          },
          {
            role: 'user',
            content: `Domain: ${domain}\nIndustry: ${industry}\nQuestion: ${question}\n\nProvide specific challenges, common pain points, and strategic considerations for this domain within this industry.`,
          },
        ],
      });

      const content = res.choices[0]?.message?.content || 'No domain insights available.';
      return {
        result: JSON.stringify({ domain, industry, insights: content }),
        summary: `**Domain Deep-Dive: ${domain} in ${industry}**\n${content}`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildResearchSystemPrompt(context: PrepContext): string {
  const trackDesc =
    context.dreamTrack === 'DOMAIN'
      ? `The DREAM track is Domain, focused on ${context.targetDomain || 'a specific area'}. Research both the company broadly AND this specific domain in depth.`
      : 'The DREAM track is Enterprise — full end-to-end assessment. Research the company holistically across all business functions.';

  return `You are the DREAM Research Agent. Your job is to build a comprehensive understanding of a client company before their workshop begins.

Client: ${context.clientName || 'Unknown'}
Industry: ${context.industry || 'Unknown'}
Website: ${context.companyWebsite || 'Not provided'}
${trackDesc}

Research the company thoroughly:
1. What does this company do? Size, market position, recent performance.
2. What are the major challenges facing this industry right now?
3. What is this company's public reputation — recent news, initiatives?
4. ${context.dreamTrack === 'DOMAIN' ? `What specific challenges exist in ${context.targetDomain || 'the target domain'} for companies in ${context.industry || 'this industry'}?` : 'What are the cross-functional challenges facing the business?'}
5. Who are the key competitors and how do they compare?

IMPORTANT INSTRUCTIONS:
- Be factual. Only report what you can verify from public knowledge.
- Do NOT invent or speculate — if you can't find something, say so.
- Use multiple search queries to build a complete picture.
- Call commit_research when you have a comprehensive understanding.

When communicating your findings, speak naturally as a colleague would.
Be professional but warm. Explain your reasoning clearly, cite your evidence,
and thank others for their contributions.`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runResearchAgent(
  context: PrepContext,
  onConversation?: AgentConversationCallback,
): Promise<WorkshopPrepResearch> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured — cannot run Research Agent');
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildResearchSystemPrompt(context);
  const startMs = Date.now();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Please begin your research on ${context.clientName || 'the company'}. Start by understanding the company overview, then explore the industry landscape, and finally investigate ${context.dreamTrack === 'DOMAIN' ? `the ${context.targetDomain || 'target domain'} specifically` : 'the competitive landscape'}.`,
    },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) {
        console.log(`[Research Agent] Timeout after ${iteration} iterations`);
        break;
      }

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'commit_research' } }
        : 'auto';

      console.log(`[Research Agent] Iteration ${iteration}${isLastIteration ? ' (forced commit)' : ''}`);

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: RESEARCH_TOOLS,
        tool_choice: toolChoice,
      });

      const choice = completion.choices[0];
      const assistantMessage = choice.message;
      messages.push(assistantMessage);

      // Emit thinking text as conversation entry
      if (assistantMessage.content) {
        const thinking = assistantMessage.content.trim();
        if (thinking.length > 20) {
          onConversation?.({
            timestampMs: Date.now(),
            agent: 'research-agent',
            to: 'prep-orchestrator',
            message: thinking,
            type: 'info',
          });
        }
      }

      // No tool calls — model is done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        console.log(`[Research Agent] No tool calls on iteration ${iteration}`);
        break;
      }

      // Process tool calls
      let commitArgs: Record<string, unknown> | null = null;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;

        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        if (fnName === 'commit_research') {
          commitArgs = fnArgs;

          // Build full research summary — no truncation
          const challenges = Array.isArray(fnArgs.keyPublicChallenges)
            ? (fnArgs.keyPublicChallenges as string[]).map((c) => `  • ${c}`).join('\n')
            : '  (none identified)';
          const developments = Array.isArray(fnArgs.recentDevelopments)
            ? (fnArgs.recentDevelopments as string[]).map((d) => `  • ${d}`).join('\n')
            : '  (none identified)';

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'research-agent',
            to: 'prep-orchestrator',
            message: `I've completed my research on ${context.clientName || 'the company'}. Here are my full findings:\n\n**Company Overview**\n${String(fnArgs.companyOverview || 'No overview available')}\n\n**Industry Context**\n${String(fnArgs.industryContext || 'No industry context available')}\n\n**Key Public Challenges**\n${challenges}\n\n**Recent Developments**\n${developments}\n\n**Competitive Landscape**\n${String(fnArgs.competitorLandscape || 'Not available')}${fnArgs.domainInsights ? `\n\n**Domain Insights (${context.targetDomain || 'Target Domain'})**\n${String(fnArgs.domainInsights)}` : ''}`,
            type: 'proposal',
            metadata: {
              toolsUsed: ['search_company_info', 'search_industry_trends', 'search_domain_challenges'],
            },
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed' }),
          });
        } else {
          // Execute research tool
          const toolResult = await executeResearchTool(openai, fnName, fnArgs, context);

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'research-agent',
            to: 'prep-orchestrator',
            message: toolResult.summary,
            type: 'request',
            metadata: { toolsUsed: [fnName] },
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult.result,
          });

          console.log(`[Research Agent] Tool ${fnName}: ${toolResult.summary.substring(0, 100)}`);
        }
      }

      // If committed, build output
      if (commitArgs) {
        const elapsed = Date.now() - startMs;
        console.log(`[Research Agent] Committed after ${iteration + 1} iterations, ${elapsed}ms`);
        return normaliseResearchOutput(commitArgs);
      }
    }

    // If loop ended without commit, force one
    console.log('[Research Agent] Loop ended without commit — forcing');
    return await forceResearchCommit(openai, messages, context);
  } catch (error) {
    console.error('[Research Agent] Failed:', error instanceof Error ? error.message : error);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'research-agent',
      to: 'prep-orchestrator',
      message: `I encountered an error during research: ${error instanceof Error ? error.message : 'Unknown error'}. I'll provide what I could gather.`,
      type: 'info',
    });

    return fallbackResearch(context);
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function normaliseResearchOutput(args: Record<string, unknown>): WorkshopPrepResearch {
  return {
    companyOverview: String(args.companyOverview || 'No overview available'),
    industryContext: String(args.industryContext || 'No industry context available'),
    keyPublicChallenges: Array.isArray(args.keyPublicChallenges)
      ? args.keyPublicChallenges.map(String)
      : [],
    recentDevelopments: Array.isArray(args.recentDevelopments)
      ? args.recentDevelopments.map(String)
      : [],
    competitorLandscape: String(args.competitorLandscape || 'No competitor data available'),
    domainInsights: args.domainInsights ? String(args.domainInsights) : null,
    researchedAtMs: Date.now(),
    sourceUrls: Array.isArray(args.sourceUrls) ? args.sourceUrls.map(String) : [],
  };
}

async function forceResearchCommit(
  openai: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  context: PrepContext,
): Promise<WorkshopPrepResearch> {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages,
      tools: RESEARCH_TOOLS,
      tool_choice: { type: 'function', function: { name: 'commit_research' } },
    });

    const toolCalls = completion.choices[0]?.message?.tool_calls;
    const fnCall = toolCalls?.find((tc) => tc.type === 'function');
    if (fnCall && fnCall.type === 'function') {
      const args = JSON.parse(fnCall.function.arguments);
      return normaliseResearchOutput(args);
    }
  } catch (error) {
    console.error('[Research Agent] Force commit failed:', error instanceof Error ? error.message : error);
  }

  return fallbackResearch(context);
}

function fallbackResearch(context: PrepContext): WorkshopPrepResearch {
  return {
    companyOverview: `Research on ${context.clientName || 'the company'} could not be completed. Please provide company context manually.`,
    industryContext: context.industry
      ? `The ${context.industry} industry is undergoing significant transformation. Manual research recommended.`
      : 'Industry context not available. Please provide manually.',
    keyPublicChallenges: ['Research incomplete — please review and supplement with manual research'],
    recentDevelopments: [],
    competitorLandscape: 'Competitor analysis not available. Please provide manually.',
    domainInsights: context.dreamTrack === 'DOMAIN' && context.targetDomain
      ? `Domain-specific insights for ${context.targetDomain} need manual research.`
      : null,
    researchedAtMs: Date.now(),
    sourceUrls: [],
  };
}

// ══════════════════════════════════════════════════════════════
// LIVE REVIEW MODE — Research Agent reviews proposals
// Has tools to query its own research findings and reason about
// whether proposals are grounded in company/industry knowledge.
// ══════════════════════════════════════════════════════════════

const LIVE_REVIEW_TIMEOUT_MS = 8_000;
const LIVE_REVIEW_ITERATIONS = 3;

const RESEARCH_REVIEW_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_research_findings',
      description: 'Retrieve your earlier research findings about this company and industry. Use this to check whether proposals reference real dynamics.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_industry_relevance',
      description: 'Query your industry knowledge to assess whether a specific claim or direction is grounded in reality for this company.',
      parameters: {
        type: 'object',
        properties: {
          claim: { type: 'string', description: 'The specific claim or direction to check.' },
        },
        required: ['claim'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_review',
      description: 'Submit your review of the proposals. This is your commit tool.',
      parameters: {
        type: 'object',
        properties: {
          stance: {
            type: 'string',
            enum: ['agree', 'challenge', 'build'],
            description: 'agree = proposals are grounded in company/industry reality, challenge = proposals are generic or miss key dynamics, build = agree but could be more specific',
          },
          feedback: {
            type: 'string',
            description: 'Your specific assessment from the research perspective. Reference what you know about the company and industry.',
          },
          suggestedChanges: {
            type: 'string',
            description: 'If challenging or building, how could these be more specific to this client?',
          },
        },
        required: ['stance', 'feedback'],
      },
    },
  },
];

function executeResearchReviewTool(
  toolName: string,
  args: Record<string, unknown>,
  guidanceState: GuidanceState,
): string {
  const prep = guidanceState.prepContext;
  const research = prep?.research;

  switch (toolName) {
    case 'get_research_findings': {
      if (!research) {
        return JSON.stringify({ available: false, message: 'No research data available — flag this gap.' });
      }
      return JSON.stringify({
        available: true,
        companyOverview: research.companyOverview,
        industryContext: research.industryContext,
        keyPublicChallenges: research.keyPublicChallenges,
        recentDevelopments: research.recentDevelopments,
        competitorLandscape: research.competitorLandscape,
        domainInsights: research.domainInsights,
      });
    }

    case 'check_industry_relevance': {
      const claim = String(args.claim || '');
      if (!research) {
        return JSON.stringify({ relevant: 'unknown', reason: 'No research data to check against.' });
      }
      // Check if the claim relates to known challenges or industry dynamics
      const allText = [
        research.companyOverview,
        research.industryContext,
        ...research.keyPublicChallenges,
        research.competitorLandscape,
        research.domainInsights || '',
      ].join(' ').toLowerCase();

      const claimWords = claim.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      const matchCount = claimWords.filter((w) => allText.includes(w)).length;
      const relevance = matchCount > 3 ? 'high' : matchCount > 1 ? 'moderate' : 'low';

      return JSON.stringify({
        claim,
        relevance,
        matchingKeywords: matchCount,
        note: relevance === 'low'
          ? 'This claim doesn\'t strongly connect to known company/industry dynamics. Could be generic.'
          : 'This appears grounded in what we know about the company.',
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

export async function reviewWithResearchAgent(
  proposals: string,
  guidanceState: GuidanceState,
  onConversation?: AgentConversationCallback,
): Promise<AgentReview> {
  if (!env.OPENAI_API_KEY) {
    return { agent: 'Research Agent', stance: 'agree', feedback: 'Research Agent unavailable.' };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const prep = guidanceState.prepContext;
  const startMs = Date.now();

  const systemPrompt = `You are the DREAM Research Agent reviewing proposals from a colleague. Your domain is company and industry knowledge.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : ''}

You researched this company before the workshop. You know their challenges, their industry, their competitive landscape. Now you're reviewing whether the Facilitation Agent's proposals are grounded in that reality or whether they're generic questions that could apply to any company.

REVIEW MODE: Use get_research_findings to recall what you know, then use check_industry_relevance to verify specific claims. Are the proposals specific to THIS client? Do they reference real dynamics? Could they be sharper?

Submit your review with submit_review when you've assessed the proposals.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Review these proposals from the Facilitation Agent:\n\n${proposals}\n\nAre these grounded in what you know about the company and industry? Use your tools to check.` },
  ];

  try {
    for (let iteration = 0; iteration < LIVE_REVIEW_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LIVE_REVIEW_TIMEOUT_MS) break;

      const isLastIteration = iteration === LIVE_REVIEW_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'submit_review' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: RESEARCH_REVIEW_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'research-agent',
          to: 'orchestrator',
          message: `[REVIEWING] ${assistantMessage.content.trim()}`,
          type: 'info',
        });
      }

      if (!assistantMessage.tool_calls?.length) break;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }

        if (fnName === 'submit_review') {
          const review: AgentReview = {
            agent: 'Research Agent',
            stance: (['agree', 'challenge', 'build'].includes(String(fnArgs.stance))
              ? String(fnArgs.stance) : 'agree') as AgentReview['stance'],
            feedback: String(fnArgs.feedback || 'No feedback provided.'),
            suggestedChanges: fnArgs.suggestedChanges ? String(fnArgs.suggestedChanges) : undefined,
          };

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'research-agent',
            to: 'facilitation-agent',
            message: `[${review.stance.toUpperCase()}] ${review.feedback}${review.suggestedChanges ? `\nSuggestion: ${review.suggestedChanges}` : ''}`,
            type: review.stance === 'challenge' ? 'challenge' : 'proposal',
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"submitted"}' });
          return review;
        } else {
          const result = executeResearchReviewTool(fnName, fnArgs, guidanceState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        }
      }
    }
  } catch (error) {
    console.error('[Research Agent Review] Failed:', error instanceof Error ? error.message : error);
  }

  return { agent: 'Research Agent', stance: 'agree', feedback: 'Review timed out — no objections raised.' };
}

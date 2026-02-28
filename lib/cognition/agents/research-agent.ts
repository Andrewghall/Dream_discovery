/**
 * DREAM Research Agent
 *
 * A GPT-4o-mini tool-calling agent that researches the client company
 * using real web search. Runs during workshop prep, NOT during the live session.
 *
 * Agentic loop pattern: builds system prompt → enters tool-calling loop →
 * autonomously decides what to research → commits findings.
 *
 * When TAVILY_API_KEY is configured, search tools hit the Tavily Search API
 * for real, current web results. Without it, falls back to GPT-4o-mini's
 * parametric knowledge (clearly labelled as such).
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { WorkshopPrepResearch, PrepContext, AgentConversationCallback, AgentReview } from './agent-types';
import type { GuidanceState } from '../guidance-state';
import { buildJourneyContextString } from '../journey-completion-state';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 8;        // More iterations — journey + dimension research needs extra calls
const LOOP_TIMEOUT_MS = 45_000;  // 45s — journey + dimension research takes longer
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
        'Search the web for public information about the company. Returns real web results with source URLs. Use different queries to explore different aspects: overview, financials, strategy, digital transformation, etc.',
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
        'Search the web for industry trends and challenges relevant to the client. Returns real web results about industry dynamics, common pain points, and strategic shifts.',
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
        'Search the web for specific challenges and best practices in a business domain. Returns real web results. Only use when DREAM track is Domain.',
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
      name: 'search_customer_journey',
      description:
        'Research the typical customer/user journey for this industry and client. Find the standard lifecycle stages, key touchpoints, and common pain points at each stage.',
      parameters: {
        type: 'object',
        properties: {
          industry: {
            type: 'string',
            description: 'The industry context — e.g. "legal education admissions", "UK retail grocery"',
          },
          clientType: {
            type: 'string',
            description: 'Type of client/customer — e.g. "law school applicant", "retail shopper", "insurance policyholder"',
          },
          focus: {
            type: 'string',
            description: 'Specific journey aspect — e.g. "end-to-end lifecycle", "onboarding experience", "renewal journey"',
          },
        },
        required: ['industry'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_industry_dimensions',
      description:
        'Research the key strategic dimensions/lenses that matter most for this industry. These replace generic categories (People/Tech/etc.) with industry-specific axes that the workshop should explore.',
      parameters: {
        type: 'object',
        properties: {
          industry: {
            type: 'string',
            description: 'The industry to research — e.g. "legal education", "retail banking"',
          },
          focus: {
            type: 'string',
            description: 'Specific dimension area — e.g. "digital maturity", "regulatory landscape", "student experience"',
          },
        },
        required: ['industry'],
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
          journeyStages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Stage name — e.g. "Account & Identity", "LSAT Registration"' },
                description: { type: 'string', description: 'What happens at this stage' },
                typicalTouchpoints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Key interaction points at this stage',
                },
              },
              required: ['name', 'description'],
            },
            description:
              'Typical customer/user journey stages for this industry, in chronological order. 6-12 stages covering the full lifecycle from first awareness through ongoing relationship.',
          },
          industryDimensions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Dimension name — e.g. "Student Experience", "Regulatory Compliance", "Supply Chain Resilience"',
                },
                description: {
                  type: 'string',
                  description: 'What this dimension covers in this industry',
                },
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '10-20 keywords for automatic classification of workshop utterances into this dimension',
                },
                color: {
                  type: 'string',
                  description: 'Hex color for UI rendering — e.g. "#60a5fa" (blue), "#34d399" (green), "#a78bfa" (purple), "#fb923c" (orange), "#2dd4bf" (teal)',
                },
              },
              required: ['name', 'description', 'keywords', 'color'],
            },
            description:
              '4-6 industry-specific strategic dimensions. These replace generic categories with dimensions that matter for THIS industry. Each should have a distinct, accessible hex color.',
          },
        },
        required: [
          'companyOverview',
          'industryContext',
          'keyPublicChallenges',
          'recentDevelopments',
          'competitorLandscape',
          'sourceUrls',
          'journeyStages',
          'industryDimensions',
        ],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TAVILY WEB SEARCH
// ══════════════════════════════════════════════════════════════

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

type TavilyResponse = {
  answer?: string;
  results: TavilyResult[];
  query: string;
};

/**
 * Call Tavily Search API for real web results.
 * Returns structured results with titles, URLs, and content snippets.
 */
async function tavilySearch(
  query: string,
  options: { searchDepth?: 'basic' | 'advanced'; maxResults?: number; includeAnswer?: boolean } = {},
): Promise<TavilyResponse> {
  const apiKey = env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: options.searchDepth || 'advanced',
      include_answer: options.includeAnswer ?? true,
      max_results: options.maxResults || 5,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Tavily API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<TavilyResponse>;
}

const useTavily = () => Boolean(env.TAVILY_API_KEY);

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

/**
 * Execute a research tool.
 * - With TAVILY_API_KEY: real web search via Tavily API
 * - Without: falls back to GPT-4o-mini parametric knowledge (labelled)
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

      if (useTavily()) {
        // ── REAL WEB SEARCH ──
        try {
          const searchQuery = `${query} ${context.clientName || ''} ${context.industry || ''}`.trim();
          const tavily = await tavilySearch(searchQuery, { searchDepth: 'advanced', maxResults: 5 });

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 300)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';
          const urls = tavily.results.map((r) => r.url);

          return {
            result: JSON.stringify({
              query, focus, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 500) })),
            }),
            summary: `**🔍 Web Search: ${focus}** (${tavily.results.length} results)\n${answer}\n\nSources:\n${sources}\n\nURLs: ${urls.join(', ')}`,
          };
        } catch (err) {
          console.error('[Research Agent] Tavily search failed, falling back:', err instanceof Error ? err.message : err);
          // Fall through to parametric
        }
      }

      // ── PARAMETRIC FALLBACK ──
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content: `You are a business research analyst. Provide factual, publicly available information about companies. If you're not confident about specific facts, say "based on publicly available information" or "this may need verification". Be specific with numbers, dates, and facts where you can. Do NOT invent or fabricate data. NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Research query about ${context.clientName || 'the company'} (${context.industry || 'unknown industry'}${context.companyWebsite ? `, website: ${context.companyWebsite}` : ''}):\n\nQuery: ${query}\nFocus: ${focus}\n\nProvide a concise, factual response. If this is a well-known company, provide specific details. If not well-known, provide general industry context and note what would need further investigation.`,
          },
        ],
      });

      const content = res.choices[0]?.message?.content || 'No information found.';
      return {
        result: JSON.stringify({ query, focus, source: 'parametric_knowledge', findings: content }),
        summary: `**Researched: ${focus}** ⚠️ (parametric knowledge — no web search API configured)\n${content}`,
      };
    }

    case 'search_industry_trends': {
      const industry = String(args.industry || context.industry || 'general');
      const focus = String(args.focus || 'key trends');

      if (useTavily()) {
        // ── REAL WEB SEARCH ──
        try {
          const searchQuery = `${industry} industry trends ${focus} ${new Date().getFullYear()}`;
          const tavily = await tavilySearch(searchQuery, { searchDepth: 'advanced', maxResults: 5 });

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 300)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';

          return {
            result: JSON.stringify({
              industry, focus, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 500) })),
            }),
            summary: `**🔍 Industry Trends: ${industry}** (${tavily.results.length} web results)\n${answer}\n\nSources:\n${sources}`,
          };
        } catch (err) {
          console.error('[Research Agent] Tavily industry search failed, falling back:', err instanceof Error ? err.message : err);
        }
      }

      // ── PARAMETRIC FALLBACK ──
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content: `You are an industry analyst. Provide factual analysis of industry trends, challenges, and dynamics. Focus on recent developments and forward-looking challenges. Be specific where possible. NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Industry analysis for: ${industry}\nFocus area: ${focus}\n\nProvide a concise analysis of current trends, challenges, and outlook.`,
          },
        ],
      });

      const content = res.choices[0]?.message?.content || 'No trends data available.';
      return {
        result: JSON.stringify({ industry, focus, source: 'parametric_knowledge', analysis: content }),
        summary: `**Industry Trends: ${industry}** ⚠️ (parametric knowledge — no web search API configured)\n${content}`,
      };
    }

    case 'search_domain_challenges': {
      const domain = String(args.domain || context.targetDomain || '');
      const industry = String(args.industry || context.industry || '');
      const question = String(args.question || `challenges in ${domain}`);

      if (useTavily()) {
        // ── REAL WEB SEARCH ──
        try {
          const searchQuery = `${domain} ${industry} ${question} challenges best practices ${new Date().getFullYear()}`;
          const tavily = await tavilySearch(searchQuery, { searchDepth: 'advanced', maxResults: 5 });

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 300)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';

          return {
            result: JSON.stringify({
              domain, industry, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 500) })),
            }),
            summary: `**🔍 Domain Deep-Dive: ${domain} in ${industry}** (${tavily.results.length} web results)\n${answer}\n\nSources:\n${sources}`,
          };
        } catch (err) {
          console.error('[Research Agent] Tavily domain search failed, falling back:', err instanceof Error ? err.message : err);
        }
      }

      // ── PARAMETRIC FALLBACK ──
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content: `You are a business operations consultant specialising in specific business domains. Provide practical insights about domain-specific challenges and best practices within industry contexts. NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Domain: ${domain}\nIndustry: ${industry}\nQuestion: ${question}\n\nProvide specific challenges, common pain points, and strategic considerations for this domain within this industry.`,
          },
        ],
      });

      const content = res.choices[0]?.message?.content || 'No domain insights available.';
      return {
        result: JSON.stringify({ domain, industry, source: 'parametric_knowledge', insights: content }),
        summary: `**Domain Deep-Dive: ${domain} in ${industry}** ⚠️ (parametric knowledge — no web search API configured)\n${content}`,
      };
    }

    case 'search_customer_journey': {
      const industry = String(args.industry || context.industry || 'general');
      const clientType = String(args.clientType || 'customer');
      const focus = String(args.focus || 'end-to-end lifecycle');

      if (useTavily()) {
        try {
          const searchQuery = `${industry} ${clientType} journey stages lifecycle touchpoints ${focus} ${new Date().getFullYear()}`;
          const tavily = await tavilySearch(searchQuery, { searchDepth: 'advanced', maxResults: 5 });

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 300)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';

          return {
            result: JSON.stringify({
              industry, clientType, focus, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 500) })),
            }),
            summary: `**🔍 Customer Journey: ${clientType} in ${industry}** (${tavily.results.length} web results)\n${answer}\n\nSources:\n${sources}`,
          };
        } catch (err) {
          console.error('[Research Agent] Tavily journey search failed, falling back:', err instanceof Error ? err.message : err);
        }
      }

      // ── PARAMETRIC FALLBACK ──
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content: `You are a customer experience analyst specialising in mapping customer journeys. Provide detailed, industry-specific lifecycle stages with key touchpoints at each stage. Be specific to the industry — a law school applicant journey is very different from a retail shopper journey. NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Map the typical ${clientType} journey in ${industry}.\nFocus: ${focus}\n\nProvide the key lifecycle stages in chronological order, with descriptions and touchpoints for each stage. Be industry-specific, not generic.`,
          },
        ],
      });

      const content = res.choices[0]?.message?.content || 'No journey data available.';
      return {
        result: JSON.stringify({ industry, clientType, focus, source: 'parametric_knowledge', analysis: content }),
        summary: `**Customer Journey: ${clientType} in ${industry}** ⚠️ (parametric knowledge — no web search API configured)\n${content}`,
      };
    }

    case 'search_industry_dimensions': {
      const industry = String(args.industry || context.industry || 'general');
      const focus = String(args.focus || 'key strategic dimensions');

      if (useTavily()) {
        try {
          const searchQuery = `${industry} strategic dimensions key success factors transformation pillars ${focus} ${new Date().getFullYear()}`;
          const tavily = await tavilySearch(searchQuery, { searchDepth: 'advanced', maxResults: 5 });

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 300)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';

          return {
            result: JSON.stringify({
              industry, focus, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 500) })),
            }),
            summary: `**🔍 Industry Dimensions: ${industry}** (${tavily.results.length} web results)\n${answer}\n\nSources:\n${sources}`,
          };
        } catch (err) {
          console.error('[Research Agent] Tavily dimensions search failed, falling back:', err instanceof Error ? err.message : err);
        }
      }

      // ── PARAMETRIC FALLBACK ──
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content: `You are a strategic consultant who identifies the key dimensions that matter most for specific industries. Instead of generic categories like "People, Technology, Operations", identify the dimensions that are truly important for the given industry. For example, education might need "Student Experience", "Institutional Trust", "Assessment Integrity". Retail might need "Supply Chain Resilience", "Omnichannel Integration", "Sustainability". NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Identify the 4-6 most important strategic dimensions for the ${industry} industry.\nFocus: ${focus}\n\nFor each dimension, provide:\n- A clear name\n- A description of what it covers\n- 10-20 keywords that would indicate someone is talking about this dimension\n\nBe specific to this industry — generic dimensions like "People" or "Technology" are too broad.`,
          },
        ],
      });

      const content = res.choices[0]?.message?.content || 'No dimension data available.';
      return {
        result: JSON.stringify({ industry, focus, source: 'parametric_knowledge', analysis: content }),
        summary: `**Industry Dimensions: ${industry}** ⚠️ (parametric knowledge — no web search API configured)\n${content}`,
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

  const searchMode = useTavily()
    ? 'You have LIVE WEB SEARCH via Tavily. Your search tools return real, current web results with source URLs. Use multiple queries to build a thorough, evidence-based picture.'
    : '⚠️ No web search API configured. Your search tools use parametric knowledge only. Results should be treated as general knowledge that needs verification.';

  return `You are the DREAM Research Agent. Your job is to build a comprehensive understanding of a client company before their workshop begins.

Client: ${context.clientName || 'Unknown'}
Industry: ${context.industry || 'Unknown'}
Website: ${context.companyWebsite || 'Not provided'}
${trackDesc}

SEARCH CAPABILITY: ${searchMode}

Research the company thoroughly:
1. What does this company do? Size, market position, recent performance.
2. What are the major challenges facing this industry right now?
3. What is this company's public reputation — recent news, initiatives?
4. ${context.dreamTrack === 'DOMAIN' ? `What specific challenges exist in ${context.targetDomain || 'the target domain'} for companies in ${context.industry || 'this industry'}?` : 'What are the cross-functional challenges facing the business?'}
5. Who are the key competitors and how do they compare?
6. What does the typical customer/user journey look like in this industry? What are the standard lifecycle stages from first awareness through ongoing relationship?
7. What are the most important strategic dimensions for this industry? (Instead of generic "People, Technology, Customer, Operations, Regulation" — what dimensions actually matter for ${context.clientName || 'this company'} in ${context.industry || 'this industry'}?)

IMPORTANT INSTRUCTIONS:
- Be factual. Only report what you can verify from search results.
- Do NOT invent or speculate — if you can't find something, say so.
- Use multiple search queries to build a complete picture — at least 3 different searches.
- Include source URLs in your commit_research call for every finding.
- Prefer recent sources (2024-2025). Flag anything that might be outdated.
- For journey stages: Research the actual industry-specific customer lifecycle (not generic). A law school admissions body has very different stages to a retail bank. Include 6-12 stages with descriptions and touchpoints.
- For industry dimensions: Choose 4-6 dimensions that matter MOST for this industry. Examples: "Student Experience", "Institutional Trust", "Assessment Integrity" for education. "Supply Chain Resilience", "Omnichannel Integration", "Sustainability" for retail. Include 10-20 keywords for each dimension to enable automatic classification of workshop utterances.
- Assign each dimension a distinct, accessible hex color for UI rendering (blues, greens, purples, oranges, teals — avoid red which is reserved for alerts).
- Call commit_research when you have a comprehensive understanding including journey stages and industry dimensions.

When communicating your findings, speak naturally as a colleague would.
Be professional but warm. Explain your reasoning clearly, cite your sources,
and note confidence level for each finding.`;
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
      content: `Please begin your research on ${context.clientName || 'the company'}. Start by understanding the company overview, then explore the industry landscape and competitive positioning${context.dreamTrack === 'DOMAIN' ? `, then investigate the ${context.targetDomain || 'target domain'} specifically` : ''}. Also research the typical customer/user journey stages for this industry, and identify the most important strategic dimensions that should frame our workshop analysis (instead of generic categories).`,
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

          const searchLabel = useTavily() ? '🔍 Web-Researched' : '⚠️ Parametric Knowledge';
          const sourceUrls = Array.isArray(fnArgs.sourceUrls) ? (fnArgs.sourceUrls as string[]) : [];
          const sourcesSection = sourceUrls.length > 0
            ? `\n\n**Sources** (${sourceUrls.length})\n${sourceUrls.map((u) => `  • ${u}`).join('\n')}`
            : '';

          // Journey stages summary
          const journeyStages = Array.isArray(fnArgs.journeyStages) ? (fnArgs.journeyStages as Array<{ name: string; description?: string }>) : [];
          const journeySection = journeyStages.length > 0
            ? `\n\n**Customer Journey** (${journeyStages.length} stages)\n${journeyStages.map((s, i) => `  ${i + 1}. ${s.name}${s.description ? ` — ${s.description}` : ''}`).join('\n')}`
            : '';

          // Industry dimensions summary
          const industryDims = Array.isArray(fnArgs.industryDimensions) ? (fnArgs.industryDimensions as Array<{ name: string; description?: string; keywords?: string[] }>) : [];
          const dimensionsSection = industryDims.length > 0
            ? `\n\n**Industry Dimensions** (${industryDims.length} axes — replacing generic categories)\n${industryDims.map((d) => `  • ${d.name}: ${d.description || 'No description'}${d.keywords?.length ? ` (${d.keywords.length} keywords)` : ''}`).join('\n')}`
            : '';

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'research-agent',
            to: 'prep-orchestrator',
            message: `${searchLabel} — I've completed my research on ${context.clientName || 'the company'}. Here are my full findings:\n\n**Company Overview**\n${String(fnArgs.companyOverview || 'No overview available')}\n\n**Industry Context**\n${String(fnArgs.industryContext || 'No industry context available')}\n\n**Key Public Challenges**\n${challenges}\n\n**Recent Developments**\n${developments}\n\n**Competitive Landscape**\n${String(fnArgs.competitorLandscape || 'Not available')}${fnArgs.domainInsights ? `\n\n**Domain Insights (${context.targetDomain || 'Target Domain'})**\n${String(fnArgs.domainInsights)}` : ''}${journeySection}${dimensionsSection}${sourcesSection}`,
            type: 'proposal',
            metadata: {
              toolsUsed: ['search_company_info', 'search_industry_trends', 'search_domain_challenges', 'search_customer_journey', 'search_industry_dimensions'],
              searchMode: useTavily() ? 'tavily_web_search' : 'parametric_fallback',
              sourceCount: sourceUrls.length,
              journeyStageCount: journeyStages.length,
              dimensionCount: industryDims.length,
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
    journeyStages: Array.isArray(args.journeyStages) ? args.journeyStages as WorkshopPrepResearch['journeyStages'] : null,
    industryDimensions: Array.isArray(args.industryDimensions) ? args.industryDimensions as WorkshopPrepResearch['industryDimensions'] : null,
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
    journeyStages: null,
    industryDimensions: null,
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

  const journeyCtx = buildJourneyContextString(guidanceState.journeyCompletionState);

  const systemPrompt = `You are the DREAM Research Agent reviewing proposals from a colleague. Your domain is company and industry knowledge.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : ''}

You researched this company before the workshop. You know their challenges, their industry, their competitive landscape. Now you're reviewing whether the Facilitation Agent's proposals are grounded in that reality or whether they're generic questions that could apply to any company.

${journeyCtx ? `JOURNEY CONTEXT:\n${journeyCtx}\nWhen reviewing proposals, cross-reference journey stages with industry benchmarks you know about. If a proposal targets a journey stage where you have relevant industry data (e.g., "78% of education portals use AI chat at onboarding"), flag it as a "build" with the benchmark.\n` : ''}
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

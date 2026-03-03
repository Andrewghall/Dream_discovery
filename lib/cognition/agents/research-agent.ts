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

const MAX_ITERATIONS = 15;        // More iterations for deep, multi-phase research
const LOOP_TIMEOUT_MS = 150_000;  // 2.5 minutes — gpt-4o is slower but much deeper
const MODEL = 'gpt-4o';           // Better depth, judgment, and longer outputs for prep research
const LIVE_REVIEW_MODEL = 'gpt-4o-mini';  // Keep fast for latency-sensitive live reviews
const MIN_SEARCHES_BEFORE_COMMIT = 6;
const MIN_SEARCHES_DOMAIN_TRACK = 8;

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
        'Commit your research findings. Call this ONLY after you have conducted thorough multi-phase research (minimum 6 searches). Each field must contain substantive, multi-paragraph content — not brief summaries. This ends your research loop.',
      parameters: {
        type: 'object',
        properties: {
          companyOverview: {
            type: 'string',
            description:
              '3-4 detailed paragraphs covering: company history and founding, what they do today in detail, market position and size (revenue, employees, customers if available), key products/services and business lines, recent strategic direction and major initiatives, leadership and organisational structure. A facilitator should be able to read this and deeply understand the company.',
          },
          industryContext: {
            type: 'string',
            description:
              '2-3 detailed paragraphs covering: macro trends reshaping the industry, disruption forces (technology, regulation, competition, demographics), specific challenges facing organisations like this client, and a forward-looking 2-5 year outlook. Include specific evidence and data points — not generic statements like "the industry is evolving".',
          },
          keyPublicChallenges: {
            type: 'array',
            items: { type: 'string' },
            description: '5-8 specific, detailed challenges. Each item should be a full sentence with context and evidence — not a bullet fragment. Example: "Declining law school enrollment (down 28% from peak in 2010) is putting revenue pressure on member institutions and reducing demand for LSAC services."',
          },
          recentDevelopments: {
            type: 'array',
            items: { type: 'string' },
            description: '4-6 recent developments, each with date/timeframe, description, and strategic implications. Example: "In January 2025, LSAC launched a new digital assessment platform, signalling a shift toward technology-enabled testing."',
          },
          competitorLandscape: {
            type: 'string',
            description: '2-3 detailed paragraphs: name specific competitors, explain how they differ in approach and positioning, what competitive advantages and disadvantages the client has, market share dynamics, and how the competitive landscape is evolving.',
          },
          domainInsights: {
            type: 'string',
            description:
              '3-4 detailed paragraphs covering: current state of the domain in this industry, emerging trends and innovations, common pain points and failure modes, best practices from leading organisations, and transformation opportunities. This is the centrepiece of a Domain track workshop. Set to null for Enterprise track.',
          },
          sourceUrls: {
            type: 'array',
            items: { type: 'string' },
            description: 'All URLs and references used in your research. Include every source that informed your findings.',
          },
          journeyStages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Stage name — e.g. "Account & Identity", "LSAT Registration"' },
                description: { type: 'string', description: 'Detailed description of what happens at this stage (2-3 sentences)' },
                typicalTouchpoints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '3-5 specific interaction points at this stage',
                },
              },
              required: ['name', 'description'],
            },
            description:
              'Industry-specific customer/user journey stages in chronological order. 6-12 stages covering the full lifecycle. Each stage needs a detailed description and 3-5 touchpoints. Be specific to this industry.',
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
                  description: 'Detailed description of what this dimension covers in this industry and why it matters (2-3 sentences)',
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
              '4-6 industry-specific strategic dimensions. These replace generic categories with dimensions that matter for THIS industry. Each should have a distinct, accessible hex color and detailed descriptions.',
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
  raw_content?: string;  // Full page text when include_raw_content=true
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
      max_results: options.maxResults || 7,
      include_raw_content: true,
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

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 800)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';
          const urls = tavily.results.map((r) => r.url);

          return {
            result: JSON.stringify({
              query, focus, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 2000), fullContent: r.raw_content?.slice(0, 3000) || null })),
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
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: `You are a business research analyst. Provide detailed, factual, publicly available information about companies. If you're not confident about specific facts, say "based on publicly available information" or "this may need verification". Be specific with numbers, dates, and facts where you can. Provide thorough, multi-paragraph responses — do NOT be brief. Do NOT invent or fabricate data. NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Research query about ${context.clientName || 'the company'} (${context.industry || 'unknown industry'}${context.companyWebsite ? `, website: ${context.companyWebsite}` : ''}):\n\nQuery: ${query}\nFocus: ${focus}\n\nProvide a detailed, thorough response with specific facts, numbers, and evidence. If this is a well-known company, provide comprehensive details. If not well-known, provide detailed industry context and note what would need further investigation.`,
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

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 800)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';

          return {
            result: JSON.stringify({
              industry, focus, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 2000), fullContent: r.raw_content?.slice(0, 3000) || null })),
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
        max_tokens: 1500,
        messages: [
          {
            role: 'system',
            content: `You are an industry analyst. Provide detailed, thorough analysis of industry trends, challenges, and dynamics. Focus on recent developments and forward-looking challenges. Be specific with data, examples, and evidence. Provide multi-paragraph responses. NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Industry analysis for: ${industry}\nFocus area: ${focus}\n\nProvide a detailed, multi-paragraph analysis of current trends, challenges, disruption forces, and outlook. Include specific examples and evidence.`,
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

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 800)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';

          return {
            result: JSON.stringify({
              domain, industry, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 2000), fullContent: r.raw_content?.slice(0, 3000) || null })),
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
        max_tokens: 1500,
        messages: [
          {
            role: 'system',
            content: `You are a business operations consultant specialising in specific business domains. Provide detailed, thorough insights about domain-specific challenges, best practices, transformation opportunities, and emerging trends within industry contexts. Give multi-paragraph responses with specific examples. NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Domain: ${domain}\nIndustry: ${industry}\nQuestion: ${question}\n\nProvide a detailed, multi-paragraph analysis covering: specific challenges, common pain points, best practices from leading organisations, emerging trends, and strategic considerations for this domain within this industry.`,
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

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 800)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';

          return {
            result: JSON.stringify({
              industry, clientType, focus, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 2000), fullContent: r.raw_content?.slice(0, 3000) || null })),
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
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: `You are a customer experience analyst specialising in mapping customer journeys. Provide detailed, industry-specific lifecycle stages with key touchpoints at each stage. Be specific to the industry — a law school applicant journey is very different from a retail shopper journey. Provide thorough descriptions with 3-5 touchpoints per stage. NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Map the typical ${clientType} journey in ${industry}.\nFocus: ${focus}\n\nProvide 6-12 key lifecycle stages in chronological order. For each stage provide a detailed description and 3-5 specific touchpoints. Be industry-specific, not generic.`,
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

          const sources = tavily.results.map((r) => `• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 800)}`).join('\n\n');
          const answer = tavily.answer || 'No synthesised answer available.';

          return {
            result: JSON.stringify({
              industry, focus, source: 'tavily_web_search',
              answer,
              resultCount: tavily.results.length,
              results: tavily.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 2000), fullContent: r.raw_content?.slice(0, 3000) || null })),
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
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: `You are a strategic consultant who identifies the key dimensions that matter most for specific industries. Instead of generic categories like "People, Technology, Operations", identify the dimensions that are truly important for the given industry. For example, education might need "Student Experience", "Institutional Trust", "Assessment Integrity". Retail might need "Supply Chain Resilience", "Omnichannel Integration", "Sustainability". NOTE: You are working from training knowledge, not live web search.`,
          },
          {
            role: 'user',
            content: `Identify the 4-6 most important strategic dimensions for the ${industry} industry.\nFocus: ${focus}\n\nFor each dimension, provide:\n- A clear name\n- A detailed description of what it covers and why it matters\n- 10-20 keywords that would indicate someone is talking about this dimension\n\nBe specific to this industry — generic dimensions like "People" or "Technology" are too broad.`,
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
  const isDomain = context.dreamTrack === 'DOMAIN';
  const minSearches = isDomain ? MIN_SEARCHES_DOMAIN_TRACK : MIN_SEARCHES_BEFORE_COMMIT;

  const trackDesc = isDomain
    ? `The DREAM track is Domain, focused on "${context.targetDomain || 'a specific area'}". You MUST research both the company broadly AND this specific domain in substantial depth — the domain is the centrepiece of this workshop.`
    : 'The DREAM track is Enterprise — full end-to-end assessment. Research the company holistically across all business functions.';

  const searchMode = useTavily()
    ? 'You have LIVE WEB SEARCH via Tavily. Your search tools return real, current web results with full page content and source URLs. Use many different queries to build a thorough, evidence-based picture. Each search gives you fresh material — use it extensively.'
    : '⚠️ No web search API configured. Your search tools use parametric knowledge only. Results should be treated as general knowledge that needs verification. Even so, provide thorough, detailed multi-paragraph responses.';

  return `You are the DREAM Research Agent. Your job is to build a DEEP, COMPREHENSIVE research briefing on a client company before their full-day strategic workshop.

This research will brief facilitators who spend an ENTIRE DAY guiding strategic discussions with senior stakeholders. Surface-level summaries are NOT sufficient. Your output must be detailed enough that a facilitator who knows nothing about this company or industry could walk in and lead informed, insightful strategic conversations.

A good research briefing has MULTIPLE PARAGRAPHS per section, specific facts, evidence, and real insight — not generic statements. Think "analyst research report", not "Wikipedia introduction".

Client: ${context.clientName || 'Unknown'}
Industry: ${context.industry || 'Unknown'}
Website: ${context.companyWebsite || 'Not provided'}
${trackDesc}
${context.workshopPurpose ? `\nWORKSHOP PURPOSE (WHY WE ARE HERE): ${context.workshopPurpose}` : ''}
${context.desiredOutcomes ? `DESIRED OUTCOMES: ${context.desiredOutcomes}` : ''}
${context.workshopPurpose || context.desiredOutcomes ? '\nYour research MUST be oriented toward this purpose and these outcomes. Every section of your briefing should help the facilitator understand the context relevant to WHY this workshop is happening and WHAT it needs to produce.\n' : ''}
SEARCH CAPABILITY: ${searchMode}

═══ RESEARCH STRATEGY — PHASED APPROACH ═══

Follow this phased research strategy. Do NOT skip phases or rush to commit.

PHASE 1: Company Foundation (3-4 searches)
- Company history, founding story, mission, and what they actually do today
- Market position, size (revenue, employees, customers/members), key products/services
- Recent strategic direction, leadership team, organisational structure
- Current performance, financial health, growth trajectory

PHASE 2: Industry and Competitive Landscape (3-4 searches)
- Macro trends reshaping this industry (technology, regulation, demographics, economics)
- Disruption forces and transformation pressures specific to this sector
- Key competitors: who they are, how they differ, competitive advantages/disadvantages
- Forward-looking industry outlook — what's coming in the next 2-5 years
- Recent news, strategic moves, partnerships, acquisitions

PHASE 3: Deep Domain Research (${isDomain ? '3-4 searches — THIS IS THE MOST IMPORTANT PHASE for Domain track' : '1-2 searches'})
${isDomain
    ? `- Current state of "${context.targetDomain}" in ${context.industry || 'this industry'} — how is it typically structured?
- Best practices and what leading organisations are doing differently
- Common failure modes, pain points, and transformation challenges
- Emerging trends, technology enablers, and innovation opportunities
- Regulatory and compliance considerations specific to this domain
- How ${context.clientName || 'the company'} specifically approaches this domain vs industry norms`
    : `- Cross-functional challenges facing the business
- Digital transformation status, strategic initiatives, and major programmes`}

PHASE 4: Journey and Dimensions Research (2-3 searches)
- Customer/user lifecycle stages specific to this industry — NOT generic stages
- Key strategic dimensions that matter for workshop analysis in this sector

═══ MINIMUM SEARCH REQUIREMENTS ═══

You MUST conduct at least ${minSearches} different searches before calling commit_research. Do NOT commit after 2-3 searches — that produces thin, surface-level output that is useless for workshop facilitation. Use different queries for each search to explore different angles and build a truly comprehensive picture.

═══ OUTPUT DEPTH REQUIREMENTS ═══

When you call commit_research, EACH field must be SUBSTANTIVE:

- companyOverview: 3-4 detailed paragraphs minimum. Cover history and founding, what they do today in detail, market position and size, key products/services and business lines, recent strategic direction, leadership and organisational structure. A facilitator should be able to read this and deeply understand the company.

- industryContext: 2-3 paragraphs minimum. Cover macro trends reshaping the industry, specific disruption forces (technology, regulation, competition, demographics), challenges facing organisations like this client, and a forward-looking 2-5 year outlook. Include specific data points and evidence — NOT "the industry is evolving".

- keyPublicChallenges: 5-8 specific, detailed challenges. Each challenge should be a full sentence with context and evidence — not a bullet fragment. For example: "Declining law school enrollment (down 28% from peak in 2010) is putting revenue pressure on member institutions and reducing demand for LSAC services."

- recentDevelopments: 4-6 developments with dates/timeframes, descriptions, and strategic implications. Not just "they launched X" but "In [date], they launched X, which signals Y because Z."

- competitorLandscape: 2-3 paragraphs. Name specific competitors, explain how they differ in approach and positioning, what competitive advantages/disadvantages the client has, and how the competitive landscape is evolving.

${isDomain ? `- domainInsights: 3-4 paragraphs covering: current state of ${context.targetDomain || 'the domain'} in this industry, emerging trends and innovations, common pain points and failure modes, best practices from leading organisations, and transformation opportunities. This is the CENTREPIECE of a Domain track workshop — it must be the most thorough section.` : '- domainInsights: null for Enterprise track.'}

- journeyStages: 6-12 industry-specific stages with detailed descriptions (2-3 sentences each) and 3-5 specific touchpoints per stage.

- industryDimensions: 4-6 dimensions with descriptive names, detailed descriptions (what it covers and why it matters), and 10-20 classification keywords each. Choose dimensions that matter for THIS industry.

═══ QUALITY STANDARDS ═══

- Be factual. Only report what you can verify from search results.
- Do NOT invent or speculate — if you can't find something, say so.
- Include source URLs in your commit_research call for every finding.
- Prefer recent sources (2024-2026). Flag anything that might be outdated.
- Each paragraph should contain SPECIFIC facts, numbers, or evidence — not just generalities.
- Assign each dimension a distinct, accessible hex color for UI rendering (blues, greens, purples, oranges, teals — avoid red which is reserved for alerts).
- Write as a colleague would brief another colleague — professional, thorough, and insightful.
- Note confidence level for each finding and cite your sources.`;
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
      content: `Begin your comprehensive, multi-phase research on ${context.clientName || 'the company'}. This research will brief a facilitator for a full-day strategic workshop with senior stakeholders — surface-level summaries will NOT be sufficient.

Follow the phased approach:
1. Phase 1: Company foundation — history, what they do, size, market position, strategic direction (3-4 searches)
2. Phase 2: Industry and competitive landscape — macro trends, disruption forces, competitors (3-4 searches)
${context.dreamTrack === 'DOMAIN' ? `3. Phase 3: Deep domain research — drill deep into "${context.targetDomain || 'the target domain'}" from multiple angles: current state, best practices, pain points, emerging trends, transformation opportunities (3-4 searches)\n4. Phase 4: Customer/user journey stages and strategic dimensions (2-3 searches)` : '3. Phase 3: Cross-functional challenges and digital transformation (1-2 searches)\n4. Phase 4: Customer/user journey stages and strategic dimensions (2-3 searches)'}

You must conduct at least ${context.dreamTrack === 'DOMAIN' ? '8' : '6'} different searches before committing. Each section of your final commit should be multiple detailed paragraphs with specific facts and evidence.`,
    },
  ];

  try {
    let searchCount = 0;
    const minSearches = context.dreamTrack === 'DOMAIN' ? MIN_SEARCHES_DOMAIN_TRACK : MIN_SEARCHES_BEFORE_COMMIT;

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
          // ── Commit gate: reject premature commits ──
          if (searchCount < minSearches && iteration < MAX_ITERATIONS - 1) {
            console.log(`[Research Agent] Commit attempted after only ${searchCount}/${minSearches} searches — nudging to continue`);
            onConversation?.({
              timestampMs: Date.now(),
              agent: 'research-agent',
              to: 'prep-orchestrator',
              message: `Deepening research (${searchCount}/${minSearches} searches completed so far)…`,
              type: 'info',
            });
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                status: 'rejected',
                reason: `You have only conducted ${searchCount} searches so far. The minimum for a thorough research briefing is ${minSearches}. Please continue researching — explore more angles before committing. Your current findings would produce a surface-level brief. Have you covered: company foundation, industry/competitive landscape, ${context.dreamTrack === 'DOMAIN' ? 'domain deep-dive, ' : ''}customer journey, and strategic dimensions?`,
              }),
            });
            continue;
          }

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
          searchCount++;
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
        model: LIVE_REVIEW_MODEL,
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

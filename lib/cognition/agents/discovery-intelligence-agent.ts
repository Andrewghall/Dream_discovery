/**
 * DREAM Discovery Intelligence Agent
 *
 * A GPT-4o-mini tool-calling agent that synthesizes all completed
 * Discovery interview responses into a structured workshop briefing.
 *
 * This is the bridge between Discovery and the Live Workshop —
 * it converts participant voices into seed knowledge.
 *
 * Runs after participants complete their interviews, before the workshop.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import type {
  WorkshopIntelligence,
  WorkshopPrepResearch,
  PrepContext,
  AgentConversationCallback,
  AgentReview,
  LensName,
} from './agent-types';
import type { GuidanceState } from '../guidance-state';
import { buildJourneyContextString } from '../journey-completion-state';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 5;
const LOOP_TIMEOUT_MS = 40_000; // 40s — synthesis is thorough
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const DISCOVERY_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_participant_responses',
      description:
        'Retrieve all participant Discovery interview data for this workshop. Returns data points grouped by participant with their classifications.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spider_scores',
      description:
        'Retrieve aggregated triple_rating spider scores for all lenses (Today, Target, Projected).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_research_context',
      description: 'Retrieve the pre-workshop Research Agent findings about the company.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_briefing',
      description: 'Commit the synthesized workshop briefing. Call when synthesis is complete.',
      parameters: {
        type: 'object',
        properties: {
          briefingSummary: {
            type: 'string',
            description: '2-3 paragraph overview for the facilitator.',
          },
          discoveryThemes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                domain: { type: 'string', enum: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'] },
                frequency: { type: 'number', description: 'How many participants mentioned this.' },
                sentiment: { type: 'string', enum: ['positive', 'negative', 'mixed'] },
                keyQuotes: { type: 'array', items: { type: 'string' }, description: '2-3 representative quotes.' },
              },
              required: ['title', 'frequency', 'sentiment'],
            },
          },
          consensusAreas: {
            type: 'array',
            items: { type: 'string' },
            description: 'Things most participants agree on.',
          },
          divergenceAreas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                perspectives: { type: 'array', items: { type: 'string' } },
              },
              required: ['topic', 'perspectives'],
            },
          },
          painPoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                domain: { type: 'string', enum: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'] },
                frequency: { type: 'number' },
                severity: { type: 'string', enum: ['critical', 'significant', 'moderate'] },
              },
              required: ['description', 'domain', 'frequency', 'severity'],
            },
          },
          aspirations: {
            type: 'array',
            items: { type: 'string' },
            description: 'What participants aspire to for the future.',
          },
          watchPoints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sensitive topics, contradictions, or areas where participants seemed guarded.',
          },
        },
        required: ['briefingSummary', 'discoveryThemes', 'consensusAreas', 'painPoints', 'aspirations', 'watchPoints'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

async function executeDiscoveryTool(
  toolName: string,
  _args: Record<string, unknown>,
  workshopId: string,
  research: WorkshopPrepResearch | null,
): Promise<{ result: string; summary: string }> {
  switch (toolName) {
    case 'get_participant_responses': {
      // Fetch completed sessions' data points
      const sessions = await prisma.conversationSession.findMany({
        where: {
          workshopId,
          completedAt: { not: null },
        },
        include: {
          participant: { select: { name: true, role: true, department: true } },
          dataPoints: {
            select: {
              rawText: true,
              source: true,
              questionKey: true,
              classification: {
                select: { primaryType: true, keywords: true },
              },
              annotation: {
                select: { dialoguePhase: true },
              },
              agenticAnalysis: {
                select: {
                  semanticMeaning: true,
                  sentimentTone: true,
                  themes: true,
                  domains: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const participantData = sessions.map((s) => ({
        name: s.participant.name || 'Anonymous',
        role: s.participant.role || 'Unknown',
        department: s.participant.department || 'Unknown',
        responseCount: s.dataPoints.length,
        keyPoints: s.dataPoints
          .filter((dp) => dp.source === 'SPEECH')
          .slice(0, 10) // Limit per participant to fit context
          .map((dp) => ({
            text: dp.rawText.substring(0, 300),
            phase: dp.annotation?.dialoguePhase || dp.questionKey,
            type: dp.classification?.primaryType,
            meaning: dp.agenticAnalysis?.semanticMeaning?.substring(0, 150),
            sentiment: dp.agenticAnalysis?.sentimentTone,
          })),
      }));

      return {
        result: JSON.stringify({
          completedCount: sessions.length,
          participants: participantData,
        }),
        summary: `${sessions.length} completed sessions, ${participantData.reduce((s, p) => s + p.responseCount, 0)} total data points`,
      };
    }

    case 'get_spider_scores': {
      // Fetch triple_rating data points — questionKey format: "v1:phase:triple_rating:index"
      const tripleRatings = await prisma.dataPoint.findMany({
        where: {
          workshopId,
          session: {
            completedAt: { not: null },
          },
          questionKey: { contains: 'triple_rating' },
        },
        select: {
          rawText: true,
          questionKey: true,
        },
      });

      // Parse scores from raw text (format: "current: X, target: Y, projected: Z")
      const phaseToLens: Record<string, LensName> = {
        people: 'People',
        corporate: 'Organisation',
        customer: 'Customer',
        technology: 'Technology',
        regulation: 'Regulation',
      };

      const scores: Record<string, { today: number[]; target: number[]; projected: number[] }> = {};

      for (const dp of tripleRatings) {
        // questionKey format: "v1:phase:triple_rating:index" or "phase:triple_rating:index"
        const parts = (dp.questionKey || '').split(':');
        // Find the phase part (comes before 'triple_rating')
        const tripleIdx = parts.indexOf('triple_rating');
        const phaseKey = tripleIdx > 0 ? parts[tripleIdx - 1] : '';
        const lens = phaseToLens[phaseKey];
        if (!lens) continue;
        if (!scores[lens]) scores[lens] = { today: [], target: [], projected: [] };

        // Extract labelled ratings (format: "current: 5, target: 8, projected: 4")
        const currentMatch = dp.rawText.match(/\bcurrent\b\s*[:=-]?\s*(10|[1-9])\b/i);
        const targetMatch = dp.rawText.match(/\btarget\b\s*[:=-]?\s*(10|[1-9])\b/i);
        const projectedMatch = dp.rawText.match(/\bprojected\b\s*[:=-]?\s*(10|[1-9])\b/i);
        if (currentMatch) scores[lens].today.push(Number(currentMatch[1]));
        if (targetMatch) scores[lens].target.push(Number(targetMatch[1]));
        if (projectedMatch) scores[lens].projected.push(Number(projectedMatch[1]));
      }

      // Calculate medians
      const median = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      const spiderData = Object.entries(scores).map(([lens, vals]) => ({
        domain: lens,
        todayMedian: +median(vals.today).toFixed(1),
        targetMedian: +median(vals.target).toFixed(1),
        projectedMedian: +median(vals.projected).toFixed(1),
        spread: +(Math.max(...vals.today) - Math.min(...vals.today)).toFixed(1),
        responseCount: vals.today.length,
      }));

      return {
        result: JSON.stringify({ spiderData, totalRatings: tripleRatings.length }),
        summary: `Spider scores: ${spiderData.length} lenses, ${tripleRatings.length} total ratings`,
      };
    }

    case 'get_research_context': {
      if (!research) {
        return {
          result: JSON.stringify({ available: false }),
          summary: 'No research context available',
        };
      }
      return {
        result: JSON.stringify({
          companyOverview: research.companyOverview.substring(0, 500),
          keyPublicChallenges: research.keyPublicChallenges,
          domainInsights: research.domainInsights?.substring(0, 300),
        }),
        summary: `Research context: ${research.keyPublicChallenges.length} challenges`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildDiscoverySystemPrompt(context: PrepContext): string {
  return `You are the DREAM Discovery Intelligence Agent. Participants have completed their Discovery interviews for ${context.clientName || 'the client'}. Your job is to synthesize their responses into a workshop briefing that will inform the live facilitation.

${context.industry ? `Industry: ${context.industry}` : ''}
${context.dreamTrack ? `DREAM Track: ${context.dreamTrack}${context.targetDomain ? ' — Focus: ' + context.targetDomain : ''}` : ''}

Synthesize the Discovery data into:
1. BRIEFING SUMMARY — 2-3 paragraph overview for the facilitator
2. KEY THEMES — Topics that came up repeatedly across interviews
3. CONSENSUS & DIVERGENCE — What people agree on vs where they disagree
4. PAIN POINTS — What frustrates people most, ranked by frequency + severity
5. ASPIRATIONS — What does the ideal future look like in participants' words
6. WATCH POINTS — Contradictions, sensitive topics, areas of guardedness

IMPORTANT:
- Ground everything in actual participant responses
- Quote where helpful (short quotes)
- Be precise and structured — this briefing will be used by AI agents during the live workshop
- If participants disagree strongly on something, highlight it as a divergence area
- If many participants raise the same issue, give it higher frequency

Start by fetching participant responses and spider scores.`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runDiscoveryIntelligenceAgent(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  onConversation?: AgentConversationCallback,
): Promise<WorkshopIntelligence> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  // ── Early exit: no Discovery interviews → nothing to synthesize ──
  const completedSessionCount = await prisma.conversationSession.count({
    where: { workshopId: context.workshopId, completedAt: { not: null } },
  });

  if (completedSessionCount === 0) {
    console.log('[Discovery Intelligence] No completed sessions — skipping synthesis');
    onConversation?.({
      timestampMs: Date.now(),
      agent: 'discovery-intelligence-agent',
      to: 'prep-orchestrator',
      message: 'No completed Discovery interviews found. Skipping synthesis — there is no participant data to analyse.',
      type: 'info',
    });
    return {
      ...fallbackIntelligence(),
      briefingSummary: 'No Discovery interviews have been completed. The workshop will proceed without participant interview data.',
    };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildDiscoverySystemPrompt(context);
  const startMs = Date.now();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Please synthesize the Discovery interview data into a workshop briefing.' },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'commit_briefing' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: DISCOVERY_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'discovery-intelligence-agent',
          to: 'prep-orchestrator',
          message: assistantMessage.content.trim(),
          type: 'info',
        });
      }

      if (!assistantMessage.tool_calls?.length) break;

      let committed = false;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }

        if (fnName === 'commit_briefing') {
          committed = true;

          // Build full synthesis output — no truncation
          const themesArr = Array.isArray(fnArgs.discoveryThemes) ? fnArgs.discoveryThemes as Array<Record<string, unknown>> : [];
          const painsArr = Array.isArray(fnArgs.painPoints) ? fnArgs.painPoints as Array<Record<string, unknown>> : [];
          const consensus = Array.isArray(fnArgs.consensusAreas) ? fnArgs.consensusAreas.map(String) : [];
          const divergence = Array.isArray(fnArgs.divergenceAreas) ? fnArgs.divergenceAreas as Array<Record<string, unknown>> : [];
          const aspirations = Array.isArray(fnArgs.aspirations) ? fnArgs.aspirations.map(String) : [];
          const watchPoints = Array.isArray(fnArgs.watchPoints) ? fnArgs.watchPoints.map(String) : [];

          const themesText = themesArr.length > 0
            ? themesArr.map((t) => {
                const quotes = Array.isArray(t.keyQuotes) ? t.keyQuotes.map((q: unknown) => `    _"${String(q)}"_`).join('\n') : '';
                return `  • **${t.title}** (${t.domain || 'General'}, ${t.sentiment}, mentioned by ${t.frequency})${quotes ? '\n' + quotes : ''}`;
              }).join('\n')
            : '  (none identified)';

          const painsText = painsArr.length > 0
            ? painsArr.map((p) => `  • **${p.description}** — ${p.domain}, ${p.severity} severity (${p.frequency} mentions)`).join('\n')
            : '  (none identified)';

          const consensusText = consensus.length > 0 ? consensus.map((c) => `  • ${c}`).join('\n') : '  (none identified)';
          const divergenceText = divergence.length > 0
            ? divergence.map((d) => `  • **${d.topic}**\n${Array.isArray(d.perspectives) ? d.perspectives.map((p: unknown) => `    – ${String(p)}`).join('\n') : ''}`).join('\n')
            : '  (none identified)';
          const aspirationsText = aspirations.length > 0 ? aspirations.map((a) => `  • ${a}`).join('\n') : '  (none identified)';
          const watchText = watchPoints.length > 0 ? watchPoints.map((w) => `  • ${w}`).join('\n') : '  (none identified)';

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'discovery-intelligence-agent',
            to: 'prep-orchestrator',
            message: `I've completed the Discovery synthesis. Here are my full findings:\n\n**Briefing Summary**\n${String(fnArgs.briefingSummary || '')}\n\n**Key Themes** (${themesArr.length})\n${themesText}\n\n**Pain Points** (${painsArr.length})\n${painsText}\n\n**Consensus Areas**\n${consensusText}\n\n**Divergence Areas**\n${divergenceText}\n\n**Aspirations**\n${aspirationsText}\n\n**Watch Points**\n${watchText}`,
            type: 'proposal',
            metadata: {
              toolsUsed: ['get_participant_responses', 'get_spider_scores', 'get_research_context'],
            },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"committed"}' });

          return normaliseIntelligence(fnArgs);
        } else {
          const toolResult = await executeDiscoveryTool(fnName, fnArgs, context.workshopId, research);

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'discovery-intelligence-agent',
            to: 'prep-orchestrator',
            message: toolResult.summary,
            type: 'request',
            metadata: { toolsUsed: [fnName] },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }

      if (committed) {
        console.log(`[Discovery Intelligence] Committed after ${iteration + 1} iterations`);
        break;
      }
    }
  } catch (error) {
    console.error('[Discovery Intelligence] Failed:', error instanceof Error ? error.message : error);
    throw error;
  }

  return fallbackIntelligence();
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function normaliseIntelligence(args: Record<string, unknown>): WorkshopIntelligence {
  return {
    maturitySnapshot: [], // Will be populated from actual spider scores
    discoveryThemes: Array.isArray(args.discoveryThemes)
      ? (args.discoveryThemes as Array<Record<string, unknown>>).map((t) => ({
          title: String(t.title || ''),
          domain: (t.domain as LensName) || null,
          frequency: Number(t.frequency || 0),
          sentiment: (t.sentiment as 'positive' | 'negative' | 'mixed') || 'mixed',
          keyQuotes: Array.isArray(t.keyQuotes) ? t.keyQuotes.map(String) : [],
        }))
      : [],
    consensusAreas: Array.isArray(args.consensusAreas) ? args.consensusAreas.map(String) : [],
    divergenceAreas: Array.isArray(args.divergenceAreas)
      ? (args.divergenceAreas as Array<Record<string, unknown>>).map((d) => ({
          topic: String(d.topic || ''),
          perspectives: Array.isArray(d.perspectives) ? d.perspectives.map(String) : [],
        }))
      : [],
    painPoints: Array.isArray(args.painPoints)
      ? (args.painPoints as Array<Record<string, unknown>>).map((p) => ({
          description: String(p.description || ''),
          domain: (p.domain as LensName) || 'People',
          frequency: Number(p.frequency || 0),
          severity: (p.severity as 'critical' | 'significant' | 'moderate') || 'moderate',
        }))
      : [],
    aspirations: Array.isArray(args.aspirations) ? args.aspirations.map(String) : [],
    watchPoints: Array.isArray(args.watchPoints) ? args.watchPoints.map(String) : [],
    participantCount: 0, // Set by caller
    synthesizedAtMs: Date.now(),
    briefingSummary: String(args.briefingSummary || ''),
  };
}

function fallbackIntelligence(): WorkshopIntelligence {
  return {
    maturitySnapshot: [],
    discoveryThemes: [],
    consensusAreas: [],
    divergenceAreas: [],
    painPoints: [],
    aspirations: [],
    watchPoints: [],
    participantCount: 0,
    synthesizedAtMs: Date.now(),
    briefingSummary: 'Discovery intelligence synthesis was not completed. Please review participant responses manually.',
  };
}

// ══════════════════════════════════════════════════════════════
// LIVE REVIEW MODE — Discovery Agent reviews proposals
// Has tools to query participant interview data and reason about
// whether proposals build on what participants told us.
// ══════════════════════════════════════════════════════════════

const LIVE_REVIEW_TIMEOUT_MS = 8_000;
const LIVE_REVIEW_ITERATIONS = 3;

const DISCOVERY_REVIEW_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_discovery_briefing',
      description: 'Retrieve the full Discovery briefing: themes, pain points, aspirations, consensus, divergence, and watch points from participant interviews.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_maturity_scores',
      description: 'Retrieve the maturity spider scores across all lenses (Today, Target, Projected medians and spread).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_participant_coverage',
      description: 'Check whether a specific topic was mentioned in participant interviews. Returns matching themes and pain points.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic or theme to check against participant data.' },
        },
        required: ['topic'],
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
            description: 'agree = proposals build on participant data, challenge = proposals ignore or retread what participants said, build = agree but participants also mentioned angles worth exploring',
          },
          feedback: {
            type: 'string',
            description: 'Your specific assessment from the Discovery perspective. Reference what participants actually said.',
          },
          suggestedChanges: {
            type: 'string',
            description: 'If challenging or building, what participant insights should these proposals incorporate?',
          },
        },
        required: ['stance', 'feedback'],
      },
    },
  },
];

function executeDiscoveryReviewTool(
  toolName: string,
  args: Record<string, unknown>,
  guidanceState: GuidanceState,
): string {
  const di = guidanceState.prepContext?.discoveryIntelligence;

  switch (toolName) {
    case 'get_discovery_briefing': {
      if (!di) {
        return JSON.stringify({ available: false, message: 'No Discovery data available — flag this gap. Participants were not interviewed or data was not synthesized.' });
      }
      return JSON.stringify({
        available: true,
        participantCount: di.participantCount || 0,
        briefingSummary: di.briefingSummary,
        themes: di.discoveryThemes?.slice(0, 8).map((t) => ({
          title: t.title,
          domain: t.domain,
          frequency: t.frequency,
          sentiment: t.sentiment,
          keyQuotes: t.keyQuotes?.slice(0, 2),
        })),
        painPoints: di.painPoints?.slice(0, 6).map((p) => ({
          description: p.description,
          domain: p.domain,
          severity: p.severity,
        })),
        aspirations: di.aspirations?.slice(0, 5),
        consensusAreas: di.consensusAreas?.slice(0, 4),
        divergenceAreas: di.divergenceAreas?.slice(0, 3),
        watchPoints: di.watchPoints?.slice(0, 3),
      });
    }

    case 'get_maturity_scores': {
      if (!di?.maturitySnapshot?.length) {
        return JSON.stringify({ available: false, message: 'No maturity data available.' });
      }
      return JSON.stringify({
        available: true,
        scores: di.maturitySnapshot.map((s) => ({
          domain: s.domain,
          todayMedian: s.todayMedian,
          targetMedian: s.targetMedian,
          projectedMedian: s.projectedMedian,
          gap: (s.targetMedian || 0) - (s.todayMedian || 0),
          spread: s.spread,
        })),
      });
    }

    case 'check_participant_coverage': {
      const topic = String(args.topic || '').toLowerCase();
      if (!di) {
        return JSON.stringify({ covered: false, message: 'No Discovery data to check.' });
      }

      const matchingThemes = (di.discoveryThemes || []).filter(
        (t) => t.title.toLowerCase().includes(topic),
      );
      const matchingPains = (di.painPoints || []).filter(
        (p) => p.description.toLowerCase().includes(topic),
      );
      const matchingAspirations = (di.aspirations || []).filter(
        (a) => a.toLowerCase().includes(topic),
      );

      const covered = matchingThemes.length > 0 || matchingPains.length > 0 || matchingAspirations.length > 0;

      return JSON.stringify({
        topic,
        covered,
        matchingThemes: matchingThemes.map((t) => t.title),
        matchingPainPoints: matchingPains.map((p) => p.description),
        matchingAspirations: matchingAspirations,
        note: covered
          ? 'Participants mentioned this — proposals should go DEEPER, not retread.'
          : 'Participants did NOT mention this — this could be a fresh angle OR a gap to flag.',
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

export async function reviewWithDiscoveryAgent(
  proposals: string,
  guidanceState: GuidanceState,
  onConversation?: AgentConversationCallback,
): Promise<AgentReview> {
  if (!env.OPENAI_API_KEY) {
    return { agent: 'Discovery Agent', stance: 'agree', feedback: 'Discovery Agent unavailable.' };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const prep = guidanceState.prepContext;
  const startMs = Date.now();

  const journeyCtx = buildJourneyContextString(guidanceState.journeyCompletionState);

  const systemPrompt = `You are the DREAM Discovery Agent reviewing proposals from a colleague. Your domain is what participants told us in pre-workshop interviews.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : ''}
${prep?.discoveryIntelligence?.participantCount ? `${prep.discoveryIntelligence.participantCount} participants were interviewed before this workshop.` : 'No participant interviews available.'}

You synthesized participant interviews before the workshop. You know their pain points, aspirations, where they agree, where they disagree, and what sensitive topics came up. Now you're reviewing whether the Facilitation Agent's proposals build on that — or whether we're asking participants to repeat themselves.

${journeyCtx ? `JOURNEY CONTEXT:\n${journeyCtx}\nWhen reviewing proposals, connect journey stages to what participants said in interviews. If a proposal targets a stage where participants cited specific pain points or aspirations, flag it as a "build" with the participant insight. If participants mentioned something relevant to a gap that's not being addressed, challenge the proposal.\n` : ''}
REVIEW MODE: Use get_discovery_briefing to recall what participants said. Use check_participant_coverage to verify specific topics. Are these proposals pushing into new territory or retreading ground? Do they connect to real pain points and aspirations?

Submit your review with submit_review when you've assessed the proposals.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Review these proposals from the Facilitation Agent:\n\n${proposals}\n\nDo these build on what participants told us, or are we retreading? Use your tools to check.` },
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
        tools: DISCOVERY_REVIEW_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'discovery-agent',
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
            agent: 'Discovery Agent',
            stance: (['agree', 'challenge', 'build'].includes(String(fnArgs.stance))
              ? String(fnArgs.stance) : 'agree') as AgentReview['stance'],
            feedback: String(fnArgs.feedback || 'No feedback provided.'),
            suggestedChanges: fnArgs.suggestedChanges ? String(fnArgs.suggestedChanges) : undefined,
          };

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'discovery-agent',
            to: 'facilitation-agent',
            message: `[${review.stance.toUpperCase()}] ${review.feedback}${review.suggestedChanges ? `\nSuggestion: ${review.suggestedChanges}` : ''}`,
            type: review.stance === 'challenge' ? 'challenge' : 'proposal',
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"submitted"}' });
          return review;
        } else {
          const result = executeDiscoveryReviewTool(fnName, fnArgs, guidanceState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        }
      }
    }
  } catch (error) {
    console.error('[Discovery Agent Review] Failed:', error instanceof Error ? error.message : error);
  }

  return { agent: 'Discovery Agent', stance: 'agree', feedback: 'Review timed out — no objections raised.' };
}

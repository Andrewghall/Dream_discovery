/**
 * DREAM Theme Agent
 *
 * A GPT-4o-mini tool-calling agent that decides if a new discussion
 * theme should be surfaced to the workshop facilitator.
 *
 * Called by the Facilitation Orchestrator when:
 * - No active theme exists, OR
 * - Active theme has been running > 15 minutes, OR
 * - Domain focus has shifted
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState } from '../cognitive-state';
import type { GuidanceState, GuidedTheme } from '../guidance-state';
import type { AgentConversationCallback, AgentReview } from './agent-types';
import type { Lens } from '@/lib/cognitive-guidance/pipeline';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 3;
const LOOP_TIMEOUT_MS = 8_000;
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const THEME_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_beliefs',
      description: 'Search beliefs accumulated during the workshop by pattern, category, or domain.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Keywords to match against belief labels.' },
          category: {
            type: 'string',
            enum: ['aspiration', 'constraint', 'enabler', 'opportunity', 'risk', 'insight', 'action'],
          },
          domain: {
            type: 'string',
            enum: ['People', 'Operations', 'Customer', 'Technology', 'Regulation'],
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_coverage_summary',
      description: 'Get domain/lens coverage counts and which themes have been completed.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_theme',
      description: 'Suggest a new discussion theme. This is your commit tool — call it when you have a theme to propose, or call it with shouldSuggest=false if no new theme is warranted.',
      parameters: {
        type: 'object',
        properties: {
          shouldSuggest: {
            type: 'boolean',
            description: 'Whether a new theme should be suggested.',
          },
          title: { type: 'string', description: 'Theme title (e.g. "Technology Landscape & Technical Debt")' },
          description: { type: 'string', description: 'Brief description of the theme.' },
          lens: {
            type: 'string',
            enum: ['People', 'Organisation', 'Technology', 'Regulation', 'Customer'],
            description: 'Primary lens for this theme (or null for cross-cutting).',
          },
          reasoning: { type: 'string', description: 'Why this theme should be surfaced now.' },
          sourceBeliefIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Belief IDs that ground this theme suggestion.',
          },
        },
        required: ['shouldSuggest', 'reasoning'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeThemeTool(
  toolName: string,
  args: Record<string, unknown>,
  cogState: CognitiveState,
  guidanceState: GuidanceState,
): { result: string; summary: string } {
  switch (toolName) {
    case 'query_beliefs': {
      const pattern = String(args.pattern || '').toLowerCase();
      const category = args.category ? String(args.category) : null;
      const domain = args.domain ? String(args.domain) : null;

      const matches = Array.from(cogState.beliefs.values()).filter((b) => {
        if (pattern && !b.label.toLowerCase().includes(pattern)) return false;
        if (category && b.category !== category) return false;
        if (domain && !b.domains.some((d) => d.domain === domain)) return false;
        return true;
      }).slice(0, 15);

      return {
        result: JSON.stringify({
          matchCount: matches.length,
          beliefs: matches.map((b) => ({
            id: b.id,
            label: b.label,
            category: b.category,
            domains: b.domains.map((d) => d.domain),
            confidence: b.confidence,
          })),
        }),
        summary: `Found ${matches.length} beliefs matching "${pattern}"`,
      };
    }

    case 'get_coverage_summary': {
      const domainCounts: Record<string, number> = {};
      for (const b of cogState.beliefs.values()) {
        for (const d of b.domains) {
          domainCounts[d.domain] = (domainCounts[d.domain] || 0) + 1;
        }
      }

      const completedThemes = guidanceState.themes.filter((t) => t.status === 'completed');
      const activeTheme = guidanceState.themes.find((t) => t.id === guidanceState.activeThemeId);

      return {
        result: JSON.stringify({
          totalBeliefs: cogState.beliefs.size,
          domainCoverage: domainCounts,
          completedThemes: completedThemes.map((t) => t.title),
          activeTheme: activeTheme
            ? {
                title: activeTheme.title,
                lens: activeTheme.lens,
                startedAtMs: activeTheme.startedAtMs,
                runningMinutes: activeTheme.startedAtMs
                  ? Math.round((Date.now() - activeTheme.startedAtMs) / 60_000)
                  : 0,
              }
            : null,
          queuedThemes: guidanceState.themes
            .filter((t) => t.status === 'queued')
            .map((t) => t.title),
        }),
        summary: `Coverage: ${cogState.beliefs.size} beliefs, ${completedThemes.length} themes completed`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildThemeSystemPrompt(
  cogState: CognitiveState,
  guidanceState: GuidanceState,
): string {
  const prep = guidanceState.prepContext;
  const activeTheme = guidanceState.themes.find((t) => t.id === guidanceState.activeThemeId);

  let discoveryContext = '';
  if (prep?.discoveryIntelligence) {
    const di = prep.discoveryIntelligence;
    discoveryContext = `
PRE-WORKSHOP INTELLIGENCE (from Discovery interviews):
- ${di.participantCount} participants interviewed
- Key themes: ${di.discoveryThemes.slice(0, 5).map((t) => t.title).join(', ')}
- Pain points: ${di.painPoints.slice(0, 3).map((p) => p.description).join('; ')}
- Consensus: ${di.consensusAreas.slice(0, 2).join('; ')}
- Divergence: ${di.divergenceAreas.slice(0, 2).map((d) => d.topic).join('; ')}`;
  }

  return `You are the DREAM Theme Agent. You analyze the workshop conversation's trajectory and suggest discussion themes to the facilitator.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown industry'})` : ''}
${prep?.dreamTrack ? `DREAM Track: ${prep.dreamTrack}${prep.targetDomain ? ' — Focus: ' + prep.targetDomain : ''}` : ''}
Current workshop phase: ${guidanceState.dialoguePhase}
Beliefs accumulated: ${cogState.beliefs.size}
Active theme: ${activeTheme ? `"${activeTheme.title}" (running ${activeTheme.startedAtMs ? Math.round((Date.now() - activeTheme.startedAtMs) / 60_000) : 0}m)` : 'None'}
Themes completed: ${guidanceState.themes.filter((t) => t.status === 'completed').map((t) => t.title).join(', ') || 'None'}
${discoveryContext}

Your job: Decide if the conversation has naturally moved to a new topic that warrants a dedicated discussion theme. Only suggest themes grounded in what's actually being discussed.

RULES:
- ONLY suggest themes backed by at least 3 beliefs.
- Cite sourceBeliefIds for every suggestion.
- If the current theme is still relevant, say so and don't suggest a new one.
- Never fabricate topics — only surface what's actually in the beliefs.

When communicating, speak naturally as a colleague would. Be professional but warm.`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export type ThemeProposal = {
  theme: GuidedTheme;
  sourceBeliefIds: string[];
  reasoning: string;
} | null;

export async function runThemeAgent(
  cogState: CognitiveState,
  guidanceState: GuidanceState,
  onConversation?: AgentConversationCallback,
): Promise<ThemeProposal> {
  if (!env.OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildThemeSystemPrompt(cogState, guidanceState);
  const startMs = Date.now();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: 'Review the current beliefs and coverage. Should we suggest a new discussion theme?',
    },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'suggest_theme' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: THEME_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'theme-agent',
          to: 'orchestrator',
          message: assistantMessage.content.trim(),
          type: 'info',
        });
      }

      if (!assistantMessage.tool_calls?.length) break;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }

        if (fnName === 'suggest_theme') {
          const shouldSuggest = Boolean(fnArgs.shouldSuggest);

          if (!shouldSuggest) {
            onConversation?.({
              timestampMs: Date.now(),
              agent: 'theme-agent',
              to: 'orchestrator',
              message: `No new theme warranted right now. ${String(fnArgs.reasoning || '')}`,
              type: 'proposal',
            });
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"no_theme"}' });
            return null;
          }

          const sourceBeliefIds = Array.isArray(fnArgs.sourceBeliefIds)
            ? fnArgs.sourceBeliefIds.map(String)
            : [];

          const theme: GuidedTheme = {
            id: `theme_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title: String(fnArgs.title || 'Untitled Theme'),
            description: String(fnArgs.description || ''),
            lens: (fnArgs.lens as Lens) || null,
            source: 'ai',
            status: 'queued',
            order: guidanceState.themes.length,
            startedAtMs: null,
            completedAtMs: null,
            sourceSignalIds: sourceBeliefIds,
          };

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'theme-agent',
            to: 'orchestrator',
            message: `I'd like to suggest a new theme: "${theme.title}". ${String(fnArgs.reasoning || '')} This is grounded in ${sourceBeliefIds.length} beliefs.`,
            type: 'proposal',
            metadata: {
              beliefsCited: sourceBeliefIds.length,
              reasoning: String(fnArgs.reasoning || ''),
            },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"committed"}' });

          return {
            theme,
            sourceBeliefIds,
            reasoning: String(fnArgs.reasoning || ''),
          };
        } else {
          const toolResult = executeThemeTool(fnName, fnArgs, cogState, guidanceState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }
    }
  } catch (error) {
    console.error('[Theme Agent] Failed:', error instanceof Error ? error.message : error);
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
// REVIEW MODE — Theme Agent reviews proposals from its domain
// Same tools, same reasoning, same agentic loop.
// ══════════════════════════════════════════════════════════════

const THEME_REVIEW_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // Same belief query and coverage tools
  THEME_TOOLS[0], // query_beliefs
  THEME_TOOLS[1], // get_coverage_summary
  // Review commit tool
  {
    type: 'function',
    function: {
      name: 'submit_review',
      description: 'Submit your review of the proposals. This is your commit tool — call it when you have assessed the proposals from your domain expertise.',
      parameters: {
        type: 'object',
        properties: {
          stance: {
            type: 'string',
            enum: ['agree', 'challenge', 'build'],
            description: 'agree = proposals align with conversational flow, challenge = proposals conflict with theme direction, build = agree but see additional angles',
          },
          feedback: {
            type: 'string',
            description: 'Your specific assessment. Reference specific proposals and explain your reasoning from your thematic knowledge.',
          },
          suggestedChanges: {
            type: 'string',
            description: 'If challenging or building, what specifically should change? Be concrete.',
          },
        },
        required: ['stance', 'feedback'],
      },
    },
  },
];

export async function reviewWithThemeAgent(
  proposals: string,
  cogState: CognitiveState,
  guidanceState: GuidanceState,
  onConversation?: AgentConversationCallback,
): Promise<AgentReview> {
  if (!env.OPENAI_API_KEY) {
    return { agent: 'Theme Agent', stance: 'agree', feedback: 'Theme Agent unavailable.' };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const basePrompt = buildThemeSystemPrompt(cogState, guidanceState);
  const startMs = Date.now();

  const systemPrompt = `${basePrompt}

REVIEW MODE: You are being asked to review proposals from the Facilitation Agent. Use your tools to check whether these proposals align with the current conversational flow and thematic direction. Do they follow the thread the room is exploring, or do they pull in a different direction?

Use query_beliefs and get_coverage_summary to ground your assessment, then submit_review with your verdict.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Review these proposals from the Facilitation Agent:\n\n${proposals}\n\nDo these align with the conversational direction? Use your tools to check.` },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'submit_review' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: THEME_REVIEW_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'theme-agent',
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
            agent: 'Theme Agent',
            stance: (['agree', 'challenge', 'build'].includes(String(fnArgs.stance))
              ? String(fnArgs.stance) : 'agree') as AgentReview['stance'],
            feedback: String(fnArgs.feedback || 'No feedback provided.'),
            suggestedChanges: fnArgs.suggestedChanges ? String(fnArgs.suggestedChanges) : undefined,
          };

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'theme-agent',
            to: 'facilitation-agent',
            message: `[${review.stance.toUpperCase()}] ${review.feedback}${review.suggestedChanges ? `\nSuggestion: ${review.suggestedChanges}` : ''}`,
            type: review.stance === 'challenge' ? 'challenge' : 'proposal',
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"submitted"}' });
          return review;
        } else {
          const toolResult = executeThemeTool(fnName, fnArgs, cogState, guidanceState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }
    }
  } catch (error) {
    console.error('[Theme Agent Review] Failed:', error instanceof Error ? error.message : error);
  }

  return { agent: 'Theme Agent', stance: 'agree', feedback: 'Review timed out — no objections raised.' };
}

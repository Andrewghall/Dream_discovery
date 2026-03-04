/**
 * DREAM Facilitation Agent
 *
 * A GPT-4o-mini tool-calling agent that generates contextual facilitation
 * post-its (sticky pads) based on the active theme and accumulated beliefs.
 *
 * Called by the Facilitation Orchestrator:
 * - Every 5 new utterances, OR
 * - Every 30 seconds, whichever comes first
 * - Skipped when freeflowMode is true
 *
 * Key difference from the previous deterministic system:
 * Instead of template strings like "'${keyword}' has appeared ${count} times...",
 * this agent generates natural, contextual facilitation questions grounded in
 * actual beliefs AND pre-workshop Discovery intelligence.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState } from '../cognitive-state';
import type { GuidanceState } from '../guidance-state';
import type { AgentConversationCallback, WorkshopPrepResearch } from './agent-types';
import type { StickyPad, StickyPadType, Lens } from '@/lib/cognitive-guidance/pipeline';
import { getDimensionNames } from '../workshop-dimensions';
import { analyzeMetricTrends } from '@/lib/historical-metrics/summarize';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 3;
const LOOP_TIMEOUT_MS = 8_000;
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const DEFAULT_FACILITATION_DOMAINS = ['People', 'Operations', 'Customer', 'Technology', 'Regulation'];
const DEFAULT_FACILITATION_LENSES = ['People', 'Organisation', 'Technology', 'Regulation', 'Customer'];

function buildFacilitationTools(dimensions?: string[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const domainEnum = dimensions?.length ? dimensions : DEFAULT_FACILITATION_DOMAINS;
  const lensEnum = dimensions?.length ? dimensions : DEFAULT_FACILITATION_LENSES;

  return [
  {
    type: 'function',
    function: {
      name: 'query_beliefs',
      description: 'Search beliefs by pattern, category, or domain.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Keywords to match.' },
          category: {
            type: 'string',
            enum: ['aspiration', 'constraint', 'enabler', 'opportunity', 'risk', 'insight', 'action'],
          },
          domain: {
            type: 'string',
            enum: domainEnum,
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_all_beliefs',
      description: 'Get ALL beliefs accumulated in this session. Use this first to see what exists before targeted queries.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contradictions',
      description: 'Get unresolved belief contradictions.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_discovery_intelligence',
      description: 'Get pre-workshop Discovery interview synthesis --themes, pain points, maturity scores.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_speech',
      description: 'Get the last 10 things participants actually said (verbatim utterances). Ground your questions in their exact words.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_historical_metrics',
      description: 'Get historical operational performance metrics -- baselines, trends, and changes. Use to check participant claims against real data and probe data-claim mismatches.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_pads',
      description: 'Generate 1-3 facilitation sticky pads. Each pad is a contextual prompt for the facilitator.',
      parameters: {
        type: 'object',
        properties: {
          pads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['CLARIFICATION', 'GAP_PROBE', 'CONTRADICTION_PROBE', 'RISK_PROBE', 'ENABLER_PROBE', 'CUSTOMER_IMPACT', 'OWNERSHIP_ACTION', 'METRIC_CHALLENGE'],
                },
                prompt: { type: 'string', description: 'The facilitation question/prompt text.' },
                lens: {
                  type: 'string',
                  enum: lensEnum,
                  description: 'Primary lens (or null for cross-cutting).',
                },
                sourceBeliefIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Belief IDs that ground this pad.',
                },
                reasoning: { type: 'string', description: 'Why this pad is relevant now.' },
                journeyGapId: { type: 'string', description: 'ID of the journey gap this pad addresses (if filling a journey gap).' },
                padLabel: { type: 'string', description: 'Display label. Use "Journey Mapping" for general journey pads or "Journey: {stage name}" for stage-specific journey pads. Leave empty for non-journey pads.' },
                metricEvidence: { type: 'string', description: 'For METRIC_CHALLENGE pads: cite the specific metric data that contradicts the participant claim. E.g. "AHT: 245s, increasing +8%"' },
              },
              required: ['type', 'prompt', 'sourceBeliefIds', 'reasoning'],
            },
            description: 'Array of 1-3 facilitation pads.',
          },
        },
        required: ['pads'],
      },
    },
  },
  ];
}

const FACILITATION_TOOLS = buildFacilitationTools();

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeFacilitationTool(
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

    case 'list_all_beliefs': {
      const all = Array.from(cogState.beliefs.values()).slice(0, 20);
      return {
        result: JSON.stringify({
          totalCount: cogState.beliefs.size,
          beliefs: all.map((b) => ({
            id: b.id,
            label: b.label,
            category: b.category,
            domains: b.domains.map((d) => d.domain),
            confidence: b.confidence,
          })),
        }),
        summary: `Listed all ${all.length} beliefs`,
      };
    }

    case 'get_contradictions': {
      const unresolved = Array.from(cogState.contradictions.values()).filter((c) => !c.resolvedAtMs);
      return {
        result: JSON.stringify({
          count: unresolved.length,
          contradictions: unresolved.slice(0, 5).map((c) => ({
            id: c.id,
            beliefAId: c.beliefAId,
            beliefBId: c.beliefBId,
            resolution: c.resolution,
          })),
        }),
        summary: `${unresolved.length} unresolved contradictions`,
      };
    }

    case 'get_discovery_intelligence': {
      const di = guidanceState.prepContext?.discoveryIntelligence;
      if (!di) {
        return {
          result: JSON.stringify({ available: false }),
          summary: 'No Discovery intelligence available',
        };
      }
      return {
        result: JSON.stringify({
          available: true,
          participantCount: di.participantCount,
          topThemes: di.discoveryThemes.slice(0, 5).map((t) => ({
            title: t.title,
            domain: t.domain,
            frequency: t.frequency,
            sentiment: t.sentiment,
          })),
          topPainPoints: di.painPoints.slice(0, 5).map((p) => ({
            description: p.description,
            domain: p.domain,
            frequency: p.frequency,
            severity: p.severity,
          })),
          maturityGaps: di.maturitySnapshot.map((m) => ({
            domain: m.domain,
            gap: +(m.targetMedian - m.todayMedian).toFixed(1),
          })),
          consensusAreas: di.consensusAreas.slice(0, 3),
          divergenceAreas: di.divergenceAreas.slice(0, 3),
        }),
        summary: `Discovery intelligence: ${di.discoveryThemes.length} themes, ${di.painPoints.length} pain points`,
      };
    }

    case 'get_recent_speech': {
      const recent = cogState.recentUtterances.slice(-10);
      if (recent.length === 0) {
        return {
          result: JSON.stringify({ utterances: [], note: 'No speech captured yet.' }),
          summary: 'No recent utterances',
        };
      }
      return {
        result: JSON.stringify({
          count: recent.length,
          utterances: recent.map((u) => ({
            speaker: u.speaker || 'Unknown',
            text: u.text,
          })),
        }),
        summary: `${recent.length} recent utterances`,
      };
    }

    case 'get_historical_metrics': {
      const metrics = guidanceState.historicalMetrics;
      if (!metrics) {
        return {
          result: JSON.stringify({ available: false, note: 'No historical metrics data uploaded.' }),
          summary: 'No historical metrics available',
        };
      }
      const trends = analyzeMetricTrends(metrics);
      return {
        result: JSON.stringify({
          available: true,
          domainPack: metrics.domainPack,
          sourceCount: metrics.sources.length,
          metrics: trends.map((t) => ({
            metricLabel: t.metricLabel,
            latestValue: t.latestValue,
            unit: t.unit,
            latestPeriod: t.latestPeriod,
            trend: t.trend,
            changePercent: t.changePercent,
          })),
        }),
        summary: `Historical metrics: ${trends.length} metrics from ${metrics.domainPack} pack`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildFacilitationSystemPrompt(
  cogState: CognitiveState,
  guidanceState: GuidanceState,
): string {
  const prep = guidanceState.prepContext;
  const bp = guidanceState.blueprint;
  const activeTheme = guidanceState.themes.find((t) => t.id === guidanceState.activeThemeId);

  // Actor taxonomy from blueprint (falls back to generic guidance)
  const actorContext = bp?.actorTaxonomy?.length
    ? `DOMAIN ACTORS: ${bp.actorTaxonomy.map(a => `${a.label} (${a.description})`).join(', ')}. Use these names in your questions.`
    : '';

  return `You are a skilled workshop facilitator's intelligent assistant. Your job is to suggest follow-up questions that a facilitator would naturally ask, grounded in what participants have ACTUALLY SAID.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : ''}
Phase: ${guidanceState.dialoguePhase}
Active theme: ${activeTheme ? `"${activeTheme.title}"` : 'None'}
Beliefs accumulated: ${cogState.beliefs.size}
${actorContext}

${guidanceState.currentMainQuestion
  ? `CURRENT MAIN QUESTION (YOUR GOAL):
"${guidanceState.currentMainQuestion.text}"
Purpose: ${guidanceState.currentMainQuestion.purpose}
Grounding: ${guidanceState.currentMainQuestion.grounding}

Every sub-question you generate MUST help explore this main question. Stay scoped.`
  : 'No main question active, generate broadly relevant prompts.'}

YOUR APPROACH:
1. Call get_recent_speech to see what participants have actually been saying
2. Call list_all_beliefs to see what's been extracted so far
3. Look at the SIGNALS and GAPS in the deliberation brief (missing dimensions, repeated themes, imbalances)
4. Generate 1-3 questions that a facilitator would naturally ask NEXT

STYLE RULES, THIS IS CRITICAL:
- ALWAYS reference something specific a participant said: "You mentioned X, can you tell me more about..."
- NEVER use consultant language: NO "innovative strategies", NO "enhance", NO "implement", NO "leverage", NO "How might we"
- NEVER repeat the main question's aspirational framing in sub-questions. The main question already sets the vision. NO "In your ideal...", NO "In the ideal world...", NO "Imagine a future where...", NO "Describe the perfect...", NO "Paint the picture of...", NO "What does the ideal future state look like...". Your job is to probe SPECIFIC aspects with SPECIFIC follow-ups grounded in what participants actually said.
- Write as a curious colleague: "What does that actually look like day to day?", "Who's affected most by that?"
- Keep questions SHORT, one sentence, conversational, warm
- If a signal shows a MISSING DIMENSION, ask about it naturally: "We've heard a lot about Operations, has anyone thought about how Regulation fits in?"
- If a signal shows a REPEATED THEME, go deeper: "X keeps coming up, what's driving that?"
- If a signal shows CATEGORY IMBALANCE (lots of constraints, few enablers), flip it: "We've identified several blockers in Y, who's working on solutions?"
- If a signal shows a METRIC CONTRADICTION (participant claim vs historical data), probe gently: "You mentioned handle times are good -- the data shows AHT has been climbing, what's driving that?"
${guidanceState.historicalMetrics
  ? `
HISTORICAL PERFORMANCE DATA AVAILABLE. Use get_historical_metrics() to check participant claims against real baselines.
If someone makes a claim that contradicts the data, probe it constructively -- not accusatively.
Use METRIC_CHALLENGE pad type for data-backed probes. Include metricEvidence in the pad.`
  : ''}

PHASE TONE:
${guidanceState.dialoguePhase === 'REIMAGINE'
  ? `REIMAGINE: Pure aspiration. "Describe the ideal...", "What does perfect look like...", "If there were no barriers...". NEVER mention constraints, blockers, or limitations.`
  : guidanceState.dialoguePhase === 'CONSTRAINTS'
  ? `CONSTRAINTS: Practical, specific, challenging. "What stands in the way of...", "Where does this break down?", "What's the biggest blocker?"`
  : `DEFINE APPROACH: Solution-oriented, concrete. "Who owns this?", "What's the first step?", "How do we actually make this happen?"`}

${guidanceState.surfacedPadPrompts.length > 0
  ? `ALREADY ASKED (do NOT repeat or paraphrase):
${guidanceState.surfacedPadPrompts.map((p, i) => `${i + 1}. "${p}"`).join('\n')}
` : ''}
RULES:
- Every pad MUST cite sourceBeliefIds from beliefs that actually exist
- NEVER fabricate, only ask about things grounded in actual beliefs or signals
- If you can't find enough grounding, generate fewer pads (1 is fine)
- Quality over quantity, one brilliant probe beats three generic questions`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export type PadProposal = {
  pad: StickyPad;
  sourceBeliefIds: string[];
  reasoning: string;
};

export type DeliberationContext = {
  themeRecommendation?: string | null;
  constraintGaps?: string | null;
  researchHighlights?: string | null;
  discoveryInsights?: string | null;
  journeyGaps?: string | null;
  signals?: string | null;
  recentUtterances?: string | null;
  metricsContext?: string | null;
};

export async function runFacilitationAgent(
  cogState: CognitiveState,
  guidanceState: GuidanceState,
  onConversation?: AgentConversationCallback,
  deliberation?: DeliberationContext,
): Promise<PadProposal[]> {
  if (!env.OPENAI_API_KEY) return [];

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildFacilitationSystemPrompt(cogState, guidanceState);
  const startMs = Date.now();

  // Build dynamic tools: blueprint lenses > research dimensions > defaults
  const bpLenses = guidanceState.blueprint?.lenses?.map(l => l.name);
  const research = guidanceState.prepContext?.research as WorkshopPrepResearch | null | undefined;
  const dims = bpLenses?.length ? bpLenses : getDimensionNames(research);
  const tools = buildFacilitationTools(dims);

  // Build the user message with signals + speech + journey context
  const deliberationBrief = [
    deliberation?.signals ? `SIGNALS & GAPS:\n${deliberation.signals}` : null,
    deliberation?.recentUtterances ? `RECENT PARTICIPANT SPEECH:\n${deliberation.recentUtterances}` : null,
    deliberation?.journeyGaps ? `JOURNEY MAP GAPS:\n${deliberation.journeyGaps}` : null,
    deliberation?.researchHighlights ? `RESEARCH CONTEXT: ${deliberation.researchHighlights}` : null,
    deliberation?.discoveryInsights ? `DISCOVERY INSIGHTS: ${deliberation.discoveryInsights}` : null,
    deliberation?.metricsContext ? `HISTORICAL METRICS:\n${deliberation.metricsContext}` : null,
  ].filter(Boolean).join('\n\n');

  const userContent = deliberationBrief
    ? `Here's what's happening in the room:\n\n${deliberationBrief}\n\nGenerate facilitation questions that follow the conversation's breadcrumbs. Reference specific things participants said. Address any signal gaps.`
    : 'Generate facilitation prompts based on the current beliefs. Call get_recent_speech first to see what participants said.';

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'generate_pads' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        messages,
        tools,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        await onConversation?.({
          timestampMs: Date.now(),
          agent: 'facilitation-agent',
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

        if (fnName === 'generate_pads') {
          const rawPads = Array.isArray(fnArgs.pads) ? fnArgs.pads : [];
          const proposals: PadProposal[] = [];

          for (const raw of rawPads as Array<Record<string, unknown>>) {
            const sourceBeliefIds = Array.isArray(raw.sourceBeliefIds)
              ? raw.sourceBeliefIds.map(String)
              : [];

            const padType = (raw.type as StickyPadType) || 'CLARIFICATION';
            const pad: StickyPad = {
              id: `pad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: padType,
              prompt: String(raw.prompt || ''),
              signalStrength: padType === 'METRIC_CHALLENGE' ? 0.85 : 0.7,
              provenance: {
                triggerType: padType === 'METRIC_CHALLENGE' ? 'metric_contradiction' : 'repeated_theme',
                sourceNodeIds: sourceBeliefIds,
                description: String(raw.reasoning || ''),
                ...(raw.metricEvidence ? { metricEvidence: String(raw.metricEvidence) } : {}),
              },
              createdAtMs: Date.now(),
              status: 'active',
              snoozedUntilMs: null,
              // Question-driven defaults for agent-generated pads
              source: 'agent',
              questionId: null,
              grounding: String(raw.reasoning || ''),
              coveragePercent: 0,
              coverageState: 'active',
              lens: String(raw.lens || raw.type || 'General'),
              mainQuestionIndex: null, // Set by the client when received via SSE
              journeyGapId: raw.journeyGapId ? String(raw.journeyGapId) : null,
              padLabel: raw.padLabel ? String(raw.padLabel) : null,
            };

            proposals.push({
              pad,
              sourceBeliefIds,
              reasoning: String(raw.reasoning || ''),
            });
          }

          await onConversation?.({
            timestampMs: Date.now(),
            agent: 'facilitation-agent',
            to: 'orchestrator',
            message: `I'd like to suggest ${proposals.length} facilitation pad${proposals.length !== 1 ? 's' : ''}: ${proposals.map((p) => `"${p.pad.prompt.substring(0, 80)}..."`).join('; ')}`,
            type: 'proposal',
            metadata: {
              beliefsCited: proposals.reduce((sum, p) => sum + p.sourceBeliefIds.length, 0),
              toolsUsed: ['query_beliefs', 'get_discovery_intelligence'],
            },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"committed"}' });
          return proposals;
        } else {
          const toolResult = executeFacilitationTool(fnName, fnArgs, cogState, guidanceState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }
    }
  } catch (error) {
    console.error('[Facilitation Agent] Failed:', error instanceof Error ? error.message : error);
  }

  return [];
}

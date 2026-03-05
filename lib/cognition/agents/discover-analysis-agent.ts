/**
 * Discover Analysis Agent
 *
 * GPT-4o tool-calling agent that handles the reasoning-intensive parts
 * of the Discover Analysis dashboard:
 *   1. Ranking and elaborating tensions from divergence data
 *   2. Identifying constraint dependency/blocking relationships
 *
 * Same loop pattern as discovery-intelligence-agent.ts.
 */

import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import type {
  TensionEntry,
  TensionSurfaceData,
  ConstraintNode,
  ConstraintRelationship,
} from '@/lib/types/discover-analysis';

const MAX_ITERATIONS = 5;
const LOOP_TIMEOUT_MS = 40_000;
const MODEL = 'gpt-4o';

// ── Types ────────────────────────────────────────────────────

export interface AnalysisAgentInput {
  /** Workshop name for context */
  workshopName: string;
  /** Raw divergence areas from WorkshopIntelligence */
  divergenceAreas: Array<{ topic: string; perspectives: string[] }>;
  /** Watch points from WorkshopIntelligence */
  watchPoints: string[];
  /** Raw sample quotes grouped by theme */
  themeQuotes: Record<string, string[]>;
  /** Base constraint nodes (from compute-constraints) */
  constraintNodes: ConstraintNode[];
  /** Pain points for additional tension context */
  painPoints: Array<{ description: string; domain: string; severity: string }>;
}

export interface AnalysisAgentOutput {
  tensions: TensionSurfaceData;
  constraintRelationships: ConstraintRelationship[];
  /** Updated constraint nodes with dependsOn/blocks populated */
  updatedConstraints: ConstraintNode[];
}

type ProgressCallback = (message: string) => void;

// ── Tools ────────────────────────────────────────────────────

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'rank_tensions',
      description:
        'Rank and elaborate the unresolved tensions in this organisation. For each tension, identify competing viewpoints from different actors, assess severity, and link to related constraints.',
      parameters: {
        type: 'object',
        properties: {
          tensions: {
            type: 'array',
            description: 'Ranked array of tensions, most severe first',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string', description: 'Short descriptive title for this tension' },
                severity: {
                  type: 'string',
                  enum: ['critical', 'significant', 'moderate'],
                  description: 'How severe this tension is for the organisation',
                },
                viewpoints: {
                  type: 'array',
                  description: 'Competing viewpoints from different actors/stakeholders',
                  items: {
                    type: 'object',
                    properties: {
                      actor: { type: 'string', description: 'The stakeholder or actor group' },
                      position: { type: 'string', description: 'Their stance on this topic' },
                      sentiment: {
                        type: 'string',
                        enum: ['positive', 'negative', 'neutral', 'mixed'],
                      },
                      evidenceQuote: { type: 'string', description: 'A representative quote or paraphrase' },
                    },
                    required: ['actor', 'position', 'sentiment', 'evidenceQuote'],
                  },
                },
                affectedActors: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'All actors affected by this tension',
                },
                relatedConstraintIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'IDs of constraints related to this tension',
                },
                domain: { type: 'string', description: 'Primary domain: People, Technology, Customer, Organisation, Regulation, or other' },
              },
              required: ['topic', 'severity', 'viewpoints', 'affectedActors', 'domain'],
            },
          },
        },
        required: ['tensions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'identify_constraint_dependencies',
      description:
        'Identify dependency, blocking, and amplifying relationships between constraints. A depends_on B means A cannot be resolved without addressing B. A blocks B means A prevents progress on B. A amplifies B means A makes B worse.',
      parameters: {
        type: 'object',
        properties: {
          relationships: {
            type: 'array',
            description: 'Relationships between constraints',
            items: {
              type: 'object',
              properties: {
                sourceId: { type: 'string', description: 'ID of the source constraint' },
                targetId: { type: 'string', description: 'ID of the target constraint' },
                type: {
                  type: 'string',
                  enum: ['depends_on', 'blocks', 'amplifies'],
                  description: 'Nature of the relationship',
                },
              },
              required: ['sourceId', 'targetId', 'type'],
            },
          },
        },
        required: ['relationships'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_analysis',
      description: 'Commit the final analysis. Call this after both rank_tensions and identify_constraint_dependencies.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief summary of what was found' },
        },
        required: ['summary'],
      },
    },
  },
];

// ── Agent runner ─────────────────────────────────────────────

export async function runDiscoverAnalysisAgent(
  input: AnalysisAgentInput,
  onProgress?: ProgressCallback,
): Promise<AnalysisAgentOutput> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const startMs = Date.now();

  // State accumulated across tool calls
  let rankedTensions: TensionEntry[] = [];
  let constraintRelationships: ConstraintRelationship[] = [];
  let tensionsDone = false;
  let constraintsDone = false;

  const systemPrompt = buildSystemPrompt(input);
  const userMessage = buildUserMessage(input);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) {
        onProgress?.('Timeout reached — finalising with current results');
        break;
      }

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption =
        isLastIteration ? { type: 'function', function: { name: 'commit_analysis' } } : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (!assistantMessage.tool_calls?.length) break;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }

        if (fnName === 'rank_tensions') {
          onProgress?.('Ranking organisational tensions...');
          const raw = Array.isArray(fnArgs.tensions) ? fnArgs.tensions : [];
          rankedTensions = (raw as Array<Record<string, unknown>>).map((t, i) => ({
            id: `tension-${nanoid(6)}`,
            topic: String(t.topic || 'Unnamed tension'),
            rank: i + 1,
            tensionIndex: 0, // Overridden by deterministic scoring
            severity: validateSeverity(t.severity),
            viewpoints: Array.isArray(t.viewpoints)
              ? (t.viewpoints as Array<Record<string, unknown>>).map((v) => ({
                  actor: String(v.actor || 'Unknown'),
                  position: String(v.position || ''),
                  sentiment: validateSentiment(v.sentiment),
                  evidenceQuote: String(v.evidenceQuote || ''),
                }))
              : [],
            affectedActors: Array.isArray(t.affectedActors) ? t.affectedActors.map(String) : [],
            relatedConstraints: Array.isArray(t.relatedConstraintIds) ? t.relatedConstraintIds.map(String) : [],
            domain: String(t.domain || 'General'),
          }));
          tensionsDone = true;

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed', tensionCount: rankedTensions.length }),
          });
        } else if (fnName === 'identify_constraint_dependencies') {
          onProgress?.('Mapping constraint dependencies...');
          const raw = Array.isArray(fnArgs.relationships) ? fnArgs.relationships : [];
          constraintRelationships = (raw as Array<Record<string, unknown>>)
            .filter((r) => r.sourceId && r.targetId && r.type)
            .map((r) => ({
              source: String(r.sourceId),
              target: String(r.targetId),
              type: validateRelType(r.type),
            }));
          constraintsDone = true;

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed', relationshipCount: constraintRelationships.length }),
          });
        } else if (fnName === 'commit_analysis') {
          onProgress?.(`Analysis complete: ${String(fnArgs.summary || '')}`);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed' }),
          });
          break;
        }
      }

      // If both done, force commit on next iteration
      if (tensionsDone && constraintsDone) {
        // Let one more iteration happen to get commit_analysis
      }
    }
  } catch (error) {
    console.error('[Discover Analysis Agent] Failed:', error instanceof Error ? error.message : error);
    // Return whatever we have so far
  }

  // Apply relationships to constraint nodes
  const updatedConstraints = applyRelationships(input.constraintNodes, constraintRelationships);

  return {
    tensions: { tensions: rankedTensions },
    constraintRelationships,
    updatedConstraints,
  };
}

// ── Prompt building ──────────────────────────────────────────

function buildSystemPrompt(input: AnalysisAgentInput): string {
  return `You are an organisational diagnostics analyst. You surface structural tensions and constraint dependencies within organisations based on stakeholder interview data.

Your task is to analyse the data from workshop "${input.workshopName}" and:

1. **Rank tensions** — Identify the top unresolved tensions in the organisation. For each tension:
   - Identify competing viewpoints from different stakeholders
   - Assess severity (critical/significant/moderate)
   - Link to affected actors and related constraints
   - Base your analysis on actual divergence data and quotes, not assumptions

2. **Map constraint dependencies** — For the given constraints, identify:
   - Which constraints depend on others (cannot be solved without addressing the dependency)
   - Which constraints block others (actively prevent progress)
   - Which constraints amplify others (make them worse)

Start by calling rank_tensions, then identify_constraint_dependencies, then commit_analysis.

Be precise. Use evidence from the provided data. Do not invent viewpoints or quotes — paraphrase from the supplied material only.`;
}

function buildUserMessage(input: AnalysisAgentInput): string {
  const parts: string[] = [];

  // Divergence areas
  if (input.divergenceAreas.length > 0) {
    parts.push('## Divergence Areas');
    for (const d of input.divergenceAreas) {
      parts.push(`\n**${d.topic}**`);
      for (const p of d.perspectives) {
        parts.push(`- ${p}`);
      }
    }
  }

  // Watch points
  if (input.watchPoints.length > 0) {
    parts.push('\n## Watch Points');
    for (const w of input.watchPoints) {
      parts.push(`- ${w}`);
    }
  }

  // Pain points
  if (input.painPoints.length > 0) {
    parts.push('\n## Pain Points');
    for (const p of input.painPoints) {
      parts.push(`- ${p.description} (${p.domain}, ${p.severity})`);
    }
  }

  // Theme quotes
  const quoteEntries = Object.entries(input.themeQuotes);
  if (quoteEntries.length > 0) {
    parts.push('\n## Sample Quotes by Theme');
    for (const [theme, quotes] of quoteEntries.slice(0, 10)) {
      parts.push(`\n**${theme}**`);
      for (const q of quotes.slice(0, 3)) {
        parts.push(`> ${q}`);
      }
    }
  }

  // Constraints
  if (input.constraintNodes.length > 0) {
    parts.push('\n## Constraints (with IDs)');
    for (const c of input.constraintNodes) {
      parts.push(`- [${c.id}] ${c.description} (${c.domain}, ${c.severity}, weight: ${c.weight})`);
    }
  }

  return parts.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────

function validateSeverity(v: unknown): 'critical' | 'significant' | 'moderate' {
  const s = String(v).toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'significant') return 'significant';
  return 'moderate';
}

function validateSentiment(v: unknown): 'positive' | 'negative' | 'neutral' | 'mixed' {
  const s = String(v).toLowerCase();
  if (s === 'positive') return 'positive';
  if (s === 'negative') return 'negative';
  if (s === 'mixed') return 'mixed';
  return 'neutral';
}

function validateRelType(v: unknown): 'depends_on' | 'blocks' | 'amplifies' {
  const s = String(v).toLowerCase();
  if (s === 'blocks') return 'blocks';
  if (s === 'amplifies') return 'amplifies';
  return 'depends_on';
}

function applyRelationships(
  nodes: ConstraintNode[],
  relationships: ConstraintRelationship[],
): ConstraintNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, dependsOn: [...n.dependsOn], blocks: [...n.blocks] }]));

  for (const rel of relationships) {
    const source = nodeMap.get(rel.source);
    const target = nodeMap.get(rel.target);
    if (!source || !target) continue;

    if (rel.type === 'depends_on') {
      if (!source.dependsOn.includes(rel.target)) source.dependsOn.push(rel.target);
    } else if (rel.type === 'blocks') {
      if (!source.blocks.includes(rel.target)) source.blocks.push(rel.target);
    }
    // 'amplifies' is tracked in relationships array only, not on nodes
  }

  return [...nodeMap.values()];
}

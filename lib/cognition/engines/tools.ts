/**
 * Agentic Tool Definitions & Execution Handlers
 *
 * These tools let the DREAM cognitive agent query its own in-memory state.
 * All execution is local (zero network latency). The model decides which
 * tools to call and in what order — this is what makes it agentic.
 */

import type OpenAI from 'openai';
import type { CognitiveState, Domain, BeliefCategory } from '../cognitive-state';
import { semanticSignature, jaccardSimilarity } from '../cognitive-state';

// ══════════════════════════════════════════════════════════════
// TOOL RESULT TYPE
// ══════════════════════════════════════════════════════════════

export type ToolResult = {
  name: string;
  result: string;          // JSON string — becomes the tool message content
  reasoningSummary: string; // Short human-readable line for reasoning panel
};

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS (OpenAI function-calling format)
// ══════════════════════════════════════════════════════════════

export const COGNITIVE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_beliefs',
      description: 'Search existing beliefs by semantic pattern, category, or domain. Use this FIRST to check what you already believe before creating duplicates.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Keywords or phrases to match against belief labels (e.g., "customer experience", "cost reduction")',
          },
          category: {
            type: 'string',
            enum: ['aspiration', 'constraint', 'enabler', 'opportunity', 'risk', 'insight', 'action'],
            description: 'Optional: filter by belief category',
          },
          domain: {
            type: 'string',
            enum: ['People', 'Operations', 'Customer', 'Technology', 'Regulation'],
            description: 'Optional: filter by domain relevance',
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_contradiction',
      description: 'Compare two beliefs for tension or contradiction. Use belief IDs from query_beliefs results.',
      parameters: {
        type: 'object',
        properties: {
          belief_a: {
            type: 'string',
            description: 'First belief ID (e.g., "belief_123_abc") or description',
          },
          belief_b: {
            type: 'string',
            description: 'Second belief ID or description',
          },
        },
        required: ['belief_a', 'belief_b'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_entities',
      description: 'Find tracked entities (concepts, systems, processes, actors, metrics) and their co-occurrence relationships.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Entity name or partial match to search for',
          },
          type: {
            type: 'string',
            enum: ['actor', 'concept', 'system', 'process', 'metric'],
            description: 'Optional: filter by entity type',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_actor_context',
      description: 'Retrieve everything known about a specific actor — their role, mention count, and recorded interactions.',
      parameters: {
        type: 'object',
        properties: {
          actor_name: {
            type: 'string',
            description: 'Name of the actor (e.g., "customer", "operations team", "Sarah")',
          },
        },
        required: ['actor_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_conversation_momentum',
      description: 'Check current conversation dynamics — domain focus, sentiment trajectory, speaker turns, and topic shifts.',
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
      name: 'commit_analysis',
      description: 'TERMINAL ACTION. Call this when you have completed your analysis of the utterance. This ends the reasoning loop.',
      parameters: {
        type: 'object',
        properties: {
          primaryType: {
            type: 'string',
            enum: ['VISIONARY', 'OPPORTUNITY', 'CONSTRAINT', 'RISK', 'ENABLER', 'ACTION', 'QUESTION', 'INSIGHT'],
          },
          semanticMeaning: { type: 'string', description: 'What the speaker means (1-2 sentences)' },
          speakerIntent: { type: 'string', description: 'Why they are saying this' },
          temporalFocus: { type: 'string', enum: ['past', 'present', 'future', 'timeless'] },
          sentimentTone: { type: 'string', enum: ['positive', 'neutral', 'concerned', 'critical'] },
          beliefUpdates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['create', 'reinforce', 'revise', 'weaken'] },
                beliefId: { type: 'string', description: 'Existing belief ID (for reinforce/revise/weaken)' },
                label: { type: 'string' },
                category: { type: 'string', enum: ['aspiration', 'constraint', 'enabler', 'opportunity', 'risk', 'insight', 'action'] },
                primaryType: { type: 'string', enum: ['VISIONARY', 'OPPORTUNITY', 'CONSTRAINT', 'RISK', 'ENABLER', 'ACTION', 'QUESTION', 'INSIGHT'] },
                domains: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      domain: { type: 'string', enum: ['People', 'Operations', 'Customer', 'Technology', 'Regulation'] },
                      relevance: { type: 'number' },
                    },
                    required: ['domain', 'relevance'],
                  },
                },
                confidence: { type: 'number' },
                reasoning: { type: 'string' },
              },
              required: ['action', 'label', 'category', 'primaryType', 'domains', 'confidence', 'reasoning'],
            },
          },
          contradictionUpdates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['detect', 'resolve'] },
                contradictionId: { type: 'string' },
                beliefAId: { type: 'string' },
                beliefBId: { type: 'string' },
                reasoning: { type: 'string' },
                resolution: { type: 'string' },
              },
              required: ['action', 'reasoning'],
            },
          },
          entityUpdates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                normalised: { type: 'string' },
                type: { type: 'string', enum: ['actor', 'concept', 'system', 'process', 'metric'] },
                coOccurring: { type: 'array', items: { type: 'string' } },
              },
              required: ['normalised', 'type', 'coOccurring'],
            },
          },
          actorUpdates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                interactions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      withActor: { type: 'string' },
                      action: { type: 'string' },
                      sentiment: { type: 'string' },
                      context: { type: 'string' },
                    },
                    required: ['withActor', 'action', 'sentiment', 'context'],
                  },
                },
              },
              required: ['name', 'role', 'interactions'],
            },
          },
          domainShift: {
            type: 'object',
            properties: {
              newFocus: { type: 'string', enum: ['People', 'Operations', 'Customer', 'Technology', 'Regulation'] },
              reasoning: { type: 'string' },
            },
            description: 'Set if conversation domain focus has shifted. Omit if no shift.',
          },
          sentimentShift: {
            type: 'object',
            properties: {
              newSentiment: { type: 'string', enum: ['positive', 'neutral', 'concerned', 'critical'] },
              trajectory: { type: 'string', enum: ['improving', 'stable', 'declining'] },
              reasoning: { type: 'string' },
            },
            description: 'Set if sentiment has shifted. Omit if no shift.',
          },
          overallConfidence: { type: 'number', description: '0.0-1.0 confidence in this analysis' },
        },
        required: ['primaryType', 'semanticMeaning', 'speakerIntent', 'temporalFocus', 'sentimentTone', 'beliefUpdates', 'overallConfidence'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION — All run in-process against CognitiveState
// ══════════════════════════════════════════════════════════════

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  state: CognitiveState,
): ToolResult {
  switch (name) {
    case 'query_beliefs':
      return executeQueryBeliefs(args, state);
    case 'check_contradiction':
      return executeCheckContradiction(args, state);
    case 'search_entities':
      return executeSearchEntities(args, state);
    case 'get_actor_context':
      return executeGetActorContext(args, state);
    case 'get_conversation_momentum':
      return executeGetConversationMomentum(state);
    default:
      return {
        name,
        result: JSON.stringify({ error: `Unknown tool: ${name}` }),
        reasoningSummary: `Unknown tool "${name}"`,
      };
  }
}

// ── query_beliefs ───────────────────────────────────────────

function executeQueryBeliefs(
  args: Record<string, unknown>,
  state: CognitiveState,
): ToolResult {
  const pattern = String(args.pattern || '');
  const category = args.category ? String(args.category) as BeliefCategory : null;
  const domain = args.domain ? String(args.domain) as Domain : null;

  const patternSig = semanticSignature(pattern);
  const patternWords = new Set(patternSig.split(' ').filter(Boolean));

  let candidates = Array.from(state.beliefs.values());

  // Filter by category
  if (category) {
    candidates = candidates.filter(b => b.category === category);
  }

  // Filter by domain
  if (domain) {
    candidates = candidates.filter(b =>
      b.domains.some(d => d.domain === domain && d.relevance >= 0.3)
    );
  }

  // Score by semantic similarity to pattern
  const scored = candidates.map(b => {
    const beliefWords = new Set(b.semanticSignature.split(' ').filter(Boolean));
    const similarity = jaccardSimilarity(patternWords, beliefWords);
    // Also check substring match on label for common words
    const labelMatch = b.label.toLowerCase().includes(pattern.toLowerCase()) ? 0.3 : 0;
    return { belief: b, score: similarity + labelMatch };
  });

  // Sort by relevance, take top 5
  const results = scored
    .filter(s => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => ({
      id: s.belief.id,
      label: s.belief.label,
      category: s.belief.category,
      primaryType: s.belief.primaryType,
      domains: s.belief.domains,
      confidence: Math.round(s.belief.confidence * 100) + '%',
      evidenceCount: s.belief.evidenceCount,
      stabilised: s.belief.stabilised,
      relevanceScore: Math.round(s.score * 100) + '%',
    }));

  const summary = results.length > 0
    ? `Queried beliefs for "${pattern}" — found ${results.length} match${results.length === 1 ? '' : 'es'}: ${results.map(r => `"${r.label}" (${r.confidence})`).join(', ')}`
    : `Queried beliefs for "${pattern}" — no matches found`;

  return {
    name: 'query_beliefs',
    result: JSON.stringify({ matches: results, totalBeliefs: state.beliefs.size }),
    reasoningSummary: summary,
  };
}

// ── check_contradiction ─────────────────────────────────────

function executeCheckContradiction(
  args: Record<string, unknown>,
  state: CognitiveState,
): ToolResult {
  const aRef = String(args.belief_a || '');
  const bRef = String(args.belief_b || '');

  // Resolve references — by ID or by fuzzy label match
  const beliefA = resolveBelief(aRef, state);
  const beliefB = resolveBelief(bRef, state);

  if (!beliefA || !beliefB) {
    const missing = !beliefA && !beliefB ? 'both beliefs' : (!beliefA ? `"${aRef}"` : `"${bRef}"`);
    return {
      name: 'check_contradiction',
      result: JSON.stringify({ error: `Could not resolve ${missing}` }),
      reasoningSummary: `Contradiction check failed — could not resolve ${missing}`,
    };
  }

  // Check if contradiction already exists between them
  const existingContradiction = Array.from(state.contradictions.values()).find(
    c => (c.beliefAId === beliefA.id && c.beliefBId === beliefB.id) ||
         (c.beliefAId === beliefB.id && c.beliefBId === beliefA.id)
  );

  // Check for category-based tension
  const tensionCategories: Record<string, string[]> = {
    aspiration: ['constraint', 'risk'],
    opportunity: ['constraint', 'risk'],
    enabler: ['constraint'],
    constraint: ['aspiration', 'opportunity', 'enabler'],
    risk: ['aspiration', 'opportunity'],
  };
  const categoryTension = tensionCategories[beliefA.category]?.includes(beliefB.category) || false;

  // Check for domain overlap
  const aDomains = new Set(beliefA.domains.filter(d => d.relevance >= 0.3).map(d => d.domain));
  const bDomains = new Set(beliefB.domains.filter(d => d.relevance >= 0.3).map(d => d.domain));
  const sharedDomains = Array.from(aDomains).filter(d => bDomains.has(d));

  const result = {
    beliefA: { id: beliefA.id, label: beliefA.label, category: beliefA.category },
    beliefB: { id: beliefB.id, label: beliefB.label, category: beliefB.category },
    existingContradiction: existingContradiction ? {
      id: existingContradiction.id,
      resolved: !!existingContradiction.resolvedAtMs,
      resolution: existingContradiction.resolution,
    } : null,
    categoryTension,
    sharedDomains,
    analysis: categoryTension && sharedDomains.length > 0
      ? 'Potential contradiction: opposing categories in overlapping domains'
      : categoryTension
        ? 'Category tension exists but domains differ — may not be a direct contradiction'
        : 'No obvious structural contradiction — assess semantic content',
  };

  return {
    name: 'check_contradiction',
    result: JSON.stringify(result),
    reasoningSummary: `Checked contradiction: "${beliefA.label}" vs "${beliefB.label}" — ${result.analysis}`,
  };
}

// ── search_entities ─────────────────────────────────────────

function executeSearchEntities(
  args: Record<string, unknown>,
  state: CognitiveState,
): ToolResult {
  const query = String(args.query || '').toLowerCase();
  const typeFilter = args.type ? String(args.type) : null;

  const results = Array.from(state.entities.values())
    .filter(e => {
      const nameMatch = e.normalised.toLowerCase().includes(query);
      const typeMatch = !typeFilter || e.type === typeFilter;
      return nameMatch && typeMatch;
    })
    .slice(0, 10)
    .map(e => ({
      name: e.normalised,
      type: e.type,
      mentionCount: e.mentionCount,
      coOccurring: Array.from(e.coOccurringEntities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    }));

  const summary = results.length > 0
    ? `Searched entities for "${query}" — found ${results.length}: ${results.map(r => `${r.name} (${r.type}, ${r.mentionCount} mentions)`).join(', ')}`
    : `Searched entities for "${query}" — none found`;

  return {
    name: 'search_entities',
    result: JSON.stringify({ entities: results, totalTracked: state.entities.size }),
    reasoningSummary: summary,
  };
}

// ── get_actor_context ───────────────────────────────────────

function executeGetActorContext(
  args: Record<string, unknown>,
  state: CognitiveState,
): ToolResult {
  const name = String(args.actor_name || '').toLowerCase();

  // Fuzzy match on actor names
  const actor = Array.from(state.actors.values()).find(
    a => a.name.toLowerCase().includes(name) || name.includes(a.name.toLowerCase())
  );

  if (!actor) {
    const allActors = Array.from(state.actors.values()).map(a => a.name);
    return {
      name: 'get_actor_context',
      result: JSON.stringify({ error: `Actor "${name}" not found`, knownActors: allActors.slice(0, 10) }),
      reasoningSummary: `Actor "${name}" not found — ${allActors.length} actors known`,
    };
  }

  const result = {
    name: actor.name,
    role: actor.role,
    mentionCount: actor.mentionCount,
    interactions: actor.interactions.slice(-10).map(i => ({
      withActor: i.withActor,
      action: i.action,
      sentiment: i.sentiment,
      context: i.context,
    })),
  };

  return {
    name: 'get_actor_context',
    result: JSON.stringify(result),
    reasoningSummary: `Actor "${actor.name}" — ${actor.role}, ${actor.mentionCount} mentions, ${actor.interactions.length} interactions`,
  };
}

// ── get_conversation_momentum ───────────────────────────────

function executeGetConversationMomentum(state: CognitiveState): ToolResult {
  const m = state.momentum;
  const result = {
    currentDomainFocus: m.currentDomainFocus,
    domainDwellMs: m.domainDwellMs,
    sentimentTrajectory: m.sentimentTrajectory,
    currentSentiment: m.currentSentiment,
    speakerTurns: m.speakerTurns,
    topicShifts: m.topicShifts,
    processedUtterances: state.processedUtteranceCount,
    totalBeliefs: state.beliefs.size,
    stabilisedBeliefs: Array.from(state.beliefs.values()).filter(b => b.stabilised).length,
    activeContradictions: Array.from(state.contradictions.values()).filter(c => !c.resolvedAtMs).length,
  };

  return {
    name: 'get_conversation_momentum',
    result: JSON.stringify(result),
    reasoningSummary: `Momentum: ${m.currentDomainFocus || 'no focus'}, ${m.currentSentiment} (${m.sentimentTrajectory}), ${m.speakerTurns} turns, ${state.beliefs.size} beliefs`,
  };
}

// ── Helpers ─────────────────────────────────────────────────

function resolveBelief(ref: string, state: CognitiveState) {
  // Try direct ID lookup
  const direct = state.beliefs.get(ref);
  if (direct) return direct;

  // Try fuzzy label match
  const refLower = ref.toLowerCase();
  for (const [, belief] of state.beliefs) {
    if (belief.label.toLowerCase().includes(refLower) || refLower.includes(belief.label.toLowerCase())) {
      return belief;
    }
  }

  // Try semantic similarity
  const refSig = semanticSignature(ref);
  const refWords = new Set(refSig.split(' ').filter(Boolean));
  let bestMatch = null;
  let bestScore = 0;

  for (const [, belief] of state.beliefs) {
    const beliefWords = new Set(belief.semanticSignature.split(' ').filter(Boolean));
    const score = jaccardSimilarity(refWords, beliefWords);
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = belief;
    }
  }

  return bestMatch;
}

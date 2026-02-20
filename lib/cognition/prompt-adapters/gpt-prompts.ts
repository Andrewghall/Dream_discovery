/**
 * GPT-Specific Prompt Templates
 *
 * Adapted from the existing workshop-analyst-agent.ts prompts,
 * enhanced to include full cognitive state context.
 *
 * These prompts are specific to GPT-4o-mini/GPT-4o capabilities.
 * Different model adapters (SLM, Claude, etc.) would have different
 * prompt strategies optimised for their strengths.
 */

import type { CognitiveState, Belief, Domain } from '../cognitive-state';
import type { UtteranceInput } from '../reasoning-engine';

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT — The agent's core intelligence
// ══════════════════════════════════════════════════════════════

export function buildSystemPrompt(state: CognitiveState): string {
  const beliefCount = state.beliefs.size;
  const stabilisedCount = Array.from(state.beliefs.values()).filter(b => b.stabilised).length;
  const contradictionCount = Array.from(state.contradictions.values()).filter(c => !c.resolvedAtMs).length;

  return `You are the DREAM cognitive agent — a continuously thinking intelligence analysing a workshop conversation in real-time.

## Your Role
You maintain an evolving understanding of the workshop. You don't analyse utterances in isolation — you carry forward beliefs, track contradictions, and build meaning over time. Your cognitive state IS the workshop output.

## Current State Summary
- Workshop: "${state.workshopGoal}"
- Phase: ${state.currentPhase}
- Beliefs formed: ${beliefCount} (${stabilisedCount} stabilised)
- Active contradictions: ${contradictionCount}
- Utterances processed: ${state.processedUtteranceCount}
- Current domain focus: ${state.momentum.currentDomainFocus || 'none yet'}
- Sentiment: ${state.momentum.currentSentiment} (${state.momentum.sentimentTrajectory})

## Your Capabilities
1. **Belief Management**: Create new beliefs, reinforce existing ones, detect contradictions
2. **Semantic Understanding**: Understand what people MEAN, not just what they say
3. **Context Tracking**: Every analysis builds on your accumulated understanding
4. **Contradiction Detection**: Spot tensions between beliefs and track them
5. **Domain Assignment**: Assign to domains based on meaning, not keywords

## Domains
- People: Human capability, culture, skills, team dynamics, organisational behaviour
- Operations: Processes, workflows, decision-making, governance, coordination
- Customer: Experience, needs, journeys, value delivery, service quality
- Technology: Systems, data, platforms, automation, integration, tools
- Regulation: Compliance, risk management, controls, legal requirements, standards

## Classification (assign exactly ONE primaryType)
- VISIONARY: Aspirational statements about a desired future state
- OPPORTUNITY: Identifying potential improvements or untapped possibilities
- CONSTRAINT: Explicit blockers, limitations, or dependencies
- RISK: Threats, concerns, things that could go wrong
- ENABLER: Things that make progress possible
- ACTION: Specific next steps or commitments
- QUESTION: Direct questions or requests for clarification
- INSIGHT: Observations, reflections, descriptions of current/past state

## Belief Categories
- aspiration: Desired future state, vision, goals
- constraint: Blockers, limits, dependencies, challenges
- enabler: What makes things possible, capabilities, foundations
- opportunity: Potential improvements, chances to create value
- risk: Threats, concerns, vulnerabilities
- insight: Observations, knowledge, understanding
- action: Specific steps, commitments, plans

## Rules
- Describing past experience or how things work = INSIGHT, not CONSTRAINT
- Positive or collaborative statements = INSIGHT or ENABLER, not CONSTRAINT
- Only CONSTRAINT when explicitly blocking/limiting/preventing
- When uncertain, prefer INSIGHT
- ALWAYS explain your reasoning
- Be honest about uncertainties

## Output Format
Return strict JSON matching the CognitiveStateUpdate structure.`;
}

// ══════════════════════════════════════════════════════════════
// USER PROMPT — Per-utterance analysis with full context
// ══════════════════════════════════════════════════════════════

export function buildUtterancePrompt(
  state: CognitiveState,
  utterance: UtteranceInput,
): string {
  // Build beliefs summary (only send top beliefs, not all)
  const beliefsSummary = buildBeliefsSummary(state);
  const contradictionsSummary = buildContradictionsSummary(state);
  const actorsSummary = buildActorsSummary(state);
  const recentReasoning = buildRecentReasoning(state);

  return `## Current Beliefs
${beliefsSummary}

## Active Contradictions
${contradictionsSummary}

## Known Actors
${actorsSummary}

## Recent Agent Reasoning
${recentReasoning}

## New Utterance to Analyse
Speaker: ${utterance.speaker || 'Unknown'}
Text: "${utterance.text}"

## Your Task
Analyse this utterance in context of your accumulated understanding. Return JSON:

{
  "primaryType": "INSIGHT|VISIONARY|OPPORTUNITY|CONSTRAINT|RISK|ENABLER|ACTION|QUESTION",
  "classification": {
    "semanticMeaning": "What the speaker means (1-2 sentences)",
    "speakerIntent": "Why they're saying this (inform, propose, challenge, etc.)",
    "temporalFocus": "past|present|future|timeless",
    "sentimentTone": "positive|neutral|concerned|critical"
  },
  "beliefUpdates": [
    {
      "action": "create|reinforce|weaken",
      "beliefId": "existing_id_if_reinforcing_or_weakening",
      "label": "The belief statement",
      "category": "aspiration|constraint|enabler|opportunity|risk|insight|action",
      "primaryType": "VISIONARY|OPPORTUNITY|CONSTRAINT|RISK|ENABLER|ACTION|QUESTION|INSIGHT",
      "domains": [{"domain": "People|Operations|Customer|Technology|Regulation", "relevance": 0.0-1.0}],
      "confidence": 0.0-1.0,
      "reasoning": "Why this belief update"
    }
  ],
  "contradictionUpdates": [
    {
      "action": "detect|resolve",
      "beliefAId": "id",
      "beliefBId": "id",
      "contradictionId": "id_for_resolve",
      "reasoning": "Why these contradict or how resolved",
      "resolution": "resolution text if resolving"
    }
  ],
  "entityUpdates": [
    {
      "normalised": "entity_name",
      "type": "actor|concept|system|process|metric",
      "coOccurring": ["other_entity"]
    }
  ],
  "actorUpdates": [
    {
      "name": "Actor Name",
      "role": "Their role",
      "interactions": [
        {"withActor": "Other", "action": "does what", "sentiment": "how it feels", "context": "from utterance"}
      ]
    }
  ],
  "domainShift": null or {"newFocus": "Domain", "reasoning": "why"},
  "sentimentShift": null or {"newSentiment": "...", "trajectory": "...", "reasoning": "why"},
  "deliberation": [
    "Step 1: What you heard and what the speaker is really saying",
    "Step 2: How this connects to what you already understand — which existing beliefs does this relate to?",
    "Step 3: What's changing in your understanding — new insight, reinforcement, tension, or shift?",
    "Step 4: What you decided to do and why — what beliefs you're creating/reinforcing/weakening",
    "Step 5: What you're still uncertain about or watching for"
  ],
  "overallConfidence": 0.0-1.0
}

CRITICAL — The "deliberation" array is your THINKING PROCESS shown live to the facilitator. This is the most important field. Think step by step:
1. What is the speaker actually communicating? Read between the lines.
2. Look at your existing beliefs — does this reinforce something you already think? Contradict it? Add nuance?
3. How does this shift your overall understanding of the workshop conversation?
4. Explain your classification and belief decisions — WHY did you choose this primaryType? WHY create/reinforce/weaken?
5. What are you uncertain about? What would you want to hear next to confirm or revise?

Each step should be a complete thought (1-2 sentences). Write as if you're a senior consultant thinking out loud. The facilitator is watching you reason in real-time — show your working, not just your conclusions.

Important:
- Reference existing belief IDs when reinforcing/weakening — don't create duplicates
- Only detect contradictions when beliefs genuinely conflict
- If this utterance doesn't change your beliefs much, say so in your deliberation and explain why`;
}

// ── Helper: Beliefs Summary ─────────────────────────────────

function buildBeliefsSummary(state: CognitiveState): string {
  if (state.beliefs.size === 0) return 'None yet — this is early in the conversation.';

  const beliefs = Array.from(state.beliefs.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Top 20 by confidence

  return beliefs.map((b) => {
    const domains = b.domains.map(d => d.domain).join(', ');
    const status = b.stabilised ? '✓ STABLE' : 'forming';
    return `[${b.id}] "${b.label}" (${b.category}, ${domains}) — confidence: ${(b.confidence * 100).toFixed(0)}%, evidence: ${b.evidenceCount}, ${status}`;
  }).join('\n');
}

// ── Helper: Contradictions Summary ──────────────────────────

function buildContradictionsSummary(state: CognitiveState): string {
  const active = Array.from(state.contradictions.values()).filter(c => !c.resolvedAtMs);
  if (active.length === 0) return 'None detected.';

  return active.map((c) => {
    const a = state.beliefs.get(c.beliefAId);
    const b = state.beliefs.get(c.beliefBId);
    return `[${c.id}] "${a?.label || '?'}" vs "${b?.label || '?'}" — unresolved`;
  }).join('\n');
}

// ── Helper: Actors Summary ──────────────────────────────────

function buildActorsSummary(state: CognitiveState): string {
  if (state.actors.size === 0) return 'None identified yet.';

  return Array.from(state.actors.values())
    .slice(0, 10)
    .map((a) => `${a.name} (${a.role}) — ${a.mentionCount} mentions, ${a.interactions.length} interactions`)
    .join('\n');
}

// ── Helper: Recent Reasoning ────────────────────────────────

function buildRecentReasoning(state: CognitiveState): string {
  const recent = state.reasoningLog.slice(-5);
  if (recent.length === 0) return 'No prior reasoning — first utterance.';

  return recent.map((r) => `${r.icon} ${r.summary}`).join('\n');
}

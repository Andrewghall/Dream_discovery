/**
 * GTM Agent 4: Way Forward
 *
 * The executable path from current GTM reality to target state.
 * Maximum 5 first moves. Every action must be owned and testable.
 *
 * Phase 4 of the GTM/ICP output model.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals } from '../../types';
import type { GtmWayForward } from '../types';

const SCHEMA = `{
  "actionStack": [
    {
      "priority": 1,
      "action": "Specific, concrete action — one sentence. Not a project name — a real instruction.",
      "owner": "Who owns this — role, not just 'leadership' or 'the team'",
      "testableOutcome": "How will we know this has happened? Observable signal within 30-60 days.",
      "linkedConstraint": "Which constraint from Phase 3 does this directly address?"
    }
  ],
  "sequenceMap": [
    {
      "step": 1,
      "action": "What happens at this step",
      "owner": "Who owns it",
      "unlock": "What becomes possible after this step completes",
      "dependency": "What must be true before this step can start"
    }
  ],
  "gtmActivation": [
    {
      "before": "Current behaviour in live deals (specific, observable)",
      "after": "Required behaviour once GTM direction is adopted",
      "expectedSignal": "Observable indicator that the change has happened"
    }
  ],
  "icpEnforcementTool": {
    "pursueCriteria": [
      "Binary pursue criterion — meets this = in. e.g. 'Problem is operational, not political'",
      "e.g. 'Budget authority sits with the person in the room'",
      "e.g. 'We have delivered this type of work before and can reference it'"
    ],
    "rejectCriteria": [
      "Binary reject criterion — meets this = out. e.g. 'Sole criteria is lowest price'",
      "e.g. 'Scope is undefined and client expects us to define it for free'",
      "e.g. 'No internal sponsor with authority'"
    ],
    "exceptionRules": [
      "When is a reject criterion waivable? e.g. 'Strategic account may proceed without reference if board-level sponsor confirmed'"
    ]
  },
  "deliveryFixMap": [
    {
      "promise": "What is being sold or implied in the market today",
      "currentCapability": "What delivery can actually provide today",
      "requiredFix": "What must change in delivery to close the gap",
      "sellOrStop": "sell | stop | fix_first — recommendation"
    }
  ],
  "partnerActionMap": {
    "keep": ["Partner relationships to maintain — why they add value"],
    "fix": ["Partner relationships that need renegotiation — what must change"],
    "remove": ["Partner dependencies to eliminate — why they create more risk than value"]
  },
  "riskShiftMap": [
    {
      "lateStageRisk": "Risk that currently surfaces late (legal, procurement, delivery constraints, budget reality)",
      "earlyStageControl": "How to surface and manage this risk earlier in the deal cycle",
      "owner": "Who owns the early-stage control action"
    }
  ],
  "failurePremortem": [
    {
      "failurePoint": "Where will the way forward stall or be abandoned",
      "whyItWillHappen": "The specific reason — cultural, structural, or commercial",
      "preventionAction": "What must be done NOW to prevent this failure"
    }
  ],
  "successSignals": {
    "thirtyDays": ["Observable signal that GTM direction has started to take hold — 30 days"],
    "sixtyDays": ["Observable signal at 60 days — pipeline quality, deal behaviour, or internal alignment"],
    "ninetyDays": ["Observable signal at 90 days — measurable shift in outcomes"]
  }
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push('=== GTM CONTEXT ===');
  lines.push(`Client / Organisation: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Business Context: ${signals.context.businessContext || 'Not specified'}`);
  lines.push(`Workshop Purpose: ${signals.context.objectives || 'Not specified'}`);

  // Define approach = primary way forward signals
  if (signals.liveSession.defineApproachPads.length > 0) {
    lines.push('\n=== WAY FORWARD SIGNALS (what participants proposed for execution) ===');
    signals.liveSession.defineApproachPads.forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.actor ? ` — ${p.actor}` : ''}`);
    });
  }

  // Constraints reveal what must be fixed
  if (signals.liveSession.constraintPads.length > 0) {
    lines.push('\n=== CONSTRAINT SIGNALS (what must be addressed in the way forward) ===');
    signals.liveSession.constraintPads.slice(0, 30).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  // Reimagine gives the target against which actions are designed
  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== IDEAL STATE SIGNALS (actions must move toward this) ===');
    signals.liveSession.reimaginePads.slice(0, 20).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  if (signals.discovery.insights.length > 0) {
    const enablers = signals.discovery.insights.filter(
      (i) => i.type === 'ENABLER' || i.type === 'OPPORTUNITY'
    );
    if (enablers.length > 0) {
      lines.push('\n=== ENABLER / OPPORTUNITY SIGNALS ===');
      enablers.slice(0, 15).forEach((i) => lines.push(`• ${i.text}`));
    }
  }

  if (signals.discovery.cohortBreakdown?.length) {
    lines.push('\n=== SIGNALS BY COHORT (who needs to change behaviour) ===');
    for (const cohort of signals.discovery.cohortBreakdown) {
      lines.push(`\n${cohort.cohortLabel} (n=${cohort.participantCount})`);
      if (cohort.topFrictions.length)
        lines.push(`  Frictions:\n${cohort.topFrictions.map((f) => `    • ${f}`).join('\n')}`);
      if (cohort.topAspirations.length)
        lines.push(`  Aspirations:\n${cohort.topAspirations.map((a) => `    • ${a}`).join('\n')}`);
    }
  }

  if (signals.scratchpad.v2Output) {
    lines.push('\n=== SCRATCHPAD OUTPUT NOTES ===');
    lines.push(signals.scratchpad.v2Output.slice(0, 1500));
  }

  if (signals.evidenceDocuments?.length) {
    lines.push('\n=== EVIDENCE DOCUMENTS ===');
    for (const doc of signals.evidenceDocuments) {
      lines.push(`\n${doc.fileName} (signal: ${doc.signalDirection})`);
      doc.keyFindings.slice(0, 3).forEach((f) => lines.push(`  • ${f}`));
    }
  }

  return lines.join('\n');
}

export async function runGtmWayForwardAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<GtmWayForward> {
  onProgress?.('GTM Way Forward: defining executable path…');

  const systemPrompt = `You are the DREAM GTM Way Forward Engine — defining the executable path from current GTM reality to the target state.

YOUR JOB: Turn workshop signals into 3-5 specific, owned, testable actions that will move the GTM in the right direction. Not a strategy document — a set of real moves.

CRITICAL RULES:

actionStack (MAXIMUM 5 ACTIONS):
- Each action must be specific enough to assign to a person on Monday morning
- "owner" must be a role — not "the business" or "leadership"
- testableOutcome must be observable in 30-60 days — not "improved performance"
- linkedConstraint must reference a real constraint from the workshop
- If you cannot identify 3 truly distinct, owned, testable actions — name fewer, not more

sequenceMap (3-6 steps):
- Shows what must happen FIRST and what each step UNLOCKS
- "unlock" is the most important field — it shows the dependency chain
- "dependency" names what must be true before this step can start

gtmActivation (3-6 rows):
- Real behavioural changes in live deals — specific, observable
- "before" must describe actual current behaviour (not a straw man)
- "after" must describe specific new behaviour (not a principle)

icpEnforcementTool:
- pursueCriteria: Binary filters — only pursue if ALL met. Should be 4-6 criteria.
- rejectCriteria: Binary filters — reject immediately if ANY met. Should be 4-6 criteria.
- exceptionRules: When are exceptions legitimate? Be honest — some exceptions are valid.

deliveryFixMap (3-5 items):
- Where is the sales-delivery gap creating commercial risk?
- sellOrStop recommendation: sell = current capability is sufficient, stop = stop selling this until delivery is fixed, fix_first = quick fix needed before selling more

riskShiftMap (3-5 items):
- Move risk LEFT in the deal cycle — surface procurement, legal, delivery constraints before they kill the deal late
- earlyStageControl is the specific action that surfaces the risk early

failurePremortem (3-5 items):
- Where will this way forward fail? Name the real failure points honestly.
- whyItWillHappen: structural or cultural reason — not a generic "lack of commitment"
- preventionAction: specific action to prevent this failure NOW

successSignals:
- 30 days: visible early indicator that behaviour has started to shift
- 60 days: measurable signal in pipeline quality, deal velocity, or internal alignment
- 90 days: measurable outcome shift — win rate, average deal size, fewer bad-fit wins

USE ONLY signals provided. Output MUST be valid JSON. No commentary outside JSON.`;

  const userMessage = `${buildSignalDump(signals)}

Return JSON matching this schema exactly:
${SCHEMA}`;

  const apiKey = process.env.OPENAI_API_KEY;
  const openai = apiKey ? new OpenAI({ apiKey }) : null;
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await openAiBreaker.execute(() =>
        openai.chat.completions.create(
          {
            model: 'gpt-4o',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 7000,
          },
          { signal: controller.signal }
        )
      );

      clearTimeout(timeoutId);
      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as GtmWayForward;
      onProgress?.('GTM Way Forward: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('GTM Way Forward agent failed after 3 attempts');
}

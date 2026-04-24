/**
 * GTM Agent 5: Executive View
 *
 * The 10-second board summary. North Star, ICP, 3 truths, 3 blockers,
 * 3 actions. Synthesised from the other 4 agents' outputs.
 *
 * Run last — depends on the other 4 agents completing.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals } from '../../types';
import type {
  GtmRealityMap,
  GtmIdealState,
  GtmConstraints,
  GtmWayForward,
  GtmExecutiveView,
} from '../types';

const SCHEMA = `{
  "headline": "One sentence. The commercial truth this report is built on. Not motivational — honest. e.g. 'This business wins when it sells the right thing to the right buyer — and loses when it doesn't.'",
  "northStar": "One sentence. The GTM direction. Specific. Not a vision statement — a commercial direction.",
  "icpOneLiner": "One sentence describing who this business is for and who it is not for. e.g. 'Mid-market operations leaders in regulated industries with a digital execution problem — not large enterprise procurement-led bids.'",
  "threeTruths": [
    "The most important commercial truth from today's reality — specific, not generic",
    "The second most important truth — from a different lens than the first",
    "The third most important truth — could be about delivery, capability, or behaviour"
  ],
  "threeBlockers": [
    "The most critical structural blocker — what prevents GTM improvement most",
    "The second blocker — from a different domain than the first",
    "The third blocker — often a commercial or behavioural constraint"
  ],
  "threeActions": [
    "The first and most important action — what happens on Monday. Specific, owned.",
    "The second action — what unlocks the next step",
    "The third action — what prevents the first two from failing"
  ]
}`;

function buildExecutiveSummaryInput(
  signals: WorkshopSignals,
  realityMap: GtmRealityMap,
  idealState: GtmIdealState,
  constraints: GtmConstraints,
  wayForward: GtmWayForward
): string {
  const lines: string[] = [];

  lines.push('=== CONTEXT ===');
  lines.push(`Client: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Workshop: ${signals.context.workshopName || 'GTM Workshop'}`);

  lines.push('\n=== REALITY SUMMARY ===');
  lines.push(realityMap.realitySummary || 'Not available');

  lines.push('\n=== NORTH STAR ===');
  lines.push(idealState.northStar || 'Not available');

  lines.push('\n=== ICP (WE ARE FOR) ===');
  lines.push(`Problem fit: ${idealState.icpDefinition.weAreFor.problemFit}`);
  lines.push(`Buyer fit: ${idealState.icpDefinition.weAreFor.buyerFit}`);
  lines.push(`NOT for: ${idealState.icpDefinition.weAreNotFor.wrongBuyer}`);

  lines.push('\n=== TOP TRUTH STATEMENTS ===');
  const topTruths = realityMap.truthStatements
    .filter((t) => t.significance === 'high')
    .slice(0, 5);
  topTruths.forEach((t) => lines.push(`• [${t.lens}] ${t.text}`));

  lines.push('\n=== CORE PATTERNS ===');
  lines.push(`Win: ${realityMap.corePatterns.whereWeWinAndWhy}`);
  lines.push(`Lose: ${realityMap.corePatterns.whereWeLoseAndWhy}`);
  lines.push(`Inconsistent: ${realityMap.corePatterns.whereWeAreInconsistent}`);

  lines.push('\n=== CONSTRAINT SUMMARY ===');
  lines.push(constraints.constraintSummary || 'Not available');

  lines.push('\n=== CRITICAL BLOCKERS ===');
  const criticalBlockers = constraints.constraintStack
    .flatMap((cs) => cs.blockers.filter((b) => b.severity === 'critical'))
    .slice(0, 5);
  criticalBlockers.forEach((b) => lines.push(`• ${b.title}: ${b.description}`));

  lines.push('\n=== TOP TRADE-OFFS ===');
  constraints.tradeOffMap.slice(0, 3).forEach((t) =>
    lines.push(`• Stop: ${t.lose} → Cost: ${t.commercialConsequence}`)
  );

  lines.push('\n=== ACTION STACK ===');
  wayForward.actionStack.slice(0, 5).forEach((a) =>
    lines.push(`• P${a.priority}: ${a.action} [Owner: ${a.owner}]`)
  );

  lines.push('\n=== SUCCESS SIGNALS (90 days) ===');
  wayForward.successSignals.ninetyDays?.forEach((s) => lines.push(`• ${s}`));

  return lines.join('\n');
}

export async function runGtmExecutiveAgent(
  signals: WorkshopSignals,
  realityMap: GtmRealityMap,
  idealState: GtmIdealState,
  constraints: GtmConstraints,
  wayForward: GtmWayForward,
  onProgress?: (msg: string) => void
): Promise<GtmExecutiveView> {
  onProgress?.('GTM Executive View: synthesising board summary…');

  const systemPrompt = `You are the DREAM GTM Executive Synthesiser — condensing the full GTM analysis into a 10-second executive view.

YOUR JOB: A CEO or board member must be able to read this and immediately understand: what is the commercial problem, what is the direction, and what are the three moves.

CRITICAL RULES:

headline: The single most important commercial truth from this workshop. Not a summary — a judgement. Write it as if you are presenting to the board.

northStar: The GTM direction. Must be specific to this client. Not "deliver value" — a clear commercial direction that anyone could use to make a decision about a deal.

icpOneLiner: Capture both sides — who you're for AND who you're not for — in one sentence.

threeTruths:
- The most important commercial truths from the reality map
- Each must be from a different domain (e.g. commercial, delivery, buyer)
- These should surprise the reader slightly — not just repeat what everyone knows

threeBlockers:
- The three structural blockers that must be removed for the GTM to change
- From the constraints analysis — select the three with the highest commercial consequence
- Must be genuinely different from each other

threeActions:
- Distilled from the action stack — the three that matter most
- First action = most urgent, most clear, most owned
- Second = unlocks the most
- Third = prevents failure

USE ONLY the provided analysis. Output MUST be valid JSON. No commentary outside JSON.`;

  const userMessage = `${buildExecutiveSummaryInput(signals, realityMap, idealState, constraints, wayForward)}

Return JSON matching this schema exactly:
${SCHEMA}`;

  const apiKey = process.env.OPENAI_API_KEY;
  const openai = apiKey ? new OpenAI({ apiKey }) : null;
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
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
            max_tokens: 2000,
          },
          { signal: controller.signal }
        )
      );

      clearTimeout(timeoutId);
      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as GtmExecutiveView;
      onProgress?.('GTM Executive View: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('GTM Executive agent failed after 3 attempts');
}

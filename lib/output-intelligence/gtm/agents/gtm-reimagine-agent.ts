/**
 * GTM Agent 2: Ideal State
 *
 * Defines what winning properly looks like — North Star, explicit ICP,
 * proposition, target segments, clean GTM path, partner model.
 *
 * Phase 2 of the GTM/ICP output model.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals } from '../../types';
import type { GtmIdealState } from '../types';

const SCHEMA = `{
  "northStar": "One sentence. What does winning properly look like for this business? Make it specific to this client — not a generic mission statement. e.g. 'Win mid-complexity AI integration work with operations-led buyers in regulated industries, delivered repeatably at margin.'",
  "endPoint": {
    "desiredBusinessEndState": "What is the business end state this GTM system is serving? Be specific — growth to X, exit readiness, market leadership in Y.",
    "growthOrExitLogic": "What is the underlying logic — grow revenue, improve margin, build acquirability, expand into a new segment?",
    "valueCreationLogic": "Where does the real value get created — IP, relationships, recurring revenue, capability?",
    "whatMustBeTrueCommercially": "What must be true commercially for this end state to be reached? e.g. 'Win rate above 40% on qualifying work, average deal size £150k+, delivery margin above 35%'"
  },
  "icpDefinition": {
    "weAreFor": {
      "problemFit": "The type of problem we solve better than anyone — specific, not generic",
      "environmentFit": "The organisational environment where we thrive — size, complexity, readiness, culture",
      "buyerFit": "Who buys us — role, decision style, what they care about, how they buy",
      "deliveryFit": "The conditions under which we deliver well — engagement model, timeframe, access",
      "behaviourFit": "How the right buyer behaves — they engage properly, they have budget authority, they want partnership not just delivery"
    },
    "weAreNotFor": {
      "wrongProblem": "The type of problem we should not be trying to solve — outside our actual capability",
      "wrongBuyer": "The buyer type that consistently leads to poor outcomes — procurement-led, perpetually uncommitted, etc.",
      "wrongDeliveryConditions": "The conditions that break our delivery — poorly scoped, politically complex, underfunded",
      "wrongCommercialBehaviour": "The commercial patterns that erode margin or create bad work — excessive discounting, scope creep tolerance, bad-fit pipeline accepted"
    }
  },
  "targetSegments": [
    {
      "segmentName": "Clear, specific segment name — not a broad category",
      "problemType": "The specific problem type this segment needs solved",
      "buyerType": "Who buys in this segment — role, seniority, decision context",
      "triggerEvent": "What event or condition makes this segment receptive — e.g. 'Post-merger integration', 'Regulatory deadline', 'New CTO hire'",
      "whyWeWin": "Why we specifically win in this segment — not generic differentiation"
    }
  ],
  "propositionCard": {
    "weHelp": "Who we help — one specific buyer description",
    "solve": "What specific problem we solve — direct, concrete",
    "by": "How we solve it — our specific approach or capability",
    "soThat": "The business outcome the buyer gets — not a feature, a result"
  },
  "cleanGtmPath": {
    "stages": [
      {
        "stage": "Target | Engage | Shape | Prove | Close | Deliver | Expand",
        "trustBuildPoints": ["What builds buyer confidence at this stage"],
        "decisionPoints": ["What decisions happen at this stage — by buyer and by us"],
        "proofPoints": ["What evidence, demonstration or social proof matters at this stage"]
      }
    ]
  },
  "sellableDeliverableOverlap": {
    "sellableOnly": ["Things we can sell but cannot reliably deliver — stop selling these or fix delivery first"],
    "deliverableOnly": ["Things we deliver well but don't sell — under-marketed capability"],
    "sellableAndDeliverable": ["The sweet spot — what we can confidently sell AND deliver to margin"]
  },
  "partnerOwnershipModel": {
    "owned": ["Capabilities we own end-to-end — no dependency risk"],
    "shared": ["Capabilities delivered with partners — define the clean handoff"],
    "dependent": ["Capabilities we rely on partners for — where dependency creates risk"]
  }
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push('=== GTM CONTEXT ===');
  lines.push(`Client / Organisation: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Business Context: ${signals.context.businessContext || 'Not specified'}`);
  lines.push(`Workshop Purpose: ${signals.context.objectives || 'Not specified'}`);

  // Reimagine pads = the ideal state signals
  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push('\n=== IDEAL STATE SIGNALS (what participants envision) ===');
    signals.liveSession.reimaginePads.forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.actor ? ` — ${p.actor}` : ''}`);
    });
  }

  // Define approach = what good GTM looks like
  if (signals.liveSession.defineApproachPads.length > 0) {
    lines.push('\n=== TARGET STATE SIGNALS (define approach / way forward) ===');
    signals.liveSession.defineApproachPads.forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.actor ? ` — ${p.actor}` : ''}`);
    });
  }

  // Discovery pads give the reality context to contrast with
  const discoveryPads = signals.liveSession.discoveryPads ?? [];
  if (discoveryPads.length > 0) {
    lines.push('\n=== CURRENT REALITY CONTEXT (needed to define the delta) ===');
    discoveryPads.slice(0, 30).forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}`);
    });
  }

  if (signals.discovery.insights.length > 0) {
    const enablers = signals.discovery.insights.filter(
      (i) => i.type === 'ENABLER' || i.type === 'OPPORTUNITY' || i.type === 'VISION'
    );
    if (enablers.length > 0) {
      lines.push('\n=== OPPORTUNITY / ENABLER SIGNALS ===');
      enablers.slice(0, 20).forEach((i) => lines.push(`• ${i.text}`));
    }
  }

  if (signals.scratchpad.reimagineContent) {
    lines.push('\n=== SCRATCHPAD REIMAGINE NOTES ===');
    lines.push(signals.scratchpad.reimagineContent.slice(0, 2000));
  }

  if (signals.scratchpad.potentialSolution) {
    lines.push('\n=== SCRATCHPAD SOLUTION DIRECTION ===');
    lines.push(signals.scratchpad.potentialSolution.slice(0, 1000));
  }

  if (signals.evidenceDocuments?.length) {
    lines.push('\n=== EVIDENCE DOCUMENTS ===');
    for (const doc of signals.evidenceDocuments) {
      lines.push(`\n${doc.fileName} (signal: ${doc.signalDirection})`);
      lines.push(`Summary: ${doc.summary}`);
      doc.keyFindings.slice(0, 4).forEach((f) => lines.push(`  • ${f}`));
    }
  }

  return lines.join('\n');
}

export async function runGtmIdealStateAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<GtmIdealState> {
  onProgress?.('GTM Ideal State: defining North Star and ICP…');

  const systemPrompt = `You are the DREAM GTM Ideal State Engine — defining what winning properly looks like for this business.

YOUR JOB: Turn workshop signals into a precise, actionable GTM target state. Not aspirational language — specific commercial decisions.

CRITICAL RULES:

northStar: One sentence. Specific to this client. Names the right work type, buyer, and context. Not "be the best partner" — something like "Win mid-complexity AI integration work with operations-led buyers in regulated industries, delivered repeatably at margin."

icpDefinition:
- weAreFor must be specific enough to use as a qualification filter in a real deal
- weAreNotFor is as important as weAreFor — this is what stops bad pipeline
- If you cannot name specific wrong buyers or wrong conditions from the signals, say so honestly

targetSegments (2-4 segments):
- Real clusters — not generic industry categories
- Use triggerEvent to make segments actionable (what makes them receptive NOW)
- whyWeWin must be specific to this business's capability, not generic differentiation

propositionCard:
- Follow the "we help / solve / by / so that" template exactly
- The output (soThat) must be a business result — not a feature or a deliverable

cleanGtmPath:
- 6-7 stages matching typical deal motion in this sector
- Each stage must have real trust-build, decision, and proof events — not placeholders

sellableDeliverableOverlap:
- sellableOnly = where the business has been overselling (difficult to say but important to name)
- deliverableOnly = under-marketed capability (often a quick win)
- sellableAndDeliverable = the actual sweet spot — this informs ICP and proposition

partnerOwnershipModel:
- owned / shared / dependent structure forces honest capability audit
- "dependent" = risk — surface it even if uncomfortable

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
            max_tokens: 6000,
          },
          { signal: controller.signal }
        )
      );

      clearTimeout(timeoutId);
      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as GtmIdealState;
      onProgress?.('GTM Ideal State: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('GTM Ideal State agent failed after 3 attempts');
}

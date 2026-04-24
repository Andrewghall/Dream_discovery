/**
 * GTM Agent 1: Reality Map
 *
 * Synthesises the commercial truth of today — what is actually happening
 * in how the business wins, loses, sells, delivers, and behaves.
 *
 * Phase 1 of the GTM/ICP output model.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals } from '../../types';
import type { GtmRealityMap } from '../types';

const SCHEMA = `{
  "realitySummary": "1-2 paragraph synthesis. Not a list — a direct, honest diagnosis of commercial reality today. Name what is true, even if uncomfortable.",
  "truthStatements": [
    {
      "text": "A single, standalone truth statement. Direct. Specific. Observable. Not an opinion.",
      "lens": "People | Commercial | Operations | Technology | Partners | Risk/Compliance",
      "significance": "high | medium | low"
    }
  ],
  "winLossPatterns": [
    {
      "pattern": "Name the pattern clearly (e.g. 'We win mid-complexity technology services')",
      "wins": "What is consistently true when we win this type of work",
      "losses": "What is consistently true when we lose",
      "shouldNotWin": "Optional — where we win but shouldn't (poor-fit wins)"
    }
  ],
  "dealFlowReality": {
    "stages": [
      {
        "stage": "Engage | Shape | Close | Deliver (or client-specific stage names)",
        "stallPoints": ["Where does this stage slow or stall"],
        "trustDropPoints": ["Where does buyer trust drop at this stage"],
        "reshapingPoints": ["Where does the deal get reshaped — scope, price, delivery"]
      }
    ],
    "summary": "1-2 sentences on the dominant deal flow failure pattern"
  },
  "deliveryContradictions": [
    {
      "sold": "What was promised or implied in the sale",
      "delivered": "What delivery actually provides",
      "gap": "The specific gap between the two",
      "impact": "Commercial or relationship consequence of this gap"
    }
  ],
  "implicitIcpPatterns": [
    "Pattern observed in wins: e.g. 'Mid-sized companies in regulated industries with a digital backlog'",
    "Pattern observed in losses: e.g. 'Large enterprises seeking lowest-cost vendor'"
  ],
  "propositionReality": "What do buyers actually think this business does? Where is the story inconsistent? Where does trust drop in live deals?",
  "commercialReality": "What are buyers actually paying for? Where does pricing weaken deals? Where is the business stretching to win?",
  "gtmMotionReality": "How do deals actually start, progress, and fail? What behaviours drive pipeline in practice?",
  "partnerReality": "Where do partners strengthen credibility? Where do they create risk or dependency? What is borrowed vs owned?",
  "technologyCapabilityReality": "What can be proven vs what is claimed? Where is capability overstated?",
  "corePatterns": {
    "whereWeWinAndWhy": "The essential pattern behind consistent wins — specific, not generic",
    "whereWeLoseAndWhy": "The essential pattern behind consistent losses — honest, direct",
    "whereWeAreInconsistent": "Where results vary and why — what creates inconsistency in outcomes"
  }
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push('=== GTM CONTEXT ===');
  lines.push(`Client / Organisation: ${signals.context.clientName || 'Not specified'}`);
  lines.push(`Industry: ${signals.context.industry || 'Not specified'}`);
  lines.push(`Business Context: ${signals.context.businessContext || 'Not specified'}`);
  lines.push(`Workshop Purpose: ${signals.context.objectives || 'Not specified'}`);

  // Discovery signals = current reality
  const discoveryPads = signals.liveSession.discoveryPads ?? [];
  if (discoveryPads.length > 0) {
    lines.push('\n=== REALITY SIGNALS (what participants said about today) ===');
    discoveryPads.forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.actor ? ` — ${p.actor}` : ''}`);
    });
  }

  // Constraint pads often contain reality admissions too
  if (signals.liveSession.constraintPads.length > 0) {
    lines.push('\n=== CONSTRAINT SIGNALS (blockers named — also reveals reality) ===');
    signals.liveSession.constraintPads.forEach((p) => {
      lines.push(`• ${p.text}${p.lens ? ` [${p.lens}]` : ''}${p.actor ? ` — ${p.actor}` : ''}`);
    });
  }

  if (signals.discovery.themes.length > 0) {
    lines.push('\n=== DISCOVERY THEMES ===');
    signals.discovery.themes.forEach((t) => lines.push(`• ${t}`));
  }

  if (signals.discovery.tensions.length > 0) {
    lines.push('\n=== TENSIONS ===');
    signals.discovery.tensions.forEach((t) => {
      lines.push(`• [${t.severity ?? 'unknown'}] ${t.topic}: ${t.perspectives.join(' | ')}`);
    });
  }

  if (signals.discovery.insights.length > 0) {
    const challenges = signals.discovery.insights.filter(
      (i) => i.type === 'CHALLENGE' || i.type === 'CONSTRAINT'
    );
    if (challenges.length > 0) {
      lines.push('\n=== CHALLENGES / CONSTRAINTS FROM PARTICIPANTS ===');
      challenges.slice(0, 25).forEach((i) => lines.push(`• ${i.text}`));
    }
  }

  if (signals.discovery.cohortBreakdown?.length) {
    lines.push('\n=== SIGNALS BY COHORT ===');
    for (const cohort of signals.discovery.cohortBreakdown) {
      lines.push(`\n${cohort.cohortLabel} (n=${cohort.participantCount})`);
      if (cohort.topFrictions.length)
        lines.push(`  Top frictions:\n${cohort.topFrictions.map((f) => `    • ${f}`).join('\n')}`);
    }
  }

  if (signals.scratchpad.discoveryOutput) {
    lines.push('\n=== SCRATCHPAD DISCOVERY NOTES ===');
    lines.push(signals.scratchpad.discoveryOutput.slice(0, 2000));
  }

  if (signals.evidenceDocuments?.length) {
    lines.push('\n=== EVIDENCE DOCUMENTS ===');
    for (const doc of signals.evidenceDocuments) {
      lines.push(`\n${doc.fileName} (signal: ${doc.signalDirection})`);
      lines.push(`Summary: ${doc.summary}`);
      doc.keyFindings.slice(0, 5).forEach((f) => lines.push(`  • ${f}`));
    }
  }

  return lines.join('\n');
}

export async function runGtmRealityAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<GtmRealityMap> {
  onProgress?.('GTM Reality: analysing commercial truth today…');

  const systemPrompt = `You are the DREAM GTM Reality Engine — exposing the commercial truth of how this business actually wins, loses, sells, and delivers today.

YOUR JOB: Surface the reality, not the aspiration. What is actually true about how this business competes? Not the pitch — the facts.

CRITICAL RULES:

realitySummary: Write a direct diagnosis. Not a neutral summary — a clear view of commercial reality. Name patterns, not platitudes.

truthStatements (10-20 items):
- Each is a standalone, observable truth
- NOT opinions or recommendations — facts that can be seen in the data
- Assign the right lens: People, Commercial, Operations, Technology, Partners, Risk/Compliance
- Mark significance honestly: high = fundamental to GTM performance, medium = material but not structural, low = relevant but secondary

winLossPatterns (3-6 patterns):
- Name real patterns — specific types of work, buyer behaviour, deal contexts
- wins/losses must be specific to what actually differentiates outcomes
- shouldNotWin = work being won that creates delivery risk or margin erosion

dealFlowReality:
- Map the actual deal journey stages (use signals to infer if not explicit)
- stallPoints = where velocity slows
- trustDropPoints = where buyer confidence drops
- reshapingPoints = where scope, price, or delivery model gets compromised

deliveryContradictions (3-8 items):
- These are the gaps between what is sold and what is delivered
- They are the root cause of reference failures, poor renewals, and reputation risk
- Be specific — generic statements are useless

implicitIcpPatterns (4-8 items):
- What the win patterns reveal about who this business is actually for (even if never stated explicitly)
- Also include patterns in who the business loses to and why

corePatterns: Be direct. Name the essential truth in 1-2 sentences for each.

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
      const parsed = JSON.parse(raw) as GtmRealityMap;
      onProgress?.('GTM Reality: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('GTM Reality agent failed after 3 attempts');
}

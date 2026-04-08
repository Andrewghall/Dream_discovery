/**
 * Engine 1: Discovery Validation Agent
 *
 * Compares pre-workshop discovery signals against live workshop findings
 * to determine hypothesis accuracy, confirmed issues, new issues, and
 * issues that were not supported by workshop evidence.
 */

import OpenAI from 'openai';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { WorkshopSignals, DiscoveryValidation } from '../types';
// OpenAI client constructed lazily inside runDiscoveryValidationAgent() — never at module load.

const SCHEMA = `{
  "confirmedIssues": [
    {
      "issue": "string — the issue identified in discovery",
      "discoverySignal": "string — what the discovery phase surfaced",
      "workshopEvidence": "string — how the workshop confirmed it",
      "confidence": "high | medium | low"
    }
  ],
  "newIssues": [
    {
      "issue": "string — new issue surfaced only in the workshop",
      "workshopEvidence": "string — specific evidence from workshop pads or signals",
      "significance": "string — why this matters for the organisation"
    }
  ],
  "reducedIssues": [
    {
      "issue": "string — a discovery issue NOT well-supported by workshop",
      "reason": "string — why the workshop evidence was weak or contradictory"
    }
  ],
  "hypothesisAccuracy": <number 0-100 — derive from evidence, do NOT copy example values>,
  "summary": "string — 2-3 paragraph synthesis of discovery vs workshop alignment"
}`;

function buildSignalDump(signals: WorkshopSignals): string {
  const lines: string[] = [];

  lines.push('=== DISCOVERY SIGNALS ===');
  if (signals.discovery.themes.length > 0) {
    lines.push(`Themes identified pre-workshop:\n${signals.discovery.themes.map((t) => `• ${t}`).join('\n')}`);
  }
  if (signals.discovery.tensions.length > 0) {
    lines.push(`\nTensions surfaced:\n${signals.discovery.tensions.map((t) => `• ${t.topic} (${t.severity ?? 'unknown'}): ${t.perspectives.join(' vs ')}`).join('\n')}`);
  }
  if (signals.discovery.constraints.length > 0) {
    lines.push(`\nConstraints identified:\n${signals.discovery.constraints.map((c) => `• ${c.title}${c.description ? ': ' + c.description : ''}`).join('\n')}`);
  }
  if (signals.discovery.alignment !== null) {
    lines.push(`\nParticipant alignment score: ${signals.discovery.alignment}/100`);
  }
  if (signals.discovery.insights.length > 0) {
    const sample = signals.discovery.insights.slice(0, 30);
    lines.push(`\nParticipant insights (sample):\n${sample.map((i) => `• [${i.type}] ${i.text}`).join('\n')}`);
  }

  lines.push('\n=== WORKSHOP SIGNALS ===');
  if (signals.liveSession.reimaginePads.length > 0) {
    lines.push(`Reimagine pads:\n${signals.liveSession.reimaginePads.slice(0, 20).map((p) => `• ${p.text}`).join('\n')}`);
  }
  if (signals.liveSession.constraintPads.length > 0) {
    lines.push(`\nConstraint pads:\n${signals.liveSession.constraintPads.slice(0, 20).map((p) => `• ${p.text}`).join('\n')}`);
  }
  if (signals.liveSession.defineApproachPads.length > 0) {
    lines.push(`\nDefine approach pads:\n${signals.liveSession.defineApproachPads.slice(0, 20).map((p) => `• ${p.text}`).join('\n')}`);
  }

  // NOTE: scratchpad exec summary intentionally excluded — it is a prior LLM
  // output, not raw evidence. Including it creates a summary-of-summary path
  // where GPT output reinforces GPT output rather than raw participant signals.

  if (signals.discovery.cohortBreakdown?.length) {
    lines.push('\n=== SIGNALS BY PARTICIPANT COHORT ===');
    for (const cohort of signals.discovery.cohortBreakdown) {
      lines.push(`\n${cohort.cohortLabel} (n=${cohort.participantCount}, roles: ${cohort.roles.slice(0, 3).join(', ')})`);
      lines.push(`  Aspiration ratio: ${Math.round(cohort.aspirationRatio * 100)}%`);
      if (cohort.topFrictions.length)
        lines.push(`  Top frictions:\n${cohort.topFrictions.map((f) => `    • ${f}`).join('\n')}`);
      if (cohort.topAspirations.length)
        lines.push(`  Top aspirations:\n${cohort.topAspirations.map((a) => `    • ${a}`).join('\n')}`);
    }
    lines.push('\nUse cohort divergence to identify where different role groups hold conflicting views on the same issues.');
  }

  if (signals.historicalMemory?.chunks.length) {
    lines.push('\n=== CROSS-WORKSHOP HISTORICAL MEMORY ===');
    lines.push('Relevant findings from past workshops in this organisation:');
    for (const c of signals.historicalMemory.chunks) {
      lines.push(`• [${c.source}, ${c.similarity.toFixed(2)}] ${c.text}`);
    }
    lines.push('(Supporting context only — not from this workshop)');
  }

  if (signals.evidenceDocuments?.length) {
    lines.push('\n=== UPLOADED EVIDENCE DOCUMENTS ===');
    lines.push('Documentary evidence uploaded and validated for this workshop:');
    for (const doc of signals.evidenceDocuments) {
      lines.push(`\nDocument: ${doc.fileName} (signal direction: ${doc.signalDirection}, confidence: ${Math.round(doc.confidence * 100)}%)`);
      lines.push(`Summary: ${doc.summary}`);
      if (doc.keyFindings.length > 0) {
        lines.push(`Key findings:\n${doc.keyFindings.map(f => `  • ${f}`).join('\n')}`);
      }
    }
    lines.push('\nUse these documents to corroborate or challenge the discovery hypothesis. Where documentary evidence confirms workshop signals, increase confidence. Where it contradicts, flag in reducedIssues with the discrepancy noted.');
  }

  if (signals.evidenceValidation) {
    const ev = signals.evidenceValidation;
    lines.push('\n=== EVIDENCE VALIDATION VERDICT ===');
    lines.push('Cross-validation of uploaded documentary evidence against workshop discovery:');

    if (ev.corroborated.length > 0) {
      lines.push(`\nCORROBORATED BY DATA (${ev.corroborated.length} findings confirmed):`);
      ev.corroborated.slice(0, 8).forEach(f => lines.push(`  ✓ ${f}`));
    }

    if (ev.contradicted.length > 0) {
      lines.push(`\nCONFIRMED CONTRADICTIONS (2+ independent sources — treat with high weight):`);
      ev.contradicted.slice(0, 5).forEach(f => lines.push(`  ✗ ${f}`));
    }

    if (ev.perceptionGaps.length > 0) {
      lines.push(`\nPERCEPTION GAPS (participants believed X but data shows Y — organisational blind spots):`);
      ev.perceptionGaps.slice(0, 5).forEach(f => lines.push(`  ⚠ ${f}`));
    }

    if (ev.blindSpots.length > 0) {
      lines.push(`\nDATA BLIND SPOTS (significant findings in data not raised by any participant):`);
      ev.blindSpots.slice(0, 5).forEach(f => lines.push(`  ● ${f}`));
    }

    const uncoveredLenses = ev.lensGaps.filter(l => !l.covered).map(l => l.lens);
    if (uncoveredLenses.length > 0) {
      lines.push(`\nLENS COVERAGE GAPS (no empirical evidence for these lenses): ${uncoveredLenses.join(', ')}`);
      lines.push('Findings in these lenses rest on participant testimony alone — flag where relevant.');
    }

    if (ev.conclusionImpact) {
      lines.push(`\nOVERALL VERDICT: ${ev.conclusionImpact}`);
    }
  }

  return lines.join('\n');
}

export async function runDiscoveryValidationAgent(
  signals: WorkshopSignals,
  onProgress?: (msg: string) => void
): Promise<DiscoveryValidation> {
  onProgress?.('Discovery Validation: analysing hypothesis accuracy…');

  const systemPrompt = `You are the DREAM PERCEPTION Signal engine — scanning how this organisation currently sees itself and its environment. Compare discovery hypothesis signals against workshop evidence. Reveal operational friction, capability maturity, actor misalignment, and where the organisation's self-perception diverges from reality. Every output must be grounded in specific workshop evidence.

Workshop Context:
- Client: ${signals.context.clientName || 'Not specified'}
- Industry: ${signals.context.industry || 'Not specified'}
- Lenses: ${signals.context.lenses.join(', ')}
- Participants: ${signals.discovery.participantCount}

Rules:
• Use ONLY the signals provided — never invent evidence
• If evidence is weak or incomplete, state that explicitly
• hypothesisAccuracy (0-100) reflects how well workshop findings matched discovery hypothesis
• If no discovery signals exist, return a low hypothesisAccuracy with explanation
• If you cannot determine hypothesis accuracy from available signals, set hypothesisAccuracy to null
• Where evidenceValidation is provided: corroborated findings should have higher confidence; contradicted findings and perceptionGaps should be reflected in reducedIssues or noted in summary; blindSpots should appear as newIssues if operationally significant
• Output MUST be valid JSON matching the schema exactly — no commentary outside the JSON`;

  const userMessage = `${buildSignalDump(signals)}

Return JSON matching this schema exactly:
${SCHEMA}`;

  const apiKey = process.env.OPENAI_API_KEY;
  const openai = apiKey ? new OpenAI({ apiKey }) : null;
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100_000);
    try {
      const response = await openAiBreaker.execute(() => openai.chat.completions.create(
        {
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        },
        { signal: controller.signal }
      ));

      clearTimeout(timeoutId);
      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as DiscoveryValidation;
      onProgress?.('Discovery Validation: complete ✓');
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw lastError ?? new Error('Discovery Validation agent failed after 3 attempts');
}

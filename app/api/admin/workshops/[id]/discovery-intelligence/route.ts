/**
 * POST /api/admin/workshops/[id]/discovery-intelligence
 *
 * Agentic replacement for the legacy single-completion executive diagnostic.
 *
 * Pipeline (matches Jo Air agentic pattern):
 *   1. Build PrepContext from workshop DB fields (generic — no name/id special-casing)
 *   2. If no discoveryBriefing exists: run runDiscoveryIntelligenceAgent
 *      (gpt-4o-mini tool-calling, up to 5 iterations) → stores WorkshopIntelligence
 *      to workshop.discoveryBriefing so discover-analysis can use it
 *   3. Build signal blocks from discoverAnalysis (alignment, tensions, constraints,
 *      narrative, confidence) — same as legacy
 *   4. GPT-4o call → 4 executive diagnostic sections (same prompt as legacy)
 *   5. Merge into scratchpad.discoveryOutput and persist
 *
 * Streams SSE progress events throughout so the UI shows live status.
 *
 * DEPRECATED: The legacy single openai.chat.completions.create() without the
 * discovery agent has been removed. All workshops now flow through
 * runDiscoveryIntelligenceAgent before the diagnostic is generated.
 *
 * Auth: validateWorkshopAccess — tenant-scoped, role-checked (unchanged).
 */

import type { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runDiscoveryIntelligenceAgent } from '@/lib/cognition/agents/discovery-intelligence-agent';
import { hasDiscoveryData } from '@/lib/cognition/agents/agent-types';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import type { PrepContext, WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

export const runtime = 'nodejs';
export const maxDuration = 90; // agent (40s) + GPT-4o diagnostic (30s) + margin

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Signal builders — compact summaries for GPT-4o diagnostic prompt ──────────
// These are unchanged from the legacy route; they transform discoverAnalysis
// data into focused signal text so the diagnostic GPT call is well-grounded.

function buildAlignmentSignals(analysis: DiscoverAnalysis): string {
  const cells = analysis.alignment?.cells ?? [];
  if (cells.length === 0) return '';

  const divergent = cells
    .filter(c => c.alignmentScore < -0.05 && c.utteranceCount >= 2)
    .sort((a, b) => a.alignmentScore - b.alignmentScore)
    .slice(0, 6);

  const aligned = cells
    .filter(c => c.alignmentScore > 0.3 && c.utteranceCount >= 2)
    .sort((a, b) => b.alignmentScore - a.alignmentScore)
    .slice(0, 4);

  const lines: string[] = ['ALIGNMENT HEATMAP SIGNALS:'];

  if (divergent.length > 0) {
    lines.push('  Divergence (actors misaligned on these themes):');
    for (const c of divergent) {
      lines.push(`    • ${c.actor} ↔ "${c.theme}" — score ${c.alignmentScore.toFixed(2)}, ${c.utteranceCount} insights`);
      if (c.sampleQuotes?.[0]) lines.push(`      "${c.sampleQuotes[0]}"`);
    }
  }

  if (aligned.length > 0) {
    lines.push('  Strong alignment (actors agree on these themes):');
    for (const c of aligned) {
      lines.push(`    • ${c.actor} ↔ "${c.theme}" — score ${c.alignmentScore.toFixed(2)}`);
    }
  }

  return lines.join('\n');
}

function buildTensionSignals(analysis: DiscoverAnalysis): string {
  const tensions = analysis.tensions?.tensions ?? [];
  if (tensions.length === 0) return '';

  const top = tensions.slice(0, 5);
  const lines: string[] = ['TENSION SURFACE SIGNALS:'];

  for (const t of top) {
    lines.push(`  [${t.severity.toUpperCase()}] Rank ${t.rank}: "${t.topic}" (domain: ${t.domain}, tension index: ${t.tensionIndex.toFixed(1)})`);
    if (t.viewpoints?.length) {
      for (const v of t.viewpoints.slice(0, 3)) {
        lines.push(`    • ${v.actor} (${v.sentiment}): ${v.position}`);
        if (v.evidenceQuote) lines.push(`      "${v.evidenceQuote}"`);
      }
    }
    if (t.affectedActors?.length > 0) {
      lines.push(`    Actors affected: ${t.affectedActors.slice(0, 5).join(', ')}`);
    }
  }

  return lines.join('\n');
}

function buildConstraintSignals(analysis: DiscoverAnalysis): string {
  const constraints = analysis.constraints?.constraints ?? [];
  if (constraints.length === 0) return '';

  const sorted = constraints
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  const lines: string[] = ['CONSTRAINT MAP SIGNALS (friction sources):'];

  for (const c of sorted) {
    lines.push(`  [${c.severity.toUpperCase()}] ${c.description} (domain: ${c.domain}, mentioned ${c.frequency}×, weight: ${c.weight.toFixed(1)})`);
    if (c.blocks?.length > 0) {
      const blockedDescs = c.blocks
        .map(id => constraints.find(x => x.id === id)?.description)
        .filter(Boolean)
        .slice(0, 2);
      if (blockedDescs.length > 0) lines.push(`    Blocks: ${blockedDescs.join('; ')}`);
    }
  }

  return lines.join('\n');
}

function buildNarrativeSignals(analysis: DiscoverAnalysis): string {
  const layers = analysis.narrative?.layers ?? [];
  const divergencePoints = analysis.narrative?.divergencePoints ?? [];
  if (layers.length === 0) return '';

  const lines: string[] = ['NARRATIVE DIVERGENCE SIGNALS:'];

  for (const l of layers) {
    const terms = (l.topTerms ?? []).slice(0, 5).map(t => t.term).join(', ');
    const focus = l.temporalFocus
      ? `past ${Math.round(l.temporalFocus.past * 100)}% / present ${Math.round(l.temporalFocus.present * 100)}% / future ${Math.round(l.temporalFocus.future * 100)}%`
      : '';
    lines.push(`  ${l.layer.toUpperCase()} layer (${l.participantCount} participants): sentiment=${l.dominantSentiment}, focus=${focus}`);
    if (terms) lines.push(`    Top terms: ${terms}`);
    if (l.samplePhrases?.[0]) lines.push(`    e.g. "${l.samplePhrases[0]}"`);
  }

  if (divergencePoints.length > 0) {
    lines.push('  Where layers disagree:');
    for (const d of divergencePoints.slice(0, 4)) {
      lines.push(`    Topic: "${d.topic}"`);
      for (const lp of d.layerPositions ?? []) {
        lines.push(`      ${lp.layer}: ${lp.language} (${lp.sentiment})`);
      }
    }
  }

  return lines.join('\n');
}

function buildConfidenceSignals(analysis: DiscoverAnalysis): string {
  const overall = analysis.confidence?.overall;
  const byDomain = analysis.confidence?.byDomain ?? [];
  if (!overall) return '';

  const total = (overall.certain + overall.hedging + overall.uncertain) || 1;
  const certainPct  = Math.round((overall.certain  / total) * 100);
  const hedgingPct  = Math.round((overall.hedging  / total) * 100);
  const uncertainPct= Math.round((overall.uncertain / total) * 100);

  const lines: string[] = [
    `CONFIDENCE INDEX: overall — certain ${certainPct}% / hedging ${hedgingPct}% / uncertain ${uncertainPct}%`,
  ];

  const highUncertainty = byDomain
    .map(d => {
      const t = (d.distribution.certain + d.distribution.hedging + d.distribution.uncertain) || 1;
      return { domain: d.domain, pct: Math.round((d.distribution.uncertain / t) * 100), phrases: d.hedgingPhrases ?? [] };
    })
    .filter(d => d.pct > 20)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  if (highUncertainty.length > 0) {
    lines.push('  High uncertainty domains:');
    for (const d of highUncertainty) {
      lines.push(`    • ${d.domain}: ${d.pct}% uncertain language`);
      if (d.phrases[0]) lines.push(`      e.g. "${d.phrases[0]}"`);
    }
  }

  return lines.join('\n');
}

// ── Diagnostic prompt (unchanged from legacy) ────────────────────────────────

function buildDiagnosticPrompt(
  participants: string[],
  totalUtterances: number,
  aiSummary: string,
  sectionSignals: string,
  richSignals: string[],
): string {
  const hasRichSignals = richSignals.length > 0;
  return `You are the DREAM Organisational Brain Scanner. Your role is to interpret workshop signals and produce clear executive intelligence — not dashboards, not generic analysis.

This is pre-workshop discovery intelligence. All signals come from pre-workshop discovery conversations with ${participants.length} participants (${totalUtterances} total insights).

${aiSummary ? `PERCEPTION SUMMARY:\n${aiSummary}\n` : ''}─── DOMAIN SIGNALS ───
${sectionSignals}

${hasRichSignals ? `─── DEEPER ANALYSIS SIGNALS ───\n${richSignals.join('\n\n')}` : ''}

─── YOUR TASK ───

Generate 4 executive intelligence sections for senior executives who need to understand this organisation.

CRITICAL RULES:
- Every insight must be grounded in the signals above. Name specific actors, domains, themes, or tensions.
- Evidence bullets must reference specific signals: cite the alignment heatmap, constraint map, tension surface, narrative divergence, or domain sentiment as appropriate. Not generic statements.
- If a signal is weak or absent, say so clearly — do not fabricate insight.
- No filler language. No generic consulting phrases. Every sentence must carry diagnostic weight.

Return valid JSON:
{
  "operationalReality": {
    "insight": "3-4 sentences. How this organisation actually operates day-to-day — the workflow patterns, decision pathways, information flow, and reliance on human experience vs systems revealed by these signals. Name specific operational patterns.",
    "evidence": [
      "Reference a specific domain signal, constraint, or quote that reveals how work actually flows",
      "Reference actor behaviour or sentiment pattern from the domain analysis",
      "Reference a friction signal from the constraint map or tension surface if available",
      "Reference a confidence or hedging pattern if available, otherwise another domain signal"
    ]
  },
  "organisationalMisalignment": {
    "insight": "3-4 sentences. Where the organisation is fractured — leadership vs operational perception gaps, cross-team tensions, technology vs operations differences, conflicting actor priorities. Name specific actors or layers.",
    "evidence": [
      "Reference a specific alignment heatmap divergence: actor, theme, and score if available",
      "Reference a tension surface entry with actor viewpoint conflict if available",
      "Reference narrative divergence between layers (executive vs operational vs frontline) if available",
      "Reference a cross-domain conflict from the domain sentiment or quote signals"
    ]
  },
  "systemicFriction": {
    "insight": "3-4 sentences. The structural friction preventing effective operation — process bottlenecks, technology limitations, decision delays, knowledge fragmentation, cross-team dependencies. Identify the dominant friction pattern.",
    "evidence": [
      "Reference the highest-weighted constraint from the constraint map: description, domain, frequency",
      "Reference a second critical or significant constraint that compounds the first",
      "Reference a tension or domain signal that illustrates the friction in practice",
      "Reference a confidence pattern showing where uncertainty is highest if available"
    ]
  },
  "transformationReadiness": {
    "insight": "3-4 sentences. Whether this organisation is capable of change — capability maturity signals, alignment levels, ambition vs structural limitations. State whether transformation looks easy, difficult, or constrained, and why.",
    "evidence": [
      "Reference optimistic sentiment signals and which domains they appear in",
      "Reference the tension index or constraint severity as a readiness risk signal",
      "Reference narrative layer alignment or divergence on future focus",
      "Reference concerned sentiment or uncertainty as a transformation risk signal"
    ]
  },
  "finalDiscoverySummary": "2-3 sentences. Executive diagnosis synthesising all four insights: how the organisation currently operates, the most important organisational tensions, the primary friction limiting performance, and the organisation's readiness for transformation. Be direct. This is the going-in statement before the workshop begins."
}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try { controller.enqueue(encoder.encode(payload)); } catch { /* stream closed */ }
      }

      try {
        // ── 1. Load all data sources in parallel ──────────────────────────
        const [workshop, scratchpad] = await Promise.all([
          prisma.workshop.findUnique({
            where: { id: workshopId },
            select: {
              id: true,
              description: true,
              businessContext: true,
              clientName: true,
              industry: true,
              companyWebsite: true,
              dreamTrack: true,
              targetDomain: true,
              prepResearch: true,
              blueprint: true,
              discoveryBriefing: true,
              discoverAnalysis: true,
            },
          }),
          prisma.workshopScratchpad.findUnique({
            where: { workshopId },
            select: { discoveryOutput: true },
          }),
        ]);

        if (!workshop) {
          sendEvent('error', { message: 'Workshop not found.' });
          controller.close();
          return;
        }

        // ── 2. Ensure discoveryBriefing exists (agentic step) ─────────────
        // If the workshop has not been through the agentic prep pipeline,
        // run runDiscoveryIntelligenceAgent now to synthesise any available
        // participant data. This is the core unification: every workshop's
        // diagnostic is now backed by the agent's structured synthesis.

        const existingBriefing = workshop.discoveryBriefing as Record<string, unknown> | null;

        if (!hasDiscoveryData(existingBriefing)) {
          sendEvent('progress', { step: 'agent', message: 'Running discovery intelligence agent…' });

          const context: PrepContext = {
            workshopId,
            workshopPurpose: workshop.description,
            desiredOutcomes: workshop.businessContext,
            clientName: workshop.clientName,
            industry: workshop.industry,
            companyWebsite: workshop.companyWebsite,
            dreamTrack: workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
            targetDomain: workshop.targetDomain,
            blueprint: readBlueprintFromJson(workshop.blueprint),
          };

          const research = workshop.prepResearch as WorkshopPrepResearch | null;

          const intelligence = await runDiscoveryIntelligenceAgent(context, research);

          // Store briefing so discover-analysis can use it on the next run
          await prisma.workshop.update({
            where: { id: workshopId },
            data: { discoveryBriefing: JSON.parse(JSON.stringify(intelligence)) },
          });
        }

        // ── 3. Validate scratchpad discovery data ─────────────────────────
        if (!scratchpad?.discoveryOutput) {
          sendEvent('error', { message: 'No discovery output data found. Run discovery interviews first.' });
          controller.close();
          return;
        }

        const discoveryOutput = scratchpad.discoveryOutput as Record<string, unknown>;
        const sections = (discoveryOutput.sections as any[]) ?? [];

        if (sections.length === 0) {
          sendEvent('error', { message: 'No domain sections found in discovery data. Hemisphere synthesis may be needed.' });
          controller.close();
          return;
        }

        // ── 4. Build signal blocks ────────────────────────────────────────
        sendEvent('progress', { step: 'signals', message: 'Building diagnostic signals…' });

        const analysis = workshop.discoverAnalysis as DiscoverAnalysis | null;
        const aiSummary       = (discoveryOutput._aiSummary      as string)   ?? '';
        const participants    = (discoveryOutput.participants     as string[]) ?? [];
        const totalUtterances = (discoveryOutput.totalUtterances  as number)  ?? 0;

        const sectionSignals = sections.map((s: any) => {
          const topThemes = (s.topThemes ?? []).slice(0, 5).join(', ');
          const quotes = (s.quotes ?? [])
            .slice(0, 2)
            .map((q: any) => `"${q.text}" — ${q.author}`)
            .join(' | ');
          const sentiment = s.sentiment
            ? `concerned ${s.sentiment.concerned}% / neutral ${s.sentiment.neutral}% / optimistic ${s.sentiment.optimistic}%`
            : '';
          return `Domain: ${s.domain} | ${s.utteranceCount} insights | Consensus: ${s.consensusLevel}%
  Themes: ${topThemes}
  Sentiment: ${sentiment}
  Quotes: ${quotes || 'none'}`;
        }).join('\n\n');

        const richSignals: string[] = [];
        if (analysis) {
          const alignmentBlock   = buildAlignmentSignals(analysis);
          const tensionBlock     = buildTensionSignals(analysis);
          const constraintBlock  = buildConstraintSignals(analysis);
          const narrativeBlock   = buildNarrativeSignals(analysis);
          const confidenceBlock  = buildConfidenceSignals(analysis);

          if (alignmentBlock)  richSignals.push(alignmentBlock);
          if (tensionBlock)    richSignals.push(tensionBlock);
          if (constraintBlock) richSignals.push(constraintBlock);
          if (narrativeBlock)  richSignals.push(narrativeBlock);
          if (confidenceBlock) richSignals.push(confidenceBlock);
        }

        // ── 5. Generate 4 executive diagnostic sections ───────────────────
        sendEvent('progress', { step: 'diagnostic', message: 'Generating executive diagnostic…' });

        const prompt = buildDiagnosticPrompt(
          participants, totalUtterances, aiSummary, sectionSignals, richSignals,
        );

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.35,
        });

        const raw = completion.choices[0]?.message?.content ?? '{}';
        let generated: Record<string, unknown>;
        try {
          generated = JSON.parse(raw);
        } catch {
          sendEvent('error', { message: 'Failed to parse diagnostic response from GPT.' });
          controller.close();
          return;
        }

        // ── 6. Merge into scratchpad and persist ──────────────────────────
        const updatedDiscoveryOutput = {
          ...discoveryOutput,
          operationalReality:        generated.operationalReality        ?? null,
          organisationalMisalignment:generated.organisationalMisalignment ?? null,
          systemicFriction:          generated.systemicFriction          ?? null,
          transformationReadiness:   generated.transformationReadiness   ?? null,
          finalDiscoverySummary:     generated.finalDiscoverySummary     ?? null,
        } as Prisma.InputJsonValue;

        await prisma.workshopScratchpad.update({
          where: { workshopId },
          data: { discoveryOutput: updatedDiscoveryOutput, updatedAt: new Date() },
        });

        sendEvent('complete', { discoveryOutput: updatedDiscoveryOutput });

      } catch (error) {
        console.error('[Discovery Intelligence] Error:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Failed to generate discovery intelligence',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

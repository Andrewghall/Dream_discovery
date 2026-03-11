/**
 * DREAM Download Report — Agentic Prompt Bar
 *
 * POST — Takes a free-text prompt from the facilitator, uses full workshop
 *        intelligence as context, returns structured output for display.
 *
 * Output types:
 *   text       — analysis paragraph
 *   bar_chart  — { title, labels, values, xLabel, yLabel }
 *   table      — { title, headers, rows }
 *   bullets    — { title, items }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { StoredOutputIntelligence, ReportSummary } from '@/lib/output-intelligence/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

// ── Output schema ─────────────────────────────────────────────────────────────

const RESPONSE_SCHEMA = `One of the following shapes:

{ "type": "text", "title": "string", "content": "string — the analysis (2-5 paragraphs)" }

{ "type": "bar_chart", "title": "string", "labels": ["string"], "values": [number], "xLabel": "string", "yLabel": "string" }

{ "type": "table", "title": "string", "headers": ["string"], "rows": [["string"]] }

{ "type": "bullets", "title": "string", "items": ["string"] }

Pick the type that best serves the user's request. Use bar_chart for comparisons and distributions, table for structured comparisons, bullets for lists, text for narrative analysis.`;

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const body = await request.json() as { prompt?: string };
    const userPrompt = body.prompt?.trim();
    if (!userPrompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!openai) {
      return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
    }

    // Load intelligence + report summary
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        outputIntelligence: true,
        reportSummary: true,
        clientName: true,
        industry: true,
        businessContext: true,
      },
    });

    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    if (!workshop.outputIntelligence) {
      return NextResponse.json({
        error: 'No intelligence data available. Generate Analysis first.',
      }, { status: 422 });
    }

    const stored = workshop.outputIntelligence as unknown as StoredOutputIntelligence;
    const intel = stored.intelligence;
    const reportSummary = workshop.reportSummary as ReportSummary | null;

    // Build compact context dump
    const contextLines: string[] = [];
    contextLines.push(`Client: ${workshop.clientName || 'Not specified'} | Industry: ${workshop.industry || 'Not specified'}`);

    if (reportSummary) {
      contextLines.push(`\nWorkshop Ask: ${reportSummary.workshopAsk}`);
      contextLines.push(`Key Insight: ${reportSummary.keyInsight}`);
      contextLines.push(`Transformation Direction: ${reportSummary.transformationDirection}`);
    }

    // Root causes
    contextLines.push(`\nRoot Causes (${intel.rootCause.rootCauses.length}):`);
    for (const rc of intel.rootCause.rootCauses) {
      contextLines.push(`  [${rc.severity}] ${rc.cause} (${rc.category})`);
    }
    contextLines.push(`Systemic Pattern: ${intel.rootCause.systemicPattern}`);

    // Confirmed issues
    if (intel.discoveryValidation.confirmedIssues.length > 0) {
      contextLines.push(`\nConfirmed Issues:`);
      for (const ci of intel.discoveryValidation.confirmedIssues) {
        contextLines.push(`  [${ci.confidence}] ${ci.issue}`);
      }
    }

    // New issues
    if (intel.discoveryValidation.newIssues.length > 0) {
      contextLines.push(`\nNew Issues (surfaced in workshop):`);
      for (const ni of intel.discoveryValidation.newIssues) {
        contextLines.push(`  ${ni.issue} — ${ni.significance}`);
      }
    }

    // Efficiency gains
    if (intel.strategicImpact.efficiencyGains.length > 0) {
      contextLines.push(`\nEfficiency Gains:`);
      for (const eg of intel.strategicImpact.efficiencyGains) {
        contextLines.push(`  ${eg.metric}: ${eg.estimated} (${eg.basis})`);
      }
    }
    if (intel.strategicImpact.automationPotential !== null) {
      contextLines.push(`Automation Potential: ${intel.strategicImpact.automationPotential.percentage}%`);
    }
    contextLines.push(`Confidence Score: ${intel.strategicImpact.confidenceScore !== null ? `${intel.strategicImpact.confidenceScore}%` : 'Insufficient evidence'}`);

    // Operating model changes
    if (intel.futureState.operatingModelChanges.length > 0) {
      contextLines.push(`\nOperating Model Changes (${intel.futureState.operatingModelChanges.length}):`);
      for (const c of intel.futureState.operatingModelChanges.slice(0, 6)) {
        contextLines.push(`  ${c.area}: ${c.currentState} → ${c.futureState}`);
      }
    }

    // Roadmap phases
    contextLines.push(`\nRoadmap:`);
    for (const phase of intel.roadmap.phases) {
      contextLines.push(`  ${phase.phase} (${phase.timeframe}): ${phase.initiatives.map((i) => i.title).join(', ')}`);
    }

    const systemPrompt = `You are an analyst for the DREAM workshop platform. You have access to a workshop's full intelligence analysis. Answer the facilitator's specific request by returning a single JSON object matching the output schema. Be specific to this organisation's data — never use generic placeholder language.`;

    const userMessage = `=== WORKSHOP INTELLIGENCE ===\n${contextLines.join('\n')}\n\n=== FACILITATOR REQUEST ===\n${userPrompt}\n\n=== OUTPUT SCHEMA ===\n${RESPONSE_SCHEMA}\n\nReturn a single JSON object. No commentary outside the JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const output = JSON.parse(raw);

    return NextResponse.json({ output });
  } catch (error) {
    console.error('[Report Prompt POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate output' },
      { status: 500 }
    );
  }
}

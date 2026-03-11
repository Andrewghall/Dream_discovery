/**
 * POST /api/admin/workshops/[id]/report-suggestions
 *
 * Analyses the current report layout + intelligence data and returns
 * 3-5 specific, actionable suggestions for enhancing the report.
 * Used by the "Suggest Additions" button in the AgenticPromptBar.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import type {
  StoredOutputIntelligence,
  ReportLayout,
  ReportSummary,
} from '@/lib/output-intelligence/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  if (!openai) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  // ── Load data ───────────────────────────────────────────────────────────────

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      name: true,
      outputIntelligence: true,
      reportSummary: true,
    },
  });

  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

  const body = await request.json().catch(() => ({})) as {
    layout?: ReportLayout;
  };

  const stored = workshop.outputIntelligence as StoredOutputIntelligence | null;
  const intelligence = stored?.intelligence ?? null;
  const reportSummary = workshop.reportSummary as ReportSummary | null;
  const layout = body.layout ?? reportSummary?.layout ?? null;

  if (!intelligence || !layout) {
    return NextResponse.json(
      { error: 'Intelligence and layout are required to generate suggestions' },
      { status: 400 }
    );
  }

  // ── Build context summary ────────────────────────────────────────────────────

  const enabledSectionIds = layout.sections.filter(s => s.enabled).map(s => s.id);
  const disabledSectionIds = layout.sections.filter(s => !s.enabled).map(s => s.id);

  const si = intelligence.strategicImpact;
  const dv = intelligence.discoveryValidation;
  const rc = intelligence.rootCause;

  const context = `
Workshop: ${workshop.name ?? 'Unknown'}

Currently ENABLED report sections: ${enabledSectionIds.join(', ') || 'none'}
Currently DISABLED sections (available to add): ${disabledSectionIds.join(', ') || 'none'}

Key data points:
- Hypothesis accuracy: ${dv.hypothesisAccuracy !== null ? `${dv.hypothesisAccuracy}%` : 'Insufficient evidence'}
- Confirmed issues: ${dv.confirmedIssues.length}, new issues: ${dv.newIssues.length}
- Automation potential: ${si.automationPotential !== null ? `${si.automationPotential.percentage}%` : 'Insufficient evidence'}
- AI-assisted work: ${si.aiAssistedWork !== null ? `${si.aiAssistedWork.percentage}%` : 'Insufficient evidence'}
- Root causes: ${rc.rootCauses.length} identified, top: "${rc.rootCauses[0]?.cause ?? 'n/a'}"
- Systemic pattern: "${rc.systemicPattern}"
- Business case: "${si.businessCaseSummary.slice(0, 200)}…"
- Confidence score: ${si.confidenceScore}%
- Efficiency gains: ${si.efficiencyGains.map(g => `${g.metric} (${g.estimated})`).join(', ') || 'none'}
${reportSummary?.executiveSummary?.urgency ? `- Urgency: "${reportSummary.executiveSummary.urgency}"` : ''}
  `.trim();

  // ── Generate suggestions ─────────────────────────────────────────────────────

  const systemPrompt = `You are a strategic report advisor helping a consultant build a compelling discovery report for a client.
Analyse the current report state and suggest 3-5 specific, high-value additions or enhancements.

Rules:
- Each suggestion must be a ready-to-use prompt (something the user can click to immediately send to the AI)
- Be specific — reference actual data points from the context (percentages, counts, specific issues)
- Focus on what would make the report more compelling and valuable for the client
- Suggest things that are NOT already in the report
- Keep each suggestion under 120 characters
- Use action verbs: "Add...", "Create...", "Generate...", "Summarise...", "Compare..."

Respond ONLY with a JSON array of strings: ["suggestion 1", "suggestion 2", ...]`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';

    // Extract JSON array (handle markdown code blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = JSON.parse(jsonMatch[0]) as string[];
    return NextResponse.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [] });

  } catch (err) {
    console.error('[Report Suggestions] Error:', err);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}

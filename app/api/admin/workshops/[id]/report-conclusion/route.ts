/**
 * POST /api/admin/workshops/[id]/report-conclusion
 *
 * Uses GPT-4o-mini to generate a compelling executive conclusion paragraph
 * and 5 prioritised, actionable next steps based on the workshop intelligence
 * and report summary. Saves to reportSummary.reportConclusion and returns it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import { nanoid } from 'nanoid';
import type {
  StoredOutputIntelligence,
  ReportSummary,
  ReportConclusion,
  ReportNextStep,
} from '@/lib/output-intelligence/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export async function POST(
  _request: NextRequest,
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

  const stored = workshop.outputIntelligence as StoredOutputIntelligence | null;
  const intelligence = stored?.intelligence ?? null;
  const reportSummary = workshop.reportSummary as ReportSummary | null;

  if (!intelligence) {
    return NextResponse.json(
      { error: 'Intelligence data is required to generate a conclusion' },
      { status: 400 },
    );
  }

  // ── Build context ────────────────────────────────────────────────────────────

  const si = intelligence.strategicImpact;
  const rc = intelligence.rootCause;
  const dv = intelligence.discoveryValidation;
  const fs = intelligence.futureState;

  const rootCauseList = rc.rootCauses
    .slice(0, 3)
    .map((c, i) => `${i + 1}. ${c.cause} (${c.severity})`)
    .join('\n');

  const efficiencyList = si.efficiencyGains
    .map(g => `• ${g.metric}: ${g.estimated}`)
    .join('\n') || 'Not specified';

  const context = `
Workshop: ${workshop.name ?? 'Unknown'}
Business case: ${si.businessCaseSummary}
Hypothesis accuracy: ${dv.hypothesisAccuracy !== null ? `${dv.hypothesisAccuracy}%` : 'Insufficient evidence'}
Confidence score: ${si.confidenceScore !== null ? `${si.confidenceScore}%` : 'Insufficient evidence'}
Automation potential: ${si.automationPotential !== null ? `${si.automationPotential.percentage}%` : 'Insufficient evidence'}
AI-assisted work: ${si.aiAssistedWork !== null ? `${si.aiAssistedWork.percentage}%` : 'Insufficient evidence'}
Systemic pattern: "${rc.systemicPattern}"
Top root causes:
${rootCauseList}
Efficiency gains:
${efficiencyList}
Future state direction: "${fs.targetOperatingModel}"
Redesign principles: ${fs.redesignPrinciples.slice(0, 3).join('; ')}
${reportSummary?.executiveSummary?.urgency ? `Urgency: "${reportSummary.executiveSummary.urgency}"` : ''}
${reportSummary?.solutionSummary?.startingPoint ? `Starting point: "${reportSummary.solutionSummary.startingPoint}"` : ''}
  `.trim();

  // ── Generate conclusion ──────────────────────────────────────────────────────

  const systemPrompt = `You are a strategic consultant writing the closing section of a discovery report for a senior client.

Generate:
1. A compelling executive conclusion (2–3 paragraphs) that synthesises what was found, why it matters, and what the path forward looks like. Make it authoritative and confident — this is the last thing the client reads.
2. Exactly 5 prioritised next steps. Each must have:
   - A punchy title (3–7 words, action-oriented)
   - A one-sentence description that is specific and actionable, referencing the actual data

Respond ONLY with valid JSON in this exact shape:
{
  "summary": "paragraph 1\\n\\nparagraph 2\\n\\nparagraph 3",
  "nextSteps": [
    { "title": "...", "description": "..." },
    { "title": "...", "description": "..." },
    { "title": "...", "description": "..." },
    { "title": "...", "description": "..." },
    { "title": "...", "description": "..." }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
      ],
      temperature: 0.6,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
    const parsed = JSON.parse(raw) as {
      summary?: string;
      nextSteps?: Array<{ title?: string; description?: string }>;
    };

    if (!parsed.summary || !Array.isArray(parsed.nextSteps)) {
      return NextResponse.json({ error: 'Invalid AI response shape' }, { status: 500 });
    }

    const conclusion: ReportConclusion = {
      summary: parsed.summary,
      nextSteps: parsed.nextSteps.slice(0, 5).map((s): ReportNextStep => ({
        id: nanoid(8),
        title: s.title ?? 'Next Step',
        description: s.description ?? '',
      })),
    };

    // ── Save back to reportSummary ───────────────────────────────────────────

    const updatedSummary: ReportSummary = {
      ...(reportSummary ?? {}) as ReportSummary,
      reportConclusion: conclusion,
    };

    await prisma.workshop.update({
      where: { id: workshopId },
      data: { reportSummary: updatedSummary as object },
    });

    return NextResponse.json({ conclusion });

  } catch (err) {
    console.error('[Report Conclusion] Error:', err);
    return NextResponse.json({ error: 'Failed to generate conclusion' }, { status: 500 });
  }
}

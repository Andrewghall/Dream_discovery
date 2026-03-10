/**
 * POST /api/admin/workshops/[id]/journey/intro
 *
 * Generates a 2–3 sentence client-facing intro paragraph for the customer
 * journey map section of the Download Report.
 *
 * Accepts the current journey data in the request body and uses GPT-4o-mini
 * to write a concise, professional narrative description.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { env } from '@/lib/env';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';

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

  if (!openai) return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });

  const body = await request.json().catch(() => null) as { journey?: LiveJourneyData } | null;
  const journey = body?.journey;
  if (!journey) return NextResponse.json({ error: 'journey data required' }, { status: 400 });

  // Summarise journey stats for the prompt
  const stageCount = journey.stages?.length ?? 0;
  const actorCount = journey.actors?.length ?? 0;
  const interactionCount = journey.interactions?.length ?? 0;
  const painPoints = journey.interactions?.filter(i => i.isPainPoint) ?? [];
  const momentsOfTruth = journey.interactions?.filter(i => i.isMomentOfTruth) ?? [];
  const criticalItems = journey.interactions?.filter(i => i.sentiment === 'critical') ?? [];

  const actorList = journey.actors?.map(a => `${a.name} (${a.role})`).join(', ') ?? '';
  const stageList = journey.stages?.join(', ') ?? '';
  const painPointSummary = painPoints.slice(0, 4).map(p => `"${p.action.slice(0, 80)}"`).join('; ');
  const motSummary = momentsOfTruth.slice(0, 3).map(m => `"${m.action.slice(0, 60)}"`).join('; ');

  const prompt = `You are writing a brief intro paragraph for a client-facing discovery report.

Journey map summary:
- Actors (${actorCount}): ${actorList}
- Stages (${stageCount}): ${stageList}
- Interactions mapped: ${interactionCount}
- Pain points (${painPoints.length}): ${painPointSummary || 'none'}
- Moments of truth (${momentsOfTruth.length}): ${motSummary || 'none'}
- Critical failures: ${criticalItems.length}

Write exactly 2–3 sentences for a CEO-level document. The paragraph should:
1. State what the map shows (who is involved and across which journey stages)
2. Highlight the most important pattern or concentration of pain points
3. Signal what this means for the business (one crisp implication)

Write in third-person, present tense. No bullet points. No headings. No intro phrases like "This map shows". Be specific — use actor names, stage names, and numbers from the data. Professional tone.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const intro = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!intro) return NextResponse.json({ error: 'No output generated' }, { status: 502 });

    return NextResponse.json({ intro });
  } catch (err) {
    console.error('Journey intro generation failed:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 });
  }
}

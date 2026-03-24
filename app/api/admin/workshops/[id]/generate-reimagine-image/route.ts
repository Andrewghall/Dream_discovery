/**
 * POST /api/admin/workshops/[id]/generate-reimagine-image
 *
 * Generates a concept image for the Reimagine section using DALL-E 3.
 * Builds the prompt from the workshop's V2 synthesis output (reimagine section).
 * Saves the URL to WorkshopScratchpad.solutionImageUrl and returns it.
 *
 * Uses the existing OPENAI_API_KEY — no new dependencies required.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import type { V2Output } from '@/lib/output/v2-synthesis-agent';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  // Load workshop + scratchpad for context
  const [workshop, scratchpad] = await Promise.all([
    prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { name: true, industry: true },
    }),
    prisma.workshopScratchpad.findUnique({
      where: { workshopId },
      select: { v2Output: true },
    }),
  ]);

  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

  // Extract reimagine data from v2Output
  const v2 = scratchpad?.v2Output as V2Output | null | undefined;
  const reimagine = v2?.reimagine;

  if (!reimagine) {
    return NextResponse.json(
      { error: 'V2 synthesis has not been run yet. Regenerate the output to produce reimagine data.' },
      { status: 422 },
    );
  }

  // Build image prompt from reimagine section
  const orgName = workshop.name || 'the organisation';
  const industry = workshop.industry || 'enterprise';

  const futureStateTitles = reimagine.futureStates
    ?.slice(0, 3)
    .map((f) => f.title)
    .filter(Boolean)
    .join('. ') || '';

  const actorShifts = reimagine.actorJourneyShifts
    ?.slice(0, 2)
    .map((s) => `${s.actor} moves from ${s.from} to ${s.to}`)
    .join('. ') || '';

  const execSummarySnippet = reimagine.execSummary
    ? reimagine.execSummary.slice(0, 200)
    : '';

  const imagePrompt = [
    `A professional, cinematic concept illustration of ${orgName}'s reimagined future in the ${industry} sector.`,
    futureStateTitles ? `Vision: ${futureStateTitles}.` : '',
    actorShifts ? `Transformation: ${actorShifts}.` : '',
    execSummarySnippet ? `Context: ${execSummarySnippet}.` : '',
    'Style: clean, warm, optimistic, modern corporate art direction.',
    'No text, no words, no logos, no people\'s faces. Abstract and conceptual. Wide format.',
  ].filter(Boolean).join(' ');

  console.log(`[generate-reimagine-image] Calling DALL-E 3 for workshop ${workshopId}. Prompt length: ${imagePrompt.length}`);

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      size: '1792x1024',
      quality: 'hd',
      n: 1,
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: 'DALL-E 3 returned no image URL' }, { status: 502 });
    }

    console.log(`[generate-reimagine-image] ✓ Image generated for workshop ${workshopId}`);

    // Save to scratchpad.solutionImageUrl (field already exists on the model)
    await prisma.workshopScratchpad.upsert({
      where: { workshopId },
      update: { solutionImageUrl: imageUrl },
      create: {
        workshopId,
        solutionImageUrl: imageUrl,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error('[generate-reimagine-image] DALL-E 3 error:', err);
    const message = err instanceof Error ? err.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Lightweight endpoint to fetch org branding for the discovery landing page.
 * Called on mount so the participant sees branded colours before clicking "Begin".
 * No session creation — just a lookup via workshopId + participant token.
 */
export async function POST(req: NextRequest) {
  try {
    const { workshopId, token } = await req.json();
    if (!workshopId || !token) {
      return NextResponse.json({ error: 'Missing workshopId or token' }, { status: 400 });
    }

    // Validate the token belongs to this workshop and fetch org branding
    const participant = await prisma.workshopParticipant.findUnique({
      where: { discoveryToken: token },
      include: {
        workshop: {
          include: {
            organization: {
              select: { name: true, logoUrl: true, primaryColor: true },
            },
          },
        },
      },
    });

    if (!participant || participant.workshopId !== workshopId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    const org = participant.workshop.organization;
    return NextResponse.json({
      name: org.name,
      logoUrl: org.logoUrl,
      primaryColor: org.primaryColor,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

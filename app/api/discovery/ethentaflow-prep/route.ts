// EthentaFlow handoff IN: serves workshop + participant + question set to the
// EthentaFlow voice agent at session start. Authenticated by a shared secret
// (DREAMFLOW_SECRET) so only the EthentaFlow server can call this.
//
// GET /api/discovery/ethentaflow-prep?workshopId=...&participantToken=...

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptParticipantData } from '@/lib/workshop-encryption';
import { fixedQuestionsForVersion, buildQuestionsFromDiscoverySet } from '@/lib/conversation/fixed-questions';

export const dynamic = 'force-dynamic';

function unauthorised() {
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  // Shared-secret auth.
  const expectedSecret = process.env.DREAMFLOW_SECRET;
  const providedSecret = request.headers.get('x-dreamflow-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) return unauthorised();

  const workshopId = request.nextUrl.searchParams.get('workshopId') ?? '';
  const participantToken = request.nextUrl.searchParams.get('participantToken') ?? '';
  if (!workshopId || !participantToken) {
    return NextResponse.json({ error: 'workshopId and participantToken are required' }, { status: 400 });
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    include: { participants: true, organization: true },
  });
  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

  const participantRow = workshop.participants.find(p => p.discoveryToken === participantToken);
  if (!participantRow) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

  const participant = decryptParticipantData(participantRow);

  // Per-lens questions — prefer the workshop-specific custom set, fall back to defaults.
  const customQs = buildQuestionsFromDiscoverySet((workshop as any).discoveryQuestions);
  const defaultQs = fixedQuestionsForVersion((workshop as any).questionSetVersion ?? 'v1');

  const questionsByLens: Record<string, Array<{ text: string; tag: string; maturityScale?: string[] }>> = {};
  const lenses = ['people', 'operations', 'technology', 'commercial', 'customer', 'partners', 'risk_compliance'];
  for (const lens of lenses) {
    const fromCustom = customQs ? (customQs as any)[lens] : null;
    const fromDefault = (defaultQs as any)[lens] ?? [];
    questionsByLens[lens] = (fromCustom && Array.isArray(fromCustom) && fromCustom.length > 0) ? fromCustom : fromDefault;
  }

  return NextResponse.json({
    workshop: {
      id: workshop.id,
      name: workshop.name,
      description: workshop.description ?? null,
      organisation: workshop.organization?.name ?? null,
      includeRegulation: workshop.includeRegulation ?? true,
    },
    participant: {
      id: participantRow.id,
      name: participant.name,
      email: participant.email,
      role: participant.role ?? null,
      department: participant.department ?? null,
    },
    questionsByLens,
  });
}

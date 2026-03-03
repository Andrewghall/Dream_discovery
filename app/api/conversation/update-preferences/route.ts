import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, token, language, voiceEnabled } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify the session exists and belongs to a valid participant
    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        participantId: true,
        participant: { select: { discoveryToken: true } },
      },
    });
    if (!session || !session.participantId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify participant token matches session owner
    if (!session.participant || session.participant.discoveryToken !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: { language?: string; voiceEnabled?: boolean } = {};
    if (typeof language === 'string') updateData.language = language;
    if (typeof voiceEnabled === 'boolean') updateData.voiceEnabled = voiceEnabled;

    await prisma.conversationSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

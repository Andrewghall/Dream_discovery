import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, language, voiceEnabled } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Verify the session exists and belongs to a valid participant
    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      select: { id: true, participantId: true },
    });
    if (!session || !session.participantId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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

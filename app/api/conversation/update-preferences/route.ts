import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, language, voiceEnabled } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const updateData: any = {};
    if (language !== undefined) updateData.language = language;
    if (voiceEnabled !== undefined) updateData.voiceEnabled = voiceEnabled;

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

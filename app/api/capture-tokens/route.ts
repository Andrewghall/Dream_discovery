/**
 * POST /api/capture-tokens - Generate a mobile capture token
 *
 * Requires admin auth. Creates a signed JWT embedding the workshopId so that
 * mobile devices can access capture functionality without a full login session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import * as jose from 'jose';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';

export const dynamic = 'force-dynamic';

function getCaptureSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('FATAL: SESSION_SECRET or AUTH_SECRET must be set. Refusing to use a fallback secret.');
  }
  return new TextEncoder().encode(secret);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workshopId } = body;

    if (!workshopId || typeof workshopId !== 'string') {
      return NextResponse.json(
        { error: 'workshopId is required' },
        { status: 400 }
      );
    }

    const tokenId = nanoid(32);

    const token = await new jose.SignJWT({
      workshopId,
      tokenId,
      createdBy: user.userId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('dream-capture')
      .setAudience('mobile-capture')
      .setExpirationTime('7d')
      .sign(getCaptureSecret());

    return NextResponse.json({
      token,
      url: `/capture/${token}`,
    });
  } catch (error) {
    console.error('Error generating capture token:', error);
    return NextResponse.json(
      { error: 'Failed to generate capture token' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/capture-tokens/[token] - Validate a mobile capture token
 *
 * NO admin auth required - this endpoint is accessed by mobile devices using
 * only the signed JWT token. The token itself proves authorisation.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CAPTURE_TOKEN_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || process.env.AUTH_SECRET || 'capture-fallback-secret'
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Verify the JWT signature and expiration
    let payload: jose.JWTPayload;
    try {
      const result = await jose.jwtVerify(token, CAPTURE_TOKEN_SECRET, {
        issuer: 'dream-capture',
        audience: 'mobile-capture',
      });
      payload = result.payload;
    } catch {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const workshopId = payload.workshopId as string | undefined;
    if (!workshopId) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    // Look up the workshop
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        id: true,
        name: true,
        domainPack: true,
        domainPackConfig: true,
      },
    });

    if (!workshop) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      workshopId: workshop.id,
      workshopName: workshop.name,
      domainPack: workshop.domainPack,
      domainPackConfig: workshop.domainPackConfig,
    });
  } catch (error) {
    console.error('Error validating capture token:', error);
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}

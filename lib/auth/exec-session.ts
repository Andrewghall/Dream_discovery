/**
 * Executive Portal Session Management
 * Completely isolated from the admin/tenant session system.
 * Uses JWT audience 'executive' — an admin token cannot pass verification here,
 * and an exec token cannot pass admin verification.
 * Cookie name: 'exec-session' (separate from 'session')
 */

import * as jose from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export interface ExecSessionPayload {
  sessionId: string;       // Session.id — the DB revocation anchor
  execLicenceId: string;   // ExecLicence.id
  execEmail: string;
  execOrgId: string;       // Organisation.id this licence is scoped to
  name: string;
  isExec: true;
  createdAt: number;
  [key: string]: unknown;
}

const getSecret = (): Uint8Array => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET not set or too short');
  return new TextEncoder().encode(secret);
};

export async function createExecSessionToken(payload: ExecSessionPayload): Promise<string> {
  return new jose.SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('dream-discovery')
    .setAudience('executive')          // cryptographically distinct from 'admin'
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function verifyExecSessionToken(token: string): Promise<ExecSessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), {
      issuer: 'dream-discovery',
      audience: 'executive',
    });
    return payload as unknown as ExecSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Verify JWT + DB state: session not revoked AND licence still active.
 */
export async function verifyExecSessionWithDB(token: string): Promise<ExecSessionPayload | null> {
  const payload = await verifyExecSessionToken(token);
  if (!payload) return null;
  try {
    const [dbSession, licence] = await Promise.all([
      prisma.session.findFirst({
        where: { id: payload.sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      }),
      prisma.execLicence.findFirst({
        where: { id: payload.execLicenceId, isActive: true, revokedAt: null },
        select: { id: true },
      }),
    ]);
    if (!dbSession || !licence) return null;
    return payload;
  } catch {
    return null; // fail closed
  }
}

export async function getExecSession(): Promise<ExecSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('exec-session');
    if (!cookie?.value) return null;
    return await verifyExecSessionWithDB(cookie.value);
  } catch {
    return null;
  }
}

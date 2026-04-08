import { NextResponse } from 'next/server';
import { getExecSession, type ExecSessionPayload } from './exec-session';

/**
 * Guard for /api/executive/* routes.
 * Returns the exec session payload on success, or a 401 NextResponse on failure.
 */
export async function requireExecAuth(): Promise<ExecSessionPayload | NextResponse> {
  const session = await getExecSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

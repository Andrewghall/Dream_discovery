import { NextResponse } from 'next/server';
import { requireExecAuth } from '@/lib/auth/require-exec-auth';

export async function GET() {
  const auth = await requireExecAuth();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    execLicenceId: auth.execLicenceId,
    execEmail: auth.execEmail,
    execOrgId: auth.execOrgId,
    name: auth.name,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { isStatementSelfContained } from '@/lib/live/semantic-gate';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json() as {
    text: string;
    context?: Array<{ speaker: string | null; text: string }>;
  };

  const text = (body?.text ?? '').trim();
  if (!text) {
    return NextResponse.json({ selfContained: false, reason: 'empty text' });
  }

  const result = await isStatementSelfContained(text, body.context ?? []);
  return NextResponse.json(result);
}

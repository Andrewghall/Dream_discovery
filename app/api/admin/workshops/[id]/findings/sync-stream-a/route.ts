/**
 * POST /api/admin/workshops/[id]/findings/sync-stream-a
 *
 * Converts existing Discovery data to Findings with STREAM_A source.
 * Idempotent - safe to call multiple times.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { syncStreamAFindings } from '@/lib/field-discovery/stream-a-adapter';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

    const result = await syncStreamAFindings(workshopId);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error syncing Stream A findings:', error);
    return NextResponse.json({ error: 'Failed to sync Stream A findings' }, { status: 500 });
  }
}

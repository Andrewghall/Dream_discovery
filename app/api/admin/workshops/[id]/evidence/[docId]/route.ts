/**
 * app/api/admin/workshops/[id]/evidence/[docId]/route.ts
 *
 * Single evidence document operations.
 *
 * GET  — Fetch a single document with full detail (status polling during processing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId, docId } = await params;
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const doc = await prisma.evidenceDocument.findFirst({
      where: { id: docId, workshopId },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ document: doc });
  } catch (err) {
    console.error('[evidence] Fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

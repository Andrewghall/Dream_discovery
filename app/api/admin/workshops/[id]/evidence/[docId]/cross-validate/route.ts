/**
 * app/api/admin/workshops/[id]/evidence/[docId]/cross-validate/route.ts
 *
 * DEPRECATED — cross-validation is workshop-level, not per-document.
 * Canonical route: POST /api/admin/workshops/[id]/evidence/cross-validate
 *
 * This stub forwards to the canonical route via 308 Permanent Redirect
 * so any existing callers are transparently upgraded.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: workshopId } = await params;
  const canonicalUrl = new URL(
    `/api/admin/workshops/${workshopId}/evidence/cross-validate`,
    request.url,
  );
  return NextResponse.redirect(canonicalUrl, { status: 308 });
}

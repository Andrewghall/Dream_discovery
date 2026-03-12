/**
 * app/api/debug/retrieval/route.ts
 *
 * PLATFORM_ADMIN only — debug endpoint for verifying vector retrieval quality.
 *
 * Usage:
 *   GET /api/debug/retrieval?q=customer+complaint+handling&orgId=<org-id>
 *   GET /api/debug/retrieval?q=...&orgId=...&workshopId=<workshop-id>
 *
 * Returns top 5 chunks with similarity scores + text previews.
 * Uses minSimilarity=0.65 (lower than production) for debug visibility.
 *
 * Do NOT wire agents to this endpoint — it's diagnostic only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { retrieveRelevant } from '@/lib/embeddings/retrieve';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: platform admin only' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q')?.trim();
    const orgId = searchParams.get('orgId')?.trim();
    const workshopId = searchParams.get('workshopId')?.trim() || undefined;

    if (!q) {
      return NextResponse.json({ error: 'Missing query param: q' }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Missing query param: orgId' }, { status: 400 });
    }

    const chunks = await retrieveRelevant(q, {
      organizationId: orgId,
      workshopId,
      topK: 5,
      minSimilarity: 0.65,  // lower threshold for debug visibility
    });

    return NextResponse.json({
      query: q,
      orgId,
      workshopId: workshopId ?? null,
      resultCount: chunks.length,
      results: chunks.map((c) => ({
        id: c.id,
        source: c.source,
        workshopId: c.workshopId,
        similarity: c.similarity,
        textPreview: c.text.slice(0, 200) + (c.text.length > 200 ? '…' : ''),
      })),
    });
  } catch (err) {
    console.error('[debug/retrieval] Error:', err);
    return NextResponse.json(
      { error: 'Retrieval failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

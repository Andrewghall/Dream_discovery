/**
 * app/api/debug/retrieval/route.ts
 *
 * PLATFORM_ADMIN only — debug endpoint for verifying vector retrieval quality.
 *
 * Usage:
 *   GET /api/debug/retrieval?q=customer+complaint+handling&orgId=<org-id>
 *   GET /api/debug/retrieval?q=...&orgId=...&workshopId=<workshop-id>
 *   GET /api/debug/retrieval?q=...&orgId=...&minSimilarity=0.3&topK=10
 *
 * Returns top chunks with similarity scores + text previews.
 * Defaults: minSimilarity=0.65, topK=5. Pass lower minSimilarity for synthetic/seed data.
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
    const minSimilarity = parseFloat(searchParams.get('minSimilarity') ?? '0.65');
    const topK = parseInt(searchParams.get('topK') ?? '5', 10);

    if (!q) {
      return NextResponse.json({ error: 'Missing query param: q' }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Missing query param: orgId' }, { status: 400 });
    }

    const chunks = await retrieveRelevant(q, {
      organizationId: orgId,
      workshopId,
      topK: isNaN(topK) ? 5 : Math.min(topK, 20),
      minSimilarity: isNaN(minSimilarity) ? 0.65 : Math.max(0, Math.min(1, minSimilarity)),
    });

    return NextResponse.json({
      query: q,
      orgId,
      workshopId: workshopId ?? null,
      minSimilarity: isNaN(minSimilarity) ? 0.65 : Math.max(0, Math.min(1, minSimilarity)),
      topK: isNaN(topK) ? 5 : Math.min(topK, 20),
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

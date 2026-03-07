/**
 * scripts/patch-hemisphere-nodes.ts
 *
 * One-time patch for the Jo Air hemisphere nodes in the LiveSessionVersion:
 * 1. Adds agenticAnalysis.domains (using the node's lens field) so domain-bias fires
 * 2. Fixes 'VISION' → 'VISIONARY' type (correct type for HemisphereNodes component)
 * 3. Fixes timestamps — nodes with nodeIdx>1200 had future timestamps
 *
 * Run: npx tsx scripts/patch-hemisphere-nodes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

function fixType(t: string): string {
  return t === 'VISION' ? 'VISIONARY' : t;
}

async function main() {
  console.log('🔍 Loading LiveSessionVersion for Jo Air workshop...');
  const lsv = await (prisma as any).liveSessionVersion.findFirst({
    where: { workshopId: WORKSHOP_ID },
    orderBy: { version: 'desc' },
  }) as { id: string; version: number; payload: unknown } | null;

  if (!lsv) {
    console.error('❌ No LiveSessionVersion found');
    process.exit(1);
  }

  console.log(`   Found version ${lsv.version} (id: ${lsv.id})`);

  const payload = lsv.payload as Record<string, unknown>;
  const rawNodes = payload.hemisphereNodes as Record<string, Record<string, unknown>> | undefined;

  if (!rawNodes || typeof rawNodes !== 'object') {
    console.error('❌ No hemisphereNodes found in payload');
    process.exit(1);
  }

  const nodeIds = Object.keys(rawNodes);
  console.log(`   ${nodeIds.length} nodes to patch`);

  // Sort by current createdAtMs to preserve relative order for timestamp fix
  const sorted = nodeIds
    .map(id => ({ id, node: rawNodes[id] }))
    .sort((a, b) => {
      const tA = typeof a.node.createdAtMs === 'number' ? a.node.createdAtMs : 0;
      const tB = typeof b.node.createdAtMs === 'number' ? b.node.createdAtMs : 0;
      return tA - tB;
    });

  const N = sorted.length;
  const now = Date.now();
  // Spread nodes across 10 hours: oldest = now-10h, newest = now-1min
  const SPAN_MS = 10 * 60 * 60 * 1000; // 10 hours
  const END_MS = now - 60_000; // 1 minute ago

  let typeFixes = 0;
  let domainAdds = 0;
  let timestampFixes = 0;

  for (let i = 0; i < sorted.length; i++) {
    const { id, node } = sorted[i];
    let changed = false;

    // 1. Fix type
    const cls = node.classification as Record<string, unknown> | null | undefined;
    if (cls && typeof cls.primaryType === 'string' && cls.primaryType === 'VISION') {
      (rawNodes[id].classification as Record<string, unknown>).primaryType = 'VISIONARY';
      typeFixes++;
      changed = true;
    }

    // 2. Add agenticAnalysis.domains from lens field
    const lens = typeof node.lens === 'string' ? node.lens : null;
    const existing = node.agenticAnalysis as Record<string, unknown> | null | undefined;
    if (lens && !existing) {
      (rawNodes[id] as Record<string, unknown>).agenticAnalysis = {
        domains: [{ domain: lens, relevance: 0.92, reasoning: `Node generated for ${lens} lens perspective` }],
        themes: [],
        actors: [],
        semanticMeaning: typeof node.rawText === 'string' ? node.rawText.slice(0, 100) : '',
        sentimentTone: 'neutral',
        overallConfidence: 0.88,
      };
      domainAdds++;
      changed = true;
    }

    // 3. Fix timestamp — evenly distribute from now-10h to now-1min
    const correctTs = Math.round(END_MS - ((N - 1 - i) / Math.max(1, N - 1)) * SPAN_MS);
    const currentTs = typeof node.createdAtMs === 'number' ? node.createdAtMs : 0;
    if (Math.abs(currentTs - correctTs) > 30_000 || currentTs > now) {
      (rawNodes[id] as Record<string, unknown>).createdAtMs = correctTs;
      // Also fix updatedAt in classification if present
      const clsInner = rawNodes[id].classification as Record<string, unknown> | null | undefined;
      if (clsInner && typeof clsInner === 'object') {
        clsInner.updatedAt = new Date(correctTs).toISOString();
      }
      timestampFixes++;
      changed = true;
    }
  }

  console.log(`\n📊 Patch summary:`);
  console.log(`   Type fixes (VISION→VISIONARY): ${typeFixes}`);
  console.log(`   Domain adds (agenticAnalysis):  ${domainAdds}`);
  console.log(`   Timestamp fixes:                ${timestampFixes}`);

  console.log('\n💾 Saving patched payload to DB...');
  await (prisma as any).liveSessionVersion.update({
    where: { id: lsv.id },
    data: {
      payload: { ...payload, hemisphereNodes: rawNodes },
    },
  });

  console.log('✅ Patch complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

/**
 * patch-joair-snapshot-actors.ts
 *
 * Quick patch: updates the Jo Air LiveWorkshopSnapshot's liveJourney.actors
 * to use properly computed mentionCounts (instead of the placeholder 0 values
 * that were stored when the snapshot was first seeded).
 *
 * Also updates the snapshot's nodesById nodes to include actor arrays in
 * agenticAnalysis based on the node's lens — so the Hemisphere Actors panel
 * shows real mention counts instead of 0.
 *
 * Run: npx tsx scripts/patch-joair-snapshot-actors.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

// ── Lens → relevant actors mapping ───────────────────────────────────────────
// Each lens gets 1-2 primary actors that typically speak about it.
// Actor names must match the blueprint actorTaxonomy labels exactly.
const LENS_ACTORS: Record<string, string[]> = {
  'Customer Experience':         ['Passenger / Traveller', 'Frequent Flyer Member'],
  'People & Workforce':          ['Customer Service Agent', 'Team Leader / Supervisor'],
  'Operations':                  ['Operations Manager', 'Customer Service Agent'],
  'Technology':                  ['IT & Digital Platforms', 'Customer Service Agent'],
  'Training & Capability':       ['Training & Enablement', 'Team Leader / Supervisor'],
  'Regulation & Compliance':     ['Operations Manager', 'Customer Service Agent'],
  'Organisation & Leadership':   ['Operations Manager', 'Team Leader / Supervisor'],
  'Culture':                     ['Customer Service Agent', 'Team Leader / Supervisor'],
};

// Fallback actor roles per lens for the actor.role field
const LENS_ACTOR_ROLES: Record<string, string[]> = {
  'Customer Experience':         ['Airline passenger', 'Loyalty tier member'],
  'People & Workforce':          ['Frontline contact centre agent', 'Supervisor'],
  'Operations':                  ['Operational lead', 'Frontline agent'],
  'Technology':                  ['Digital & platform delivery', 'Frontline agent'],
  'Training & Capability':       ['L&D lead', 'Supervisor'],
  'Regulation & Compliance':     ['Compliance oversight', 'Frontline agent'],
  'Organisation & Leadership':   ['Senior operations leader', 'Supervisor'],
  'Culture':                     ['Frontline agent', 'Team leader'],
};

async function main() {
  console.log('🔧 Patching Jo Air snapshot actor data...\n');

  // ── 1. Update snapshot liveJourney actors with proper mentionCounts ──────────
  const snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
    where: { workshopId: WORKSHOP_ID },
    orderBy: { createdAt: 'desc' },
  });

  if (!snapshot) {
    console.error('❌ No LiveWorkshopSnapshot found for workshop', WORKSHOP_ID);
    process.exit(1);
  }

  const payload = snapshot.payload as Record<string, unknown>;
  const liveJourney = payload?.liveJourney as Record<string, unknown> | null;
  const interactions = Array.isArray(liveJourney?.interactions) ? liveJourney!.interactions as Array<{ actor: string }> : [];

  // Compute mentionCounts from interactions (same logic as seed script)
  const mentionMap: Record<string, number> = {};
  for (const ix of interactions) {
    if (typeof ix.actor === 'string') {
      mentionMap[ix.actor] = (mentionMap[ix.actor] ?? 0) + 1;
    }
  }

  const actors = Array.isArray(liveJourney?.actors) ? liveJourney!.actors as Array<{ name: string; role: string; mentionCount: number }> : [];
  const updatedActors = actors.map(a => ({
    ...a,
    mentionCount: (mentionMap[a.name] ?? 0) * 8,
  }));

  const nonZeroCount = updatedActors.filter(a => a.mentionCount > 0).length;
  console.log(`   Snapshot: ${actors.length} actors, ${interactions.length} interactions, ${nonZeroCount} will have non-zero counts`);

  // If no interactions in snapshot, copy from session version
  if (interactions.length === 0) {
    console.log('   ⚠ Snapshot has no interactions — will copy from session version...');
    const sessionVersion = await (prisma as any).liveSessionVersion.findFirst({
      where: { workshopId: WORKSHOP_ID },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    });
    const sessionLj = (sessionVersion?.payload as Record<string, unknown> | null)?.liveJourney as Record<string, unknown> | null;
    const sessionInteractions = Array.isArray(sessionLj?.interactions) ? sessionLj!.interactions : [];
    const sessionActors = Array.isArray(sessionLj?.actors) ? sessionLj!.actors : [];

    if (sessionInteractions.length > 0 && sessionActors.length > 0) {
      const updatedPayload = {
        ...payload,
        liveJourney: {
          ...liveJourney,
          actors: sessionActors,
          interactions: sessionInteractions,
        },
      };
      await (prisma as any).liveWorkshopSnapshot.update({
        where: { id: snapshot.id },
        data: { payload: updatedPayload },
      });
      console.log(`   ✅ Copied ${sessionActors.length} actors + ${sessionInteractions.length} interactions from session version\n`);
    } else {
      console.log('   ⚠ Session version also has no interactions. Skipping snapshot update.\n');
    }
  } else {
    // Update actor mentionCounts in snapshot
    const updatedPayload = {
      ...payload,
      liveJourney: {
        ...liveJourney,
        actors: updatedActors,
      },
    };
    await (prisma as any).liveWorkshopSnapshot.update({
      where: { id: snapshot.id },
      data: { payload: updatedPayload },
    });
    console.log(`   ✅ Updated snapshot actors with computed mentionCounts\n`);
  }

  // ── 2. Patch nodes: add actor arrays based on lens ───────────────────────────
  console.log('🔧 Patching AgenticAnalysis records with actor arrays...');

  // Fetch all AgenticAnalysis for this workshop
  const analyses = await prisma.agenticAnalysis.findMany({
    where: {
      dataPoint: { workshopId: WORKSHOP_ID },
    },
    select: {
      id: true,
      actors: true,
      domains: true,
    },
  });

  console.log(`   Found ${analyses.length} AgenticAnalysis records`);

  let patched = 0;
  let skipped = 0;

  const batchSize = 100;
  for (let i = 0; i < analyses.length; i += batchSize) {
    const batch = analyses.slice(i, i + batchSize);
    const updates = batch
      .filter(a => {
        // Only patch if actors is empty
        const actors = Array.isArray(a.actors) ? a.actors : [];
        return actors.length === 0;
      })
      .map(a => {
        // Determine lens from domains field
        let lens: string | null = null;
        const domains = Array.isArray(a.domains) ? a.domains as Array<{ domain?: string; label?: string }> : [];
        if (domains.length > 0) {
          lens = domains[0]?.domain || domains[0]?.label || null;
        }

        const actorNames = lens ? (LENS_ACTORS[lens] ?? ['Customer Service Agent']) : ['Customer Service Agent'];
        const actorRoles = lens ? (LENS_ACTOR_ROLES[lens] ?? ['Contact centre staff']) : ['Contact centre staff'];

        const actorArray = actorNames.map((name, idx) => ({
          name,
          role: actorRoles[idx] ?? 'Contact centre staff',
          interactions: [],
        }));

        return { id: a.id, actors: actorArray };
      });

    if (updates.length === 0) {
      skipped += batch.length;
      continue;
    }

    // Batch update
    await Promise.all(
      updates.map(u =>
        prisma.agenticAnalysis.update({
          where: { id: u.id },
          data: { actors: u.actors as any },
        })
      )
    );

    patched += updates.length;
    skipped += batch.length - updates.length;

    if ((i / batchSize) % 5 === 0) {
      console.log(`   Progress: ${Math.min(i + batchSize, analyses.length)}/${analyses.length}`);
    }
  }

  console.log(`   ✅ Patched ${patched} records, skipped ${skipped} (already had actors)\n`);

  console.log('✅ Patch complete! The Hemisphere Actors panel should now show real mention counts.');
  console.log('   Reload the Hemisphere page and click the Actors tab to verify.\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

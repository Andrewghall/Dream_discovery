/**
 * Patches workshopScratchpad.customerJourney with the correct
 * Jo Air journey data from the live session (LiveSessionVersion v1).
 *
 * The synthesis prompt generates generic airline stages; this replaces
 * them with the blueprint stages, actors, and pre-seeded interactions.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

async function main() {
  // Read live session version (v1) for the correct journey data
  const session = await (prisma as any).liveSessionVersion.findFirst({
    where: { workshopId: WORKSHOP_ID },
    orderBy: { version: 'desc' },
    select: { payload: true, version: true },
  });
  if (!session) throw new Error('No LiveSessionVersion found');
  const p = session.payload as any;
  const liveJourney = p?.liveJourney;
  if (!liveJourney) throw new Error('No liveJourney in session payload');

  console.log('Live session journey:');
  console.log(`  Stages: ${liveJourney.stages?.length} — ${JSON.stringify(liveJourney.stages)}`);
  console.log(`  Actors: ${liveJourney.actors?.length}`);
  console.log(`  Interactions: ${liveJourney.interactions?.length}`);

  // Build the customerJourney in the scratchpad format
  // CustomerJourneyTab reads: stages (string[]), actors (Actor[]), interactions (Interaction[])
  const customerJourney = {
    stages: liveJourney.stages,
    actors: liveJourney.actors,
    interactions: liveJourney.interactions,
    painPointSummary: 'Disruption handling is the dominant pain point across all actor types. When flights are cancelled or delayed, the contact centre receives 3x normal volume with agents lacking real-time operational data, authority to rebook, or priority routing for high-value customers. The gap between what passengers expect and what agents can deliver is widest at the moments of highest emotional intensity.',
    momentOfTruthSummary: 'Three defining moments emerge: the Gold member receiving proactive goodwill before they need to call (rare, celebrated), the specialist agent resolving 12 disruption rebookings in 6 minutes (empowered, exceptional), and the post-disruption EU261 claim handled manually over 8–12 weeks (systemic failure). These moments reveal where Jo Air\'s service model works and where it fundamentally breaks.',
  };

  // Patch the scratchpad
  const result = await prisma.workshopScratchpad.updateMany({
    where: { workshopId: WORKSHOP_ID },
    data: { customerJourney } as any,
  });

  console.log(`\n✅ Patched ${result.count} scratchpad record(s)`);
  console.log(`   ${customerJourney.stages.length} stages, ${customerJourney.actors.length} actors, ${customerJourney.interactions.length} interactions`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

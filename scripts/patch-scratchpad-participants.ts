/**
 * Patch the stored scratchpad.discoveryOutput.participants array
 * to use the actual 30 Jo Air discovery participants instead of the
 * 8 hemisphere actor names that were stored during synthesis.
 *
 * Run: npx tsx scripts/patch-scratchpad-participants.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

async function main() {
  // Get actual participants who completed discovery
  const participants = await prisma.workshopParticipant.findMany({
    where: { workshopId: WORKSHOP_ID, responseCompletedAt: { not: null } },
    select: { name: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${participants.length} discovery participants`);

  const scratchpad = await prisma.workshopScratchpad.findUnique({
    where: { workshopId: WORKSHOP_ID },
    select: { discoveryOutput: true },
  });

  if (!scratchpad) {
    console.error('❌ No scratchpad found — run Synthesise first');
    process.exit(1);
  }

  const discoveryOutput = scratchpad.discoveryOutput as Record<string, unknown> | null;
  if (!discoveryOutput) {
    console.error('❌ No discoveryOutput in scratchpad — run Synthesise first');
    process.exit(1);
  }

  const currentParticipants = discoveryOutput.participants;
  console.log(`Current participants (${Array.isArray(currentParticipants) ? currentParticipants.length : 'N/A'}):`, currentParticipants);

  // Patch participants array
  const updatedOutput = {
    ...discoveryOutput,
    participants: participants.map(p => p.name),
  };

  await prisma.workshopScratchpad.update({
    where: { workshopId: WORKSHOP_ID },
    data: { discoveryOutput: updatedOutput },
  });

  console.log(`\n✅ Patched scratchpad.discoveryOutput.participants → ${participants.length} participants`);
  console.log('Names:', participants.map(p => p.name).join(', '));
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });

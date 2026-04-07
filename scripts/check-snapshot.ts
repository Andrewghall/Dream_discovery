import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const snap = await (prisma as any).liveWorkshopSnapshot.findFirst({
    where: { workshopId: 'cmmezcr7r0001jj04vc6fiqdw' },
    select: { id: true, createdAt: true, payload: true }
  });
  if (!snap) { console.log('NO SNAPSHOT'); return; }
  const p = snap.payload as any;
  const journey = p?.liveJourney;
  console.log('Snapshot ID:', snap.id);
  console.log('Created:', snap.createdAt);
  console.log('Stages count:', journey?.stages?.length);
  console.log('First 4 stages:', JSON.stringify(journey?.stages?.slice(0,4)));
  console.log('Actors count:', journey?.actors?.length);
  console.log('Interactions count:', journey?.interactions?.length);
  const nodeCount = Object.keys(p?.nodesById ?? {}).length;
  console.log('Nodes:', nodeCount);
}
main().finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const versions = await (prisma as any).liveSessionVersion.findMany({
    where: { workshopId: 'cmmezcr7r0001jj04vc6fiqdw' },
    select: { id: true, version: true, createdAt: true, payload: true },
    orderBy: { version: 'desc' },
    take: 3,
  });
  for (const v of versions) {
    const p = v.payload as any;
    const journey = p?.liveJourney;
    console.log(`\nVersion ${v.version} (${v.id}) — created ${v.createdAt}`);
    console.log('  Stages:', journey?.stages?.length, '| Actors:', journey?.actors?.length, '| Interactions:', journey?.interactions?.length);
    if (journey?.stages) console.log('  Stage[0]:', journey.stages[0]);
    if (journey?.actors) console.log('  Actor[0]:', journey.actors[0]);
  }
}
main().finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const ws = await prisma.workshopScratchpad.findFirst({
    where: { workshopId: 'cmmezcr7r0001jj04vc6fiqdw' },
    select: { customerJourney: true, discoveryOutput: true, updatedAt: true },
  });
  if (!ws) { console.log('NO SCRATCHPAD'); return; }
  console.log('Updated:', ws.updatedAt);
  const cj = ws.customerJourney as any;
  console.log('\ncustomerJourney:');
  if (cj) {
    console.log('  stages:', cj.stages?.length, JSON.stringify(cj.stages?.map((s: any) => s.name ?? s)));
    console.log('  actors:', cj.actors?.length);
    console.log('  interactions:', cj.interactions?.length);
  } else {
    console.log('  NULL / empty');
  }
  const dout = ws.discoveryOutput as any;
  console.log('\ndiscoveryOutput participants:', dout?.participants?.length);
}
main().finally(() => prisma.$disconnect());

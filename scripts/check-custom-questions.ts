import { prisma } from '@/lib/prisma';

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'Ethenta' } });
  if (!org) throw new Error('Ethenta org not found');
  const workshops = await prisma.workshop.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, customQuestions: true },
  });
  let ok = 0, empty = 0;
  for (const w of workshops) {
    const qs = w.customQuestions as any;
    const total = qs?.phases
      ? Object.values(qs.phases).reduce((s: number, p: any) => s + (p.questions?.length ?? 0), 0)
      : 0;
    const status = total > 0 ? '✅' : '❌';
    console.log(`${status} ${w.name} — ${total}q`);
    if (total > 0) ok++; else empty++;
  }
  console.log(`\nTotal: ${ok} with questions, ${empty} empty`);
  await prisma.$disconnect();
}

main().catch(console.error);

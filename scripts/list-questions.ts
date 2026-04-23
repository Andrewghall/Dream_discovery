import { prisma } from '@/lib/prisma';

const WORKSHOPS = [
  { id: 'cmoabyrde0004xuzp8vqykhdh', name: 'Aer Lingus' },
  { id: 'cmoahj3dl000gxuzpu79zhiph', name: 'Marks and Spencer' },
  { id: 'cmoahaplf000exuzp47ys1j4q', name: 'easyJet' },
  { id: 'cmoah4o9s000cxuzpyqrlbv2i', name: 'Bupa' },
  { id: 'cmoagr0vu000axuzp7b5db2r6', name: 'Lloyds Banking Group' },
  { id: 'cmoagjf2h0008xuzprn4yhey4', name: 'Tesco' },
];

async function main() {
  for (const ws of WORKSHOPS) {
    const row = await prisma.workshop.findUniqueOrThrow({
      where: { id: ws.id },
      select: { customQuestions: true },
    });
    const qs = row.customQuestions as any;
    console.log('\n' + '='.repeat(60));
    console.log(ws.name.toUpperCase());
    console.log('='.repeat(60));
    for (const [phase, phaseData] of Object.entries(qs.phases as any)) {
      console.log('\n  [' + phase + ']');
      for (const q of (phaseData as any).questions) {
        const sub = q.subQuestions?.length ? ' (+' + q.subQuestions.length + ' sub)' : '';
        console.log('    [' + q.lens + '] [' + q.depth + '] ' + q.text + sub);
        if (q.subQuestions?.length) {
          for (const sq of q.subQuestions) {
            console.log('      -> ' + sq.text);
          }
        }
      }
    }
  }
  await prisma.$disconnect();
}

main().catch(console.error);

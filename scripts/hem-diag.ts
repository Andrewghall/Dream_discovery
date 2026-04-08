import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const snap = await (prisma as any).liveWorkshopSnapshot.findFirst({
    where: { workshopId: 'cmmezcr7r0001jj04vc6fiqdw' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, payload: true }
  });

  if (!snap) { console.log('NO SNAPSHOT'); return; }
  const payload = snap.payload as any;
  const nodesById = payload?.nodesById ?? payload?.nodes ?? {};
  const entries = Object.entries(nodesById);

  console.log('snapshot id:', snap.id);
  console.log('snapshot name:', snap.name);
  console.log('total nodes in nodesById:', entries.length);

  let hasRawText = 0, hasClassification = 0, hasPrimaryType = 0, hasAgenticAnalysis = 0, hasLens = 0;
  const byPhase: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const [, datum] of entries as [string, any][]) {
    if (typeof datum?.rawText === 'string' && datum.rawText.trim()) hasRawText++;
    if (datum?.classification && typeof datum.classification === 'object') hasClassification++;
    if (typeof datum?.classification?.primaryType === 'string') {
      hasPrimaryType++;
      const pt = datum.classification.primaryType;
      byType[pt] = (byType[pt] || 0) + 1;
    }
    if (datum?.agenticAnalysis && typeof datum.agenticAnalysis === 'object') hasAgenticAnalysis++;
    if (typeof datum?.lens === 'string' && datum.lens.trim()) hasLens++;
    const phase = datum?.dialoguePhase ?? 'unknown';
    byPhase[phase] = (byPhase[phase] || 0) + 1;
  }

  console.log('\nField coverage:');
  console.log('  rawText present:', hasRawText);
  console.log('  classification present:', hasClassification);
  console.log('  primaryType present:', hasPrimaryType);
  console.log('  agenticAnalysis present:', hasAgenticAnalysis);
  console.log('  lens present:', hasLens);
  console.log('\nBy phase:', byPhase);
  console.log('By primaryType:', byType);

  const sample = (entries as [string, any][]).find(([, v]) => v?.dialoguePhase === 'DISCOVERY');
  if (sample) {
    console.log('\nSample DISCOVERY node key:', sample[0]);
    console.log('Sample DISCOVERY node:', JSON.stringify(sample[1], null, 2).slice(0, 500));
  }
  
  // Check original 122 node structure
  const oldSample = (entries as [string, any][]).find(([, v]) => !v?.agenticAnalysis?.domains || v?.agenticAnalysis?.domains?.length === 0);
  if (oldSample) {
    console.log('\nSample OLD node:', JSON.stringify(oldSample[1], null, 2).slice(0, 400));
  }
}
main().finally(() => prisma.$disconnect());

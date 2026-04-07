import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const w = await p.workshop.findFirst({
  where: { name: { contains: 'Jo Air' } },
  select: { id: true, name: true, discoveryQuestions: true }
});
console.log('Workshop:', w?.id, w?.name);

if (w) {
  const lenses = w.discoveryQuestions?.lenses || [];
  console.log('\ndiscoveryQuestions lenses:', lenses.map(l => `${l.key} → ${l.label}`));

  // Check phaseInsights from ConversationReports
  const reports = await p.conversationReport.findMany({
    where: { workshopId: w.id },
    select: { phaseInsights: true }
  });

  const byPhase = {};
  for (const rpt of reports) {
    const arr = Array.isArray(rpt.phaseInsights) ? rpt.phaseInsights : Object.values(rpt.phaseInsights || {});
    for (const pi of arr) {
      if (!byPhase[pi.phase]) byPhase[pi.phase] = [];
      if (pi.currentScore != null) byPhase[pi.phase].push(pi.currentScore);
    }
  }

  console.log('\n--- phaseInsights aggregated from all reports ---');
  for (const [phase, scores] of Object.entries(byPhase).sort()) {
    const sorted = scores.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(` "${phase}": n=${scores.length}, median=${median}`);
  }

  console.log('\n--- Lens coverage check ---');
  for (const lens of lenses) {
    const scores = byPhase[lens.label] || byPhase[lens.key] || [];
    const sorted = scores.sort((a, b) => a - b);
    const median = scores.length ? sorted[Math.floor(sorted.length / 2)] : null;
    console.log(` ${scores.length > 0 ? '✓' : '✗'} "${lens.label}": n=${scores.length}, median=${median ?? 'no data'}`);
  }
}

await p.$disconnect();

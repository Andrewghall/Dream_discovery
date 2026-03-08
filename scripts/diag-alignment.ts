import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function groupRole(role: string | null): string {
  if (!role) return 'General';
  const r = role.toLowerCase();
  if (/\b(ceo|chief|director|vp|vice.president|head of|president|executive)\b/.test(r)) return 'Leadership';
  if (/\b(manager|lead|supervisor|coordinator)\b/.test(r)) return 'Management';
  if (/\b(customer|service|agent|cabin|crew|passenger)\b/.test(r)) return 'Customer Ops';
  if (/\b(tech|it\b|system|data|engineer|developer|analyst)\b/.test(r)) return 'Technology';
  if (/\b(ops|operation|logistics|ground|dispatch|handling)\b/.test(r)) return 'Operations';
  return 'General Staff';
}

async function main() {
  const reports = await prisma.conversationReport.findMany({
    where: { workshopId: 'cmmezcr7r0001jj04vc6fiqdw' },
    select: {
      participant: { select: { name: true, role: true } },
      phaseInsights: true,
    },
  });

  console.log(`Total reports: ${reports.length}`);

  const actorMap: Record<string, Array<{name: string, role: string | null}>> = {};
  const cellMap = new Map<string, { theme: string; actor: string; pos: number; neg: number; neu: number }>();
  const themeCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();

  for (const r of reports) {
    const name = r.participant?.name || 'Unknown';
    const role = (r.participant as { role?: string } | null)?.role ?? null;
    const actor = groupRole(role);

    if (!actorMap[actor]) actorMap[actor] = [];
    actorMap[actor].push({ name, role: role });

    actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);

    const phases = (r.phaseInsights as Array<{ phase?: string; currentScore?: number | null }>) || [];

    for (const phase of phases) {
      const theme = phase.phase?.trim();
      if (!theme) continue;
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);

      const score = typeof phase.currentScore === 'number' ? phase.currentScore : 5;
      const sentiment: 'positive' | 'negative' | 'neutral' = score < 4 ? 'negative' : score > 6 ? 'positive' : 'neutral';

      const key = `${theme}|||${actor}`;
      const cell = cellMap.get(key) || { theme, actor, pos: 0, neg: 0, neu: 0 };
      if (sentiment === 'positive') cell.pos++;
      else if (sentiment === 'negative') cell.neg++;
      else cell.neu++;
      cellMap.set(key, cell);
    }
  }

  console.log('\nActor distribution:');
  for (const [actor, people] of Object.entries(actorMap)) {
    console.log(`  ${actor} (${people.length}): ${people.map(p => p.name + ' [' + p.role + ']').join(', ')}`);
  }

  console.log('\nTheme counts:');
  for (const [theme, count] of [...themeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${theme}: ${count}`);
  }

  console.log('\nActor counts:');
  for (const [actor, count] of actorCounts.entries()) {
    console.log(`  ${actor}: ${count}`);
  }

  console.log(`\nTotal cells in cellMap: ${cellMap.size}`);
  console.log('\nSample cells:');
  let shown = 0;
  for (const [key, cell] of cellMap) {
    if (shown < 20) {
      console.log(`  ${key} → pos=${cell.pos} neg=${cell.neg} neu=${cell.neu}`);
      shown++;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });

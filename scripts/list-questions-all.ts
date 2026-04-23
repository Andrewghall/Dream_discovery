import { prisma } from '@/lib/prisma';

const WORKSHOPS = [
  // Session 7-30 (known IDs)
  { id: 'cmobfjkkw000dxuskmvw5aj4b', name: 'Standard Chartered — SME Lending Strategy' },
  { id: 'cmobfmf3x000fxusksuaegirz', name: 'Nationwide — AI-Powered Mortgage Advice' },
  { id: 'cmobfnuk2000hxusk8s2ggo48', name: 'Legal & General — Annuity Value Optimisation' },
  { id: 'cmobfp5r0000jxuskzxkhn2kp', name: 'AstraZeneca — Oncology Franchise GTM' },
  { id: 'cmobfqo8j000lxuskpkjvvh9i', name: 'Kainos — Public Sector AI Adoption' },
  { id: 'cmobfs5l4000nxusk6bex5i8j', name: 'National Grid — Field Operations AI' },
  { id: 'cmobftj91000pxuskyth5v60m', name: 'Waitrose — Customer Loyalty Transformation' },
  { id: 'cmobfurcj000rxusk5ofg8ozf', name: 'Deloitte — Future of Work Transformation' },
  { id: 'cmobfyea2000txuskfrz8e47z', name: 'HMRC — Digital Transformation Programme' },
  { id: 'cmobfzigu000vxuskq1bq05dj', name: 'ITV — Content & Streaming Transformation' },
  { id: 'cmobg0usg000xxusk4u8c59t5', name: 'DHL — Last-Mile Delivery AI Optimisation' },
  { id: 'cmobg26jt000zxuskbdhhe6qk', name: 'Octopus Energy — AI-Powered Customer Operations' },
  { id: 'cmobg345r0011xusky96u1uc7', name: 'B&Q — Omnichannel Retail Transformation' },
  { id: 'cmobg3tge0013xuskpimkbxll', name: 'Cabinet Office — Digital Government Platform' },
  { id: 'cmobg4w2s0015xuskdd4juu1s', name: 'Boots — Pharmacy Digital Innovation' },
  { id: 'cmobg5yfg0017xuskzpk0aa04', name: 'Guardian — Digital Subscriptions Strategy' },
  { id: 'cmobg6vhp0019xuskp7yge194', name: 'Network Rail — Infrastructure Operations AI' },
  { id: 'cmobg7se2001bxuskk437f9px', name: 'Halfords — Auto Services Go-To-Market Strategy' },
  { id: 'cmobg8ngj001dxuskdgr9574f', name: 'Sage — SME Accounting AI Platform Strategy' },
  { id: 'cmobg9j8c001fxuski6m59sa9', name: 'KPMG — Advisory AI Transformation' },
  { id: 'cmobgc3ci001hxuskm077zxyr', name: 'SSE — Energy Transition Transformation' },
  { id: 'cmobgd7wb001jxusk4d6z6bvv', name: 'Arm Holdings — Semiconductor IP Strategy' },
  { id: 'cmobgeder001lxuskr1yr88bh', name: 'Accenture — UK Public Sector Practice' },
  { id: 'cmobgfp2a001nxusksnhcvx36', name: 'Go-Ahead — Transport Operations Efficiency' },
];

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('DISCOVERY QUESTIONS VALIDATION REPORT');
  console.log('Generated: ' + new Date().toISOString());
  console.log('='.repeat(80));

  let totalGenerated = 0;
  let totalEmpty = 0;
  const results: Array<{name: string; status: string; phases: Record<string, number>; totalQ: number}> = [];

  for (const ws of WORKSHOPS) {
    try {
      const row = await prisma.workshop.findUniqueOrThrow({
        where: { id: ws.id },
        select: { customQuestions: true },
      });
      const qs = row.customQuestions as any;

      if (!qs || !qs.phases) {
        results.push({ name: ws.name, status: 'EMPTY — no customQuestions', phases: {}, totalQ: 0 });
        totalEmpty++;
        continue;
      }

      const phases: Record<string, number> = {};
      let total = 0;
      for (const [phase, phaseData] of Object.entries(qs.phases as any)) {
        const count = ((phaseData as any).questions || []).length;
        phases[phase] = count;
        total += count;
      }

      if (total === 0) {
        results.push({ name: ws.name, status: 'EMPTY — phases exist but no questions', phases, totalQ: 0 });
        totalEmpty++;
      } else {
        results.push({ name: ws.name, status: 'OK', phases, totalQ: total });
        totalGenerated++;
      }
    } catch (e: any) {
      results.push({ name: ws.name, status: 'ERROR: ' + e.message, phases: {}, totalQ: 0 });
      totalEmpty++;
    }
  }

  // Print summary table
  console.log('\n📊 SUMMARY TABLE');
  console.log('-'.repeat(80));
  console.log(String('Workshop').padEnd(55) + String('Status').padEnd(10) + 'Questions');
  console.log('-'.repeat(80));
  for (const r of results) {
    const status = r.status === 'OK' ? '✅' : '❌';
    console.log(status + ' ' + r.name.substring(0, 53).padEnd(54) + r.totalQ.toString().padStart(5));
  }
  console.log('-'.repeat(80));
  console.log(`\nTotal workshops checked: ${WORKSHOPS.length}`);
  console.log(`✅ Discovery Questions generated: ${totalGenerated}`);
  console.log(`❌ Missing/empty: ${totalEmpty}`);

  // Print detailed view for workshops that have questions
  console.log('\n\n' + '='.repeat(80));
  console.log('DETAILED QUESTIONS BY WORKSHOP');
  console.log('='.repeat(80));

  for (const ws of WORKSHOPS) {
    const row = await prisma.workshop.findUnique({
      where: { id: ws.id },
      select: { customQuestions: true },
    });
    const qs = row?.customQuestions as any;
    if (!qs?.phases) continue;

    let hasAny = false;
    for (const phaseData of Object.values(qs.phases as any)) {
      if (((phaseData as any).questions || []).length > 0) { hasAny = true; break; }
    }
    if (!hasAny) continue;

    console.log('\n' + '─'.repeat(80));
    console.log('🏢 ' + ws.name);
    console.log('─'.repeat(80));

    for (const [phase, phaseData] of Object.entries(qs.phases as any)) {
      const qs2 = (phaseData as any).questions || [];
      if (qs2.length === 0) continue;
      console.log(`\n  [${phase.toUpperCase()}] — ${qs2.length} question(s)`);
      for (const q of qs2) {
        const sub = q.subQuestions?.length ? ` (+${q.subQuestions.length} sub)` : '';
        console.log(`    [${q.lens}] [${q.depth}] ${q.text}${sub}`);
        if (q.subQuestions?.length) {
          for (const sq of q.subQuestions) {
            console.log(`      ↳ ${sq.text}`);
          }
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);

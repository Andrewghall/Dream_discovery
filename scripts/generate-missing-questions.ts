/**
 * Generates Discovery Questions for workshops that are missing them.
 * Calls runDiscoveryQuestionAgent directly, bypassing the HTTP API.
 */
import { runDiscoveryQuestionAgent } from '@/lib/cognition/agents/discovery-question-agent';
import { prisma } from '@/lib/prisma';

const MISSING_WORKSHOPS = [
  // GTM workshops — regenerate to apply industry-specific riskFocus
  { id: 'cmobdfl3p0001xuskx6hdnekc', name: 'Capita — Go-To-Market & ICP Strategy' },
  { id: 'cmobfp5r0000jxuskzxkhn2kp', name: 'AstraZeneca — Oncology Franchise GTM' },
  { id: 'cmobg5yfg0017xuskzpk0aa04', name: 'Guardian — Digital Subscriptions Strategy' },
  { id: 'cmobg7se2001bxuskk437f9px', name: 'Halfords — Auto Services Go-To-Market Strategy' },
  { id: 'cmobg8ngj001dxuskdgr9574f', name: 'Sage — SME Accounting AI Platform Strategy' },
  { id: 'cmobgd7wb001jxusk4d6z6bvv', name: 'Arm Holdings — Semiconductor IP Strategy' },
];

async function main() {
  console.log('='.repeat(70));
  console.log('GENERATING MISSING DISCOVERY QUESTIONS');
  console.log('Started: ' + new Date().toISOString());
  console.log('='.repeat(70));
  console.log(`Workshops to process: ${MISSING_WORKSHOPS.length}\n`);

  let success = 0;
  let failed = 0;

  for (const ws of MISSING_WORKSHOPS) {
    console.log(`\n[${success + failed + 1}/${MISSING_WORKSHOPS.length}] ${ws.name}`);
    console.log('  ID: ' + ws.id);
    const startMs = Date.now();

    try {
      const questionSet = await runDiscoveryQuestionAgent(ws.id, (entry) => {
        if (entry.role === 'proposal') {
          process.stdout.write('  📝 ');
          console.log(entry.content.substring(0, 80) + (entry.content.length > 80 ? '…' : ''));
        }
      });

      const totalQ = questionSet.lenses.reduce((s, l) => s + l.questions.length, 0);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`  ✅ Generated ${totalQ} questions across ${questionSet.lenses.length} lenses in ${elapsed}s`);
      success++;
    } catch (err: any) {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`  ❌ FAILED after ${elapsed}s: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`DONE: ${success} succeeded, ${failed} failed`);
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

main().catch(console.error);

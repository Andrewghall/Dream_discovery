/**
 * Regenerate discovery questions for all demo workshops.
 * Run with: npx tsx scripts/regen-discovery-questions.ts
 */

import { runDiscoveryQuestionAgent } from '@/lib/cognition/agents/discovery-question-agent';

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
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Regenerating: ${ws.name} (${ws.id})`);
    console.log(`${'='.repeat(60)}`);
    try {
      const questionSet = await runDiscoveryQuestionAgent(ws.id, (entry) => {
        if (entry.role === 'proposal') {
          console.log(`  [proposal] ${entry.content.slice(0, 80)}...`);
        }
      });
      const totalQs = questionSet.lenses.reduce((sum, l) => sum + l.questions.length, 0);
      console.log(`✓ Done: ${totalQs} questions across ${questionSet.lenses.length} lenses`);
      for (const lens of questionSet.lenses) {
        console.log(`\n  [${lens.key}]`);
        for (const q of lens.questions) {
          console.log(`    [${q.tag}] ${q.text}`);
        }
      }
    } catch (err) {
      console.error(`✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log('\nAll done.');
}

main().catch(console.error);

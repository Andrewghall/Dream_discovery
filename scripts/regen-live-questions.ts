/**
 * Regenerate live workshop facilitation questions for all demo workshops.
 * Run with: set -a && source .env && set +a && npx tsx --tsconfig tsconfig.json scripts/regen-live-questions.ts
 */

import { prisma } from '@/lib/prisma';
import { runQuestionSetAgent } from '@/lib/cognition/agents/question-set-agent';
import { validateQuestionSet } from '@/lib/cognition/agents/question-set-validator';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import { decryptWorkshopContext } from '@/lib/workshop/context-integrity';
import type { PrepContext, WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';

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
    console.log(`Regenerating live questions: ${ws.name} (${ws.id})`);
    console.log(`${'='.repeat(60)}`);

    try {
      const raw = await prisma.workshop.findUniqueOrThrow({
        where: { id: ws.id },
        select: {
          id: true,
          workshopType: true,
          description: true,
          businessContext: true,
          clientName: true,
          industry: true,
          companyWebsite: true,
          dreamTrack: true,
          targetDomain: true,
          prepResearch: true,
          discoveryBriefing: true,
          blueprint: true,
        },
      });

      const workshop = decryptWorkshopContext(raw);
      const blueprint = readBlueprintFromJson(workshop.blueprint);
      const research = workshop.prepResearch as unknown as WorkshopPrepResearch | null;
      const discoveryBriefing = workshop.discoveryBriefing as Record<string, unknown> | null;

      const context: PrepContext = {
        workshopId: ws.id,
        workshopType: blueprint?.workshopType ?? workshop.workshopType,
        workshopPurpose: workshop.description,
        desiredOutcomes: workshop.businessContext,
        clientName: workshop.clientName,
        industry: workshop.industry,
        companyWebsite: workshop.companyWebsite,
        dreamTrack: workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
        targetDomain: workshop.targetDomain,
        engagementType: blueprint?.engagementType ?? null,
        domainPack: blueprint?.domainPack ?? null,
        domainPackConfig: null,
        historicalMetrics: null,
        blueprint,
      };

      // 10-minute timeout per workshop (contract-driven: 3 depths x lenses = many questions)
      const questionSet = await runQuestionSetAgent(
        context,
        research,
        (entry) => {
          if (entry.type === 'proposal') {
            console.log(`  [proposal] ${entry.message.slice(0, 80)}...`);
          }
        },
        discoveryBriefing,
        { timeoutMs: 600_000, maxIterations: 20 },
      );

      // Validate before saving
      const validationError = validateQuestionSet(questionSet);
      if (validationError) {
        console.error(`✗ Validation failed: ${validationError}`);
        continue;
      }

      // Persist
      await prisma.workshop.update({
        where: { id: ws.id },
        data: { customQuestions: JSON.parse(JSON.stringify(questionSet)) },
      });

      const totalQs = Object.values(questionSet.phases).reduce(
        (sum, p) => sum + p.questions.length,
        0,
      );
      console.log(
        `✓ Done: ${totalQs} questions across ${Object.keys(questionSet.phases).length} phases (confidence: ${questionSet.dataConfidence})`,
      );

      for (const [phase, phaseData] of Object.entries(questionSet.phases)) {
        console.log(`\n  [${phase}]`);
        for (const q of phaseData.questions) {
          const sub = q.subQuestions?.length ? ` (+${q.subQuestions.length} sub)` : '';
          const depth = q.depth ? ` [${q.depth}]` : '';
          console.log(`    [${q.lens}]${depth} ${q.text}${sub}`);
        }
      }
    } catch (err) {
      console.error(`✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\nAll done.');
  await prisma.$disconnect();
}

main().catch(console.error);

/**
 * Generates Live Workshop Questions (customQuestions) for all Ethenta workshops.
 * Calls runQuestionSetAgent directly — no Discovery Synthesis required.
 * Saves to customQuestions field (same as the /prep/questions API route).
 */
import { prisma } from '@/lib/prisma';
import { runQuestionSetAgent } from '@/lib/cognition/agents/question-set-agent';
import { validateQuestionSet } from '@/lib/cognition/agents/question-set-validator';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import { decryptWorkshopContext } from '@/lib/workshop/context-integrity';
import type { PrepContext, WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';

async function main() {
  console.log('='.repeat(70));
  console.log('GENERATING LIVE WORKSHOP QUESTIONS — ALL ETHENTA WORKSHOPS');
  console.log('Started: ' + new Date().toISOString());
  console.log('='.repeat(70));

  const org = await prisma.organization.findFirst({ where: { name: 'Ethenta' } });
  if (!org) throw new Error('Ethenta org not found');

  const workshops = await prisma.workshop.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
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

  console.log(`\nWorkshops to process: ${workshops.length}\n`);

  let success = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const raw of workshops) {
    const ws = decryptWorkshopContext(raw);
    const blueprint = readBlueprintFromJson(ws.blueprint);
    const research = ws.prepResearch as unknown as WorkshopPrepResearch | null;
    const discoveryBriefing = ws.discoveryBriefing as Record<string, unknown> | null;

    const context: PrepContext = {
      workshopId: ws.id,
      workshopType: blueprint?.workshopType ?? ws.workshopType ?? null,
      workshopPurpose: ws.description ?? null,
      desiredOutcomes: ws.businessContext ?? null,
      clientName: ws.clientName ?? null,
      industry: ws.industry ?? null,
      companyWebsite: ws.companyWebsite ?? null,
      dreamTrack: (ws.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null) ?? null,
      targetDomain: ws.targetDomain ?? null,
      engagementType: blueprint?.engagementType ?? null,
      domainPack: blueprint?.domainPack ?? null,
      blueprint,
    };

    console.log(`[${success + failed + 1}/${workshops.length}] ${raw.name}`);
    const startMs = Date.now();

    try {
      const questionSet = await runQuestionSetAgent(context, research, undefined, discoveryBriefing, {
        timeoutMs: 180_000,
        maxIterations: 25,
      });

      const validationError = validateQuestionSet(questionSet);
      if (validationError) {
        throw new Error('Validation failed: ' + validationError);
      }

      await prisma.workshop.update({
        where: { id: ws.id },
        data: { customQuestions: JSON.parse(JSON.stringify(questionSet)) },
      });

      const total = Object.values(questionSet.phases).reduce((s, p) => s + (p as any).questions.length, 0);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`  ✅ ${total} questions across 3 phases in ${elapsed}s`);
      success++;
    } catch (err: any) {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`  ❌ FAILED after ${elapsed}s: ${err.message}`);
      failures.push(`${raw.name}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`DONE: ${success} succeeded, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  - ' + f);
  }
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

main().catch(console.error);

/**
 * fix-joair-blueprint.ts
 *
 * Fixes the Jo Air workshop blueprint and domain pack.
 * The blueprint was generated without a domain pack, so it has the wrong
 * lenses (old 5-lens set) and wrong journey stages (6 generic aviation stages).
 * This sets domainPack = 'contact_centre_airline' and regenerates the blueprint.
 *
 * Run: npx tsx scripts/fix-joair-blueprint.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateBlueprint } from '../lib/cognition/workshop-blueprint-generator';
import { getDomainPack } from '../lib/domain-packs/registry';

const prisma = new PrismaClient();

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';
const DOMAIN_PACK_KEY = 'contact_centre_airline';

async function main() {
  console.log('🛫 Fixing Jo Air workshop blueprint...\n');

  const workshop = await prisma.workshop.findUnique({
    where: { id: WORKSHOP_ID },
    select: {
      id: true,
      name: true,
      domainPack: true,
      engagementType: true,
      prepResearch: true,
      blueprint: true,
    },
  });

  if (!workshop) {
    throw new Error(`Workshop ${WORKSHOP_ID} not found`);
  }

  console.log(`Workshop: ${workshop.name}`);
  console.log(`Current domainPack: ${workshop.domainPack ?? 'null'}`);

  const pr = workshop.prepResearch as Record<string, unknown> | null;
  const existingBp = workshop.blueprint as Record<string, unknown> | null;

  // Gather research dimensions if present
  const researchDimensions = (pr as any)?.industryDimensions ?? undefined;

  // Build the generator input with the airline pack key
  const generatorInput = {
    industry: (existingBp as any)?.industry ?? 'Aviation / Airline',
    dreamTrack: (existingBp as any)?.dreamTrack ?? 'DOMAIN',
    workshopType: (existingBp as any)?.workshopType ?? 'OPERATIONS',
    engagementType: workshop.engagementType ?? 'diagnostic_baseline',
    domainPack: DOMAIN_PACK_KEY,
    purpose: (existingBp as any)?.purpose ?? 'Transform Jo Air contact centre operations to deliver consistent, personalised customer experiences at scale',
    outcomes: (existingBp as any)?.outcomes ?? 'Reduction in failure demand, improved FCR and agent experience, clear AI enablement roadmap',
    researchDimensions,
    previousVersion: (existingBp as any)?.blueprintVersion ?? 0,
  };

  console.log('\nGenerator input:');
  console.log(`  industry: ${generatorInput.industry}`);
  console.log(`  domainPack: ${generatorInput.domainPack}`);
  console.log(`  engagementType: ${generatorInput.engagementType}`);

  const newBlueprint = generateBlueprint(generatorInput);

  console.log('\nGenerated blueprint:');
  console.log(`  Lenses (${newBlueprint.lenses.length}): ${newBlueprint.lenses.map((l) => l.name).join(', ')}`);
  console.log(`  Journey stages (${newBlueprint.journeyStages.length}): ${newBlueprint.journeyStages.map((s) => s.name).join(', ')}`);
  console.log(`  Actor taxonomy: ${newBlueprint.actorTaxonomy.length} actors`);
  console.log(`  REIMAGINE lenses: ${newBlueprint.phaseLensPolicy.REIMAGINE.join(', ')}`);

  // Validate it has the airline stages
  if (newBlueprint.journeyStages.length !== 10 || newBlueprint.journeyStages[0].name !== 'Inspiration & Planning') {
    throw new Error(`Blueprint looks wrong — expected 10 airline stages, got ${newBlueprint.journeyStages.length} starting with "${newBlueprint.journeyStages[0]?.name}"`);
  }
  if (newBlueprint.lenses.length !== 8) {
    throw new Error(`Blueprint looks wrong — expected 8 airline lenses, got ${newBlueprint.lenses.length}`);
  }
  if (newBlueprint.actorTaxonomy.length !== 17) {
    throw new Error(`Blueprint looks wrong — expected 17 airline actors, got ${newBlueprint.actorTaxonomy.length}`);
  }

  console.log('\n✅ Blueprint validated — 10 stages, 8 lenses, 17 actors');

  // Get the domain pack config
  const domainPackConfig = getDomainPack(DOMAIN_PACK_KEY);
  if (!domainPackConfig) {
    throw new Error(`Domain pack '${DOMAIN_PACK_KEY}' not found in registry`);
  }

  // Update the workshop
  await prisma.workshop.update({
    where: { id: WORKSHOP_ID },
    data: {
      domainPack: DOMAIN_PACK_KEY,
      domainPackConfig: domainPackConfig as any,
      blueprint: newBlueprint as any,
    },
  });

  console.log(`\n✅ Workshop updated successfully`);
  console.log(`   domainPack: ${DOMAIN_PACK_KEY}`);
  console.log(`   blueprint: regenerated with airline pack`);
  console.log('\n🛫 Jo Air workshop is now correctly configured as Contact Centre — Airline');
}

main()
  .catch((err) => {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

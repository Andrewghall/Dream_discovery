/**
 * Verify blueprint persistence and retrieval for an airline contact centre workshop.
 * Run with: npx tsx scripts/test-blueprint-persistence.ts
 */
import { PrismaClient } from '@prisma/client';
import { generateBlueprint } from '../lib/cognition/workshop-blueprint-generator';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  const user = await prisma.user.findFirst();
  if (!org || !user) {
    console.log('No org/user found');
    return;
  }

  const bp = generateBlueprint({
    industry: 'Aviation',
    dreamTrack: 'DOMAIN',
    engagementType: 'operational_deep_dive',
    domainPack: 'contact_centre',
    purpose: 'Map the airline contact centre',
    outcomes: 'Improve handling of flight disruptions',
    clientName: 'Aer Lingus',
  });

  console.log('=== Generated Blueprint ===');
  console.log('Lenses:', bp.lenses.map(l => l.name).join(', '));
  console.log('Journey:', bp.journeyStages.map(s => s.name).join(', '));
  console.log('Lens count:', bp.lenses.length);

  const w = await prisma.workshop.create({
    data: {
      name: 'TEST_AIRLINE_BP_VERIFY',
      description: 'Map the airline contact centre',
      businessContext: 'Improve handling of flight disruptions',
      workshopType: 'CUSTOM',
      includeRegulation: true,
      organizationId: org.id,
      createdById: user.id,
      clientName: 'Aer Lingus',
      industry: 'Aviation',
      dreamTrack: 'DOMAIN',
      engagementType: 'OPERATIONAL_DEEP_DIVE',
      domainPack: 'contact_centre',
      blueprint: bp as any,
    }
  });

  console.log('\nWorkshop created:', w.id);

  const readBack = await prisma.workshop.findUnique({
    where: { id: w.id },
    select: { blueprint: true },
  });
  const dbBp = readBack?.blueprint as any;
  console.log('\n=== DB Blueprint (read back) ===');
  console.log('Lenses:', dbBp.lenses.map((l: any) => l.name).join(', '));
  console.log('Journey:', dbBp.journeyStages.map((s: any) => s.name).join(', '));
  console.log('Lens count:', dbBp.lenses.length);

  const lensMatch = bp.lenses[0].name === dbBp.lenses[0].name;
  const stageMatch = bp.journeyStages[0].name === dbBp.journeyStages[0].name;
  console.log('\n=== Verification ===');
  console.log('Lens persistence:', lensMatch ? 'PASS' : 'FAIL');
  console.log('Stage persistence:', stageMatch ? 'PASS' : 'FAIL');
  console.log('Overall:', (lensMatch && stageMatch) ? 'PASS' : 'FAIL');

  await prisma.workshop.delete({ where: { id: w.id } });
  console.log('\nTest workshop cleaned up');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

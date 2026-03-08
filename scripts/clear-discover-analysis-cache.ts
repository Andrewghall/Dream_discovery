/**
 * Clear stale discoverAnalysis cache for Jo Air workshop
 * so the next "Generate Analysis" click computes fresh from the updated seed data.
 *
 * Run: npx tsx scripts/clear-discover-analysis-cache.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

async function main() {
  // Use raw query to set the JSON field to null cleanly
  await prisma.$executeRaw`
    UPDATE workshops SET discover_analysis = NULL WHERE id = ${WORKSHOP_ID}
  `;

  const workshop = await prisma.workshop.findUnique({
    where: { id: WORKSHOP_ID },
    select: { id: true, name: true, discoverAnalysis: true },
  });

  if (workshop?.discoverAnalysis) {
    console.error('❌ Cache still present — manual clear needed');
    process.exit(1);
  }

  console.log(`✅ Cleared discoverAnalysis cache for "${workshop?.name}" (${WORKSHOP_ID})`);
  console.log('👉 Click "Generate Analysis" on the Discovery Output page to recompute.');
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });

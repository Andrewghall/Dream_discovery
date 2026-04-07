import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE workshops ADD COLUMN IF NOT EXISTS behavioural_interventions JSONB'
  );
  console.log('Migration applied: behavioural_interventions column added');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

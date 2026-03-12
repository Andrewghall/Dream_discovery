/**
 * scripts/mark-joair-system-org.ts
 *
 * 1. Adds is_system column to organizations table (idempotent — ADD COLUMN IF NOT EXISTS)
 * 2. Marks the Jo Air demo organisation as isSystem = true
 * 3. Marks all Jo Air workshops as isExample = true
 *
 * System orgs are platform-owned and hidden from the tenant-facing
 * organisations admin list. Their workshops show up in every tenant's
 * dashboard with an "Example" badge so every client sees a fully
 * completed Dream workshop on arrival.
 *
 * Usage:
 *   npx tsx scripts/mark-joair-system-org.ts
 *   npx tsx scripts/mark-joair-system-org.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Mark Jo Air as System Org ${isDryRun ? '(DRY RUN)' : ''} ===\n`);

  // Step 1: Ensure column exists (idempotent — safe to run multiple times)
  // Even in dry-run, we need the column to exist for subsequent queries.
  // The ALTER TABLE is non-destructive (IF NOT EXISTS) so safe to run always.
  const colCheck = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'organizations' AND column_name = 'is_system'
    ) AS exists
  `;
  const columnExists = colCheck[0]?.exists ?? false;

  if (!columnExists) {
    if (isDryRun) {
      console.log('[dry-run] Column is_system does not exist yet — would add it with:');
      console.log('  ALTER TABLE organizations ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE');
      console.log('\nNote: re-run without --dry-run to apply the column and data changes.\n');
      await prisma.$disconnect();
      return;
    }
    await prisma.$executeRawUnsafe(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log('✓ Column is_system added to organizations table');
  } else {
    console.log('✓ Column is_system already exists');
  }

  // Step 2: Find the Jo Air org
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    billing_email: string | null;
    is_system: boolean;
  }>>`
    SELECT id, name, "billingEmail" AS billing_email, is_system
    FROM organizations
    WHERE name = 'Jo Air'
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.log('✗ No organisation named "Jo Air" found. Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  const org = rows[0];
  console.log(`\nFound: ${org.name} (id: ${org.id})`);
  console.log(`  isSystem currently: ${org.is_system}`);
  console.log(`  billingEmail: ${org.billing_email ?? 'none'}`);

  // Find its workshops
  const workshops = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    is_example: boolean;
  }>>`
    SELECT id, name, is_example
    FROM workshops
    WHERE "organizationId" = ${org.id}
  `;

  console.log(`  Workshops (${workshops.length}):`);
  for (const w of workshops) {
    console.log(`    - ${w.name} (isExample: ${w.is_example})`);
  }

  const alreadyDone = org.is_system && workshops.every(w => w.is_example);
  if (alreadyDone) {
    console.log('\n✓ Already correctly configured. No changes needed.');
    await prisma.$disconnect();
    return;
  }

  if (isDryRun) {
    console.log('\n[dry-run] Would set:');
    if (!org.is_system) {
      console.log(`  UPDATE organizations SET is_system = TRUE WHERE id = '${org.id}'`);
    }
    const needsExample = workshops.filter(w => !w.is_example);
    if (needsExample.length > 0) {
      console.log(`  UPDATE workshops SET is_example = TRUE for ${needsExample.length} workshop(s):`);
      for (const w of needsExample) {
        console.log(`    - ${w.name}`);
      }
    }
    console.log('\nDry run complete — no changes made.');
  } else {
    if (!org.is_system) {
      await prisma.$executeRawUnsafe(
        `UPDATE organizations SET is_system = TRUE WHERE id = $1`,
        org.id
      );
      console.log('\n  ✓ Organization marked as system (is_system = TRUE)');
    }

    const updated = await prisma.$executeRawUnsafe(
      `UPDATE workshops SET is_example = TRUE WHERE "organizationId" = $1 AND is_example = FALSE`,
      org.id
    );
    console.log(`  ✓ ${updated} workshop(s) marked as example (is_example = TRUE)`);

    console.log('\n✓ Done. Jo Air is now a system org — hidden from tenant org lists,');
    console.log('  workshops visible to all tenants as examples with "Example" badge.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});

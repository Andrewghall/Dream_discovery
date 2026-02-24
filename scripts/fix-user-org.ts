import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNOSTIC: Organizations and Users ===\n');

  // List all organizations
  const orgs = await prisma.organization.findMany({
    include: {
      users: { select: { id: true, email: true, role: true, name: true } },
      _count: { select: { workshops: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const org of orgs) {
    console.log(`📁 Org: "${org.name}" (id: ${org.id})`);
    console.log(`   Billing email: ${org.billingEmail}`);
    console.log(`   Workshops: ${org._count.workshops}`);
    console.log(`   Users:`);
    for (const u of org.users) {
      console.log(`     - ${u.email} (${u.role}, name: ${u.name})`);
    }
    console.log('');
  }

  // Find the user in question
  const targetEmail = 'andrew@stratgen.co.uk';
  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { organization: true },
  });

  if (!user) {
    console.log(`❌ User "${targetEmail}" not found in database`);
    return;
  }

  console.log(`\n=== TARGET USER ===`);
  console.log(`Email: ${user.email}`);
  console.log(`Name: ${user.name}`);
  console.log(`Role: ${user.role}`);
  console.log(`Current Org: "${user.organization?.name}" (id: ${user.organizationId})`);

  // Find the StratGen org
  const stratgenOrg = orgs.find(o =>
    o.name.toLowerCase().includes('stratgen') ||
    o.billingEmail?.toLowerCase().includes('stratgen')
  );

  if (!stratgenOrg) {
    console.log(`\n⚠️  No organisation with "stratgen" in name or billing email found.`);
    console.log('Available orgs:');
    orgs.forEach(o => console.log(`  - "${o.name}" (id: ${o.id}, billing: ${o.billingEmail})`));
    console.log('\nTo fix manually, run:');
    console.log(`  npx tsx scripts/fix-user-org.ts <correct-org-id>`);
    return;
  }

  if (user.organizationId === stratgenOrg.id) {
    console.log(`\n✅ User is ALREADY in the correct org ("${stratgenOrg.name}")`);
    return;
  }

  console.log(`\n🔄 FIXING: Moving "${targetEmail}" from "${user.organization?.name}" to "${stratgenOrg.name}"`);

  await prisma.user.update({
    where: { email: targetEmail },
    data: { organizationId: stratgenOrg.id },
  });

  console.log(`✅ Done! User "${targetEmail}" now belongs to "${stratgenOrg.name}" (id: ${stratgenOrg.id})`);
  console.log(`\n⚠️  The user must LOG OUT and LOG BACK IN to get a new session with the correct org.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

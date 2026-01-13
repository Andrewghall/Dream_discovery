import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create organization
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org' },
    update: {},
    create: {
      id: 'demo-org',
      name: 'Demo Organization',
    },
  });
  console.log('✓ Created organization:', org.name);

  // Create user
  const user = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      id: 'demo-user',
      email: 'admin@demo.com',
      name: 'Demo Admin',
      organizationId: org.id,
    },
  });
  console.log('✓ Created user:', user.email);

  // Create sample workshop
  const workshop = await prisma.workshop.upsert({
    where: { id: 'demo-workshop' },
    update: {},
    create: {
      id: 'demo-workshop',
      name: 'Q1 2026 Strategic Planning Workshop',
      description: 'Gathering insights for our quarterly strategic planning session',
      businessContext:
        'We are planning our Q1 strategy and need to understand current challenges, opportunities, and team perspectives on our direction.',
      workshopType: 'STRATEGY',
      status: 'DRAFT',
      organizationId: org.id,
      createdById: user.id,
      scheduledDate: new Date('2026-02-01T10:00:00Z'),
      responseDeadline: new Date('2026-01-25T23:59:59Z'),
    },
  });
  console.log('✓ Created workshop:', workshop.name);

  // Create sample participants
  const participants = [
    {
      name: 'Sarah Johnson',
      email: 'sarah@demo.com',
      role: 'Product Manager',
      department: 'Product',
    },
    {
      name: 'Michael Chen',
      email: 'michael@demo.com',
      role: 'Engineering Lead',
      department: 'Engineering',
    },
    {
      name: 'Emily Rodriguez',
      email: 'emily@demo.com',
      role: 'Head of Sales',
      department: 'Sales',
    },
  ];

  for (const p of participants) {
    const participant = await prisma.workshopParticipant.create({
      data: {
        workshopId: workshop.id,
        name: p.name,
        email: p.email,
        role: p.role,
        department: p.department,
      },
    });
    console.log('✓ Created participant:', participant.name);
  }

  console.log('\n✅ Seed completed successfully!');
  console.log('\nYou can now:');
  console.log('1. Run: npm run dev');
  console.log('2. Visit: http://localhost:3000/admin');
  console.log('3. View the demo workshop and add more participants');
  console.log('\nTo test discovery conversation:');
  console.log('- Go to workshop detail page');
  console.log('- Copy a participant\'s discovery link');
  console.log('- Open in new tab to start AI conversation');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create tenant admin for Upstream Works
  const organizationId = 'demo-org'; // UpstreamWorks
  const email = 'admin@upstreamworks.com';
  const name = 'Upstream Admin';
  const password = 'UpstreamAdmin2026!';

  console.log('Creating tenant admin user for Upstream Works...');
  console.log('Email:', email);

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    // Update existing user
    const user = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        role: 'TENANT_ADMIN',
        organizationId,
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      include: { organization: true },
    });

    console.log('✅ Updated existing tenant admin user');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Organization:', user.organization?.name);
  } else {
    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'TENANT_ADMIN',
        organizationId,
        isActive: true,
      },
      include: { organization: true },
    });

    console.log('✅ Created new tenant admin user');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Organization:', user.organization?.name);
  }

  console.log('\n🔐 Login credentials for Upstream Works:');
  console.log('URL: http://localhost:3001/tenant/login');
  console.log('Email:', email);
  console.log('Password:', password);
}

main()
  .catch((e) => {
    console.error('Error creating tenant user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

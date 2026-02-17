import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_USERNAME + '@ethenta.com' || 'ethenta_admin@ethenta.com';
  const password = process.env.ADMIN_PASSWORD || 'EthentaDREAM2026!Secure#';
  const name = 'Platform Admin';

  console.log('Creating platform admin user...');
  console.log('Email:', email);

  // Hash the password with bcrypt (10 rounds)
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
        role: 'PLATFORM_ADMIN',
        organizationId: null, // Platform admins have no organization
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    console.log('✅ Updated existing platform admin user');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
  } else {
    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'PLATFORM_ADMIN',
        organizationId: null, // Platform admins have no organization
        isActive: true,
      },
    });

    console.log('✅ Created new platform admin user');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
  }

  console.log('\n🔐 Login credentials:');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('\n⚠️  Change this password after first login!');
}

main()
  .catch((e) => {
    console.error('Error creating admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

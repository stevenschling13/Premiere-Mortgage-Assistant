import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const orgName = process.env.SEED_ORG_NAME || 'Premiere Demo Lender';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  let organization = await prisma.organization.findFirst({ where: { name: orgName } });
  if (!organization) {
    organization = await prisma.organization.create({ data: { name: orgName } });
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: adminEmail, organizationId: organization.id },
  });
  if (!existingUser) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin User',
        organizationId: organization.id,
        role: UserRole.OWNER,
        passwordHash,
      },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

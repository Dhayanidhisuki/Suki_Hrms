import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({ where: { code: 'KUNAERO' } });
  if (!company) {
    console.log('Company not found');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@kunaero.suki.hrms' },
    update: { passwordHash: hashedPassword, isActive: true, companyId: company.id },
    create: {
      email: 'admin@kunaero.suki.hrms',
      passwordHash: hashedPassword,
      isActive: true,
      companyId: company.id,
    },
  });

  console.log('Company admin created/updated:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

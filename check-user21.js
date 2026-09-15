const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const user = await p.user.findUnique({
    where: { id: 21 },
    select: { id: true, email: true, roleId: true, isSuperAdmin: true, companyId: true },
  });
  console.log('User 21:', user);

  // Check the JWT secret
  const fs = require('fs');
  const envContent = fs.readFileSync('.env', 'utf8');
  const jwtMatch = envContent.match(/JWT_SECRET=(.+)/);
  console.log('JWT_SECRET:', jwtMatch ? jwtMatch[1].trim() : 'NOT FOUND');

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

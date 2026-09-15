const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const plan = await p.oTPlan.findFirst({ where: { isActive: true } });
  console.log(plan);
  await p.$disconnect();
})();

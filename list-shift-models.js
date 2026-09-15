const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log(Object.keys(p).filter(k => k.toLowerCase().includes('shift')));
  await p.$disconnect();
})();

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const s = await p.shiftMaster.findMany();
  for (const x of s) console.log(x.id, x.code, x.name, 'grace=' + x.graceMinutes, 'start=' + x.startTime, 'end=' + x.endTime);
  await p.$disconnect();
})();

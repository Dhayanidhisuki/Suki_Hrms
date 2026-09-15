const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const r = await p.shiftAssignmentOverride.findMany({ where: { employeeId: 373 } });
    console.log('OK rows=' + r.length);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

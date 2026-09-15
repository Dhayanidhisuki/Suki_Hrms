const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const updated = await p.payrollRun.update({
      where: { id: 36 },
      data: { status: 'CALCULATED' },
    });
    console.log('Reset run 36 to: ' + updated.status);
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

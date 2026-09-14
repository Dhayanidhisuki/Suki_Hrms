const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Unlink user 5 from employee 386
  await p.employee.update({
    where: { id: 386 },
    data: { userId: null },
  });
  console.log('Unlinked user 5 from employee 386');

  // Delete the test shift change request
  await p.shiftChangeRequest.deleteMany({ where: { id: 1 } });
  console.log('Deleted test shift change request');

  // Delete the test override
  await p.shiftAssignmentOverride.deleteMany({
    where: { employeeId: 372, date: new Date('2026-07-15') },
  });
  console.log('Deleted test override');

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

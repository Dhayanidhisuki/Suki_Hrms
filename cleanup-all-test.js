const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Clean up bulk shift upload test data
  console.log('=== Cleaning up bulk shift upload test data ===');
  await p.shiftAssignmentOverride.deleteMany({
    where: { date: new Date('2026-07-28'), reason: { contains: 'Bulk shift upload' } },
  });
  console.log('Deleted test overrides.');

  await p.shiftChangeNotification.deleteMany({
    where: { reason: 'Bulk shift upload' },
  });
  console.log('Deleted test notifications.');

  // Clean up comp-off request test data
  console.log('\n=== Cleaning up comp-off test data ===');
  await p.compOffRequest.deleteMany({
    where: { workedDate: new Date('2026-07-26') },
  });
  console.log('Deleted test comp-off requests.');

  // Clean up shift change request test data
  console.log('\n=== Cleaning up shift change request test data ===');
  await p.shiftChangeRequest.deleteMany({
    where: { status: 'approved', requestedDate: new Date('2026-07-25') },
  });
  await p.shiftAssignmentOverride.deleteMany({
    where: { date: new Date('2026-07-25'), reason: { contains: 'Shift change request' } },
  });
  await p.shiftChangeNotification.deleteMany({
    where: { reason: 'Shift change request approved' },
  });
  console.log('Deleted test shift change data.');

  // Restore user 5 link to employee 386
  console.log('\n=== Restoring user 5 to employee 386 ===');
  await p.employee.update({ where: { id: 376 }, data: { userId: null } });
  await p.employee.update({ where: { id: 386 }, data: { userId: 5 } });
  console.log('Restored.');

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

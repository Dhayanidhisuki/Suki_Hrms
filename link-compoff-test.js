const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Unlink user 5 from employee 386
  console.log('=== Unlinking user 5 from employee 386 ===');
  await p.employee.update({ where: { id: 386 }, data: { userId: null } });
  console.log('Unlinked.');

  // Link user 5 to employee 376 (RC031, Thenpandi)
  console.log('=== Linking user 5 to employee 376 (RC031) ===');
  await p.employee.update({ where: { id: 376 }, data: { userId: 5 } });
  console.log('Linked.');

  // Check the attendance record for July 26
  const att = await p.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId: 376, date: new Date('2026-07-26') } },
  });
  console.log('\nAttendance for RC031 on 2026-07-26:');
  console.log('  isWeeklyOffWorked:', att?.isWeeklyOffWorked);
  console.log('  otApprovalStatus:', att?.otApprovalStatus);
  console.log('  otSettlementType:', att?.otSettlementType);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

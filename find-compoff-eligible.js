const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find attendance records where isWeeklyOffWorked=true and OT is approved
  const records = await p.dailyAttendance.findMany({
    where: {
      isWeeklyOffWorked: true,
      otApprovalStatus: 'approved',
      employee: { companyId: 1, isActive: true },
    },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, userId: true } },
    },
    take: 10,
  });
  console.log('Weekly-off worked with approved OT:');
  records.forEach(r => {
    console.log(`  emp=${r.employee.employeeCode} (${r.employee.firstName}) date=${r.date.toISOString().slice(0,10)} settlement=${r.otSettlementType} userId=${r.employee.userId}`);
  });

  // Also check holiday worked
  const holidayRecords = await p.dailyAttendance.findMany({
    where: {
      isHolidayWorked: true,
      otApprovalStatus: 'approved',
      employee: { companyId: 1, isActive: true },
    },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, userId: true } },
    },
    take: 5,
  });
  console.log('\nHoliday worked with approved OT:');
  holidayRecords.forEach(r => {
    console.log(`  emp=${r.employee.employeeCode} (${r.employee.firstName}) date=${r.date.toISOString().slice(0,10)} settlement=${r.otSettlementType} userId=${r.employee.userId}`);
  });

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

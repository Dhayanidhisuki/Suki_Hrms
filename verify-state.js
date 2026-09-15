const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true, isActive: true, reportingManagerId: true },
    orderBy: { employeeCode: 'asc' },
  });
  console.log('Remaining employees:', r.length);
  r.forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} ${e.lastName} active=${e.isActive} mgr=${e.reportingManagerId ?? 'null'}`));

  // Check attendance and salary data for the 12
  const attCount = await p.dailyAttendance.count();
  console.log(`\nDailyAttendance records: ${attCount}`);
  const sumCount = await p.monthlyAttendanceSummary.count();
  console.log(`MonthlyAttendanceSummary records: ${sumCount}`);
  const runs = await p.payrollRun.findMany({ orderBy: { id: 'desc' }, take: 5 });
  console.log(`Payroll runs: ${runs.length}`);
  runs.forEach(r => console.log(`  id=${r.id} ${r.year}-${String(r.month).padStart(2,'0')} ${r.status}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

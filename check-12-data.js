const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KEEP_CODES = ['RC027','RC028','RC029','RC030','RC031','RC032','RC033','RC034','RC035','RC036','RC037','RC114'];

(async () => {
  const emps = await p.employee.findMany({
    where: { employeeCode: { in: KEEP_CODES } },
    select: { id: true, employeeCode: true, firstName: true },
  });

  console.log('=== 12 Employees — Data Check ===\n');
  for (const e of emps) {
    const jobInfo = await p.jobInfo.findFirst({ where: { employeeId: e.id }, select: { id: true, departmentId: true, overtimeAllowed: true, shiftMasterId: true } });
    const salaryRev = await p.employeeSalaryRevision.findFirst({
      where: { employeeId: e.id, effectiveTo: null },
      include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true } } } } },
    });
    const attCount = await p.dailyAttendance.count({ where: { employeeId: e.id } });
    const sumCount = await p.monthlyAttendanceSummary.count({ where: { employeeId: e.id } });

    console.log(`${e.employeeCode} ${e.firstName} (id=${e.id}):`);
    console.log(`  JobInfo: ${jobInfo ? `id=${jobInfo.id} dept=${jobInfo.departmentId} OT=${jobInfo.overtimeAllowed}` : 'MISSING'}`);
    console.log(`  SalaryRevision: ${salaryRev ? `${salaryRev.components.length} components` : 'MISSING'}`);
    if (salaryRev) {
      salaryRev.components.forEach(c => console.log(`    ${c.salaryComponent.code} ${c.salaryComponent.type} = ${c.amount}`));
    }
    console.log(`  Attendance: ${attCount} daily, ${sumCount} monthly summaries`);
    console.log('');
  }

  // Check July 2026 attendance summaries
  console.log('=== July 2026 Monthly Summaries ===');
  const julySums = await p.monthlyAttendanceSummary.findMany({
    where: { year: 2026, month: 7 },
    include: { employee: { select: { employeeCode: true, firstName: true } } },
  });
  console.log(`Found: ${julySums.length}`);
  julySums.forEach(s => console.log(`  ${s.employee.employeeCode} ${s.employee.firstName}: payable=${s.payableDays} LOP=${s.lopDays} OT=${s.otMinutesTotal} late=${s.lateMinutesTotal} early=${s.earlyOutMinutesTotal}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

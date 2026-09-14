const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const CODES = [
  'RC027','RC028','RC029','RC030','RC031','RC032',
  'RC033','RC034','RC035','RC036','RC037','RC114'
];

(async () => {
  const all = await p.employee.findMany({
    where: { isActive: true },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
    orderBy: { employeeCode: 'asc' },
  });
  console.log(`Active employees: ${all.length}`);
  console.log('Keep list:', CODES.join(', '));

  const keep = all.filter(e => CODES.includes(e.employeeCode));
  const remove = all.filter(e => !CODES.includes(e.employeeCode));

  console.log(`\nKeep: ${keep.length}`);
  keep.forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} (id=${e.id})`));

  console.log(`\nRemove: ${remove.length}`);
  remove.slice(0,20).forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} (id=${e.id})`));
  if (remove.length > 20) console.log(`  ... and ${remove.length - 20} more`);

  // Count records for non-keep employees in key tables
  const keepIds = keep.map(e => e.id);

  const tables = [
    { name: 'Employee', fn: () => p.employee.count({ where: { id: { notIn: keepIds } } }) },
    { name: 'DailyAttendance', fn: () => p.dailyAttendance.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'DailyAttendanceHistory', fn: () => p.dailyAttendanceHistory.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'MonthlyAttendanceSummary', fn: () => p.monthlyAttendanceSummary.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'PayrollLine', fn: () => p.payrollLine.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'OtApproval', fn: () => p.otApproval.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'LomApproval', fn: () => p.lomApproval.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'LeaveApplication', fn: () => p.leaveApplication.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'CompOffTransaction', fn: () => p.compOffTransaction.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'ShiftAssignmentOverride', fn: () => p.shiftAssignmentOverride.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'ShiftChangeRequest', fn: () => p.shiftChangeRequest.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'Loan', fn: () => p.loan.count({ where: { employeeId: { notIn: keepIds } } }) },
    { name: 'EmployeeSalaryRevision', fn: () => p.employeeSalaryRevision.count({ where: { employeeId: { notIn: keepIds } } }) },
  ];

  console.log('\nRecords to remove for non-keep employees:');
  for (const t of tables) {
    try {
      const c = await t.fn();
      console.log(`  ${t.name.padEnd(30)} ${c}`);
    } catch (e) {
      console.log(`  ${t.name.padEnd(30)} ERROR: ${e.message}`);
    }
  }

  // Check payroll runs
  const runs = await p.payrollRun.findMany({
    include: { _count: { select: { lines: true } } },
    orderBy: { id: 'desc' },
    take: 5,
  });
  console.log('\nPayroll runs:');
  runs.forEach(r => console.log(`  id=${r.id} ${r.year}-${String(r.month).padStart(2,'0')} ${r.status} lines=${r._count.lines}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

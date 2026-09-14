const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KEEP_CODES = [
  'RC027','RC028','RC029','RC030','RC031','RC032',
  'RC033','RC034','RC035','RC036','RC037','RC114'
];

(async () => {
  console.log('=== Starting cleanup ===\n');

  // 1. Identify keep vs remove employee IDs
  const keepEmps = await p.employee.findMany({
    where: { employeeCode: { in: KEEP_CODES } },
    select: { id: true, employeeCode: true, firstName: true },
  });
  const keepIds = keepEmps.map(e => e.id);
  console.log(`Keep: ${keepIds.length} employees`);
  keepEmps.forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} (id=${e.id})`));

  const allEmps = await p.employee.findMany({ select: { id: true, employeeCode: true } });
  const removeIds = allEmps.filter(e => !keepIds.includes(e.id)).map(e => e.id);
  console.log(`\nRemove: ${removeIds.length} employees`);

  // 2. Delete payroll runs 31-35 and their lines/components first
  // (PayrollLineComponent -> PayrollLine -> PayrollRun)
  console.log('\n--- Deleting payroll runs 31-35 ---');
  const runIds = [31, 32, 33, 34, 35];
  for (const runId of runIds) {
    try {
      // Delete PayrollLineComponent rows for lines in this run
      const lines = await p.payrollLine.findMany({ where: { payrollRunId: runId }, select: { id: true } });
      const lineIds = lines.map(l => l.id);
      if (lineIds.length > 0) {
        await p.payrollLineComponent.deleteMany({ where: { payrollLineId: { in: lineIds } } });
      }
      await p.payrollLine.deleteMany({ where: { payrollRunId: runId } });
      await p.payrollRun.delete({ where: { id: runId } }).catch(() => {});
      console.log(`  Run ${runId} deleted (${lineIds.length} lines)`);
    } catch (e) {
      console.log(`  Run ${runId} error: ${e.message}`);
    }
  }

  // 3. Delete child records for non-keep employees (order matters: deepest children first)
  console.log('\n--- Deleting related records for non-keep employees ---');

  const childTables = [
    // Payroll-related
    { name: 'PayrollLineComponent (via line.employeeId)', fn: async () => {
      const lines = await p.payrollLine.findMany({ where: { employeeId: { in: removeIds } }, select: { id: true } });
      const lineIds = lines.map(l => l.id);
      if (lineIds.length > 0) await p.payrollLineComponent.deleteMany({ where: { payrollLineId: { in: lineIds } } });
      return lineIds.length;
    }},
    { name: 'PayrollLine', fn: () => p.payrollLine.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count) },
    // Attendance
    { name: 'DailyAttendance', fn: () => p.dailyAttendance.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count) },
    { name: 'DailyAttendanceHistory', fn: () => p.dailyAttendanceHistory.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count) },
    { name: 'MonthlyAttendanceSummary', fn: () => p.monthlyAttendanceSummary.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count) },
    // Approvals
    { name: 'OtApproval', fn: () => p.otApproval.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    { name: 'LomApproval', fn: () => p.lomApproval.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    { name: 'MispunchApproval', fn: () => p.mispunchApproval.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    { name: 'LeaveApplication', fn: () => p.leaveApplication.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count) },
    { name: 'PermissionRequest', fn: () => p.permissionRequest.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    // Comp-off / shift
    { name: 'CompOffTransaction', fn: () => p.compOffTransaction.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count) },
    { name: 'CompOffRequest', fn: () => p.compOffRequest.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    { name: 'ShiftAssignmentOverride', fn: () => p.shiftAssignmentOverride.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count) },
    { name: 'ShiftChangeRequest', fn: () => p.shiftChangeRequest.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count) },
    { name: 'ShiftChangeNotification', fn: () => p.shiftChangeNotification.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    // Salary / benefits
    { name: 'EmployeeSalaryRevision (components first)', fn: async () => {
      const revs = await p.employeeSalaryRevision.findMany({ where: { employeeId: { in: removeIds } }, select: { id: true } });
      const revIds = revs.map(r => r.id);
      if (revIds.length > 0) {
        await p.employeeSalaryComponent.deleteMany({ where: { employeeSalaryRevisionId: { in: revIds } } });
      }
      await p.employeeSalaryRevision.deleteMany({ where: { id: { in: revIds } } });
      return revIds.length;
    }},
    { name: 'EmployeeBenefitEnrollment', fn: () => p.employeeBenefitEnrollment.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    { name: 'BenefitRateByEmployeeType', fn: () => p.benefitRateByEmployeeType.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    // Loans
    { name: 'LoanInstallment (via loan)', fn: async () => {
      const loans = await p.loan.findMany({ where: { employeeId: { in: removeIds } }, select: { id: true } });
      const loanIds = loans.map(l => l.id);
      if (loanIds.length > 0) {
        await p.loanInstallment.deleteMany({ where: { loanId: { in: loanIds } } });
      }
      await p.loan.deleteMany({ where: { id: { in: loanIds } } });
      return loanIds.length;
    }},
    // Documents
    { name: 'EmployeeDocument', fn: () => p.employeeDocument.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    // Job info
    { name: 'EmployeeJobInfo', fn: () => p.employeeJobInfo.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    // Biometric
    { name: 'BiometricDeviceUser', fn: () => p.biometricDeviceUser.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    // Leave balance
    { name: 'EmployeeLeaveBalance', fn: () => p.employeeLeaveBalance.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    // TDS
    { name: 'EmployeeTdsDeclaration', fn: () => p.employeeTdsDeclaration.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    // Canteen / petrol / DM
    { name: 'CanteenToken', fn: () => p.canteenToken.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    { name: 'PetrolAllowanceEntry', fn: () => p.petrolAllowanceEntry.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
    { name: 'DoubleMachineEntry', fn: () => p.doubleMachineEntry.deleteMany({ where: { employeeId: { in: removeIds } } }).then(r => r.count).catch(() => -1) },
  ];

  for (const t of childTables) {
    try {
      const c = await t.fn();
      console.log(`  ${t.name.padEnd(40)} ${c >= 0 ? c : '(table not found)'}`);
    } catch (e) {
      console.log(`  ${t.name.padEnd(40)} ERROR: ${e.message}`);
    }
  }

  // 4. Finally delete the employees themselves
  console.log('\n--- Deleting non-keep employees ---');
  try {
    // Unlink userId first if needed
    const del = await p.employee.deleteMany({ where: { id: { in: removeIds } } });
    console.log(`  Deleted ${del.count} employees`);
  } catch (e) {
    console.log(`  Employee delete error: ${e.message}`);
    // Try soft-delete fallback: deactivate
    console.log('  Falling back to hard delete with userId nullification...');
    try {
      await p.employee.updateMany({ where: { id: { in: removeIds } }, data: { userId: null } });
      const del = await p.employee.deleteMany({ where: { id: { in: removeIds } } });
      console.log(`  Deleted ${del.count} employees (after nullifying userId)`);
    } catch (e2) {
      console.log(`  Still failed: ${e2.message}`);
    }
  }

  // 5. Verify
  console.log('\n=== Verification ===');
  const remaining = await p.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true, isActive: true },
    orderBy: { employeeCode: 'asc' },
  });
  console.log(`Remaining employees: ${remaining.length}`);
  remaining.forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} ${e.lastName} active=${e.isActive}`));

  const runs = await p.payrollRun.findMany({ orderBy: { id: 'desc' }, take: 5 });
  console.log(`\nRemaining payroll runs: ${runs.length}`);
  runs.forEach(r => console.log(`  id=${r.id} ${r.year}-${String(r.month).padStart(2,'0')} ${r.status}`));

  await p.$disconnect();
  console.log('\n=== Cleanup complete ===');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

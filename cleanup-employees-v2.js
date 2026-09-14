const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KEEP_CODES = [
  'RC027','RC028','RC029','RC030','RC031','RC032',
  'RC033','RC034','RC035','RC036','RC037','RC114'
];

// All Prisma models that have an employeeId field, in safe deletion order
// (children before parents, standalone tables first).
const CHILD_MODELS = [
  // Attendance (already partially cleaned, but re-run to be safe)
  'dailyAttendance',
  'dailyAttendanceHistory',
  'monthlyAttendanceSummary',
  // Approvals stored on attendance — already handled via DailyAttendance
  'mispunchCorrection',
  // Leave / permission
  'leaveApplication',
  'permissionRequest',
  'leaveBalance',
  'leaveEncashment',
  // Comp-off
  'compOffRequest',
  'compOffTransaction',
  'compOffBalance',
  // Shift
  'shiftAssignmentOverride',
  'shiftChangeRequest',
  'shiftChangeNotification',
  // Salary / payroll
  'employeeSalaryRevision',
  'employeeSalaryComponent',
  'employeeCtc',
  'salaryRevisionRequest',
  'salaryRevisionComponent',
  'salaryArrear',
  'salaryArrearMonth',
  'bonusRecord',
  'gratuityRecord',
  'pmsIncentive',
  'employeeBenefit',
  // Loans
  'loan',
  'loanInstallment',
  // Documents / personal
  'employeeDocument',
  'personalDetails',
  'employeeContactDetails',
  'employeeEmergencyContact',
  'employeeBankDetail',
  'employeeDependent',
  'employeeExperience',
  'employeeEducation',
  'employeePassport',
  'employeeKyc',
  'employeeSkill',
  'employeeActivity',
  'employeeAssetAllocation',
  'exitInterview',
  // Biometric
  'biometricAttendanceImport',
  // Canteen / petrol / DM
  'canteenToken',
  'petrolAllowanceEntry',
  'doubleMachineEntry',
  // JobInfo — this is the FK that blocked the last run
  'jobInfo',
];

(async () => {
  console.log('=== Starting comprehensive cleanup ===\n');

  const keepEmps = await p.employee.findMany({
    where: { employeeCode: { in: KEEP_CODES } },
    select: { id: true, employeeCode: true },
  });
  const keepIds = keepEmps.map(e => e.id);
  console.log(`Keep: ${keepIds.length} employees (ids: ${keepIds.join(',')})`);

  const allEmps = await p.employee.findMany({ select: { id: true, employeeCode: true } });
  const removeIds = allEmps.filter(e => !keepIds.includes(e.id)).map(e => e.id);
  console.log(`Remove: ${removeIds.length} employees\n`);

  // Delete child records
  console.log('--- Deleting child records ---');
  for (const model of CHILD_MODELS) {
    if (!p[model] || typeof p[model].deleteMany !== 'function') {
      console.log(`  ${model.padEnd(30)} (not a Prisma model — skipped)`);
      continue;
    }
    try {
      // For loanInstallment, we need to delete via loanId
      if (model === 'loanInstallment') {
        const loans = await p.loan.findMany({ where: { employeeId: { in: removeIds } }, select: { id: true } });
        const loanIds = loans.map(l => l.id);
        if (loanIds.length > 0) {
          await p.loanInstallment.deleteMany({ where: { loanId: { in: loanIds } } });
        }
        console.log(`  ${model.padEnd(30)} ${loanIds.length} (via loan)`);
        continue;
      }
      // For employeeSalaryComponent, delete via revisionId
      if (model === 'employeeSalaryComponent') {
        const revs = await p.employeeSalaryRevision.findMany({ where: { employeeId: { in: removeIds } }, select: { id: true } });
        const revIds = revs.map(r => r.id);
        if (revIds.length > 0) {
          await p.employeeSalaryComponent.deleteMany({ where: { employeeSalaryRevisionId: { in: revIds } } });
        }
        console.log(`  ${model.padEnd(30)} ${revIds.length} (via revision)`);
        continue;
      }
      // For salaryRevisionComponent, delete via revisionRequestId
      if (model === 'salaryRevisionComponent') {
        const reqs = await p.salaryRevisionRequest.findMany({ where: { employeeId: { in: removeIds } }, select: { id: true } });
        const reqIds = reqs.map(r => r.id);
        if (reqIds.length > 0) {
          await p.salaryRevisionComponent.deleteMany({ where: { salaryRevisionRequestId: { in: reqIds } } });
        }
        console.log(`  ${model.padEnd(30)} ${reqIds.length} (via request)`);
        continue;
      }
      // For salaryArrearMonth, delete via salaryArrearId
      if (model === 'salaryArrearMonth') {
        const arrears = await p.salaryArrear.findMany({ where: { employeeId: { in: removeIds } }, select: { id: true } });
        const arrearIds = arrears.map(a => a.id);
        if (arrearIds.length > 0) {
          await p.salaryArrearMonth.deleteMany({ where: { salaryArrearId: { in: arrearIds } } });
        }
        console.log(`  ${model.padEnd(30)} ${arrearIds.length} (via arrear)`);
        continue;
      }
      const result = await p[model].deleteMany({ where: { employeeId: { in: removeIds } } });
      console.log(`  ${model.padEnd(30)} ${result.count}`);
    } catch (e) {
      console.log(`  ${model.padEnd(30)} ERROR: ${e.message.split('\n')[0]}`);
    }
  }

  // Delete employees
  console.log('\n--- Deleting employees ---');
  try {
    // Nullify userId first to avoid User-Employee FK issues
    await p.employee.updateMany({ where: { id: { in: removeIds }, userId: { not: null } }, data: { userId: null } });
    const del = await p.employee.deleteMany({ where: { id: { in: removeIds } } });
    console.log(`  Deleted ${del.count} employees`);
  } catch (e) {
    console.log(`  ERROR: ${e.message.split('\n')[0]}`);
    // List remaining FK constraints
    console.log('  Checking which child tables still have references...');
    for (const model of CHILD_MODELS) {
      if (!p[model] || typeof p[model].count !== 'function') continue;
      try {
        const c = await p[model].count({ where: { employeeId: { in: removeIds } } });
        if (c > 0) console.log(`    ${model}: ${c} rows remaining`);
      } catch {}
    }
  }

  // Verify
  console.log('\n=== Verification ===');
  const remaining = await p.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true, isActive: true },
    orderBy: { employeeCode: 'asc' },
  });
  console.log(`Remaining employees: ${remaining.length}`);
  remaining.forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} ${e.lastName} active=${e.isActive}`));

  await p.$disconnect();
  console.log('\n=== Done ===');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

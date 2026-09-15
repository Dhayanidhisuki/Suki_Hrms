const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Check all shift masters
    const allShifts = await p.shiftMaster.findMany({
      select: { id: true, code: true, name: true, startTime: true, endTime: true, nightAllowed: true, nightAllowanceAmount: true },
    });
    console.log('=== ALL Shift Masters ===');
    allShifts.forEach(s => console.log('  id=' + s.id + ' ' + s.code + ' ' + s.name + ' (' + s.startTime + '-' + s.endTime + ') nightAllowed=' + s.nightAllowed + ' allowance=' + s.nightAllowanceAmount));

    // Check Divya's daily attendance with shiftMasterId
    const att = await p.dailyAttendance.findMany({
      where: { employeeId: 373, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
      select: { date: true, shiftMasterId: true, status: true, inTime: true, outTime: true },
      orderBy: { date: 'asc' },
    });
    console.log('\n=== Divya Daily Attendance shiftMasterId ===');
    att.forEach(d => console.log('  ' + d.date.toISOString().slice(0,10) + ' shiftMasterId=' + d.shiftMasterId + ' status=' + d.status));

    // Check if NIGHT_ALLOWANCE was added as a salary component in the revision
    const rev = await p.employeeSalaryRevision.findFirst({
      where: { employeeId: 373, effectiveTo: null },
      include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true } } } } },
    });
    console.log('\n=== Divya Salary Revision Components ===');
    rev?.components.forEach(c => console.log('  ' + c.salaryComponent.code + ' ' + c.salaryComponent.name + ' ' + c.salaryComponent.type + ' = ' + c.amount));

  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

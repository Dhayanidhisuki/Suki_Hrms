const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Check the actual payroll line component for NIGHT_ALLOWANCE
    const naComp = await p.salaryComponent.findFirst({ where: { code: 'NIGHT_ALLOWANCE' } });
    console.log('NIGHT_ALLOWANCE component: id=' + naComp?.id + ' type=' + naComp?.type);

    // Find the payroll line component for Divya (RC028, employeeId=373) in run 36
    const plcs = await p.payrollLineComponent.findMany({
      where: {
        payrollLine: { employeeId: 373, payrollRunId: 36 },
        salaryComponentId: naComp?.id,
      },
      include: { payrollLine: { select: { id: true, netSalary: true } }, salaryComponent: { select: { code: true, name: true } } },
    });
    console.log('\nNIGHT_ALLOWANCE payroll line components for Divya: ' + plcs.length);
    plcs.forEach(c => console.log('  id=' + c.id + ' amount=' + c.amount + ' isAdhoc=' + c.isAdhoc + ' lineId=' + c.payrollLineId));

    // Check all shift masters with nightAllowed
    const nightShifts = await p.shiftMaster.findMany({
      where: { nightAllowed: true },
      select: { id: true, shiftName: true, startTime: true, endTime: true, nightAllowed: true, nightAllowanceAmount: true },
    });
    console.log('\n=== Night Shifts ===');
    if (nightShifts.length === 0) console.log('  (none configured)');
    nightShifts.forEach(s => console.log('  id=' + s.id + ' ' + s.shiftName + ' (' + s.startTime + '-' + s.endTime + ') nightAllowed=' + s.nightAllowed + ' allowance=' + s.nightAllowanceAmount));

    // Check all shift masters
    const allShifts = await p.shiftMaster.findMany({
      select: { id: true, shiftName: true, startTime: true, endTime: true, nightAllowed: true, nightAllowanceAmount: true, isNightShift: true },
    });
    console.log('\n=== ALL Shift Masters ===');
    allShifts.forEach(s => console.log('  id=' + s.id + ' ' + s.shiftName + ' (' + s.startTime + '-' + s.endTime + ') nightAllowed=' + s.nightAllowed + ' allowance=' + s.nightAllowanceAmount + ' isNightShift=' + s.isNightShift));

    // Check Divya's daily attendance with shiftMasterId
    const att = await p.dailyAttendance.findMany({
      where: { employeeId: 373, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
      select: { date: true, shiftMasterId: true, status: true, inTime: true, outTime: true },
      orderBy: { date: 'asc' },
    });
    console.log('\n=== Divya Daily Attendance shiftMasterId ===');
    att.forEach(d => console.log('  ' + d.date.toISOString().slice(0,10) + ' shiftMasterId=' + d.shiftMasterId + ' status=' + d.status));

  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

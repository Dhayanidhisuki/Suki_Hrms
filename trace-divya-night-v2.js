const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const emp = await p.employee.findFirst({ where: { employeeCode: 'RC028' }, select: { id: true } });
    console.log('RC028 employeeId=' + emp.id);

    // Shift overrides
    const shifts = await p.shiftAssignmentOverride.findMany({
      where: { employeeId: emp.id, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
      include: { shiftMaster: true },
      orderBy: { date: 'asc' },
    });
    console.log('\n=== Shift Overrides (July 2026) ===');
    console.log('count=' + shifts.length);
    shifts.forEach(s => console.log('  ' + s.date.toISOString().slice(0,10) + ' -> ' + s.shiftMaster?.shiftName + ' night=' + s.shiftMaster?.isNightShift));

    // JobInfo
    const jobInfo = await p.jobInfo.findFirst({
      where: { employeeId: emp.id },
      include: { shiftMaster: true },
    });
    console.log('\nJobInfo shift: ' + jobInfo?.shiftMaster?.shiftName + ' night=' + jobInfo?.shiftMaster?.isNightShift);
    console.log('employeeTypeId=' + jobInfo?.employeeTypeId);

    // Daily attendance
    const attendance = await p.dailyAttendance.findMany({
      where: { employeeId: emp.id, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
      include: { shiftMaster: true },
      orderBy: { date: 'asc' },
    });
    console.log('\n=== Daily Attendance (July 2026) ===');
    console.log('count=' + attendance.length);
    attendance.forEach(d => {
      const night = d.shiftMaster?.isNightShift ? ' *** NIGHT ***' : '';
      const inT = d.inTime ? new Date(d.inTime).toISOString().slice(11,16) : '--:--';
      const outT = d.outTime ? new Date(d.outTime).toISOString().slice(11,16) : '--:--';
      console.log('  ' + d.date.toISOString().slice(0,10) + ' shift=' + d.shiftMaster?.shiftName + ' in=' + inT + ' out=' + outT + ' ot=' + d.otMinutesCalculated + ' late=' + d.lateMinutes + ' status=' + d.status + night);
    });

    // Benefit rates
    const benefitRates = await p.benefitRateByEmployeeType.findMany({
      where: { employeeTypeId: jobInfo?.employeeTypeId, isActive: true },
      include: { salaryComponent: { select: { code: true, name: true, type: true } } },
    });
    console.log('\n=== Benefit Rates ===');
    benefitRates.forEach(b => console.log('  ' + b.salaryComponent?.code + ' ' + b.salaryComponent?.name + ' ' + b.salaryComponent?.type + ' = ' + b.amount));

    // Payroll line components
    const payLine = await p.payrollLine.findFirst({
      where: { employeeId: emp.id, payrollRunId: 36 },
      include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true } } } } },
    });
    console.log('\n=== Payroll Line Components (Run 36) ===');
    payLine?.components.forEach(c => console.log('  ' + c.salaryComponent.code + ' (' + c.salaryComponent.type + ') = ' + c.amount + ' isAdhoc=' + c.isAdhoc));

  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

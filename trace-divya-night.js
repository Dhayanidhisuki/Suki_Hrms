const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const emp = await p.employee.findFirst({ where: { employeeCode: 'RC028' }, select: { id: true } });
  console.log(`RC028 employeeId=${emp.id}`);

  // Shift overrides for Divya in July 2026
  const shifts = await p.shiftAssignmentOverride.findMany({
    where: { employeeId: emp.id, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
    include: { shiftMaster: { select: { shiftName: true, startTime: true, endTime: true, isNightShift: true } } },
    orderBy: { date: 'asc' },
  });
  console.log('\n=== Shift Overrides (July 2026) ===');
  if (shifts.length === 0) console.log('  (none — using default shift from JobInfo)');
  shifts.forEach(s => console.log(`  ${s.date.toISOString().slice(0,10)} -> ${s.shiftMaster?.shiftName} (${s.shiftMaster?.startTime}-${s.shiftMaster?.endTime}) night=${s.shiftMaster?.isNightShift}`));

  // JobInfo shift
  const jobInfo = await p.jobInfo.findFirst({
    where: { employeeId: emp.id },
    include: { shiftMaster: { select: { shiftName: true, startTime: true, endTime: true, isNightShift: true } } },
  });
  console.log(`\nJobInfo shift: ${jobInfo?.shiftMaster?.shiftName} (${jobInfo?.shiftMaster?.startTime}-${jobInfo?.shiftMaster?.endTime}) night=${jobInfo?.shiftMaster?.isNightShift}`);

  // Daily attendance
  const attendance = await p.dailyAttendance.findMany({
    where: { employeeId: emp.id, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
    include: { shiftMaster: { select: { shiftName: true, startTime: true, endTime: true, isNightShift: true } } },
    orderBy: { date: 'asc' },
  });
  console.log('\n=== Daily Attendance (July 2026) ===');
  if (attendance.length === 0) console.log('  (none)');
  attendance.forEach(d => {
    const nightFlag = d.shiftMaster?.isNightShift ? ' *** NIGHT ***' : '';
    const inT = d.inTime ? new Date(d.inTime).toISOString().slice(11,16) : '--:--';
    const outT = d.outTime ? new Date(d.outTime).toISOString().slice(11,16) : '--:--';
    console.log(`  ${d.date.toISOString().slice(0,10)} shift=${d.shiftMaster?.shiftName} (${d.shiftMaster?.startTime}-${d.shiftMaster?.endTime}) in=${inT} out=${outT} ot=${d.otMinutesCalculated} late=${d.lateMinutes} status=${d.status}${nightFlag}`);
  });

  // Night allowance benefit rate
  const benefitRates = await p.benefitRateByEmployeeType.findMany({
    where: { employeeTypeId: jobInfo?.employeeTypeId, isActive: true },
    include: { salaryComponent: { select: { code: true, name: true, type: true } } },
  });
  console.log('\n=== Benefit Rates for employeeTypeId=' + jobInfo?.employeeTypeId + ' ===');
  benefitRates.forEach(b => console.log(`  ${b.salaryComponent?.code} ${b.salaryComponent?.name} ${b.salaryComponent?.type} = ${b.amount}`));

  // Night allowance component
  const nightComp = await p.salaryComponent.findFirst({ where: { code: { contains: 'NIGHT' } } });
  console.log(`\nNight allowance component: ${nightComp?.code} ${nightComp?.name} (id=${nightComp?.id})`);

  // Payroll line components for Divya in run 36
  const payLine = await p.payrollLine.findFirst({
    where: { employeeId: emp.id, payrollRunId: 36 },
    include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true } } } } },
  });
  console.log('\n=== Payroll Line Components (Run 36) ===');
  payLine?.components.forEach(c => console.log(`  ${c.salaryComponent.code} (${c.salaryComponent.type}) = ${c.amount} isAdhoc=${c.isAdhoc}`));

  await p.$disconnect();
})().catch(e => { console.error(e.message.split('\n').slice(0,8).join('\n')); process.exit(1); });

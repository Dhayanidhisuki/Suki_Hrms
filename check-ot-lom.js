const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Check OT plans
    const otPlans = await p.oTPlan.findMany();
    console.log('=== OT Plans ===');
    otPlans.forEach(o => console.log(`  id=${o.id} name=${o.name} threshold=${o.applicableAfterMinutes} maxDay=${o.maxOtHoursPerDay} maxMonth=${o.maxOtHoursPerMonth} rate=${o.otRateMultiplier} weekday=${o.weekdayFactor} holiday=${o.holidayFactor}`));

    // Check LomConfig
    const lomConfig = await p.lomConfig.findUnique({ where: { companyId: 1 } });
    console.log('\n=== LOM Config ===');
    console.log('  grace=' + lomConfig?.graceMinutesExempt + ' cap=' + lomConfig?.dailyLomCap + ' basis=' + lomConfig?.calculationBasis + ' multiplier=' + lomConfig?.multiplier + ' denom=' + lomConfig?.payrollDaysDenominator + ' shiftSource=' + lomConfig?.shiftDurationSource);

    // Check Divya's daily attendance for LOM and OT
    const att = await p.dailyAttendance.findMany({
      where: { employeeId: 373, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
      include: { shiftMaster: { select: { code: true, name: true, graceMinutes: true, bufferMinutes: true, startTime: true, endTime: true } } },
      orderBy: { date: 'asc' },
    });
    console.log('\n=== RC028 Divya Daily Attendance (LOM/OT) ===');
    att.forEach(d => {
      const inT = d.inTime ? new Date(d.inTime).toISOString().slice(11,16) : '--:--';
      const outT = d.outTime ? new Date(d.outTime).toISOString().slice(11,16) : '--:--';
      console.log(`  ${d.date.toISOString().slice(0,10)} shift=${d.shiftMaster?.code} in=${inT} out=${outT} late=${d.lateMinutes} early=${d.earlyOutMinutes} otCalc=${d.otMinutesCalculated} otAppr=${d.otMinutesApproved} otStatus=${d.otApprovalStatus} settle=${d.otSettlementType} work=${d.workingMinutes} (shift grace=${d.shiftMaster?.graceMinutes})`);
    });

    // Monthly summary
    const summary = await p.monthlyAttendanceSummary.findFirst({ where: { employeeId: 373, year: 2026, month: 7 } });
    console.log('\n=== Monthly Summary RC028 ===');
    console.log(`  payable=${summary?.payableDays} late=${summary?.lateMinutesTotal} early=${summary?.earlyOutMinutesTotal} ot=${summary?.otMinutesTotal}`);

  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const [line, att, otPlan, revision] = await Promise.all([
      p.payrollLine.findFirst({ where: { employeeId: 373, payrollRunId: 36 } }),
      p.dailyAttendance.findMany({
        where: { employeeId: 373, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
        include: { shiftMaster: { select: { code: true } } },
        orderBy: { date: 'asc' },
      }),
      p.oTPlan.findFirst({ where: { isActive: true } }),
      p.employeeSalaryRevision.findFirst({
        where: { employeeId: 373, effectiveTo: null },
        include: { components: { include: { salaryComponent: { select: { code: true, type: true } } } } },
      }),
    ]);

    const threshold = otPlan?.applicableAfterMinutes ?? 0;
    const capMin = (otPlan?.maxOtHoursPerDay ?? 3) * 60;
    const fullGross = Number(revision?.grossSalary ?? line?.grossEarnings);
    const perHour = fullGross / 31 / 8;

    console.log('=== Divya (RC028) July 2026 OT Verification ===\n');
    console.log(`OT Plan: threshold=${threshold} min, cap=${capMin} min, multiplier=${otPlan?.otRateMultiplier}, weekdayFactor=${otPlan?.weekdayFactor}`);
    console.log(`Salary revision gross (OT basis): ${fullGross}`);
    console.log(`Payroll gross (prorated): ${line?.grossEarnings}`);
    console.log(`OT hourly rate: ${perHour.toFixed(4)}`);
    console.log(`Stored OT amount: ${line?.otAmount}`);
    console.log(`\nFormula: if rawOT >= ${threshold}, payable = min(rawOT, ${capMin})\n`);

    console.log('Date       | Shift     | Day Type | Raw OT | Payable | Rate/Hr | Factor | Amount');
    console.log('-----------|-----------|----------|--------|---------|---------|--------|-------');
    let totalPayableMin = 0;
    let totalPayableAmount = 0;

    for (const d of att) {
      if (!['Present', 'HalfDay', 'OnDuty'].includes(d.status)) continue;
      const raw = d.otMinutesCalculated || 0;
      let payable = 0;
      let reason = '';
      if (raw < threshold) {
        reason = 'below threshold';
      } else if (raw > capMin) {
        payable = capMin;
        reason = `capped`;
      } else {
        payable = raw;
        reason = 'full';
      }
      if (payable === 0) continue;

      const dayType = d.isHolidayWorked ? 'Holiday' : d.isWeeklyOffWorked ? 'Weekly Off' : 'Weekday';
      const dayFactor = d.isHolidayWorked
        ? Number(otPlan?.holidayFactor ?? 1)
        : d.isWeeklyOffWorked
          ? Number(otPlan?.weeklyOffFactor ?? 1)
          : Number(otPlan?.weekdayFactor ?? 1);
      const effectiveFactor = Number(otPlan?.otRateMultiplier ?? 1.5) * dayFactor;
      const hours = payable / 60;
      const amount = hours * perHour * effectiveFactor;
      totalPayableMin += payable;
      totalPayableAmount += amount;

      console.log(`${d.date.toISOString().slice(0,10)} | ${(d.shiftMaster?.code || '—').padEnd(9)} | ${dayType.padEnd(10)} | ${String(raw).padStart(6)} | ${String(payable).padStart(7)} | ${perHour.toFixed(2).padStart(7)} | ${String(effectiveFactor).padStart(6)} | ${amount.toFixed(2)}`);
    }

    console.log(`\nTotal payable OT minutes: ${totalPayableMin}`);
    console.log(`Total OT hours: ${(totalPayableMin / 60).toFixed(2)}`);
    console.log(`Calculated OT amount: ${totalPayableAmount.toFixed(2)}`);
    console.log(`Stored OT amount: ${line?.otAmount}`);
    console.log(`\nPayslip Total Earnings = ${Number(line?.grossEarnings) + Number(line?.otherEarningsTotal)}`);
    console.log(`  (gross ${line?.grossEarnings} + other earnings ${line?.otherEarningsTotal})`);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  await p.$disconnect();
})();

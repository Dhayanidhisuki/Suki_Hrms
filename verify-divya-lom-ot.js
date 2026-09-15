const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const lomConfig = await p.lomConfig.findUnique({ where: { companyId: 1 } });
    const otPlan = await p.oTPlan.findFirst({ where: { isActive: true } });

    console.log('=== LOM Config ===');
    console.log(`  grace (legacy) = ${lomConfig?.graceMinutesExempt}`);
    console.log(`  cap = ${lomConfig?.dailyLomCap}`);
    console.log(`  basis = ${lomConfig?.calculationBasis}`);
    console.log(`  multiplier = ${lomConfig?.multiplier}`);

    console.log('\n=== OT Plan ===');
    console.log(`  threshold = ${otPlan?.applicableAfterMinutes} min`);
    console.log(`  max per day = ${otPlan?.maxOtHoursPerDay} hours`);
    console.log(`  multiplier = ${otPlan?.otRateMultiplier}`);

    const att = await p.dailyAttendance.findMany({
      where: { employeeId: 373, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
      include: { shiftMaster: { select: { code: true, graceMinutes: true } } },
      orderBy: { date: 'asc' },
    });

    console.log('\n=== Divya (RC028) LOM & OT day-by-day ===');
    let totalLom = 0;
    let totalOt = 0;
    att.forEach(d => {
      if (!['Present', 'HalfDay', 'OnDuty'].includes(d.status)) return;
      const raw = (d.lateMinutes || 0) + (d.earlyOutMinutes || 0);
      const grace = d.shiftMaster?.graceMinutes ?? 0;
      const lom = Math.min(Math.max(0, raw - grace), lomConfig?.dailyLomCap || 240);
      totalLom += lom;

      const otCalc = d.otMinutesCalculated || 0;
      const otAppr = d.otMinutesApproved || 0;
      const rawOt = d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT' ? otAppr : otCalc;
      const threshold = otPlan?.applicableAfterMinutes || 0;
      const capMin = (otPlan?.maxOtHoursPerDay || 3) * 60;
      const otAfterThreshold = Math.max(0, rawOt - threshold);
      const otCapped = Math.min(otAfterThreshold, capMin);
      if (otCapped > 0) totalOt += otCapped;

      console.log(`  ${d.date.toISOString().slice(0,10)} ${d.shiftMaster?.code} late=${d.lateMinutes} early=${d.earlyOutMinutes} grace=${grace} LOM=${lom} otCalc=${otCalc} otAppr=${otAppr} rawOt=${rawOt} -> OT(after ${threshold}min thresh, ${capMin}min cap)=${otCapped}`);
    });
    console.log(`\nTotal LOM minutes = ${totalLom}`);
    console.log(`Total OT minutes = ${totalOt}`);

    const line = await p.payrollLine.findFirst({
      where: { employeeId: 373, payrollRunId: 36 },
      include: { components: { include: { salaryComponent: { select: { code: true, type: true } } } } },
    });
    console.log('\n=== Payroll Line RC028 ===');
    console.log(`  gross=${line?.grossEarnings} otAmount=${line?.otAmount} otherEarn=${line?.otherEarningsTotal} otherDed=${line?.otherDeductionsTotal} lom=${line?.lomAmount} net=${line?.netSalary}`);
    console.log('\n=== Components ===');
    line?.components.forEach(c => console.log(`  ${c.salaryComponent.code} (${c.salaryComponent.type}) = ${c.amount}`));

  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

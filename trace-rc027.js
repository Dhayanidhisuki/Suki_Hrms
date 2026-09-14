const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // RC027 = employeeId 372
  const empId = 372;

  // 1. Salary revision components
  const rev = await p.employeeSalaryRevision.findFirst({
    where: { employeeId: empId, effectiveTo: null },
    include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true, includeInPf: true, includeInEsi: true } } } } },
  });
  console.log('=== Salary Revision ===');
  rev.components.forEach(c => console.log(`  ${c.salaryComponent.code} ${c.salaryComponent.type} amount=${c.amount} includeInPf=${c.salaryComponent.includeInPf}`));

  // 2. Monthly attendance summary for July 2026
  const sum = await p.monthlyAttendanceSummary.findFirst({
    where: { employeeId: empId, year: 2026, month: 7 },
  });
  console.log('\n=== July 2026 Attendance Summary ===');
  console.log(`  totalWorkingDays=${sum.totalWorkingDays} payableDays=${sum.payableDays} lopDays=${sum.lopDays}`);
  console.log(`  otMinutesTotal=${sum.otMinutesTotal} lateMinutesTotal=${sum.lateMinutesTotal} earlyOutMinutesTotal=${sum.earlyOutMinutesTotal}`);

  // 3. Daily attendance with LOM approval status
  const lomDays = await p.dailyAttendance.findMany({
    where: { employeeId: empId, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
    select: { date: true, lateMinutes: true, earlyOutMinutes: true, lomApprovalStatus: true, lomApprovedMinutes: true, otMinutesCalculated: true, otMinutesApproved: true, otApprovalStatus: true, otSettlementType: true },
    orderBy: { date: 'asc' },
  });
  console.log('\n=== Daily Attendance (July 2026) ===');
  lomDays.forEach(d => console.log(`  ${d.date.toISOString().slice(0,10)} late=${d.lateMinutes} early=${d.earlyOutMinutes} lomStatus=${d.lomApprovalStatus} lomApproved=${d.lomApprovedMinutes} otCalc=${d.otMinutesCalculated} otStatus=${d.otApprovalStatus} otSettle=${d.otSettlementType}`));

  // 4. LOM config
  const lomConfig = await p.lomConfig.findFirst({ where: { companyId: 1 } });
  console.log('\n=== LOM Config ===');
  console.log(`  basis=${lomConfig?.calculationBasis} grace=${lomConfig?.graceMinutesExempt} cap=${lomConfig?.dailyLomCap} multiplier=${lomConfig?.multiplier} source=${lomConfig?.shiftDurationSource} denom=${lomConfig?.payrollDaysDenominator}`);

  // 5. PF rate
  const pfRate = await p.pfRate.findFirst({ where: { companyId: 1, effectiveTo: null } });
  console.log('\n=== PF Rate ===');
  console.log(`  employee=${pfRate?.employeeContributionRate}% employer=${pfRate?.employerContributionRate}% cap=${pfRate?.pfWageCeiling}`);

  // 6. OT plan
  const otPlan = await p.oTPlan.findFirst({ where: { companyId: 1, isActive: true } });
  console.log('\n=== OT Plan ===');
  console.log(`  multiplier=${otPlan?.otMultiplier} threshold=${otPlan?.applicableAfterMinutes} maxHoursDay=${otPlan?.maxOtHoursPerDay} maxHoursMonth=${otPlan?.maxOtHoursPerMonth}`);

  // 7. Deduction rates
  const dedRates = await p.deductionRate.findMany({ where: { companyId: 1, isActive: true } });
  console.log('\n=== Deduction Rates ===');
  if (dedRates.length === 0) console.log('  (none)');
  dedRates.forEach(d => console.log(`  ${d.code} type=${d.deductionType} value=${d.rateValue} isLop=${d.isLop}`));

  // 8. LWF rates
  const lwfRates = await p.lwfRate.findMany({ where: { companyId: 1, isActive: true } });
  console.log('\n=== LWF Rates ===');
  if (lwfRates.length === 0) console.log('  (none)');
  lwfRates.forEach(d => console.log(`  type=${d.rateType} empRate=${d.employeeRate} month=${d.deductionMonth}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // PF rate
  const pfRate = await p.pfRate.findFirst({ where: { isActive: true } });
  console.log('=== PF Rate ===');
  console.log(`  employee=${pfRate?.employeeContributionRate}% employer=${pfRate?.employerContributionRate}% ceiling=${pfRate?.wageCeilingMonthly}`);

  // OT plan
  const otPlan = await p.oTPlan.findFirst({ where: { isActive: true } });
  console.log('\n=== OT Plan ===');
  console.log(`  multiplier=${otPlan?.otMultiplier} threshold=${otPlan?.applicableAfterMinutes} maxHoursDay=${otPlan?.maxOtHoursPerDay} maxHoursMonth=${otPlan?.maxOtHoursPerMonth}`);

  // Deduction rates
  const dedRates = await p.deductionRate.findMany({ where: { isActive: true } });
  console.log('\n=== Deduction Rates ===');
  if (dedRates.length === 0) console.log('  (none)');
  dedRates.forEach(d => console.log(`  ${d.code} type=${d.deductionType} value=${d.rateValue} isLop=${d.isLop}`));

  // LWF rates
  const lwfRates = await p.lwfRate.findMany({ where: { isActive: true } });
  console.log('\n=== LWF Rates ===');
  if (lwfRates.length === 0) console.log('  (none)');
  lwfRates.forEach(d => console.log(`  type=${d.rateType} empRate=${d.employeeRate} month=${d.deductionMonth}`));

  // Health insurance
  const hi = await p.healthInsuranceConfig.findFirst();
  console.log('\n=== Health Insurance ===');
  console.log(`  active=${hi?.isActive} empRate=${hi?.employeeContributionRate} premium=${hi?.monthlyPremium}`);

  // LIC
  const lic = await p.licDeductionConfig?.findFirst?.() ?? null;
  console.log('\n=== LIC ===');
  console.log(`  ${lic ? JSON.stringify(lic) : '(none or table missing)'}`);

  // Benefit rates for this employee
  const emp = await p.employee.findFirst({ where: { employeeCode: 'RC027' }, select: { id: true } });
  const jobInfo = await p.jobInfo.findFirst({ where: { employeeId: emp.id }, select: { employeeTypeId: true } });
  console.log('\n=== JobInfo ===');
  console.log(`  employeeTypeId=${jobInfo?.employeeTypeId}`);

  if (jobInfo?.employeeTypeId) {
    const benefitRates = await p.benefitRateByEmployeeType.findMany({
      where: { employeeTypeId: jobInfo.employeeTypeId, isActive: true },
      include: { salaryComponent: { select: { code: true, name: true, type: true } } },
    });
    console.log('\n=== Benefit Rates ===');
    if (benefitRates.length === 0) console.log('  (none)');
    benefitRates.forEach(b => console.log(`  ${b.salaryComponent?.code} ${b.salaryComponent?.type} amount=${b.amount}`));
  }

  // Salary components with type deduction that might be auto-applied
  const dedComponents = await p.salaryComponent.findMany({ where: { type: 'deduction' }, select: { code: true, name: true } });
  console.log('\n=== Deduction Salary Components (catalog) ===');
  dedComponents.forEach(c => console.log(`  ${c.code} ${c.name}`));

  await p.$disconnect();
})().catch(e => { console.error(e.message.split('\n').slice(0,5).join('\n')); process.exit(1); });

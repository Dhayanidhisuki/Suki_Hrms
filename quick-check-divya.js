const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const line = await p.payrollLine.findFirst({
      where: { employeeId: 373, payrollRunId: 36 },
      include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true } } } } },
    });
    console.log('=== RC028 Divya Payroll Line ===');
    console.log(`gross=${line?.grossEarnings} otAmount=${line?.otAmount} otherEarn=${line?.otherEarningsTotal} pf=${line?.pfEmployee} otherDed=${line?.otherDeductionsTotal} lom=${line?.lomAmount} net=${line?.netSalary}`);
    console.log('\n=== Components ===');
    line?.components.forEach(c => console.log(`  ${c.salaryComponent.code} (${c.salaryComponent.name}, ${c.salaryComponent.type}) = ${c.amount}`));
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

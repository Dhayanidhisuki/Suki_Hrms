const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Get all benefit rates for employeeTypeId=5
    const rates = await p.benefitRateByEmployeeType.findMany({
      where: { employeeTypeId: 5, isActive: true },
      include: { salaryComponent: { select: { id: true, code: true, name: true, type: true } } },
    });
    console.log('=== Benefit Rates for employeeTypeId=5 ===');
    rates.forEach(r => console.log('  id=' + r.id + ' componentId=' + r.salaryComponentId + ' code=' + r.salaryComponent?.code + ' name=' + r.salaryComponent?.name + ' type=' + r.salaryComponent?.type + ' amount=' + r.amount));

    // Get all benefit rates for all types
    const allRates = await p.benefitRateByEmployeeType.findMany({
      where: { isActive: true },
      include: { salaryComponent: { select: { id: true, code: true, name: true, type: true } } },
    });
    console.log('\n=== ALL Benefit Rates ===');
    allRates.forEach(r => console.log('  employeeTypeId=' + r.employeeTypeId + ' componentId=' + r.salaryComponentId + ' code=' + r.salaryComponent?.code + ' name=' + r.salaryComponent?.name + ' type=' + r.salaryComponent?.type + ' amount=' + r.amount));

    // Check NIGHT_ALLOWANCE component
    const naComp = await p.salaryComponent.findFirst({ where: { code: 'NIGHT_ALLOWANCE' } });
    console.log('\nNIGHT_ALLOWANCE component: id=' + naComp?.id + ' type=' + naComp?.type);

    // Check which benefit rates reference NIGHT_ALLOWANCE
    const naRates = allRates.filter(r => r.salaryComponent?.code === 'NIGHT_ALLOWANCE');
    console.log('NIGHT_ALLOWANCE benefit rates: ' + naRates.length);
    naRates.forEach(r => console.log('  employeeTypeId=' + r.employeeTypeId + ' amount=' + r.amount));

  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const lines = await p.payrollLine.findMany({
    where: { payrollRunId: 31 },
    include: {
      employee: { select: { employeeCode: true, firstName: true } },
      components: { include: { salaryComponent: { select: { code: true, type: true } } } },
    },
    orderBy: { employeeId: 'asc' },
  });
  for (const line of lines) {
    const naComp = line.components.find(c => c.salaryComponent.code === 'NIGHT_ALLOWANCE');
    const otComp = line.components.find(c => c.salaryComponent.code === 'OT_PAY');
    const lomComp = line.components.find(c => c.salaryComponent.code === 'LOM');
    console.log(
      line.employee.employeeCode, line.employee.firstName,
      '| gross:', line.grossEarnings,
      '| OT:', line.otAmount,
      '| LOM:', line.lomAmount,
      '| night:', naComp ? naComp.amount : 0,
      '| net:', line.netSalary
    );
  }

  // Also check approved LOM minutes per employee
  const lomApproved = await p.dailyAttendance.findMany({
    where: {
      date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') },
      employee: { companyId: 1, isActive: true },
      lomApprovalStatus: 'approved',
    },
    select: { employeeId: true, lomApprovedMinutes: true },
  });
  const byEmp = {};
  lomApproved.forEach(r => {
    byEmp[r.employeeId] = (byEmp[r.employeeId] ?? 0) + (r.lomApprovedMinutes ?? 0);
  });
  console.log('\nApproved LOM minutes per employee:');
  Object.entries(byEmp).forEach(([empId, min]) => console.log('  emp', empId, ':', min, 'min'));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

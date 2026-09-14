const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const lomComp = await p.salaryComponent.findUnique({ where: { companyId_code: { companyId: 1, code: 'LOM' } } });
  console.log('LOM component:', lomComp ? lomComp.id + ' ' + lomComp.name : 'NOT FOUND');
  const lines = await p.payrollLine.findMany({
    where: { payrollRunId: 31 },
    select: { employeeId: true, lomAmount: true, grossEarnings: true, netSalary: true },
    orderBy: { employeeId: 'asc' },
  });
  lines.forEach(l => console.log('emp', l.employeeId, '| gross:', l.grossEarnings, '| LOM:', l.lomAmount, '| net:', l.netSalary));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

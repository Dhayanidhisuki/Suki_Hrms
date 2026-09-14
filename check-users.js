const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find employees with userId set
  const emps = await p.employee.findMany({
    where: { userId: { not: null }, deletedAt: null },
    select: { id: true, employeeCode: true, firstName: true, userId: true, reportingManagerId: true },
    take: 20,
  });
  console.log('Employees with userId:');
  emps.forEach(e => console.log('  empId=', e.id, 'code=', e.employeeCode, 'name=', e.firstName, 'userId=', e.userId, 'managerId=', e.reportingManagerId));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

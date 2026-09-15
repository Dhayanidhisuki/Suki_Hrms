const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const mgr = await p.employee.findUnique({
    where: { id: 386 },
    select: { id: true, employeeCode: true, firstName: true, userId: true, isActive: true, deletedAt: true },
  });
  console.log('Manager (emp 386):', mgr);

  if (mgr?.userId) {
    const user = await p.user.findUnique({
      where: { id: mgr.userId },
      select: { id: true, email: true, roleId: true, isSuperAdmin: true, companyId: true },
    });
    console.log('Manager user:', user);
  } else {
    console.log('Manager has no userId — cannot test L1 approval via API');
    // Find any employee with a userId that is active
    const empsWithUsers = await p.employee.findMany({
      where: { userId: { not: null }, deletedAt: null, isActive: true },
      select: { id: true, employeeCode: true, firstName: true, userId: true, reportingManagerId: true },
    });
    console.log('All employees with userId:', empsWithUsers);
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

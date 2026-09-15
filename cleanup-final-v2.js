const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KEEP_CODES = ['RC027','RC028','RC029','RC030','RC031','RC032','RC033','RC034','RC035','RC036','RC037','RC114'];

(async () => {
  const keepEmps = await p.employee.findMany({ where: { employeeCode: { in: KEEP_CODES } }, select: { id: true } });
  const keepIds = keepEmps.map(e => e.id);
  const allEmps = await p.employee.findMany({ select: { id: true } });
  const removeIds = allEmps.filter(e => !keepIds.includes(e.id)).map(e => e.id);
  console.log(`Remove: ${removeIds.length} employees`);

  // 1. Null out reportingManagerId for anyone referencing a remove employee
  const r1 = await p.employee.updateMany({
    where: { reportingManagerId: { in: removeIds } },
    data: { reportingManagerId: null },
  });
  console.log(`reportingManagerId cleared: ${r1.count}`);

  // 2. Also null out userId for remove employees
  const r2 = await p.employee.updateMany({
    where: { id: { in: removeIds }, userId: { not: null } },
    data: { userId: null },
  });
  console.log(`userId cleared: ${r2.count}`);

  // 3. Delete employees
  console.log('\n--- Deleting employees ---');
  try {
    const del = await p.employee.deleteMany({ where: { id: { in: removeIds } } });
    console.log(`Deleted ${del.count} employees`);
  } catch (e) {
    console.log(`ERROR: ${e.message.split('\n').slice(0,5).join('\n')}`);
  }

  // Verify
  console.log('\n=== Verification ===');
  const remaining = await p.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true, isActive: true, departmentId: true, reportingManagerId: true },
    orderBy: { employeeCode: 'asc' },
  });
  console.log(`Remaining employees: ${remaining.length}`);
  remaining.forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} ${e.lastName} active=${e.isActive} dept=${e.departmentId} mgr=${e.reportingManagerId}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

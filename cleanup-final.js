const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KEEP_CODES = ['RC027','RC028','RC029','RC030','RC031','RC032','RC033','RC034','RC035','RC036','RC037','RC114'];

(async () => {
  const keepEmps = await p.employee.findMany({ where: { employeeCode: { in: KEEP_CODES } }, select: { id: true } });
  const keepIds = keepEmps.map(e => e.id);
  const allEmps = await p.employee.findMany({ select: { id: true } });
  const removeIds = allEmps.filter(e => !keepIds.includes(e.id)).map(e => e.id);
  console.log(`Remove: ${removeIds.length} employees`);

  // 1. Delete doubleMachineIncentive rows
  try {
    const r = await p.doubleMachineIncentive.deleteMany({ where: { employeeId: { in: removeIds } } });
    console.log(`doubleMachineIncentive: ${r.count} deleted`);
  } catch (e) { console.log(`doubleMachineIncentive: ${e.message.split('\n')[0]}`); }

  // 2. Unlink Users from remove employees (User.employee is a nullable 1:1 relation)
  try {
    const r = await p.user.updateMany({
      where: { employee: { id: { in: removeIds } } },
      data: { employee: { disconnect: true } },
    });
    console.log(`User links disconnected: ${r.count}`);
  } catch (e) { console.log(`User unlink: ${e.message.split('\n')[0]}`); }

  // 3. Now delete employees
  console.log('\n--- Deleting employees ---');
  try {
    const del = await p.employee.deleteMany({ where: { id: { in: removeIds } } });
    console.log(`Deleted ${del.count} employees`);
  } catch (e) {
    console.log(`ERROR: ${e.message.split('\n')[0]}`);
    // Find remaining blockers
    const modelNames = Object.keys(p).filter(k => typeof p[k] === 'object' && p[k] !== null && typeof p[k].count === 'function');
    console.log('\nRemaining blockers:');
    for (const model of modelNames.sort()) {
      try {
        const count = await p[model].count({ where: { employeeId: { in: removeIds } } });
        if (count > 0) console.log(`  ${model}: ${count}`);
      } catch {}
    }
  }

  // Verify
  console.log('\n=== Verification ===');
  const remaining = await p.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true, isActive: true },
    orderBy: { employeeCode: 'asc' },
  });
  console.log(`Remaining employees: ${remaining.length}`);
  remaining.forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} ${e.lastName} active=${e.isActive}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

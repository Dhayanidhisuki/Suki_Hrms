const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KEEP_CODES = ['RC027','RC028','RC029','RC030','RC031','RC032','RC033','RC034','RC035','RC036','RC037','RC114'];

(async () => {
  const keepEmps = await p.employee.findMany({ where: { employeeCode: { in: KEEP_CODES } }, select: { id: true } });
  const keepIds = keepEmps.map(e => e.id);
  const allEmps = await p.employee.findMany({ select: { id: true } });
  const removeIds = allEmps.filter(e => !keepIds.includes(e.id)).map(e => e.id);
  console.log(`Remove IDs: ${removeIds.length} employees`);

  // Get all Prisma model names
  const modelNames = Object.keys(p).filter(k => typeof p[k] === 'object' && p[k] !== null && typeof p[k].count === 'function');
  
  console.log('\nChecking all Prisma models for employeeId references:');
  for (const model of modelNames.sort()) {
    try {
      const count = await p[model].count({ where: { employeeId: { in: removeIds } } });
      if (count > 0) {
        console.log(`  ${model}: ${count} rows`);
      }
    } catch (e) {
      // Model doesn't have employeeId field — skip silently
    }
  }

  // Also check BiometricAttendanceImport specifically for the error
  console.log('\nBiometricAttendanceImport check:');
  try {
    const c = await p.biometricAttendanceImport.count({ where: { employeeId: { in: removeIds } } });
    console.log(`  count: ${c}`);
  } catch (e) {
    console.log(`  ERROR: ${e.message.split('\n').slice(0,3).join(' | ')}`);
  }

  // Check for userId references in User table that might block
  console.log('\nUser-Employee link check:');
  const usersWithEmpLink = await p.user.findMany({ where: { employeeId: { in: removeIds } }, select: { id: true, username: true, employeeId: true } });
  console.log(`  Users linked to remove employees: ${usersWithEmpLink.length}`);
  usersWithEmpLink.slice(0,10).forEach(u => console.log(`    user ${u.username} (id=${u.id}) -> employee ${u.employeeId}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

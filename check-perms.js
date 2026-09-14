const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check role 6 (company-admin) permissions for masters.edit via RolePermission
  const rps = await p.rolePermission.findMany({
    where: { roleId: 6, permission: { module: 'masters' } },
    include: { permission: { select: { module: true, submodule: true, action: true, code: true } } },
  });
  console.log('Role 6 masters permissions:');
  rps.forEach(rp => console.log('  ', rp.permission.code, '|', rp.permission.module, rp.permission.submodule, rp.permission.action));

  // Check all users
  const users = await p.user.findMany({
    where: { deletedAt: null },
    select: { id: true, username: true, roleId: true, employeeId: true, isSuperAdmin: true },
    take: 20,
  });
  console.log('\nUsers:');
  users.forEach(u => console.log('  id=', u.id, 'username=', u.username, 'roleId=', u.roleId, 'isSuperAdmin=', u.isSuperAdmin, 'employeeId=', u.employeeId));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

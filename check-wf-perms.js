const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const rps = await p.rolePermission.findMany({
    where: { roleId: 6, permission: { module: 'workforce' } },
    include: { permission: { select: { code: true, module: true, submodule: true, action: true } } },
  });
  console.log('Role 6 workforce permissions:');
  rps.forEach(rp => console.log('  ', rp.permission.code));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

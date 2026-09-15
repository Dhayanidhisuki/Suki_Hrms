const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Temporarily link user 5 (admin) to employee 386 (Namita, Suresh's manager)
  await p.employee.update({
    where: { id: 386 },
    data: { userId: 5 },
  });
  console.log('Linked user 5 to employee 386 (Namita)');

  // Verify
  const emp = await p.employee.findUnique({
    where: { id: 386 },
    select: { id: true, employeeCode: true, userId: true },
  });
  console.log('Verified:', emp);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

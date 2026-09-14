const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find the department for employee 372 (Suresh, RC027)
  const jobInfo = await p.jobInfo.findFirst({
    where: { employeeId: 372, effectiveTo: null },
    select: { departmentId: true },
  });
  console.log('Suresh (372) department:', jobInfo?.departmentId);

  // Check weekly off configs for that department
  if (jobInfo?.departmentId) {
    const configs = await p.departmentWeeklyOff.findMany({
      where: { departmentId: jobInfo.departmentId },
    });
    console.log('Weekly off configs for dept', jobInfo.departmentId, ':');
    configs.forEach(c => console.log('  day', c.weekOffDay, '(0=Sun,6=Sat) frozen:', c.isFrozen));
  }

  // Check a specific date - July 26, 2026 is a Sunday (day 0)
  const testDate = new Date('2026-07-26');
  console.log('\nJuly 26, 2026 is day', testDate.getUTCDay(), '(0=Sunday)');

  // Check July 25, 2026 is a Saturday (day 6)
  const testDate2 = new Date('2026-07-25');
  console.log('July 25, 2026 is day', testDate2.getUTCDay(), '(6=Saturday)');

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

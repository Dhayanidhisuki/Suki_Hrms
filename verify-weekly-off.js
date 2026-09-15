const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Simulate isWeeklyOffForEmployee for Suresh (372) on various dates
  const jobInfo = await p.jobInfo.findFirst({
    where: { employeeId: 372, effectiveTo: null },
    select: { departmentId: true },
  });
  console.log('Suresh (372) department:', jobInfo?.departmentId);

  const configs = await p.departmentWeeklyOff.findMany({
    where: { departmentId: jobInfo.departmentId },
  });
  console.log('Weekly off configs:', configs.map(c => c.weekOffDay));

  // Test dates
  const dates = [
    { date: '2026-07-25', day: 6, label: 'Saturday' },
    { date: '2026-07-26', day: 0, label: 'Sunday' },
    { date: '2026-07-21', day: 2, label: 'Tuesday' },
  ];

  for (const d of dates) {
    const isWeeklyOff = configs.some(c => c.weekOffDay === d.day);
    console.log(`  ${d.date} (${d.label}): isWeeklyOff=${isWeeklyOff}`);
  }

  // Also check the yearly leave calendar for Aug 15
  const yearlyLeave = await p.yearlyLeaveCalendar.findFirst({
    where: { companyId: 1, date: new Date('2026-08-15'), isActive: true, deletedAt: null },
    include: { leaveTypeMaster: true },
  });
  console.log('\nYearly leave for Aug 15, 2026:', yearlyLeave ? `${yearlyLeave.name} (${yearlyLeave.leaveTypeMaster.name})` : 'None');

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

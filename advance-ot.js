const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const otPending = await p.dailyAttendance.findMany({
    where: {
      date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') },
      employee: { companyId: 1, isActive: true },
      otMinutesCalculated: { gt: 0 },
      otApprovalStatus: 'pending_manager',
    },
    select: { id: true, employeeId: true, date: true, otMinutesCalculated: true },
  });
  console.log('Pending manager OT:', otPending.length);
  const ids = otPending.map(r => r.id);
  console.log('First 5 ids:', ids.slice(0, 5));

  // Advance all to pending_hr for HR bulk approval
  const updated = await p.dailyAttendance.updateMany({
    where: { id: { in: ids } },
    data: { otApprovalStatus: 'pending_hr', otManagerActionByUserId: 5, otManagerActionAt: new Date() },
  });
  console.log('Advanced', updated.count, 'to pending_hr');
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

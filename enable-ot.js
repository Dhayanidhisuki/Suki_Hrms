const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Enable OT for all 12 active employees
  const updated = await p.jobInfo.updateMany({
    where: {
      employeeId: { in: [372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382, 459] },
      effectiveTo: null,
    },
    data: { overtimeAllowed: true, overtimeFactor: 1.5 },
  });
  console.log('Enabled OT for', updated.count, 'employees');

  // Now queue all July OT entries (otMinutesCalculated > 0, otApprovalStatus null) to pending_manager
  const otEntries = await p.dailyAttendance.findMany({
    where: {
      date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') },
      employee: { companyId: 1, isActive: true },
      otMinutesCalculated: { gt: 0 },
      otApprovalStatus: null,
    },
    select: { id: true },
  });
  console.log('OT entries to queue:', otEntries.length);

  const result = await p.dailyAttendance.updateMany({
    where: { id: { in: otEntries.map(e => e.id) } },
    data: { otApprovalStatus: 'pending_manager' },
  });
  console.log('Queued', result.count, 'to pending_manager');

  // Advance all to pending_hr for HR bulk approval testing
  const advanced = await p.dailyAttendance.updateMany({
    where: { id: { in: otEntries.map(e => e.id) }, otApprovalStatus: 'pending_manager' },
    data: { otApprovalStatus: 'pending_hr', otManagerActionByUserId: 5, otManagerActionAt: new Date() },
  });
  console.log('Advanced', advanced.count, 'to pending_hr');

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

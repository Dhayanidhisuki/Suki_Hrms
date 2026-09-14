const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Queue all July attendance records with late/early-out minutes to pending
  const result = await p.dailyAttendance.updateMany({
    where: {
      date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') },
      employee: { companyId: 1, isActive: true },
      lomApprovalStatus: null,
      OR: [
        { lateMinutes: { gt: 0 } },
        { earlyOutMinutes: { gt: 0 } },
      ],
    },
    data: { lomApprovalStatus: 'pending' },
  });
  console.log('Queued', result.count, 'LOM entries to pending');

  // Check counts
  const pending = await p.dailyAttendance.count({
    where: {
      date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') },
      employee: { companyId: 1, isActive: true },
      lomApprovalStatus: 'pending',
    },
  });
  console.log('Pending LOM entries:', pending);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

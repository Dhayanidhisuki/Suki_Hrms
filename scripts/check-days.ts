import { prisma } from '../src/lib/prisma';

async function main() {
  const days = await prisma.dailyAttendance.findMany({
    where: {
      employeeId: { in: [373, 374, 375, 376, 377, 378] },
      date: { gte: new Date(Date.UTC(2026, 8, 23)), lte: new Date(Date.UTC(2026, 8, 24)) },
    },
    select: { employeeId: true, date: true, status: true, source: true, inTime: true },
  });
  console.log('existing rows:', JSON.stringify(days));

  const hist = await prisma.dailyAttendanceHistory.findMany({
    where: {
      employeeId: { in: [373, 374, 375, 376, 377, 378] },
      date: { gte: new Date(Date.UTC(2026, 8, 23)), lte: new Date(Date.UTC(2026, 8, 24)) },
    },
    select: { employeeId: true, date: true, changedBySource: true, changedAt: true },
    orderBy: { changedAt: 'desc' },
  });
  console.log('history:', JSON.stringify(hist));
}

main().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const emps = await p.employee.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, employeeCode: true },
      orderBy: { employeeCode: 'asc' },
    });

    for (const emp of emps) {
      const att = await p.dailyAttendance.findMany({
        where: { employeeId: emp.id, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
        orderBy: { date: 'asc' },
      });

      const presentDays = att.filter(a => a.status === 'Present').length;
      const halfDays = att.filter(a => a.status === 'HalfDay').length;
      const payableDays = presentDays + halfDays * 0.5;
      const totalWorkingDays = 31;
      const lopDays = totalWorkingDays - payableDays;
      const lateMinutesTotal = att.reduce((s, a) => s + (a.lateMinutes || 0), 0);
      const earlyOutMinutesTotal = att.reduce((s, a) => s + (a.earlyOutMinutes || 0), 0);
      const otMinutesTotal = att.reduce((s, a) => s + (a.otMinutesApproved || a.otMinutesCalculated || 0), 0);

      // Update or create monthly summary
      const existing = await p.monthlyAttendanceSummary.findFirst({
        where: { employeeId: emp.id, year: 2026, month: 7 },
      });

      const data = {
        totalWorkingDays,
        payableDays,
        presentDays,
        absentDays: att.filter(a => a.status === 'Absent').length,
        leaveDays: att.filter(a => a.status === 'Leave').length,
        lopDays,
        lateMinutesTotal,
        earlyOutMinutesTotal,
        otMinutesTotal,
      };

      if (existing) {
        await p.monthlyAttendanceSummary.update({ where: { id: existing.id }, data });
      } else {
        await p.monthlyAttendanceSummary.create({
          data: { employeeId: emp.id, year: 2026, month: 7, ...data },
        });
      }

      console.log(`${emp.employeeCode}: payable=${payableDays} lop=${lopDays} late=${lateMinutesTotal} ot=${otMinutesTotal}`);
    }

    console.log('\nMonthly summaries regenerated.');
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

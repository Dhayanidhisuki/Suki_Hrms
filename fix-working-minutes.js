const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const SHIFTS = {
  1: { start: 9 * 60, end: 17.5 * 60 },
  2: { start: 9 * 60, end: 17.5 * 60 },
  3: { start: 6 * 60, end: 14 * 60 },
  4: { start: 14 * 60, end: 22 * 60 },
  5: { start: 22 * 60, end: 6 * 60, crossesMidnight: true },
  6: { start: 13 * 60, end: 21 * 60 },
  7: { start: 9 * 60, end: 18 * 60 },
};

function toMinutes(dt) {
  return dt.getUTCHours() * 60 + dt.getUTCMinutes();
}

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
        include: { shiftMaster: { select: { id: true, graceMinutes: true } } },
        orderBy: { date: 'asc' },
      });

      for (const d of att) {
        if (!d.inTime || !d.outTime || !d.shiftMaster) continue;

        const shift = SHIFTS[d.shiftMaster.id];
        if (!shift) continue;

        const inMin = toMinutes(new Date(d.inTime));
        const outMinRaw = toMinutes(new Date(d.outTime));
        let outMin = outMinRaw;
        if (shift.crossesMidnight && outMinRaw < shift.start) {
          outMin = outMinRaw + 24 * 60;
        }
        const shiftStart = shift.start;
        const shiftEnd = shift.end + (shift.crossesMidnight ? 24 * 60 : 0);

        // Recalculate from actual in/out
        const lateMinutes = Math.max(0, inMin - shiftStart);
        const earlyOutMinutes = Math.max(0, shiftEnd - outMin);
        const workingMinutes = outMin - inMin;
        const otMinutesCalculated = Math.max(0, outMin - shiftEnd);

        await p.dailyAttendance.update({
          where: { id: d.id },
          data: {
            lateMinutes,
            earlyOutMinutes,
            workingMinutes,
            otMinutesCalculated,
          },
        });

        if (emp.employeeCode === 'RC028' && d.date.toISOString().slice(0,10) === '2026-07-16') {
          console.log(`RC028 16-Jul fixed: in=${d.inTime.toISOString().slice(11,16)} out=${d.outTime.toISOString().slice(11,16)} late=${lateMinutes} early=${earlyOutMinutes} work=${workingMinutes} ot=${otMinutesCalculated}`);
        }
      }
    }

    console.log('All working minutes fixed.');
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

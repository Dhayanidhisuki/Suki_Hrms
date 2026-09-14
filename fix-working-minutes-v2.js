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

function sameDayUTC(d1, d2) {
  return d1.toISOString().slice(0, 10) === d2.toISOString().slice(0, 10);
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
        include: { shiftMaster: { select: { id: true, code: true, graceMinutes: true } } },
        orderBy: { date: 'asc' },
      });

      for (const d of att) {
        if (!d.inTime || !d.outTime || !d.shiftMaster) continue;

        const shift = SHIFTS[d.shiftMaster.id];
        if (!shift) continue;

        const inTime = new Date(d.inTime);
        const outTime = new Date(d.outTime);
        const inMin = toMinutes(inTime);
        let outMin = toMinutes(outTime);

        // If out is on the next calendar day, add 24 hours
        if (!sameDayUTC(inTime, outTime)) {
          outMin += 24 * 60;
        }

        const shiftStart = shift.start;
        const shiftEnd = shift.end + (shift.crossesMidnight ? 24 * 60 : 0);

        const lateMinutes = Math.max(0, inMin - shiftStart);
        const workingMinutes = outMin - inMin;
        let earlyOutMinutes = 0;
        let otMinutesCalculated = 0;

        if (outMin < shiftEnd) {
          // Left before shift end
          earlyOutMinutes = shiftEnd - outMin;
        } else if (outMin > shiftEnd) {
          // Worked after shift end (OT)
          otMinutesCalculated = outMin - shiftEnd;
        }

        await p.dailyAttendance.update({
          where: { id: d.id },
          data: {
            lateMinutes,
            earlyOutMinutes,
            workingMinutes,
            otMinutesCalculated,
          },
        });

        if (emp.employeeCode === 'RC028' && d.date.toISOString().slice(0,10) === '2026-07-29') {
          console.log(`RC028 29-Jul fixed: in=${inTime.toISOString().slice(11,16)} out=${outTime.toISOString().slice(11,16)} late=${lateMinutes} early=${earlyOutMinutes} work=${workingMinutes} ot=${otMinutesCalculated}`);
        }
      }
    }

    console.log('All working minutes fixed.');
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

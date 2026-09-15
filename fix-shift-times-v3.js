const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Shift definitions
const SHIFTS = {
  1: { start: 9 * 60, end: 17.5 * 60, name: 'GEN', duration: 510 },        // 09:00-17:30
  2: { start: 9 * 60, end: 17.5 * 60, name: 'GENERAL', duration: 510 },     // 09:00-17:30
  3: { start: 6 * 60, end: 14 * 60, name: 'MORNING', duration: 480 },      // 06:00-14:00
  4: { start: 14 * 60, end: 22 * 60, name: 'EVENING', duration: 480 },     // 14:00-22:00
  5: { start: 22 * 60, end: 6 * 60, name: 'NIGHT', duration: 480, crossesMidnight: true }, // 22:00-06:00
  6: { start: 13 * 60, end: 21 * 60, name: '001', duration: 480 },          // 13:00-21:00
  7: { start: 9 * 60, end: 18 * 60, name: 'SHF001', duration: 540 },        // 09:00-18:00
};

// Deterministic pseudo-random
function seededRandom(seed) {
  const x = Math.sin(seed * 9999.123) * 10000;
  return x - Math.floor(x);
}

function makeDateTime(date, minutesFromMidnight, isNextDay = false) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  if (isNextDay) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCMinutes(minutesFromMidnight);
  return d;
}

function getInOutTimes(shiftMasterId, date, status, seed) {
  const shift = SHIFTS[shiftMasterId];
  if (!shift) return null;

  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 7);
  const r3 = seededRandom(seed + 13);
  const r4 = seededRandom(seed + 19);

  // Late arrival: realistic distribution
  // 30% on time (0 min), 40% 5-20 min late, 30% 25-60 min late
  let lateMinutes;
  if (r1 < 0.3) {
    lateMinutes = 0;
  } else if (r1 < 0.7) {
    lateMinutes = Math.floor(5 + r2 * 15); // 5-19 min
  } else {
    lateMinutes = Math.floor(25 + r2 * 35); // 25-59 min
  }

  // Early out: 60% full shift, 40% early by 5-40 min
  let earlyOutMinutes;
  if (r3 < 0.6) {
    earlyOutMinutes = 0;
  } else {
    earlyOutMinutes = Math.floor(5 + r3 * 35); // 5-39 min
  }

  // OT: 40% no OT, 30% 30-60 min, 30% 60-150 min
  let otMinutes;
  if (r4 < 0.4) {
    otMinutes = 0;
  } else if (r4 < 0.7) {
    otMinutes = Math.floor(30 + r4 * 30); // 30-59 min
  } else {
    otMinutes = Math.floor(60 + r4 * 90); // 60-149 min
  }

  const inMinutes = shift.start + lateMinutes;
  let outMinutes, workingMinutes;

  if (shift.crossesMidnight) {
    // Night shift: 22:00 -> 06:00 next day
    workingMinutes = shift.duration - earlyOutMinutes + otMinutes;
    const nextDayOutMinutes = shift.end - earlyOutMinutes + otMinutes;
    return {
      inTime: makeDateTime(date, inMinutes, false),
      outTime: makeDateTime(date, nextDayOutMinutes, true),
      workingMinutes,
      lateMinutes,
      earlyOutMinutes,
      otMinutesCalculated: otMinutes,
    };
  } else {
    workingMinutes = shift.duration - earlyOutMinutes - lateMinutes + otMinutes;
    outMinutes = shift.end - earlyOutMinutes + otMinutes;
    return {
      inTime: makeDateTime(date, inMinutes, false),
      outTime: makeDateTime(date, outMinutes, false),
      workingMinutes: Math.max(0, workingMinutes),
      lateMinutes,
      earlyOutMinutes,
      otMinutesCalculated: otMinutes,
    };
  }
}

(async () => {
  try {
    const emps = await p.employee.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true },
      orderBy: { employeeCode: 'asc' },
    });

    let updatedCount = 0;

    for (const emp of emps) {
      const att = await p.dailyAttendance.findMany({
        where: { employeeId: emp.id, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
        orderBy: { date: 'asc' },
      });

      console.log(`\n=== ${emp.employeeCode} ${emp.firstName} (${att.length} days) ===`);

      for (const d of att) {
        if (!d.shiftMasterId) continue;
        const shift = SHIFTS[d.shiftMasterId];
        if (!shift) continue;

        if (!['Present', 'HalfDay', 'OnDuty'].includes(d.status)) {
          continue;
        }

        const date = new Date(d.date);
        date.setUTCHours(0, 0, 0, 0);
        const seed = emp.id * 1000 + date.getUTCDate() * 31 + 7;

        const times = getInOutTimes(d.shiftMasterId, date, d.status, seed);
        if (!times) continue;

        let { inTime, outTime, workingMinutes, lateMinutes, earlyOutMinutes, otMinutesCalculated } = times;

        // For HalfDay: half shift, no OT, reduced late
        if (d.status === 'HalfDay') {
          const halfDuration = Math.floor(shift.duration / 2);
          workingMinutes = halfDuration;
          earlyOutMinutes = shift.duration - halfDuration;
          otMinutesCalculated = 0;
          lateMinutes = Math.min(lateMinutes, 20);
          if (shift.crossesMidnight) {
            const nextDayOutMinutes = shift.end - earlyOutMinutes;
            outTime = makeDateTime(date, nextDayOutMinutes, true);
          } else {
            outTime = makeDateTime(date, shift.end - earlyOutMinutes, false);
          }
          inTime = makeDateTime(date, shift.start + lateMinutes, false);
        }

        await p.dailyAttendance.update({
          where: { id: d.id },
          data: {
            inTime,
            outTime,
            workingMinutes,
            lateMinutes,
            earlyOutMinutes,
            otMinutesCalculated,
            // Clear stale OT approvals so payroll uses otMinutesCalculated
            otMinutesApproved: null,
            otApprovalStatus: null,
            otSettlementType: null,
          },
        });
        updatedCount++;

        const inStr = inTime.toISOString().slice(11, 16);
        const outStr = outTime.toISOString().slice(11, 16);
        console.log(`  ${d.date.toISOString().slice(0,10)} ${shift.name} ${d.status} in=${inStr} out=${outStr} late=${lateMinutes} early=${earlyOutMinutes} ot=${otMinutesCalculated} work=${workingMinutes}`);
      }
    }

    console.log(`\n=== DONE: ${updatedCount} records updated ===`);
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Shift definitions: start/end in minutes from midnight
// Night shift (id=5) crosses midnight: 22:00 -> 06:00 next day
const SHIFTS = {
  1: { start: 9 * 60, end: 17.5 * 60, name: 'GEN', duration: 510 },        // 09:00-17:30 (8.5h)
  2: { start: 9 * 60, end: 17.5 * 60, name: 'GENERAL', duration: 510 },     // 09:00-17:30
  3: { start: 6 * 60, end: 14 * 60, name: 'MORNING', duration: 480 },     // 06:00-14:00 (8h)
  4: { start: 14 * 60, end: 22 * 60, name: 'EVENING', duration: 480 },    // 14:00-22:00 (8h)
  5: { start: 22 * 60, end: 6 * 60, name: 'NIGHT', duration: 480, crossesMidnight: true }, // 22:00-06:00
  6: { start: 13 * 60, end: 21 * 60, name: '001', duration: 480 },         // 13:00-21:00
  7: { start: 9 * 60, end: 18 * 60, name: 'SHF001', duration: 540 },       // 09:00-18:00
};

// Deterministic pseudo-random based on employeeId + date so results are reproducible
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
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
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);

  // Late arrival: 0-25 minutes (some days late, some on time)
  // ~40% days on time (0 min late), ~60% late by 5-25 min
  let lateMinutes;
  if (r1 < 0.4) {
    lateMinutes = 0; // on time
  } else if (r1 < 0.8) {
    lateMinutes = Math.floor(5 + r2 * 20); // 5-24 min late
  } else {
    lateMinutes = Math.floor(25 + r2 * 30); // 25-54 min late (significant)
  }

  // Early out: 0-30 minutes early (only on some days)
  // ~70% days full shift, ~30% early by 5-30 min
  let earlyOutMinutes;
  if (r3 < 0.7) {
    earlyOutMinutes = 0; // full shift
  } else {
    earlyOutMinutes = Math.floor(5 + r3 * 25); // 5-29 min early
  }

  // OT: 0-120 minutes (some days have OT)
  // ~50% days no OT, ~50% OT by 15-120 min
  let otMinutes;
  if (r1 < 0.5) {
    otMinutes = 0;
  } else if (r1 < 0.85) {
    otMinutes = Math.floor(15 + r2 * 45); // 15-59 min OT
  } else {
    otMinutes = Math.floor(60 + r2 * 60); // 60-119 min OT
  }

  const inMinutes = shift.start + lateMinutes;
  let outMinutes, workingMinutes;

  if (shift.crossesMidnight) {
    // Night shift: 22:00 -> 06:00 next day
    // working = duration - earlyOut + late + OT
    // out time is next day
    workingMinutes = shift.duration - earlyOutMinutes + otMinutes;
    // out time in minutes from midnight of NEXT day
    // shift end = 360 (06:00), minus early out, plus OT
    const nextDayOutMinutes = shift.end - earlyOutMinutes + otMinutes;
    return {
      inTime: makeDateTime(date, inMinutes, false),        // 22:00+late same day
      outTime: makeDateTime(date, nextDayOutMinutes, true), // 06:00-early+OT next day
      workingMinutes,
      lateMinutes,
      earlyOutMinutes,
      otMinutesCalculated: otMinutes,
    };
  } else {
    // Normal shift
    workingMinutes = shift.duration - earlyOutMinutes - lateMinutes + otMinutes;
    // Actually working minutes = outTime - inTime
    // outTime = shift.end - earlyOut + OT
    // inTime = shift.start + late
    // working = (shift.end - earlyOut + OT) - (shift.start + late)
    //         = shift.duration - earlyOut - late + OT
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
        if (!d.shiftMasterId) {
          console.log(`  ${d.date.toISOString().slice(0,10)} SKIP - no shift`);
          continue;
        }

        const shift = SHIFTS[d.shiftMasterId];
        if (!shift) {
          console.log(`  ${d.date.toISOString().slice(0,10)} SKIP - unknown shift ${d.shiftMasterId}`);
          continue;
        }

        // Skip non-working statuses
        if (!['Present', 'HalfDay', 'OnDuty'].includes(d.status)) {
          console.log(`  ${d.date.toISOString().slice(0,10)} ${shift.name} ${d.status} - keeping null times`);
          continue;
        }

        const date = new Date(d.date);
        date.setUTCHours(0, 0, 0, 0);
        const seed = emp.id * 10000 + date.getUTCDate() + date.getUTCMonth() * 100;

        const times = getInOutTimes(d.shiftMasterId, date, d.status, seed);
        if (!times) continue;

        let { inTime, outTime, workingMinutes, lateMinutes, earlyOutMinutes, otMinutesCalculated } = times;

        // For HalfDay: reduce working time to half, adjust outTime
        if (d.status === 'HalfDay') {
          const halfDuration = Math.floor(shift.duration / 2);
          workingMinutes = halfDuration;
          earlyOutMinutes = shift.duration - halfDuration;
          otMinutesCalculated = 0;
          lateMinutes = Math.min(lateMinutes, 15); // less late on half days
          // Recalculate outTime
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

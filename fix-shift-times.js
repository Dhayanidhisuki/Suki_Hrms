const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Shift times in minutes from midnight
const SHIFT_TIMES = {
  1: { start: 9 * 60, end: 17.5 * 60, name: 'GEN' },        // 09:00-17:30
  2: { start: 9 * 60, end: 17.5 * 60, name: 'GENERAL' },     // 09:00-17:30
  3: { start: 6 * 60, end: 14 * 60, name: 'MORNING' },       // 06:00-14:00
  4: { start: 14 * 60, end: 22 * 60, name: 'EVENING' },      // 14:00-22:00
  5: { start: 22 * 60, end: 6 * 60, name: 'NIGHT' },         // 22:00-06:00 (crosses midnight)
  6: { start: 13 * 60, end: 21 * 60, name: '001' },          // 13:00-21:00
  7: { start: 9 * 60, end: 18 * 60, name: 'SHF001' },        // 09:00-18:00
};

function minutesToTime(minutes, baseDate) {
  // minutes is minutes from midnight of baseDate
  // For night shift, end time (360 min = 06:00) is next day
  const d = new Date(baseDate);
  d.setUTCHours(0, 0, 0, 0);
  const totalMinutes = minutes;
  d.setUTCMinutes(totalMinutes);
  return d;
}

function getTimeForShift(shiftMasterId, date, isStart) {
  const shift = SHIFT_TIMES[shiftMasterId];
  if (!shift) return null;
  const mins = isStart ? shift.start : shift.end;
  // For night shift end (06:00 = 360 min), it's the next day
  if (shiftMasterId === 5 && !isStart) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCMinutes(360); // 06:00 next day
    return d;
  }
  return minutesToTime(mins, date);
}

(async () => {
  try {
    // Get all 12 employees
    const emps = await p.employee.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true },
      orderBy: { employeeCode: 'asc' },
    });

    let updatedCount = 0;
    let skippedCount = 0;

    for (const emp of emps) {
      // Get all July 2026 attendance
      const att = await p.dailyAttendance.findMany({
        where: { employeeId: emp.id, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
        orderBy: { date: 'asc' },
      });

      for (const d of att) {
        if (!d.shiftMasterId) {
          console.log(`  SKIP ${emp.employeeCode} ${d.date.toISOString().slice(0,10)} - no shift assigned`);
          skippedCount++;
          continue;
        }

        const shift = SHIFT_TIMES[d.shiftMasterId];
        if (!shift) {
          console.log(`  SKIP ${emp.employeeCode} ${d.date.toISOString().slice(0,10)} - unknown shift id=${d.shiftMasterId}`);
          skippedCount++;
          continue;
        }

        const date = new Date(d.date);
        date.setUTCHours(0, 0, 0, 0);

        const inTime = getTimeForShift(d.shiftMasterId, date, true);
        const outTime = getTimeForShift(d.shiftMasterId, date, false);

        if (!inTime || !outTime) {
          skippedCount++;
          continue;
        }

        // Calculate working minutes
        const shiftDuration = d.shiftMasterId === 5
          ? (24 * 60 - shift.start) + shift.end  // night shift crosses midnight
          : shift.end - shift.start;

        let workingMinutes, lateMinutes, earlyOutMinutes;

        if (d.status === 'Present' || d.status === 'OnDuty') {
          workingMinutes = shiftDuration;
          lateMinutes = 0;
          earlyOutMinutes = 0;
        } else if (d.status === 'HalfDay') {
          workingMinutes = Math.floor(shiftDuration / 2);
          lateMinutes = 0;
          earlyOutMinutes = shiftDuration - workingMinutes;
          // Adjust out time to halfway through shift
          const halfOutTime = new Date(inTime);
          halfOutTime.setUTCMinutes(halfOutTime.getUTCMinutes() + workingMinutes);
          await p.dailyAttendance.update({
            where: { id: d.id },
            data: {
              inTime: inTime,
              outTime: halfOutTime,
              workingMinutes,
              lateMinutes,
              earlyOutMinutes,
            },
          });
          updatedCount++;
          console.log(`  ${emp.employeeCode} ${d.date.toISOString().slice(0,10)} ${shift.name} HalfDay in=${inTime.toISOString().slice(11,16)} out=${halfOutTime.toISOString().slice(11,16)} work=${workingMinutes}min`);
          continue;
        } else {
          // Leave, WeeklyOff, Holiday, Absent, etc. — keep times as null
          skippedCount++;
          continue;
        }

        await p.dailyAttendance.update({
          where: { id: d.id },
          data: {
            inTime,
            outTime,
            workingMinutes,
            lateMinutes,
            earlyOutMinutes,
          },
        });
        updatedCount++;
        console.log(`  ${emp.employeeCode} ${d.date.toISOString().slice(0,10)} ${shift.name} Present in=${inTime.toISOString().slice(11,16)} out=${outTime.toISOString().slice(11,16)} work=${workingMinutes}min`);
      }
    }

    console.log(`\n=== DONE ===`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

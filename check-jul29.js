const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const d = await p.dailyAttendance.findFirst({
      where: { employeeId: 373, date: new Date('2026-07-29') },
      include: { shiftMaster: { select: { code: true, startTime: true, endTime: true } } },
    });
    console.log('Date:', d.date.toISOString().slice(0,10));
    console.log('Shift:', d.shiftMaster?.code, d.shiftMaster?.startTime, d.shiftMaster?.endTime);
    console.log('In:', d.inTime, new Date(d.inTime).toISOString());
    console.log('Out:', d.outTime, new Date(d.outTime).toISOString());
    console.log('Status:', d.status);
    console.log('Late:', d.lateMinutes);
    console.log('Early:', d.earlyOutMinutes);
    console.log('Working:', d.workingMinutes);
    console.log('OT:', d.otMinutesCalculated);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  await p.$disconnect();
})();

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Get Divya's night shift attendance days
    const nightDays = await p.dailyAttendance.findMany({
      where: {
        employeeId: 373,
        date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') },
        status: { in: ['Present', 'HalfDay', 'OnDuty'] },
        shiftMaster: { nightAllowed: true, nightAllowanceAmount: { gt: 0 } },
      },
      include: { shiftMaster: { select: { id: true, code: true, name: true, nightAllowanceAmount: true, nightAllowed: true } } },
      orderBy: { date: 'asc' },
    });
    console.log('=== Divya Night Shift Days (matching payroll query) ===');
    console.log('count=' + nightDays.length);
    let total = 0;
    nightDays.forEach(d => {
      const amt = Number(d.shiftMaster?.nightAllowanceAmount ?? 0);
      total += amt;
      console.log('  ' + d.date.toISOString().slice(0,10) + ' shift=' + d.shiftMaster?.code + ' ' + d.shiftMaster?.name + ' allowance=' + d.shiftMaster?.nightAllowanceAmount + ' status=' + d.status);
    });
    console.log('Total night allowance should be: ' + total);

    // Also check shift id=6 (001 shift_3, nightAllowed=true, allowance=500)
    const shift6Days = await p.dailyAttendance.findMany({
      where: {
        employeeId: 373,
        date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') },
        shiftMasterId: 6,
      },
      include: { shiftMaster: { select: { code: true, name: true, nightAllowanceAmount: true } } },
      orderBy: { date: 'asc' },
    });
    console.log('\n=== Divya Shift id=6 days ===');
    console.log('count=' + shift6Days.length);
    shift6Days.forEach(d => console.log('  ' + d.date.toISOString().slice(0,10) + ' status=' + d.status + ' allowance=' + d.shiftMaster?.nightAllowanceAmount));

  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

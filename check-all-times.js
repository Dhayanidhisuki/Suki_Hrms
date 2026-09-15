const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Get all 12 employees
    const emps = await p.employee.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
      orderBy: { employeeCode: 'asc' },
    });
    console.log('=== 12 Employees ===');
    emps.forEach(e => console.log('  ' + e.employeeCode + ' ' + e.firstName + ' ' + e.lastName + ' (id=' + e.id + ')'));

    // Get all shift masters
    const shifts = await p.shiftMaster.findMany({
      select: { id: true, code: true, name: true, startTime: true, endTime: true, nightAllowed: true, nightAllowanceAmount: true },
    });
    console.log('\n=== Shift Masters ===');
    shifts.forEach(s => console.log('  id=' + s.id + ' ' + s.code + ' ' + s.name + ' (' + s.startTime + '-' + s.endTime + ')'));

    // For each employee, get July 2026 attendance with shift
    for (const emp of emps) {
      const att = await p.dailyAttendance.findMany({
        where: { employeeId: emp.id, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
        include: { shiftMaster: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } },
        orderBy: { date: 'asc' },
      });
      console.log('\n=== ' + emp.employeeCode + ' ' + emp.firstName + ' ===');
      att.forEach(d => {
        const inT = d.inTime ? new Date(d.inTime).toISOString().slice(11,16) : '--:--';
        const outT = d.outTime ? new Date(d.outTime).toISOString().slice(11,16) : '--:--';
        console.log('  ' + d.date.toISOString().slice(0,10) + ' shift=' + (d.shiftMaster?.code ?? 'NONE') + ' (' + (d.shiftMaster?.startTime ?? '?') + '-' + (d.shiftMaster?.endTime ?? '?') + ') in=' + inT + ' out=' + outT + ' status=' + d.status);
      });
    }

  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();

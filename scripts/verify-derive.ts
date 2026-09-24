import { prisma } from '../src/lib/prisma';
import { resolveEmployeeShiftConfig, resolveDailyShiftWithOverride } from '../src/lib/biometricConversion';

async function main() {
  const empId = 378; // Bhuvana's row (EMP030)
  const emp = await prisma.employee.findUnique({
    where: { id: empId },
    select: { id: true, employeeCode: true, firstName: true, oldEmployeeCode: true },
  });
  console.log('employee:', emp);

  const date = new Date(Date.UTC(2026, 8, 23));
  const config = await resolveEmployeeShiftConfig(empId);
  const shift = await resolveDailyShiftWithOverride(empId, date, config);
  console.log('resolved shift:', JSON.stringify(shift, null, 1));

  const day = await prisma.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId: empId, date } },
    select: {
      status: true, inTime: true, outTime: true, workingMinutes: true,
      lateMinutes: true, earlyOutMinutes: true, otMinutesCalculated: true,
      otMinutesApproved: true, shiftMasterId: true, source: true,
      inSource: true, outSource: true, inLatitude: true, inLongitude: true,
    },
  });
  console.log('stored day:', JSON.stringify(day, null, 1));

  const sm = day?.shiftMasterId
    ? await prisma.shiftMaster.findUnique({ where: { id: day.shiftMasterId } })
    : null;
  console.log('shift master:', JSON.stringify(sm, null, 1));
}

main().finally(() => prisma.$disconnect());

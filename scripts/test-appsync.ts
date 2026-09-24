// One-off manual app-sync run for verification.
// Run: npx tsx scripts/test-appsync.ts
import { prisma } from '../src/lib/prisma';
import { runAppSync } from '../src/lib/appAttendanceSync';

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log('companies:', companies);
  const companyId = companies[0]?.id;
  if (!companyId) {
    console.log('no company found');
    return;
  }

  const outcome = await runAppSync({
    companyId,
    rangeStart: new Date(Date.UTC(2026, 8, 23)),
    rangeEnd: new Date(Date.UTC(2026, 8, 24)),
    trigger: 'manual',
  });
  console.log('OUTCOME:', JSON.stringify(outcome, null, 1));

  // Show resulting source days + merged attendance
  const srcDays = await prisma.attendanceSourceDay.findMany({
    where: { date: { gte: new Date(Date.UTC(2026, 8, 23)), lte: new Date(Date.UTC(2026, 8, 24)) } },
    orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
  });
  console.log(`\nAttendanceSourceDay rows: ${srcDays.length}`);
  for (const s of srcDays.slice(0, 10)) {
    console.log(
      `  emp=${s.employeeId} ${s.date.toISOString().slice(0, 10)} ${s.source}`,
      `in=${s.inTime?.toISOString().slice(11, 16) ?? '-'} out=${s.outTime?.toISOString().slice(11, 16) ?? '-'}`,
      `gps=${s.inLatitude ?? '-'}/${s.inLongitude ?? '-'}`
    );
  }

  const finals = await prisma.dailyAttendance.findMany({
    where: { date: { gte: new Date(Date.UTC(2026, 8, 23)), lte: new Date(Date.UTC(2026, 8, 24)) } },
    include: { employee: { select: { employeeCode: true, firstName: true, oldEmployeeCode: true } } },
    orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
  });
  console.log(`\nDailyAttendance rows: ${finals.length}`);
  for (const f of finals.slice(0, 15)) {
    console.log(
      `  ${f.employee.employeeCode}(${f.employee.oldEmployeeCode}) ${f.employee.firstName}`,
      `${f.date.toISOString().slice(0, 10)} in=${f.inTime?.toISOString().slice(11, 16) ?? '-'}(${f.inSource ?? '-'})`,
      `out=${f.outTime?.toISOString().slice(11, 16) ?? '-'}(${f.outSource ?? '-'})`,
      `status=${f.status} src=${f.source} gps=${f.inLatitude ?? '-'}/${f.inLongitude ?? '-'}`
    );
  }
}

main().finally(() => prisma.$disconnect());

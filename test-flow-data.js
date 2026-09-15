const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const users = await p.user.findMany({ select: { id: true, username: true, role: { select: { id: true, roleCode: true } } }, take: 20 });
  console.log('=== Users ===');
  users.forEach(u => console.log(`  id=${u.id} user=${u.username} role=${u.role?.roleCode}`));

  const emps = await p.employee.findMany({ where: { isActive: true }, select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } }, userId: true }, orderBy: { employeeCode: 'asc' } });
  console.log(`\n=== Active Employees (${emps.length}) ===`);
  emps.forEach(e => console.log(`  ${e.employeeCode} ${e.firstName} ${e.lastName} | dept=${e.department?.name} | userId=${e.userId}`));

  const shifts = await p.shiftMaster.findMany({ where: { deletedAt: null }, select: { id: true, code: true, name: true, startTime: true, endTime: true, nightAllowed: true } });
  console.log(`\n=== Shifts (${shifts.length}) ===`);
  shifts.forEach(s => console.log(`  ${s.code} ${s.name} ${s.startTime}-${s.endTime} night=${s.nightAllowed}`));

  const runs = await p.payrollRun.findMany({ select: { id: true, year: true, month: true, status: true }, orderBy: { id: 'desc' }, take: 5 });
  console.log('\n=== Payroll Runs (latest 5) ===');
  runs.forEach(r => console.log(`  id=${r.id} ${r.year}-${String(r.month).padStart(2,'0')} status=${r.status}`));

  const lom = await p.lomConfig.findFirst({ select: { graceMinutesExempt: true, calculationBasis: true, multiplier: true, shiftDurationSource: true, dailyLomCap: true } });
  console.log('\n=== LOM Config ===');
  console.log(`  basis=${lom?.calculationBasis} grace=${lom?.graceMinutesExempt}m cap=${lom?.dailyLomCap}m source=${lom?.shiftDurationSource}`);

  const depts = await p.department.findMany({ select: { id: true, code: true, name: true } });
  console.log(`\n=== Departments (${depts.length}) ===`);
  depts.forEach(d => console.log(`  ${d.code} ${d.name}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

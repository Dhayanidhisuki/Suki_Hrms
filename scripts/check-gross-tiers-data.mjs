import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const companies = await prisma.company.findMany({ select: { id: true, name: true } });
console.log("Companies:", JSON.stringify(companies));

const employees = await prisma.employee.findMany({
  where: { deletedAt: null, isActive: true },
  take: 5,
  select: { id: true, employeeCode: true, firstName: true, lastName: true, companyId: true }
});
console.log("Sample employees:", JSON.stringify(employees, null, 2));

if (employees.length > 0) {
  const emp = employees[0];
  const revs = await prisma.employeeSalaryRevision.findMany({
    where: { employeeId: emp.id, effectiveTo: null },
    include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true, includeInGross: true, grossTier: true } } } } }
  });
  console.log("Salary revision for " + emp.employeeCode + ":", JSON.stringify(revs, null, 2));
}

if (companies.length > 0) {
  const comps = await prisma.salaryComponent.findMany({
    where: { companyId: companies[0].id, deletedAt: null, code: { in: ['BASIC', 'HRA', 'LTA', 'SPL_ALLOW', 'EDUCATION', 'ADD_HRA', 'PERFORMANCE_INS'] } },
    select: { id: true, code: true, name: true, type: true, includeInGross: true, grossTier: true }
  });
  console.log("Relevant components:", JSON.stringify(comps, null, 2));
}

const summaries = await prisma.monthlyAttendanceSummary.findMany({
  take: 3,
  select: { id: true, employeeId: true, year: true, month: true, status: true, totalWorkingDays: true, payableDays: true }
});
console.log("Attendance summaries:", JSON.stringify(summaries, null, 2));

const runs = await prisma.payrollRun.findMany({ take: 3, select: { id: true, year: true, month: true, status: true, companyId: true } });
console.log("Payroll runs:", JSON.stringify(runs, null, 2));

await prisma.$disconnect();

import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const test = await prisma.company.findMany({ where: { name: { contains: "Gross Tiers Verify" } }, select: { id: true, name: true } });
console.log("Test companies to clean:", test.length);
for (const c of test) {
  try {
    await prisma.payrollLineComponent.deleteMany({ where: { payrollLine: { payrollRun: { companyId: c.id } } } });
    await prisma.payrollLine.deleteMany({ where: { payrollRun: { companyId: c.id } } });
    await prisma.payrollRun.deleteMany({ where: { companyId: c.id } });
    const emps = await prisma.employee.findMany({ where: { companyId: c.id }, select: { id: true } });
    if (emps.length) {
      const ids = emps.map(e => e.id);
      await prisma.monthlyAttendanceSummary.deleteMany({ where: { employeeId: { in: ids } } });
      await prisma.jobInfo.deleteMany({ where: { employeeId: { in: ids } } });
      await prisma.employeeSalaryComponent.deleteMany({ where: { salaryRevision: { employeeId: { in: ids } } } });
      await prisma.employeeSalaryRevision.deleteMany({ where: { employeeId: { in: ids } } });
    }
    await prisma.employee.deleteMany({ where: { companyId: c.id } });
    await prisma.salaryComponent.deleteMany({ where: { companyId: c.id } });
    await prisma.company.delete({ where: { id: c.id } });
    console.log("  deleted", c.id, c.name);
  } catch (e) {
    console.log("  skip", c.id, e.message);
  }
}
await prisma.$disconnect();

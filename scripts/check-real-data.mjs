import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

// Company 1 = KUN AEROSPACE (real data)
const companyId = 1;

// Check salary components and their flags
const comps = await prisma.salaryComponent.findMany({
  where: { companyId, deletedAt: null, type: "earning" },
  select: { id: true, code: true, name: true, includeInGross: true, grossTier: true, includeInPf: true },
  orderBy: { code: "asc" }
});
console.log("=== EARNING COMPONENTS (company 1) ===");
for (const c of comps) {
  console.log("  " + c.code.padEnd(15) + " " + c.name.padEnd(25) + " inGross=" + c.includeInGross + " tier=" + c.grossTier + " inPf=" + c.includeInPf);
}

// Check employees with salary revisions
const emps = await prisma.employee.findMany({
  where: { companyId, deletedAt: null, isActive: true },
  select: {
    id: true, employeeCode: true, firstName: true, lastName: true,
    salaryRevisions: {
      where: { effectiveTo: null },
      take: 1,
      select: { id: true, grossSalary: true, components: { include: { salaryComponent: { select: { code: true, name: true, includeInGross: true, grossTier: true } } } } }
    }
  },
  take: 5
});
console.log("\n=== EMPLOYEES WITH SALARY (company 1, first 5) ===");
for (const e of emps) {
  const rev = e.salaryRevisions[0];
  if (!rev) { console.log("  " + e.employeeCode + " " + e.firstName + " — NO salary revision"); continue; }
  console.log("  " + e.employeeCode + " " + e.firstName + " — grossSalary=" + rev.grossSalary + " (" + rev.components.length + " components)");
  for (const c of rev.components) {
    console.log("      " + c.salaryComponent.code.padEnd(15) + " " + c.amount + "  [inGross=" + c.salaryComponent.includeInGross + " tier=" + c.salaryComponent.grossTier + "]");
  }
}

// Check attendance summaries finalized
const summaries = await prisma.monthlyAttendanceSummary.findMany({
  where: { employee: { companyId }, status: "FINALIZED" },
  select: { employeeId: true, year: true, month: true, status: true, totalWorkingDays: true, payableDays: true },
  take: 5,
  orderBy: [{ year: "desc" }, { month: "desc" }]
});
console.log("\n=== FINALIZED ATTENDANCE (company 1, first 5) ===");
for (const s of summaries) {
  console.log("  emp#" + s.employeeId + " " + s.year + "-" + s.month + " " + s.status + " " + s.payableDays + "/" + s.totalWorkingDays + " days");
}

// Check existing payroll runs
const runs = await prisma.payrollRun.findMany({
  where: { companyId },
  select: { id: true, year: true, month: true, status: true },
  orderBy: [{ year: "desc" }, { month: "desc" }],
  take: 5
});
console.log("\n=== PAYROLL RUNS (company 1, first 5) ===");
for (const r of runs) {
  console.log("  run#" + r.id + " " + r.year + "-" + r.month + " status=" + r.status);
}

// Check PF rate
const pf = await prisma.pfRate.findFirst({ where: { effectiveTo: null, isActive: true } });
console.log("\n=== PF RATE ===", pf ? "emp=" + pf.employeeContributionRate + "% ceiling=" + pf.wageCeilingMonthly : "NONE");

// Check PT slabs
const pts = await prisma.professionalTaxSlab.findMany({ where: { effectiveTo: null, isActive: true } });
console.log("=== PT SLABS ===");
for (const p of pts) console.log("  " + p.minSalary + " to " + p.maxSalary + " = " + p.monthlyAmount);

await prisma.$disconnect();

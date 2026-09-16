/**
 * verify-gross-tiers.mjs — End-to-end verification of the Fixed Gross /
 * Additional Gross / CTC-only (Performance Incentive) payroll changes.
 *
 * Sets up a fresh isolation company with the exact salary structure from
 * the business example, runs the calculation logic, and prints the result:
 *   Fixed Gross  = 50,000  (Basic + HRA + LTA + Special + Educational)
 *   Additional   =  9,000  (Additional HRA)
 *   Gross        = 59,000
 *   PF           =  3,000  (on Basic, NOT on 64,000)
 *   PT           =    208  (on Gross, NOT on 64,000)
 *   Net          = 55,792  (Gross - PF - PT; performance incentive NOT added)
 *
 *   node scripts/verify-gross-tiers.mjs
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const companyId = (await prisma.company.create({
  data: { code: "GTV" + Date.now(), name: "Gross Tiers Verify Co" },
})).id;
const suffix2 = String(Date.now()).slice(-6);
console.log("Created company id", companyId);

try {
  // ── Org structure (required by JobInfo) ────────────────────────────
  const dept = await prisma.department.create({ data: { code: "DPT" + suffix2, name: "Test Dept" } });
  const desig = await prisma.designation.create({ data: { code: "DSG" + suffix2, name: "Test Desig" } });
  const empType = await prisma.employeeType.create({ data: { code: "ETP" + suffix2, name: "Test Type" } });
  console.log("Created org structure");

  // ── Salary components with the right flags ─────────────────────────
  //    FIXED tier: Basic, HRA, LTA, Special, Educational
  //    ADDITIONAL tier: Additional HRA
  //    CTC-only (includeInGross=false): Performance Incentive
  const componentDefs = [
    { code: "BASIC",     name: "Basic Salary",          type: "earning", includeInGross: true,  grossTier: "FIXED",       includeInPf: true },
    { code: "HRA",       name: "HRA",                    type: "earning", includeInGross: true,  grossTier: "FIXED",       includeInPf: false },
    { code: "LTA",      name: "LTA",                    type: "earning", includeInGross: true,  grossTier: "FIXED",       includeInPf: false },
    { code: "SPL_ALLOW", name: "Special Allowance",     type: "earning", includeInGross: true,  grossTier: "FIXED",       includeInPf: false },
    { code: "EDUCATION", name: "Educational Allowance",  type: "earning", includeInGross: true,  grossTier: "FIXED",       includeInPf: false },
    { code: "ADD_HRA",   name: "Additional HRA",         type: "earning", includeInGross: true,  grossTier: "ADDITIONAL",  includeInPf: false },
    { code: "PERF_INS",  name: "Performance Incentive", type: "earning", includeInGross: false, grossTier: "ADDITIONAL",  includeInPf: false },
  ];
  const compIds = {};
  for (const c of componentDefs) {
    compIds[c.code] = (await prisma.salaryComponent.create({
      data: { companyId, code: c.code, name: c.name, type: c.type, includeInGross: c.includeInGross, grossTier: c.grossTier, includeInPf: c.includeInPf, isSystemDefined: false },
    })).id;
  }
  console.log("Created", Object.keys(compIds).length, "components");

  // ── Test employee ──────────────────────────────────────────────────
    const emp = await prisma.employee.create({
      data: { companyId, employeeCode: "VERIFY01", firstName: "Verify", lastName: "Test", isActive: true },
    });
  console.log("Created employee", emp.employeeCode, "id", emp.id);

  // JobInfo with PF + PT applicable
  await prisma.jobInfo.create({
    data: {
      employeeId: emp.id,
      departmentId: dept.id,
      designationId: desig.id,
      employeeTypeId: empType.id,
      joinDate: new Date("2026-01-01"),
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: null,
      esiApplicable: false,
      professionalTaxApplicable: true,
      overtimeAllowed: false,
      wageType: "monthly",
    },
  });
  console.log("Created JobInfo (PF + PT applicable)");

  // ── Salary revision with the example amounts ─────────────────────
  const revision = await prisma.employeeSalaryRevision.create({
    data: {
      employeeId: emp.id,
      financialYear: "2026-2027",
      grossSalary: 59000,
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: null,
      components: {
        create: [
          { salaryComponentId: compIds.BASIC,     amount: 25000 },
          { salaryComponentId: compIds.HRA,       amount: 15000 },
          { salaryComponentId: compIds.LTA,       amount: 5000 },
          { salaryComponentId: compIds.SPL_ALLOW, amount: 2500 },
          { salaryComponentId: compIds.EDUCATION, amount: 2500 },
          { salaryComponentId: compIds.ADD_HRA,   amount: 9000 },
          { salaryComponentId: compIds.PERF_INS,  amount: 5000 },
        ],
      },
    },
  });
  console.log("Created salary revision id", revision.id, "with 7 components");

  // ── Finalized attendance (full month, no LOP) ─────────────────────
  const year = 2026, month = 9;
  await prisma.monthlyAttendanceSummary.create({
    data: {
      employeeId: emp.id,
      year, month,
      totalWorkingDays: 30, payableDays: 30, presentDays: 30,
      absentDays: 0, leaveDays: 0, lopDays: 0,
      otMinutesTotal: 0, lateMinutesTotal: 0, earlyOutMinutesTotal: 0,
      status: "FINALIZED",
    },
  });
  console.log("Created attendance summary (FINALIZED, 30/30 days)");

  // ── PF rate: 12% employee, ceiling 50000 (so PF = 12% of 25000 = 3000) ─
  await prisma.pfRate.create({
    data: { code: "PF" + suffix2, employeeContributionRate: 12, employerContributionRate: 13, pensionContributionRate: 8.33, wageCeilingMonthly: 50000, effectiveFrom: new Date("2026-01-01"), effectiveTo: null, isActive: true },
  });
  console.log("Set PF rate 12%, ceiling 50000");

  // ── PT slab: 208 for salary > 12500 ───────────────────────────────
  await prisma.professionalTaxSlab.create({
    data: { code: "PT" + suffix2, minSalary: 12501, maxSalary: null, monthlyAmount: 208, effectiveFrom: new Date("2026-01-01"), effectiveTo: null, isActive: true },
  });
  console.log("Set PT slab: 208 for salary > 12500");

  // ── Run the calculation engine ────────────────────────────────────
  const run = await prisma.payrollRun.create({ data: { companyId, year, month } });
  console.log("Created payroll run id", run.id, "for", year, "-", month);

  // Import calculatePayrollRun from the compiled TS
  // Use dynamic import with tsx-compatible path
  const { calculatePayrollRun } = await import("../src/lib/payrollCalculation.ts");
  const result = await calculatePayrollRun(run.id);
  console.log("Calculation result:", JSON.stringify(result));

  // ── Read the PayrollLine and verify ────────────────────────────────
  const line = await prisma.payrollLine.findFirst({
    where: { payrollRunId: run.id, employeeId: emp.id },
    include: { components: { include: { salaryComponent: { select: { code: true, name: true, type: true, includeInGross: true, grossTier: true } } } } },
  });

  const fixedGross = Number(line.fixedGross);
  const additionalGross = Number(line.additionalGross);
  const grossEarnings = Number(line.grossEarnings);
  const pfEmployee = Number(line.pfEmployee);
  const professionalTax = Number(line.professionalTax);
  const netSalary = Number(line.netSalary);
  const perfIncentive = Number(line.performanceIncentive);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("              PAYROLL VERIFICATION RESULT");
  console.log("═══════════════════════════════════════════════════");
  console.log("Component breakdown:");
  for (const c of line.components.filter(c => c.salaryComponent.type === "earning")) {
    const tier = c.salaryComponent.includeInGross === false ? "CTC-ONLY" : c.salaryComponent.grossTier;
    console.log("  " + c.salaryComponent.code.padEnd(12) + " " + String(Number(c.amount)).padStart(6) + "  [" + tier + "]");
  }
  console.log("───────────────────────────────────────────────────");
  console.log("Fixed Gross:     " + fixedGross.toLocaleString() + "    (expected 50,000)  " + (fixedGross === 50000 ? "PASS" : "FAIL"));
  console.log("Additional:      " + additionalGross.toLocaleString() + "    (expected  9,000)  " + (additionalGross === 9000 ? "PASS" : "FAIL"));
  console.log("Gross:           " + grossEarnings.toLocaleString() + "    (expected 59,000)  " + (grossEarnings === 59000 ? "PASS" : "FAIL"));
  console.log("PF (12% Basic):  " + pfEmployee.toLocaleString() + "    (expected  3,000)  " + (pfEmployee === 3000 ? "PASS" : "FAIL"));
  console.log("PT:              " + professionalTax.toLocaleString() + "    (expected    208)  " + (professionalTax === 208 ? "PASS" : "FAIL"));
  console.log("Net Salary:       " + netSalary.toLocaleString() + "    (expected 55,792)  " + (netSalary === 55792 ? "PASS" : "FAIL"));
  console.log("Perf Incentive:   " + perfIncentive.toLocaleString() + "    (expected      0)  " + (perfIncentive === 0 ? "PASS" : "FAIL"));
  console.log("═══════════════════════════════════════════════════");
  console.log("Perf incentive excluded from Gross: " + (grossEarnings === 59000 ? "PASS" : "FAIL"));
  console.log("Perf incentive NOT a PF base:       " + (pfEmployee === 3000 ? "PASS" : "FAIL"));
  console.log("Perf incentive NOT a PT base:       " + (professionalTax === 208 ? "PASS" : "FAIL"));
  console.log("═══════════════════════════════════════════════════");

  const allPass = fixedGross === 50000 && additionalGross === 9000 && grossEarnings === 59000 && pfEmployee === 3000 && professionalTax === 208 && netSalary === 55792 && perfIncentive === 0;
  console.log("\nOVERALL: " + (allPass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));

} catch (err) {
  console.error("ERROR:", err.message);
  console.error(err.stack);
} finally {
  // ── Cleanup: delete in dependency order ────────────────────────────
  console.log("\nCleaning up...");
  try {
    const empIds = (await prisma.employee.findMany({ where: { companyId }, select: { id: true } })).map(e => e.id);
    await prisma.payrollLineComponent.deleteMany({});
    if (empIds.length) await prisma.payrollLine.deleteMany({ where: { employeeId: { in: empIds } } });
    await prisma.payrollRun.deleteMany({ where: { companyId } });
    if (empIds.length) await prisma.monthlyAttendanceSummary.deleteMany({ where: { employeeId: { in: empIds } } });
    if (empIds.length) await prisma.jobInfo.deleteMany({ where: { employeeId: { in: empIds } } });
    if (empIds.length) await prisma.employeeSalaryComponent.deleteMany({ where: { salaryRevision: { employeeId: { in: empIds } } } });
    if (empIds.length) await prisma.employeeSalaryRevision.deleteMany({ where: { employeeId: { in: empIds } } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.salaryComponent.deleteMany({ where: { companyId } });
    await prisma.pfRate.deleteMany({});
    await prisma.professionalTaxSlab.deleteMany({});
    await prisma.department.deleteMany({ where: { code: "DPT" + suffix2 } });
    await prisma.designation.deleteMany({ where: { code: "DSG" + suffix2 } });
    await prisma.employeeType.deleteMany({ where: { code: "ETP" + suffix2 } });
    await prisma.company.delete({ where: { id: companyId } });
    console.log("Cleanup done.");
  } catch (cleanupErr) {
    console.error("Cleanup error:", cleanupErr.message);
  }
  await prisma.$disconnect();
}

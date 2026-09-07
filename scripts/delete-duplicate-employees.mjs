/**
 * Deletes exact-duplicate employee records (same firstName+lastName+
 * oldEmployeeCode uploaded more than once — e.g. "Anandraj"/036 imported
 * as both EMP001 and EMP052) for KUN Aerospace. Within each duplicate
 * group, keeps whichever copy already has synced DailyAttendance rows (or
 * the first-created one if none do) and deletes the rest, following the
 * same FK dependency order as reset-kun-demo-data.mjs.
 *
 * Reads the id list from dup-ids-to-delete.json (built by a one-off
 * grouping query) rather than recomputing it, so what gets deleted exactly
 * matches what was shown to the user before they approved.
 *
 *   node scripts/delete-duplicate-employees.mjs <path-to-ids.json>
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

const COMPANY_ID = 1;
const idsFile = process.argv[2];
if (!idsFile) throw new Error("Usage: node scripts/delete-duplicate-employees.mjs <path-to-ids.json>");
const employeeIds = JSON.parse(readFileSync(idsFile, "utf8"));

try {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company || !/kun/i.test(company.name)) {
    throw new Error(`Safety check failed: companyId ${COMPANY_ID} is "${company?.name}", not KUN Aerospace. Aborting.`);
  }

  const found = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, companyId: COMPANY_ID },
    select: { id: true, employeeCode: true, oldEmployeeCode: true, firstName: true, lastName: true },
  });
  console.log(`Deleting ${found.length} duplicate employee records:`);
  for (const e of found) console.log(`  ${e.employeeCode} (id ${e.id}) — ${e.firstName} ${e.lastName} — device ${e.oldEmployeeCode}`);

  if (found.length === 0) {
    console.log("Nothing to delete.");
  } else {
    const ids = found.map((e) => e.id);
    await prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({ where: { id: { in: ids } }, data: { reportingManagerId: null } });
      await tx.employee.updateMany({ where: { reportingManagerId: { in: ids } }, data: { reportingManagerId: null } });
      await tx.biometricAttendanceImport.updateMany({ where: { matchedEmployeeId: { in: ids } }, data: { matchedEmployeeId: null } });

      const revisions = await tx.employeeSalaryRevision.findMany({ where: { employeeId: { in: ids } }, select: { id: true } });
      await tx.employeeSalaryComponent.deleteMany({ where: { salaryRevisionId: { in: revisions.map((r) => r.id) } } });

      const revisionRequests = await tx.salaryRevisionRequest.findMany({ where: { employeeId: { in: ids } }, select: { id: true } });
      await tx.salaryRevisionComponent.deleteMany({ where: { salaryRevisionRequestId: { in: revisionRequests.map((r) => r.id) } } });

      const arrears = await tx.salaryArrear.findMany({ where: { employeeId: { in: ids } }, select: { id: true } });
      await tx.salaryArrearMonth.deleteMany({ where: { salaryArrearId: { in: arrears.map((a) => a.id) } } });

      const payrollLines = await tx.payrollLine.findMany({ where: { employeeId: { in: ids } }, select: { id: true } });
      await tx.payrollLineComponent.deleteMany({ where: { payrollLineId: { in: payrollLines.map((l) => l.id) } } });

      await tx.gratuityRecord.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.bonusRecord.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.leaveApplication.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.leaveBalance.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.dailyAttendanceHistory.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.dailyAttendance.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.monthlyAttendanceSummary.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeActivity.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeSkill.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeDocument.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeAssetAllocation.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeEmergencyContact.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeKyc.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeePassport.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeDependent.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeExperience.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeEducation.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeBankDetail.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeContactDetails.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.personalDetails.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.salaryStructure.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeCtc.deleteMany({ where: { employeeId: { in: ids } } });

      await tx.salaryArrear.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.salaryRevisionRequest.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.employeeSalaryRevision.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.payrollLine.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.exitInterview.deleteMany({ where: { employeeId: { in: ids } } });
      await tx.jobInfo.deleteMany({ where: { employeeId: { in: ids } } });

      await tx.employee.deleteMany({ where: { id: { in: ids } } });
    });

    console.log(`Deleted ${found.length} duplicate employees.`);
  }
} finally {
  await prisma.$disconnect();
}

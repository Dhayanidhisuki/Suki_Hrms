/**
 * Deletes the 25 legacy demo employees (EMP001-EMP025, companyId=1) whose
 * oldEmployeeCode is a 6-digit legacy code (e.g. "100038") that has never
 * matched any real user on the biometric device — confirmed by scanning
 * the device's full punch history (55 distinct enrolled IDs, all short
 * numeric/E-prefixed, none matching the 100xxx pattern). Explicitly
 * requested by the user after confirming scope (25 mismatched employees,
 * not the full company).
 *
 * Follows the same FK dependency order as reset-kun-demo-data.mjs, scoped
 * to just these 25 ids instead of the whole company, plus nulls out the
 * two extra references that script's broader scope didn't need to worry
 * about in isolation: reportingManagerId on employees OUTSIDE this set who
 * report to one of these 25, and BiometricAttendanceImport.matchedEmployeeId.
 *
 *   node scripts/delete-mismatched-biometric-employees.mjs
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

try {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company || !/kun/i.test(company.name)) {
    throw new Error(`Safety check failed: companyId ${COMPANY_ID} is "${company?.name}", not KUN Aerospace. Aborting.`);
  }

  const candidates = await prisma.employee.findMany({
    where: { companyId: COMPANY_ID, isActive: true, deletedAt: null },
    select: { id: true, employeeCode: true, oldEmployeeCode: true, firstName: true, lastName: true },
  });
  const legacy = candidates.filter((e) => e.oldEmployeeCode && /^\d{5,6}$/.test(e.oldEmployeeCode));
  const employeeIds = legacy.map((e) => e.id);

  console.log(`Found ${employeeIds.length} employees with a legacy 6-digit oldEmployeeCode:`);
  for (const e of legacy) console.log(`  ${e.employeeCode} (id ${e.id}) — ${e.firstName} ${e.lastName} — device code ${e.oldEmployeeCode}`);

  if (employeeIds.length === 0) {
    console.log("Nothing to delete.");
  } else {
    await prisma.$transaction(async (tx) => {
      // Break self-referential reportingManagerId links, both within the
      // set and from any other employee who reports to one of these 25.
      await tx.employee.updateMany({ where: { id: { in: employeeIds } }, data: { reportingManagerId: null } });
      await tx.employee.updateMany({ where: { reportingManagerId: { in: employeeIds } }, data: { reportingManagerId: null } });

      // Legacy CSV import rows that matched one of these — unmatch, don't delete the import row itself.
      await tx.biometricAttendanceImport.updateMany({ where: { matchedEmployeeId: { in: employeeIds } }, data: { matchedEmployeeId: null } });

      const revisions = await tx.employeeSalaryRevision.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
      const revisionIds = revisions.map((r) => r.id);
      await tx.employeeSalaryComponent.deleteMany({ where: { salaryRevisionId: { in: revisionIds } } });

      const revisionRequests = await tx.salaryRevisionRequest.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
      const revisionRequestIds = revisionRequests.map((r) => r.id);
      await tx.salaryRevisionComponent.deleteMany({ where: { salaryRevisionRequestId: { in: revisionRequestIds } } });

      const arrears = await tx.salaryArrear.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
      const arrearIds = arrears.map((a) => a.id);
      await tx.salaryArrearMonth.deleteMany({ where: { salaryArrearId: { in: arrearIds } } });

      const payrollLines = await tx.payrollLine.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
      const payrollLineIds = payrollLines.map((l) => l.id);
      await tx.payrollLineComponent.deleteMany({ where: { payrollLineId: { in: payrollLineIds } } });

      await tx.gratuityRecord.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.bonusRecord.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.leaveApplication.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.leaveBalance.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.dailyAttendanceHistory.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.dailyAttendance.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.monthlyAttendanceSummary.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeActivity.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeSkill.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeDocument.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeAssetAllocation.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeEmergencyContact.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeKyc.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeePassport.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeDependent.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeExperience.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeEducation.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeBankDetail.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeContactDetails.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.personalDetails.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.salaryStructure.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeCtc.deleteMany({ where: { employeeId: { in: employeeIds } } });

      await tx.salaryArrear.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.salaryRevisionRequest.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeSalaryRevision.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.payrollLine.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.exitInterview.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.jobInfo.deleteMany({ where: { employeeId: { in: employeeIds } } });

      await tx.employee.deleteMany({ where: { id: { in: employeeIds } } });
    });

    console.log(`Deleted ${employeeIds.length} mismatched-code employees and their dependent records.`);
  }
} finally {
  await prisma.$disconnect();
}

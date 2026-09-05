/**
 * Deletes ALL employee/transactional data for KUN Aerospace (companyId=1)
 * to prepare a clean slate for demo seeding. Explicitly does NOT touch:
 *   - Masters (departments, designations, PF/ESI rates, salary components,
 *     bonus rates, gratuity policies, etc.)
 *   - Any User/Role/Permission/RolePermission rows (login accounts)
 *   - Any other company's data
 *
 * Deletes in FK dependency order (every FK in this schema is onDelete:
 * NoAction, so children must go before parents). One-off, not meant to be
 * re-run blindly — it re-verifies the company identity before deleting
 * anything.
 *
 *   node scripts/reset-kun-demo-data.mjs
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

  const employees = await prisma.employee.findMany({ where: { companyId: COMPANY_ID }, select: { id: true } });
  const employeeIds = employees.map((e) => e.id);
  console.log(`Found ${employeeIds.length} employees under ${company.name} (companyId=${COMPANY_ID}).`);

  if (employeeIds.length === 0) {
    console.log("Nothing to delete.");
  } else {
    await prisma.$transaction(async (tx) => {
      // Break self-referential reportingManagerId links before deleting.
      await tx.employee.updateMany({ where: { id: { in: employeeIds } }, data: { reportingManagerId: null } });

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
      // Must go before EmployeeSalaryRevision — SalaryRevisionRequest.appliedRevisionId FKs to it.
      await tx.salaryRevisionRequest.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.employeeSalaryRevision.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.payrollLine.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.payrollRun.deleteMany({ where: { companyId: COMPANY_ID } });
      await tx.exitInterview.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await tx.jobInfo.deleteMany({ where: { employeeId: { in: employeeIds } } });

      await tx.employee.deleteMany({ where: { id: { in: employeeIds } } });
    });

    console.log(`Deleted all employee/transactional data for ${employeeIds.length} employees under ${company.name}.`);
  }
} finally {
  await prisma.$disconnect();
}

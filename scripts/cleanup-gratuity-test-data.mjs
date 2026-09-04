/**
 * Hard-deletes the 3 fake employees created to verify Gratuity Phase 1
 * (EMP105/106/107 — "Gratuity TestCase", "GratuityShort TestCase",
 * "GratuityReject TestCase") and every row that references them, in FK
 * dependency order (all Gratuity/Employee FKs are onDelete: NoAction, so
 * children must go first). One-off, not meant to be re-run.
 *
 *   node scripts/cleanup-gratuity-test-data.mjs
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

const employeeIds = [70, 71, 72];

try {
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  });
  console.log("Deleting:", employees);

  await prisma.$transaction(async (tx) => {
    await tx.employeeActivity.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await tx.gratuityRecord.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await tx.exitInterview.deleteMany({ where: { employeeId: { in: employeeIds } } });
    const revisions = await tx.employeeSalaryRevision.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
    const revisionIds = revisions.map((r) => r.id);
    await tx.employeeSalaryComponent.deleteMany({ where: { salaryRevisionId: { in: revisionIds } } });
    await tx.employeeSalaryRevision.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await tx.jobInfo.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await tx.employee.deleteMany({ where: { id: { in: employeeIds } } });
  });

  console.log(`Deleted ${employees.length} test employees and all related rows.`);
} finally {
  await prisma.$disconnect();
}

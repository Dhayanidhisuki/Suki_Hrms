/**
 * BRD 01 §15/§17 — one open EmployeeReportingHistory row per employee from
 * the current Employee.reportingManagerId / secondReportingManagerId
 * pointers, effective from the date of joining of the current job row (or
 * the employee's createdAt when there is none). Idempotent: employees that
 * already have any history row are skipped.
 *
 *   node scripts/backfill-reporting-history.mjs
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

function utcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const employees = await prisma.employee.findMany({
  where: { deletedAt: null },
  select: {
    id: true,
    companyId: true,
    reportingManagerId: true,
    secondReportingManagerId: true,
    createdAt: true,
    jobInfos: { where: { effectiveTo: null }, take: 1, select: { joinDate: true } },
  },
});

const withHistory = new Set(
  (await prisma.employeeReportingHistory.findMany({ distinct: ["employeeId"], select: { employeeId: true } })).map((r) => r.employeeId)
);

let created = 0;
for (const emp of employees) {
  if (withHistory.has(emp.id)) continue;
  await prisma.employeeReportingHistory.create({
    data: {
      companyId: emp.companyId,
      employeeId: emp.id,
      primaryManagerId: emp.reportingManagerId,
      secondaryManagerId: emp.secondReportingManagerId,
      effectiveFrom: utcDay(emp.jobInfos[0]?.joinDate ?? emp.createdAt),
      effectiveTo: null,
      changeReason: "BACKFILL",
      createdByUserId: null,
    },
  });
  created++;
}

console.log(`backfill-reporting-history: ${employees.length} employees, ${created} rows created, ${withHistory.size} already had history`);
console.log(`EmployeeReportingHistory rows now: ${await prisma.employeeReportingHistory.count()}`);
await prisma.$disconnect();

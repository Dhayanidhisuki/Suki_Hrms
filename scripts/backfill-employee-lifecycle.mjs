/**
 * BRD 01 §8 — backfill Employee.lifecycleState from the legacy status:
 *   on-leave            → LONG_LEAVE
 *   terminated/resigned → SEPARATED
 *   active              → CONFIRMED when a confirmation date exists,
 *                         PROBATION while a probation end date is recorded
 *                         without one (the Pending Confirmations queue),
 *                         else CONFIRMED.
 * Writes one EmployeeStateTransition row (trigger BACKFILL) per employee.
 * Idempotent: rows that already carry a lifecycleState are left alone.
 * Mirrors deriveLifecycleState() in src/lib/employee/lifecycle.ts.
 *
 *   node scripts/backfill-employee-lifecycle.mjs
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

function derive(status, job) {
  switch (status) {
    case "on-leave":
      return "LONG_LEAVE";
    case "terminated":
    case "resigned":
      return "SEPARATED";
    default:
      if (job?.confirmationDate) return "CONFIRMED";
      if (job?.probationEndDate) return "PROBATION";
      return "CONFIRMED";
  }
}

function utcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const employees = await prisma.employee.findMany({
  where: { lifecycleState: null },
  select: {
    id: true,
    companyId: true,
    employeeCode: true,
    status: true,
    createdAt: true,
    jobInfos: { where: { effectiveTo: null }, take: 1, select: { joinDate: true, probationEndDate: true, confirmationDate: true } },
  },
});

const tally = {};
for (const emp of employees) {
  const job = emp.jobInfos[0] ?? null;
  const state = derive(emp.status, job);
  const effectiveDate = utcDay(job?.joinDate ?? emp.createdAt);
  await prisma.$transaction([
    prisma.employee.update({ where: { id: emp.id }, data: { lifecycleState: state } }),
    prisma.employeeStateTransition.create({
      data: {
        companyId: emp.companyId,
        employeeId: emp.id,
        fromState: null,
        toState: state,
        trigger: "BACKFILL",
        effectiveDate,
        reason: `Backfilled from legacy status '${emp.status}'`,
        performedByUserId: null,
      },
    }),
  ]);
  tally[state] = (tally[state] ?? 0) + 1;
}

console.log(`backfill-employee-lifecycle: ${employees.length} employees updated`, tally);
console.log(`Employees still without lifecycleState: ${await prisma.employee.count({ where: { lifecycleState: null } })}`);
console.log(`EmployeeStateTransition rows now: ${await prisma.employeeStateTransition.count()}`);
await prisma.$disconnect();

/**
 * Demo data for Workforce › Benefits › Double Machine & Other Incentives.
 *
 * Seeds a spread across all four workflow states so every part of the page is
 * exercised: the status pipeline, the Payroll Impact column, the hold reason,
 * the approver stamp and the summary bar counts.
 *
 * Defaults to June 2026 — the only period that is BOTH unlocked (CALCULATED,
 * so approve/hold/return work) AND has payroll lines (so "Will be paid" is
 * meaningful). July is APPROVED and August/September are LOCKED, which make
 * the page read-only; October is DRAFT with no lines, so every row would say
 * "No payroll line".
 *
 *   node scripts/seed-demo-incentives.mjs            # seed June 2026
 *   node scripts/seed-demo-incentives.mjs 2026 6     # seed a specific period
 *   node scripts/seed-demo-incentives.mjs --clear    # remove demo rows again
 *
 * NOTE: `complete` rows are PAID by payroll. If this period is recalculated,
 * these amounts land on real payslips. Run --clear when you are done looking.
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

const clear = process.argv.includes("--clear");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number);
const YEAR = args[0] || 2026;
const MONTH = args[1] || 6;

/** Amounts per state. Index into the run's employees, in order. */
const PLAN = [
  { status: "complete", doubleMachine: 2400, attendanceBonus: 1000, shiftIncentive: 500, otWeeklyInc: 500, employeeR: 0 },
  { status: "complete", doubleMachine: 1800, attendanceBonus: 1000, shiftIncentive: 0, otWeeklyInc: 1000, employeeR: 1500 },
  { status: "complete", doubleMachine: 0, attendanceBonus: 1000, shiftIncentive: 0, otWeeklyInc: 0, employeeR: 0 },
  { status: "process", doubleMachine: 1200, attendanceBonus: 0, shiftIncentive: 500, otWeeklyInc: 0, employeeR: 0 },
  { status: "process", doubleMachine: 3000, attendanceBonus: 1000, shiftIncentive: 0, otWeeklyInc: 500, employeeR: 0 },
  { status: "process", doubleMachine: 0, attendanceBonus: 0, shiftIncentive: 500, otWeeklyInc: 500, employeeR: 1500 },
  { status: "hold", doubleMachine: 2000, attendanceBonus: 1000, shiftIncentive: 0, otWeeklyInc: 0, employeeR: 0,
    reason: "Machine log not signed off by the shift supervisor" },
  { status: "hold", doubleMachine: 0, attendanceBonus: 1000, shiftIncentive: 500, otWeeklyInc: 0, employeeR: 1500,
    reason: "Referral pending HR confirmation of the candidate's join date" },
  // The two remaining employees are left with no row at all — that is the
  // virtual "draft" state, and it keeps the summary bar honest.
];

try {
  const run = await prisma.payrollRun.findFirst({ where: { year: YEAR, month: MONTH } });
  if (!run) { console.log(`No payroll run for ${MONTH}/${YEAR} — nothing to attach demo data to.`); process.exit(0); }

  const employeeIds = (await prisma.payrollLine.findMany({
    where: { payrollRunId: run.id }, select: { employeeId: true }, orderBy: { employeeId: "asc" },
  })).map((l) => l.employeeId);

  if (clear) {
    const d = await prisma.doubleMachineIncentive.deleteMany({
      where: { companyId: run.companyId, year: YEAR, month: MONTH, employeeId: { in: employeeIds } },
    });
    console.log(`Removed ${d.count} demo row(s) from ${MONTH}/${YEAR}.`);
    process.exit(0);
  }

  if (run.status === "APPROVED" || run.status === "LOCKED") {
    console.log(`Payroll for ${MONTH}/${YEAR} is ${run.status} — the page will be read-only. Pick an unlocked period for an interactive demo.`);
  }

  // An approver id, so the "✓ approved by" stamp renders on complete rows.
  const approver = await prisma.user.findFirst({ select: { id: true, email: true } });

  let made = 0;
  for (let i = 0; i < PLAN.length && i < employeeIds.length; i++) {
    const spec = PLAN[i];
    const employeeId = employeeIds[i];
    await prisma.doubleMachineIncentive.deleteMany({ where: { employeeId, year: YEAR, month: MONTH } });
    await prisma.doubleMachineIncentive.create({
      data: {
        companyId: run.companyId, employeeId, year: YEAR, month: MONTH,
        status: spec.status,
        doubleMachine: spec.doubleMachine, attendanceBonus: spec.attendanceBonus,
        shiftIncentive: spec.shiftIncentive, otWeeklyInc: spec.otWeeklyInc, employeeR: spec.employeeR,
        rejectionReason: spec.reason ?? null,
        approvedByUserId: spec.status === "complete" ? approver?.id ?? null : null,
        approvedAt: spec.status === "complete" ? new Date() : null,
      },
    });
    made++;
  }

  const counts = await prisma.doubleMachineIncentive.groupBy({
    by: ["status"], where: { companyId: run.companyId, year: YEAR, month: MONTH }, _count: { _all: true },
  });
  console.log(`Seeded ${made} row(s) for ${MONTH}/${YEAR} (run is ${run.status}).`);
  for (const c of counts) console.log(`  ${c.status}: ${c._count._all}`);
  console.log(`  approver stamp: ${approver?.email ?? "none found"}`);
  console.log(`  ${employeeIds.length - made} employee(s) left with no row — these show as "draft".`);
  console.log(`\nRun with --clear to remove them.`);
} finally {
  await prisma.$disconnect();
}

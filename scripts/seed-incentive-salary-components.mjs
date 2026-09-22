/**
 * Backfills the SalaryComponent rows that payrollCalculation.ts looks up when
 * crediting the monthly incentives from Workforce > Benefits > Double Machine
 * & Other Incentives — plus CANTEEN_DED, which the canteen recovery now writes
 * to instead of the CANTEEN earning row.
 *
 * Without these the amounts are still PAID (they go into autoEarningsTotal
 * regardless) but no PayrollLineComponent is written, so each one collapses
 * into the payslip's "Other Earnings" line instead of appearing by name.
 *
 * Idempotent, and runs across every company by default.
 *
 *   node scripts/seed-incentive-salary-components.mjs [companyId]
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

const COMPONENTS = [
  { code: "DM_INCENTIVE", name: "Double Machine Incentive", type: "earning" },
  { code: "ATT_BONUS", name: "Attendance Bonus", type: "earning" },
  { code: "SHIFT_BONUS", name: "Shift Incentive", type: "earning" },
  { code: "PETROL", name: "Petrol Allowance", type: "earning" },
  { code: "OT_WEEKLY_INC", name: "OT Weekly Incentive", type: "earning" },
  { code: "EMP_REFERRAL", name: "Employee Referral", type: "earning" },
  { code: "CANTEEN_DED", name: "Canteen Deduction", type: "deduction" },
];

try {
  const only = process.argv[2] ? Number(process.argv[2]) : null;
  const companies = only
    ? [{ id: only }]
    : await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true } });

  let created = 0;
  let existing = 0;
  for (const { id: companyId } of companies) {
    for (const c of COMPONENTS) {
      const found = await prisma.salaryComponent.findUnique({
        where: { companyId_code: { companyId, code: c.code } },
      });
      if (found) { existing++; continue; }
      await prisma.salaryComponent.create({ data: { companyId, ...c, isSystemDefined: false } });
      created++;
      console.log(`  company ${companyId}: created ${c.code}`);
    }
  }
  console.log(`\nDone — ${created} created, ${existing} already present, across ${companies.length} company(ies).`);
} finally {
  await prisma.$disconnect();
}

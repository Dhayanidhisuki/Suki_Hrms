/**
 * Repoints any DeductionRate coded CANTEEN at the CANTEEN_DED component.
 *
 * payrollCalculation resolves a DeductionRate's payslip component by code.
 * `CANTEEN` is an EARNING row ("Canteen Allowance"), so the canteen recovery —
 * correctly added to autoDeductionsTotal — was itemised on the payslip as a
 * +₹500 earning. `CANTEEN_DED` ("Canteen Deduction") exists for exactly this.
 *
 * Idempotent. payrollCalculation now also refuses to itemise a deduction rate
 * against an earning component, so this only restores the named line.
 *
 *   node scripts/fix-canteen-deduction-rate.mjs
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

try {
  const rates = await prisma.deductionRate.findMany({ where: { code: "CANTEEN" } });
  if (rates.length === 0) { console.log("No DeductionRate coded CANTEEN — nothing to do."); }
  for (const r of rates) {
    const target = await prisma.salaryComponent.findUnique({
      where: { companyId_code: { companyId: r.companyId, code: "CANTEEN_DED" } },
    });
    if (!target) {
      console.log(`  company ${r.companyId}: CANTEEN_DED missing — run seed-incentive-salary-components.mjs first`);
      continue;
    }
    await prisma.deductionRate.update({ where: { id: r.id }, data: { code: "CANTEEN_DED" } });
    console.log(`  company ${r.companyId}: DeductionRate ${r.id} CANTEEN -> CANTEEN_DED (${r.rateValue})`);
  }
} finally {
  await prisma.$disconnect();
}

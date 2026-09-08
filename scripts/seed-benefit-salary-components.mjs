/**
 * Backfills the 5 new Employee Benefits & Allowances SalaryComponent rows
 * (added to src/lib/defaultSalaryComponents.ts) for a company that already
 * ran bootstrap-admin before they existed — new companies get them
 * automatically via that flow going forward.
 *
 *   node scripts/seed-benefit-salary-components.mjs [companyId]
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

const COMPANY_ID = Number(process.argv[2] ?? 1);

const NEW_COMPONENTS = [
  { code: "CANTEEN_DED", name: "Canteen Deduction", type: "deduction" },
  { code: "PETROL_ALLOW", name: "Petrol Allowance", type: "earning" },
  { code: "DOUBLE_MACHINE", name: "Double Machine Allowance", type: "earning" },
  { code: "EXTRA_WORK", name: "Extra Work Allowance", type: "earning" },
  { code: "REFERRAL_BONUS", name: "Referral Bonus", type: "earning" },
];

try {
  for (const c of NEW_COMPONENTS) {
    const row = await prisma.salaryComponent.upsert({
      where: { companyId_code: { companyId: COMPANY_ID, code: c.code } },
      update: {},
      create: { companyId: COMPANY_ID, code: c.code, name: c.name, type: c.type, isSystemDefined: false },
    });
    console.log(`${c.code} -> id ${row.id}`);
  }
} finally {
  await prisma.$disconnect();
}

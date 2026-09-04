/**
 * Seeds the 1 SalaryComponent row used by the Bonus Management Phase 1
 * "Apply to Payroll" action to itemize an approved bonus as an ad-hoc
 * PayrollLineComponent earning (see src/lib/bonusApply.ts) into one
 * company's catalog. Idempotent (upsert by unique [companyId, code] —
 * migration 000012 made SalaryComponent company-scoped). Superseded going
 * forward by bootstrap-admin, which seeds this into every new company
 * automatically via src/lib/defaultSalaryComponents.ts — this script is for
 * backfilling an existing company that predates that.
 *
 *   node scripts/seed-bonus-component.mjs [companyId]   (default: 1)
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

const companyId = Number(process.argv[2] ?? 1);

try {
  await prisma.salaryComponent.upsert({
    where: { companyId_code: { companyId, code: "BONUS" } },
    update: { name: "Bonus", type: "earning" },
    create: { companyId, code: "BONUS", name: "Bonus", type: "earning", isSystemDefined: true },
  });
  console.log(`Bonus salary component upserted for company ${companyId}.`);
} finally {
  await prisma.$disconnect();
}

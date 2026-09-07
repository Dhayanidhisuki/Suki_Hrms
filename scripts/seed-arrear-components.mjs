/**
 * Seeds the 3 SalaryComponent rows used by the Salary Revision & Arrear
 * Phase 1 "Apply to Payroll" action to itemize an arrear as ad-hoc
 * PayrollLineComponent rows (see src/lib/arrearApply.ts) into one company's
 * catalog. Idempotent (upsert by unique [companyId, code] — migration
 * 000012 made SalaryComponent company-scoped). Superseded going forward by
 * bootstrap-admin, which seeds these into every new company automatically
 * via src/lib/defaultSalaryComponents.ts — this script is for backfilling
 * an existing company that predates that.
 *
 *   node scripts/seed-arrear-components.mjs [companyId]   (default: 1)
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

const COMPONENTS = [
  ["ARREAR_GROSS", "Salary Arrear", "earning"],
  ["ARREAR_PF", "PF Arrear", "deduction"],
  ["ARREAR_ESI", "ESI Arrear", "deduction"],
];

try {
  for (const [code, name, type] of COMPONENTS) {
    await prisma.salaryComponent.upsert({
      where: { companyId_code: { companyId, code } },
      update: { name, type },
      create: { companyId, code, name, type, isSystemDefined: true },
    });
  }
  console.log(`Arrear salary components upserted for company ${companyId}: ${COMPONENTS.length}`);
} finally {
  await prisma.$disconnect();
}

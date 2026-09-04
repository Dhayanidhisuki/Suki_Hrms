/**
 * Seeds SalaryComponent rows from D:\CRM\kun hrms\payroll.rpt (35 components)
 * into one company's catalog. Idempotent (upsert by unique [companyId, code]
 * — migration 000012 made SalaryComponent company-scoped).
 *
 * This list mirrors src/lib/defaultSalaryComponents.ts (the source of truth
 * new companies get seeded from automatically via bootstrap-admin) — kept
 * as a separate plain-JS copy here rather than importing that .ts file
 * because this script runs under plain Node (no TS loader configured), not
 * through Next.js's toolchain. Keep the two in sync by hand if either
 * changes.
 *
 *   node scripts/seed-salary-components.mjs [companyId]   (default: 1)
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

// [code, name, type] — from payroll.rpt COMPONENT / DEFAULT_LABLE.
// type is inferred from the component's role in the payroll.rpt LOGIC_TYPE
// rows (PF/ESI/LWF/LIC/professional-tax style rows are deductions; the rest
// are earnings). No formulas are seeded — spec forbids inventing calc logic.
const COMPONENTS = [
  ["BASIC", "Basic Salary", "earning"],
  ["SRA", "SRA", "earning"],
  ["QA", "QA", "earning"],
  ["FDA", "SRA", "earning"],
  ["SNACKS", "Snacks Allowance", "earning"],
  ["CONVEYANCE", "Conv.Allow", "earning"],
  ["SPL_ALLOW", "Spl.Allowance", "earning"],
  ["HEAT", "Heat Allowance", "earning"],
  ["WASH", "Wash Allowance", "earning"],
  ["HRA", "HRA", "earning"],
  ["NIGHT_SHIFT", "Night Shift Allowance", "earning"],
  ["DA", "DA", "earning"],
  ["EDUCATION", "Education Allowance", "earning"],
  ["ATTENDANCE", "Attendance Incentive for 100% Attendance", "earning"],
  ["ADD_HRA", "Additional HRA", "earning"],
  ["HEALTH", "Health Allowance", "earning"],
  ["CANTEEN", "Canteen Allowance", "earning"],
  ["GUEST_HOUSE", "Guest.House Allowance", "earning"],
  ["CCA", "CCA", "earning"],
  ["DIS_LOCATION", "Dis.Location.Allow", "earning"],
  ["OTHER1", "Other Allowance", "earning"],
  ["OTHER2", "Other Allowance 2", "earning"],
  ["OTHER3", "Other Allowance 3", "earning"],
  ["LUNCH_PER_DAY", "Lunch Allowance Per/Day", "earning"],
  ["FOOD", "Food Allowance", "earning"],
  ["PROD_INS", "Prod.Incentive", "earning"],
  ["PERFORMANCE_INS", "Performance Incentive", "earning"],
  ["PERFORMANCE", "Performance Allowance", "earning"],
  ["ESI", "Esi Allowance", "deduction"],
  ["PF", "PF", "deduction"],
  ["LIC", "LIC", "deduction"],
  ["LWF", "LWF", "deduction"],
  ["ATTENDANCE1", "Attendance Bonus if 1 day leave", "earning"],
  ["ATTENDANCE2", "Attendance Bonus if 2 days leave", "earning"],
  ["OTHER_DED2", "Other Deduction2", "deduction"],
];

const SYSTEM_DEFINED = new Set(["BASIC", "PF", "ESI"]);

try {
  for (const [code, name, type] of COMPONENTS) {
    await prisma.salaryComponent.upsert({
      where: { companyId_code: { companyId, code } },
      update: { name, type },
      create: { companyId, code, name, type, isSystemDefined: SYSTEM_DEFINED.has(code) },
    });
  }
  console.log(`Salary components upserted for company ${companyId}: ${COMPONENTS.length}`);
  console.log("\nDone.");
} finally {
  await prisma.$disconnect();
}

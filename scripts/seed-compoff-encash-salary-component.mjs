/**
 * Backfills the COMPOFF_ENCASH SalaryComponent row that
 * src/lib/compOffEncashApply.ts looks up by exact code when pushing
 * comp-off encashment into a payroll run as an ad-hoc earning — same
 * mechanism as BONUS (src/lib/bonusApply.ts). Company bootstrap seeds new
 * companies with it automatically (src/lib/defaultSalaryComponents.ts);
 * this backfills companies provisioned before that code existed.
 *
 * Idempotent, and runs across every company by default.
 *
 *   node scripts/seed-compoff-encash-salary-component.mjs [companyId]
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
  const only = process.argv[2] ? Number(process.argv[2]) : null;
  const companies = only
    ? [{ id: only }]
    : await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true } });

  let created = 0;
  let existing = 0;
  for (const { id: companyId } of companies) {
    const found = await prisma.salaryComponent.findUnique({
      where: { companyId_code: { companyId, code: "COMPOFF_ENCASH" } },
    });
    if (found) { existing++; continue; }
    await prisma.salaryComponent.create({
      data: { companyId, code: "COMPOFF_ENCASH", name: "Comp-Off Encashment", type: "earning", isSystemDefined: true },
    });
    created++;
    console.log(`  company ${companyId}: created COMPOFF_ENCASH`);
  }
  console.log(`\nDone — ${created} created, ${existing} already present, across ${companies.length} company(ies).`);
} finally {
  await prisma.$disconnect();
}

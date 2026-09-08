/**
 * Applies the two confirmed client BRD leave rules to LeaveMaster:
 *   - Earned Leave (EL): create it if missing, accrualType
 *     EARNED_PER_DAYS_WORKED at 1 day per 20 days worked, no carry-forward
 *     limit specified by the client yet so left un-set (carryForwardAllowed
 *     stays false until the client confirms a carry-forward policy for EL).
 *   - Casual Leave (CL): existing row updated to explicitly NOT carry
 *     forward (client: "no carry forward to next year") — it already
 *     defaulted to false pre-migration, this just makes the decision
 *     explicit and idempotent against future default changes.
 * Leaves Sick Leave and the stray "sickleave" (SL0) rows untouched — no BRD
 * answer covers them yet.
 *
 *   node scripts/configure-el-cl-leave-rules.mjs
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
  const el = await prisma.leaveMaster.upsert({
    where: { code: "EL" },
    update: { accrualType: "EARNED_PER_DAYS_WORKED", daysWorkedPerAccrualUnit: 20 },
    create: {
      code: "EL",
      name: "Earned Leave",
      description: "1 day earned per 20 working days worked (client BRD).",
      accrualType: "EARNED_PER_DAYS_WORKED",
      daysWorkedPerAccrualUnit: 20,
      carryForwardAllowed: false,
    },
  });
  console.log(`EL: id=${el.id} accrualType=${el.accrualType} daysWorkedPerAccrualUnit=${el.daysWorkedPerAccrualUnit}`);

  const cl = await prisma.leaveMaster.update({
    where: { code: "CL" },
    data: { accrualType: "FIXED_ANNUAL", carryForwardAllowed: false, carryForwardMaxDays: null },
  });
  console.log(`CL: id=${cl.id} accrualType=${cl.accrualType} carryForwardAllowed=${cl.carryForwardAllowed} defaultAnnualDays=${cl.defaultAnnualDays}`);
  console.log("Note: CL.defaultAnnualDays is still 0 — client has not given the actual CL entitlement number yet (BRD: \"Based on company policy\").");
} finally {
  await prisma.$disconnect();
}

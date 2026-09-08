/**
 * Seeds the Compensatory Off leave type (code COMPOFF) — MANUAL accrual, not
 * touched by the annual leave-credit run. Balance is credited entirely by
 * the OT Approval HR stage when Sunday/holiday OT is settled as Comp-Off
 * instead of paid overtime (src/app/api/workforce/attendance/ot/[id]/approve/route.ts),
 * and spent through the existing Leave Entry / Leave Approval pages like
 * any other leave type — no new "spend Comp-Off" UI needed.
 *
 *   node scripts/seed-compoff-leave-type.mjs
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
  const compOff = await prisma.leaveMaster.upsert({
    where: { code: "COMPOFF" },
    update: { accrualType: "MANUAL" },
    create: {
      code: "COMPOFF",
      name: "Compensatory Off",
      description: "Earned by working a weekly-off day or holiday, granted via OT approval settlement.",
      accrualType: "MANUAL",
      carryForwardAllowed: false,
    },
  });
  console.log(`COMPOFF: id=${compOff.id} accrualType=${compOff.accrualType}`);
  console.log("Note: no validity/expiry period set — client BRD answer was \"Based on Company\", not given yet.");
} finally {
  await prisma.$disconnect();
}

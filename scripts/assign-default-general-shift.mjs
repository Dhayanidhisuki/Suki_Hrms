/**
 * One-off/testing: assigns the "General Shift" ShiftMaster (code GENERAL,
 * 09:00-18:00, seeded by scripts/erp-extract/seed-masters.js) to every
 * employee whose current JobInfo has no usable shift — i.e. shiftMasterId
 * is null and it isn't a properly-configured ROTATIONAL assignment (which
 * uses shiftRotationPlanId instead, see src/lib/biometricConversion.ts's
 * resolveEmployeeShiftConfig). This is what makes Attendance Overview show
 * "No shift assigned" (src/app/api/workforce/attendance/overview/route.ts)
 * and biometric sync fall back to a flat 8h/no-late-calc guess.
 *
 * Requested as a temporary "make everyone General Shift for now, we'll
 * edit later" fix so bulk-imported/testing employees stop showing no
 * shift. Leaves shiftAssignmentType as-is when it's already GENERAL, sets
 * it to GENERAL for the few edge cases (null or broken ROTATIONAL).
 *
 *   node scripts/assign-default-general-shift.mjs
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
  const generalShift = await prisma.shiftMaster.findFirst({ where: { code: "GENERAL" } });
  if (!generalShift) {
    throw new Error('No ShiftMaster with code "GENERAL" found — run scripts/erp-extract/seed-masters.js first.');
  }
  console.log(`Using ShiftMaster #${generalShift.id} "${generalShift.name}" (${generalShift.startTime}-${generalShift.endTime}).`);

  const affected = await prisma.jobInfo.findMany({
    where: {
      effectiveTo: null,
      shiftMasterId: null,
      OR: [
        { shiftAssignmentType: null },
        { shiftAssignmentType: { not: "ROTATIONAL" } },
        { AND: [{ shiftAssignmentType: "ROTATIONAL" }, { shiftRotationPlanId: null }] },
      ],
    },
    select: { id: true, employeeId: true },
  });
  console.log(`${affected.length} current JobInfo rows have no usable shift.`);

  if (affected.length === 0) {
    console.log("Nothing to do.");
  } else {
    const result = await prisma.jobInfo.updateMany({
      where: { id: { in: affected.map((j) => j.id) } },
      data: { shiftMasterId: generalShift.id, shiftAssignmentType: "GENERAL" },
    });
    console.log(`Updated ${result.count} JobInfo rows to General Shift.`);
  }
} finally {
  await prisma.$disconnect();
}

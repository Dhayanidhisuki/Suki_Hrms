/**
 * One-time backfill: the auto-queue logic added to
 * upsertDailyAttendanceWithHistory only fires on a write that actually
 * changes otMinutesCalculated — a day whose OT was already calculated
 * before this feature existed (and hasn't changed since) never gets
 * re-written, so it would never enter the OT Approval queue on its own.
 * This scans existing DailyAttendance rows with real OT minutes and no
 * approval status yet, and queues them for OT-eligible employees only
 * (JobInfo.overtimeAllowed) — mirrors the same eligibility gate the live
 * auto-queue logic applies.
 *
 *   node scripts/backfill-ot-approval-queue.mjs
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
  const candidates = await prisma.dailyAttendance.findMany({
    where: { otMinutesCalculated: { gt: 0 }, otApprovalStatus: null },
    select: { id: true, employeeId: true },
  });
  console.log(`${candidates.length} days have OT minutes but no approval status.`);

  const eligibleEmployeeIds = new Set(
    (
      await prisma.jobInfo.findMany({
        where: { effectiveTo: null, overtimeAllowed: true, employeeId: { in: [...new Set(candidates.map((c) => c.employeeId))] } },
        select: { employeeId: true },
      })
    ).map((j) => j.employeeId)
  );

  const toQueue = candidates.filter((c) => eligibleEmployeeIds.has(c.employeeId));
  console.log(`${toQueue.length} of those belong to OT-eligible employees (JobInfo.overtimeAllowed) — queuing those.`);

  if (toQueue.length > 0) {
    const result = await prisma.dailyAttendance.updateMany({
      where: { id: { in: toQueue.map((c) => c.id) } },
      data: { otApprovalStatus: 'pending_manager' },
    });
    console.log(`Queued ${result.count} days for Reporting Manager approval.`);
  }
  console.log(`${candidates.length - toQueue.length} day(s) skipped — not OT-eligible (or OT-eligibility not set on JobInfo).`);
} finally {
  await prisma.$disconnect();
}

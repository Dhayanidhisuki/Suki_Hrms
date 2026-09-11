/**
 * POST /api/masters/designations/jd-bulk-import — JD Upload (KUN BRD
 * review, 2026-09-10, item 4). Bulk-writes Designation.jobDescription from
 * an admin-uploaded Excel file: one row per Designation Code + Job
 * Description. Matches rows to existing Designations by code (case/space
 * insensitive) — never creates a Designation, only fills in its JD text.
 *
 * Body: { rows: [{ code: string, jobDescription: string }] }
 * Returns one result per input row so the page can show exactly which
 * rows applied and which didn't (unknown code, empty JD, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { z } from 'zod';

const rowSchema = z.object({
  code: z.string().min(1).max(20),
  jobDescription: z.string().min(1),
});
const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const designations = await prisma.designation.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });
  const byCode = new Map(designations.map((d) => [d.code.trim().toUpperCase(), d.id]));

  const results: { row: number; code: string; status: 'updated' | 'not_found'; designationId?: number }[] = [];
  const updates: { id: number; jobDescription: string }[] = [];

  parsed.data.rows.forEach((r, i) => {
    const id = byCode.get(r.code.trim().toUpperCase());
    if (!id) {
      results.push({ row: i + 1, code: r.code, status: 'not_found' });
      return;
    }
    updates.push({ id, jobDescription: r.jobDescription });
    results.push({ row: i + 1, code: r.code, status: 'updated', designationId: id });
  });

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) => prisma.designation.update({ where: { id: u.id }, data: { jobDescription: u.jobDescription } }))
    );
  }

  return NextResponse.json({
    updated: updates.length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    results,
  });
}

/**
 * POST /api/workforce/leave/accrual  { year: number }
 *   — runs the annual leave-credit job (src/lib/leaveAccrual.ts) for every
 *     active employee and leave type in the caller's company. Admin-
 *     triggered, same pattern as Biometric's "Sync now" or Monthly
 *     Attendance's Finalize/Freeze — safe to re-run for the same year.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { runAnnualLeaveCredit } from '@/lib/leaveAccrual';

const bodySchema = z.object({ year: z.number().int().min(2000).max(2100) });

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runAnnualLeaveCredit(scope.companyId, parsed.data.year);
  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculateFnF, persistFnFCalculation } from '@/lib/fnfCalculation';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { FNF_CALCULABLE, assertStatus } from '@/lib/fnf/workflow';
import { fnfEligibility } from '@/lib/fnf/eligibility';

const bodySchema = z.object({
  noticeServedDays: z.coerce.number().int().min(0).optional(),
  noticeWaivedDays: z.coerce.number().int().min(0).optional(),
  clearanceOverrideRemark: z.string().min(3).max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const settlementId = parseInt((await params).id);
  const userId = Number(request.headers.get('x-user-id'));
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const overrides = parsed.success ? parsed.data : {};

  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const blocked = assertStatus(settlement.status, FNF_CALCULABLE, 'calculate');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const elig = await fnfEligibility(settlement.exitInterviewId, scope.companyId);
  const clearanceIssue = elig.issues.find((i) => i.code === 'CLEARANCE');
  if (clearanceIssue && !overrides.clearanceOverrideRemark) {
    return NextResponse.json({ error: clearanceIssue.message, issues: elig.issues }, { status: 409 });
  }

  try {
    const calc = await calculateFnF(
      settlement.employeeId,
      settlement.exitInterviewId,
      scope.companyId,
      overrides,
      { userId: Number.isFinite(userId) ? userId : null },
      settlement.freezeSnapshotId,
    );
    await persistFnFCalculation(settlementId, calc, Number.isFinite(userId) ? userId : 0);
    if (overrides.clearanceOverrideRemark) {
      await prisma.fnFSettlement.update({
        where: { id: settlementId },
        data: { clearanceOverrideRemark: overrides.clearanceOverrideRemark },
      });
    }
    await logActivity(prisma, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_calculated',
      module: 'fnf',
      performedByUserId: Number.isFinite(userId) ? userId : null,
      relatedRecordId: settlementId,
      newValue: { netPayable: calc.netPayable, payableDays: calc.payableDays, freezeSnapshotId: calc.freezeSnapshotId },
      remarks: overrides.clearanceOverrideRemark,
    });
    const updated = await prisma.fnFSettlement.findFirst({
      where: { id: settlementId },
      include: fnfInclude,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Calculation failed' }, { status: 500 });
  }
}

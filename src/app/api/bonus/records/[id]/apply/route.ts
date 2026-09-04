/**
 * POST /api/bonus/records/[id]/apply — body { payrollRunId }. APPROVED →
 * PROCESSED. Pushes the bonus into that run as an ad-hoc earning line.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { applyBonusSchema } from '@/lib/validations/bonus';
import { applyBonusToPayroll } from '@/lib/bonusApply';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.bonus.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const parsed = applyBonusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.bonusRecord.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const targetRun = await prisma.payrollRun.findFirst({
    where: { id: parsed.data.payrollRunId, companyId: scope.companyId },
  });
  if (!targetRun) return NextResponse.json({ error: 'Target payroll run not found' }, { status: 404 });

  try {
    await applyBonusToPayroll(record.id, parsed.data.payrollRunId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const updated = await prisma.bonusRecord.findUnique({ where: { id: record.id } });
  return NextResponse.json(updated);
}

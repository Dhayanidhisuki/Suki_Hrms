import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { loadKunFnfStatement } from '@/lib/fnf/kun-statement';
import { netFromLines } from '@/lib/fnf/rules';
import { FNF_CALCULABLE, assertStatus } from '@/lib/fnf/workflow';

const overrideSchema = z.object({
  remark: z.string().min(3).max(500),
  lines: z.array(
    z.object({
      id: z.number().int().optional(),
      kind: z.enum(['EARNING', 'DEDUCTION']),
      code: z.string().min(1).max(40),
      name: z.string().min(1).max(120),
      source: z.enum(['SYSTEM', 'MANUAL']).optional(),
      amount: z.coerce.number(),
      editable: z.boolean().optional(),
      remark: z.string().max(500).optional().nullable(),
    }),
  ),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const settlementId = parseInt((await params).id);
  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
    include: fnfInclude,
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const kunStatement = await loadKunFnfStatement(settlementId);
  return NextResponse.json({ ...settlement, kunStatement });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const settlementId = parseInt((await params).id);
  const userId = Number(request.headers.get('x-user-id')) || null;
  const parsed = overrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Override requires line items and a remark' }, { status: 400 });
  }

  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const blocked = assertStatus(settlement.status, FNF_CALCULABLE, 'override');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const lines = parsed.data.lines.map((l) => ({
    kind: l.kind,
    amount: Number(l.amount),
  }));
  const totals = netFromLines(lines);
  const otherPayments = parsed.data.lines
    .filter((l) => l.source === 'MANUAL' && l.kind === 'EARNING')
    .reduce((s, l) => s + Number(l.amount), 0);
  const otherDeductions = parsed.data.lines
    .filter((l) => l.source === 'MANUAL' && l.kind === 'DEDUCTION')
    .reduce((s, l) => s + Number(l.amount), 0);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.fnFSettlementLine.deleteMany({ where: { settlementId } });
    await tx.fnFSettlementLine.createMany({
      data: parsed.data.lines.map((l, i) => ({
        settlementId,
        kind: l.kind,
        code: l.code,
        name: l.name,
        source: l.source ?? 'MANUAL',
        amount: l.amount,
        editable: l.editable ?? l.source === 'MANUAL',
        remark: l.remark ?? null,
        sortOrder: i,
      })),
    });
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        ...totals,
        otherPayments,
        otherDeductions,
        overrideRemark: parsed.data.remark,
        status: 'calculated',
      },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_overridden',
      module: 'fnf',
      performedByUserId: userId,
      relatedRecordId: settlementId,
      remarks: parsed.data.remark,
      newValue: totals,
    });
    return rec;
  });

  return NextResponse.json(updated);
}

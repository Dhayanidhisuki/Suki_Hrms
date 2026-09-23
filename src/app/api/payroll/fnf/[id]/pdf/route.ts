import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { generateFnfStatementPdf } from '@/lib/fnf-statement';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const settlementId = Number((await params).id);
  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
    include: { employee: { select: { oldEmployeeCode: true } } },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const pdf = await generateFnfStatementPdf(settlementId);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="FNF-${settlement.employee.oldEmployeeCode ?? settlementId}.pdf"`,
    },
  });
}

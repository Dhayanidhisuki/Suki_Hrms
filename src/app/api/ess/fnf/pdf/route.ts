import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { generateFnfStatementPdf } from '@/lib/fnf-statement';

export async function GET(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employee = await prisma.employee.findFirst({
    where: { userId, companyId: scope.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'No employee record is linked to this login' }, { status: 404 });
  }

  const id = Number(new URL(request.url).searchParams.get('id'));
  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id, companyId: scope.companyId, employeeId: employee.id },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });

  const pdf = await generateFnfStatementPdf(settlement.id);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="FNF-statement.pdf"`,
    },
  });
}

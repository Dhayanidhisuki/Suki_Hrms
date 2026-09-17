import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { fnfInclude } from '@/lib/fnf/include';
import { loadKunFnfStatement } from '@/lib/fnf/kun-statement';

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

  const rows = await prisma.fnFSettlement.findMany({
    where: { companyId: scope.companyId, employeeId: employee.id },
    include: fnfInclude,
    orderBy: { createdAt: 'desc' },
  });
  const data = await Promise.all(
    rows.map(async (s) => ({ ...s, kunStatement: await loadKunFnfStatement(s.id) })),
  );
  return NextResponse.json({ data });
}

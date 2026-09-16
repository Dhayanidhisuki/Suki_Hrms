/**
 * GET /api/employees/[id]/lifecycle/job-history — every dated job row (BRD 01
 * §15) newest first, with the change reason / reference, resolved master
 * names, and the reporting-line history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { canSeeEmployee, scopeContextFromHeaders } from '@/lib/employee/scope';
import { listJobHistory } from '@/lib/employee/resolveJob';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const employeeId = parseInt(id);
  const ctx = scopeContextFromHeaders(request.headers);
  if (!(await canSeeEmployee(ctx.userId, scope.companyId, employeeId, { isSuperAdmin: ctx.isSuperAdmin }))) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const rows = await listJobHistory(scope.companyId, employeeId);
  if (!rows) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const reporting = await prisma.employeeReportingHistory.findMany({
    where: { companyId: scope.companyId, employeeId },
    orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
  });
  const managerIds = [
    ...new Set(reporting.flatMap((r) => [r.primaryManagerId, r.secondaryManagerId]).filter((v): v is number => v !== null)),
  ];
  const managers = managerIds.length
    ? await prisma.employee.findMany({ where: { id: { in: managerIds } }, select: { id: true, employeeCode: true, firstName: true, lastName: true } })
    : [];
  const managerById = new Map(managers.map((m) => [m.id, m]));

  return NextResponse.json({
    data: rows,
    reporting: reporting.map((r) => ({
      id: r.id,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      changeReason: r.changeReason,
      primaryManager: r.primaryManagerId ? (managerById.get(r.primaryManagerId) ?? null) : null,
      secondaryManager: r.secondaryManagerId ? (managerById.get(r.secondaryManagerId) ?? null) : null,
    })),
  });
}

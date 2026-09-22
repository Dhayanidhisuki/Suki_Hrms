import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { fnfEligibility, ensureClearanceChecks } from '@/lib/fnf/eligibility';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const q = new URL(request.url).searchParams.get('q')?.trim();
  const employeeFilter = q
    ? {
        companyId: scope.companyId,
        deletedAt: null,
        OR: [
          { employeeCode: { contains: q } },
          { firstName: { contains: q } },
          { lastName: { contains: q } },
        ],
      }
    : { companyId: scope.companyId, deletedAt: null };

  const rows = await prisma.exitInterview.findMany({
    where: {
      OR: [{ fnfSettlement: null }, { fnfSettlement: { status: { not: 'completed' } } }],
      employee: employeeFilter,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          jobInfos: {
            where: { effectiveTo: null },
            take: 1,
            include: { designation: { select: { name: true } }, department: { select: { name: true } } },
          },
        },
      },
      fnfSettlement: { select: { id: true, status: true } },
      clearanceChecks: true,
    },
    orderBy: { exitDate: 'desc' },
    take: 50,
  });

  const data = [];
  for (const row of rows) {
    if (!row.fnfSettlement) await ensureClearanceChecks(row.id);
    const elig = await fnfEligibility(row.id, scope.companyId);
    const job = row.employee.jobInfos[0];
    data.push({
      id: row.id,
      employeeId: row.employeeId,
      exitDate: row.exitDate,
      lastWorkingDay: row.approvedLastWorkingDay ?? row.exitDate,
      exitType: row.exitType,
      noticePeriodDays: row.noticePeriodDays,
      noticeServedDays: row.noticeServedDays,
      noticeWaivedDays: row.noticeWaivedDays,
      clearanceStatus: row.clearanceStatus,
      fnfStatus: row.fnfSettlement?.status ?? null,
      fnfId: row.fnfSettlement?.id ?? null,
      employee: {
        id: row.employee.id,
        employeeCode: row.employee.employeeCode,
        firstName: row.employee.firstName,
        lastName: row.employee.lastName,
        department: job?.department?.name,
        designation: job?.designation?.name,
      },
      eligibility: elig,
    });
  }

  return NextResponse.json({ data });
}

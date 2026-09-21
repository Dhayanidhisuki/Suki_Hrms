/**
 * GET /api/reports/payroll/full-and-final?from=&to=&status=&departmentId=
 *
 * F&F settlement register: one row per settlement in a last-working-day
 * range, with the component breakdown that makes up the net. Read-only — it
 * reports the stored settlement columns and never recalculates, so a figure
 * here always matches what was approved and paid.
 *
 * Excel export is generated client-side from these same rows, matching the
 * other payroll reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  try {
    const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const sp = request.nextUrl.searchParams;
    const from = sp.get('from');
    const to = sp.get('to');
    const status = sp.get('status');
    const departmentId = sp.get('departmentId');

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const dated = fromDate && !Number.isNaN(fromDate.getTime());
    const datedTo = toDate && !Number.isNaN(toDate.getTime());

    const where: Prisma.FnFSettlementWhereInput = {
      companyId: scope.companyId,
      ...(status ? { status } : {}),
      ...(dated || datedTo
        ? {
            lastWorkingDay: {
              ...(dated ? { gte: fromDate } : {}),
              ...(datedTo ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(departmentId
        ? { employee: { jobInfos: { some: { effectiveTo: null, departmentId: Number(departmentId) } } } }
        : {}),
    };

    const rows = await prisma.fnFSettlement.findMany({
      where,
      orderBy: [{ lastWorkingDay: 'desc' }, { id: 'desc' }],
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
              select: {
                designation: { select: { name: true } },
                department: { select: { name: true } },
                joinDate: true,
              },
            },
          },
        },
        exitInterview: { select: { exitType: true, exitDate: true, resignationDate: true } },
      },
    });

    const num = (v: unknown) => Number(v ?? 0);

    const data = rows.map((r) => {
      const job = r.employee.jobInfos[0];
      return {
        settlementId: r.id,
        employeeId: r.employeeId,
        employeeCode: r.employee.employeeCode,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
        designation: job?.designation?.name ?? null,
        department: job?.department?.name ?? null,
        joinDate: job?.joinDate ?? null,
        exitType: r.exitInterview?.exitType ?? null,
        resignationDate: r.exitInterview?.resignationDate ?? null,
        lastWorkingDay: r.lastWorkingDay,
        status: r.status,
        // Earnings
        unpaidSalary: num(r.unpaidSalary),
        leaveEncashment: num(r.leaveEncashment),
        gratuity: num(r.gratuity),
        bonusProportion: num(r.bonusProportion),
        arrearsAmount: num(r.arrearsAmount),
        incentiveAmount: num(r.incentiveAmount),
        otherPayments: num(r.otherPayments),
        // Recoveries — ptDeduction included, which the stored breakdown
        // previously omitted even though it was always in the net.
        noticePay: num(r.noticePay),
        loanRecovery: num(r.loanRecovery),
        assetRecovery: num(r.assetRecovery),
        tdsDeduction: num(r.tdsDeduction),
        pfDeduction: num(r.pfDeduction),
        esiDeduction: num(r.esiDeduction),
        ptDeduction: num(r.ptDeduction),
        otherDeductions: num(r.otherDeductions),
        // Totals as stored, never recomputed here.
        totalPayable: num(r.totalPayable),
        totalRecovery: num(r.totalRecovery),
        netPayable: num(r.netPayable),
        paymentDate: r.paymentDate,
        settlementDate: r.settlementDate,
      };
    });

    const totals = data.reduce(
      (acc, r) => ({
        totalPayable: acc.totalPayable + r.totalPayable,
        totalRecovery: acc.totalRecovery + r.totalRecovery,
        netPayable: acc.netPayable + r.netPayable,
      }),
      { totalPayable: 0, totalRecovery: 0, netPayable: 0 },
    );

    return NextResponse.json({
      data,
      totals: {
        count: data.length,
        totalPayable: Number(totals.totalPayable.toFixed(2)),
        totalRecovery: Number(totals.totalRecovery.toFixed(2)),
        netPayable: Number(totals.netPayable.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('[reports/full-and-final] GET failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build the F&F register' },
      { status: 500 },
    );
  }
}

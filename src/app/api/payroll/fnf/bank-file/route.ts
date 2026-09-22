import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { payableStatuses } from '@/lib/fnf/workflow';

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ids = new URL(request.url).searchParams.get('ids');
  const idList = ids
    ? ids.split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  // The payable statuses depend on the company's approval chain. This used to
  // hardcode ['finance_verified', 'approved'], which under the default
  // HR_FINANCE chain put settlements that finance had NOT yet verified into
  // the file the bank pays from — the same control mark-paid enforces
  // correctly. 'approved' is payable only when no finance stage is configured.
  const config = await prisma.fullAndFinalConfig.findUnique({ where: { companyId: scope.companyId } });
  const where: Record<string, unknown> = {
    companyId: scope.companyId,
    status: { in: [...payableStatuses(config?.approvalStages)] },
    // netPayable is totalPayable - totalRecovery with no floor, so recoveries
    // exceeding dues make it negative. That is money the employee owes the
    // company, not a credit to push through the bank.
    netPayable: { gt: 0 },
  };
  if (idList.length) where.id = { in: idList };

  const rows = await prisma.fnFSettlement.findMany({
    where,
    include: {
      employee: {
        select: {
          employeeCode: true,
          firstName: true,
          lastName: true,
          bankDetail: { select: { accountNumber: true, bankName: true, ifscCode: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const header = [
    'EmployeeCode',
    'EmployeeName',
    'AccountNumber',
    'IFSC',
    'BankName',
    'NetPayable',
    'LastWorkingDay',
    'SettlementId',
    'Status',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    const name = `${r.employee.firstName} ${r.employee.lastName}`.trim();
    const bank = r.employee.bankDetail;
    lines.push(
      [
        csvCell(r.employee.employeeCode),
        csvCell(name),
        csvCell(bank?.accountNumber),
        csvCell(bank?.ifscCode),
        csvCell(bank?.bankName),
        csvCell(Number(r.netPayable).toFixed(2)),
        csvCell(r.lastWorkingDay.toISOString().slice(0, 10)),
        csvCell(r.id),
        csvCell(r.status),
      ].join(','),
    );
  }

  const csv = `${lines.join('\n')}\n`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fnf-bank-file.csv"',
    },
  });
}

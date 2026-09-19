/**
 * GET /api/reports/attendance/comp-off?year=X&month=Y&format=csv&detail=1
 *
 * Comp-Off Report — comp-off balances, transactions, and requests
 * matching with OT payroll (COMP_OFF settlements).
 *
 * For each employee:
 *   - Balance: current comp-off balance, earned, used, expired, encashed.
 *   - Transactions: per-transaction log (CREDIT from OT approval, DEBIT
 *     from leave, EXPIRE, ENCASH) with source type and date.
 *   - Requests: CompOffRequest rows (worked date, requested date, status).
 *   - OT matching: DailyAttendance rows settled as COMP_OFF — the OT
 *     that was converted to comp-off instead of cash payout.
 *   - Policy: CompOffPolicy config (min qualifying hours, expiry, encashment).
 *
 * `?detail=1` returns per-transaction rows for all employees (flat list).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '0');
  const month = parseInt(searchParams.get('month') ?? '0');
  const format = searchParams.get('format');
  const detail = searchParams.get('detail') === '1';

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  // ── Fetch comp-off policy ──
  const policy = await prisma.compOffPolicy.findUnique({
    where: { companyId: scope.companyId },
  });

  // ── Fetch employees ──
  const employees = await prisma.employee.findMany({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: { department: { select: { name: true } } },
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  // ── Fetch comp-off balances ──
  const balances = await prisma.compOffBalance.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) } },
  });
  const balanceByEmp = new Map(balances.map((b) => [b.employeeId, b]));

  // ── Fetch comp-off transactions for the month ──
  const transactions = await prisma.compOffTransaction.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monthStart, lt: monthEnd },
    },
    orderBy: { date: 'asc' },
  });
  const txnByEmp = new Map<number, typeof transactions>();
  for (const t of transactions) {
    const list = txnByEmp.get(t.employeeId) ?? [];
    list.push(t);
    txnByEmp.set(t.employeeId, list);
  }

  // ── Fetch comp-off requests for the month ──
  const requests = await prisma.compOffRequest.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      workedDate: { gte: monthStart, lt: monthEnd },
    },
    orderBy: { workedDate: 'asc' },
  });
  const reqByEmp = new Map<number, typeof requests>();
  for (const r of requests) {
    const list = reqByEmp.get(r.employeeId) ?? [];
    list.push(r);
    reqByEmp.set(r.employeeId, list);
  }

  // ── Fetch DailyAttendance rows settled as COMP_OFF (OT matching) ──
  const compOffOtRows = await prisma.dailyAttendance.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monthStart, lt: monthEnd },
      otApprovalStatus: 'approved',
      otSettlementType: 'COMP_OFF',
    },
    include: {
      shiftMaster: { select: { code: true, name: true } },
    },
    orderBy: { date: 'asc' },
  });
  const compOffOtByEmp = new Map<number, typeof compOffOtRows>();
  for (const d of compOffOtRows) {
    const list = compOffOtByEmp.get(d.employeeId) ?? [];
    list.push(d);
    compOffOtByEmp.set(d.employeeId, list);
  }

  // ── Build per-employee rows ──
  const rows = employees.map((emp) => {
    const jobInfo = emp.jobInfos[0];
    const balance = balanceByEmp.get(emp.id);
    const txns = txnByEmp.get(emp.id) ?? [];
    const reqs = reqByEmp.get(emp.id) ?? [];
    const otCompOffs = compOffOtByEmp.get(emp.id) ?? [];

    // Transaction breakdown
    const txnBreakdown = txns.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      type: t.type, // CREDIT | DEBIT | EXPIRE | ENCASH
      days: Number(t.days),
      balanceAfter: Number(t.balanceAfter),
      reason: t.reason,
      sourceType: t.sourceType, // OT_APPROVAL | LEAVE | MANUAL | EXPIRY
      sourceId: t.sourceId,
    }));

    // Request breakdown
    const reqBreakdown = reqs.map((r) => ({
      id: r.id,
      workedDate: r.workedDate.toISOString().slice(0, 10),
      requestedDate: r.requestedDate.toISOString().slice(0, 10),
      status: r.status,
      reason: r.reason,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString().slice(0, 10) : null,
      rejectionReason: r.rejectionReason,
    }));

    // OT COMP_OFF matching breakdown
    const otCompOffBreakdown = otCompOffs.map((d) => ({
      id: d.id,
      date: d.date.toISOString().slice(0, 10),
      dayOfWeek: d.date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      shiftCode: d.shiftMaster?.code ?? '—',
      shiftName: d.shiftMaster?.name ?? '—',
      status: d.status,
      otMinutesCalculated: Number(d.otMinutesCalculated ?? 0),
      otMinutesApproved: d.otMinutesApproved ? Number(d.otMinutesApproved) : null,
      isHolidayWorked: d.isHolidayWorked,
      isWeeklyOffWorked: d.isWeeklyOffWorked,
      otManagerActionAt: d.otManagerActionAt ? d.otManagerActionAt.toISOString().slice(0, 10) : null,
      otHrActionAt: d.otHrActionAt ? d.otHrActionAt.toISOString().slice(0, 10) : null,
    }));

    // Transaction totals
    const credits = txns.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + Number(t.days), 0);
    const debits = txns.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + Math.abs(Number(t.days)), 0);
    const expired = txns.filter((t) => t.type === 'EXPIRE').reduce((s, t) => s + Math.abs(Number(t.days)), 0);
    const encashed = txns.filter((t) => t.type === 'ENCASH').reduce((s, t) => s + Math.abs(Number(t.days)), 0);

    return {
      id: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName ?? ''}`.trim(),
      department: jobInfo?.department?.name ?? '—',
      // Balance
      currentBalance: balance ? Number(balance.balance) : 0,
      totalEarned: balance ? Number(balance.earned) : 0,
      totalUsed: balance ? Number(balance.used) : 0,
      totalExpired: balance ? Number(balance.expired) : 0,
      totalEncashed: balance ? Number(balance.encashed) : 0,
      // This month's transactions
      txnCount: txns.length,
      creditsThisMonth: credits,
      debitsThisMonth: debits,
      expiredThisMonth: expired,
      encashedThisMonth: encashed,
      // Requests
      requestCount: reqs.length,
      approvedRequests: reqs.filter((r) => r.status === 'approved').length,
      pendingRequests: reqs.filter((r) => r.status === 'pending').length,
      rejectedRequests: reqs.filter((r) => r.status === 'rejected').length,
      // OT COMP_OFF matching
      otCompOffCount: otCompOffs.length,
      otCompOffMinutes: otCompOffs.reduce((s, d) => s + Number(d.otMinutesCalculated ?? 0), 0),
      // Detail
      txnBreakdown,
      reqBreakdown,
      otCompOffBreakdown,
    };
  });

  // Filter to employees with any comp-off activity
  const rowsWithData = rows.filter((r) =>
    r.currentBalance > 0 || r.txnCount > 0 || r.requestCount > 0 || r.otCompOffCount > 0
  );

  // ── Totals ──
  const totals = rowsWithData.reduce(
    (acc, r) => {
      acc.currentBalance += r.currentBalance;
      acc.totalEarned += r.totalEarned;
      acc.totalUsed += r.totalUsed;
      acc.creditsThisMonth += r.creditsThisMonth;
      acc.debitsThisMonth += r.debitsThisMonth;
      acc.expiredThisMonth += r.expiredThisMonth;
      acc.encashedThisMonth += r.encashedThisMonth;
      acc.otCompOffCount += r.otCompOffCount;
      acc.otCompOffMinutes += r.otCompOffMinutes;
      acc.pendingRequests += r.pendingRequests;
      return acc;
    },
    {
      currentBalance: 0, totalEarned: 0, totalUsed: 0,
      creditsThisMonth: 0, debitsThisMonth: 0, expiredThisMonth: 0, encashedThisMonth: 0,
      otCompOffCount: 0, otCompOffMinutes: 0, pendingRequests: 0,
    }
  );

  // ── CSV export ──
  if (format === 'csv') {
    if (detail) {
      // Per-transaction CSV
      const headers = [
        'Employee Code', 'Employee Name', 'Department', 'Date',
        'Type', 'Days', 'Balance After', 'Source Type', 'Reason',
      ];
      const csvRows: string[] = [];
      for (const r of rowsWithData) {
        for (const t of r.txnBreakdown) {
          csvRows.push([
            r.employeeCode, r.employeeName, r.department, t.date,
            t.type, t.days.toFixed(2), t.balanceAfter.toFixed(2),
            t.sourceType ?? '', t.reason ?? '',
          ].map((v) => `"${v}"`).join(','));
        }
      }
      const csv = [headers.join(','), ...csvRows].join('\n');
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="comp_off_detail_${year}_${month}.csv"` },
      });
    }

    // Summary CSV
    const headers = [
      'Employee Code', 'Employee Name', 'Department',
      'Current Balance', 'Total Earned', 'Total Used', 'Total Expired', 'Total Encashed',
      'Credits (This Month)', 'Debits (This Month)', 'Expired (This Month)', 'Encashed (This Month)',
      'Requests', 'Approved', 'Pending', 'Rejected',
      'OT Comp-Off Days', 'OT Comp-Off Minutes',
    ];
    const csvRows = rowsWithData.map((r) => [
      r.employeeCode, r.employeeName, r.department,
      r.currentBalance.toFixed(2), r.totalEarned.toFixed(2), r.totalUsed.toFixed(2),
      r.totalExpired.toFixed(2), r.totalEncashed.toFixed(2),
      r.creditsThisMonth.toFixed(2), r.debitsThisMonth.toFixed(2),
      r.expiredThisMonth.toFixed(2), r.encashedThisMonth.toFixed(2),
      r.requestCount, r.approvedRequests, r.pendingRequests, r.rejectedRequests,
      r.otCompOffCount, r.otCompOffMinutes,
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="comp_off_summary_${year}_${month}.csv"` },
    });
  }

  // ── JSON ──
  if (detail) {
    const flatTxns: Array<Record<string, unknown>> = [];
    for (const r of rowsWithData) {
      for (const t of r.txnBreakdown) {
        flatTxns.push({
          employeeCode: r.employeeCode, employeeName: r.employeeName, department: r.department,
          ...t,
        });
      }
    }
    return NextResponse.json({
      policy: policy ? {
        minQualifyingHours: policy.minQualifyingHours,
        qualifyingDayTypes: policy.qualifyingDayTypes,
        expiryMonths: policy.expiryMonths,
        allowEncashment: policy.allowEncashment,
        encashmentRatePerDay: policy.encashmentRatePerDay ? Number(policy.encashmentRatePerDay) : null,
        autoCreditOnApproval: policy.autoCreditOnApproval,
      } : null,
      rows: flatTxns,
      totals,
    });
  }

  return NextResponse.json({
    policy: policy ? {
      minQualifyingHours: policy.minQualifyingHours,
      qualifyingDayTypes: policy.qualifyingDayTypes,
      expiryMonths: policy.expiryMonths,
      allowEncashment: policy.allowEncashment,
      encashmentRatePerDay: policy.encashmentRatePerDay ? Number(policy.encashmentRatePerDay) : null,
      autoCreditOnApproval: policy.autoCreditOnApproval,
    } : null,
    rows: rowsWithData,
    totals,
  });
}

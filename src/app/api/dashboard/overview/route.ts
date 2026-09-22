/**
 * GET /api/dashboard/overview
 *
 * Single aggregation behind the org-wide HR dashboard on `/`. One round trip
 * instead of the eight the page would otherwise make — every panel on that
 * page reads one slice of this payload.
 *
 * Every section is company-scoped through getCompanyId(). The attendance /
 * leave / comp-off tables carry no companyId of their own, so they scope
 * through `employee: { companyId }` (LeaveApplication's own companyId is
 * nullable on legacy rows, so the relation filter is the reliable one).
 *
 * Sections with no rows return empty arrays / zeros rather than placeholder
 * figures — the dashboard renders an explicit empty state for those.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

// DailyAttendance.status is a free string (see schema); these are the values
// upsertDailyAttendanceWithHistory writes. Anything else falls into "other".
const PRESENT_STATUSES = ['Present', 'HalfDay', 'OnDuty'];
const LEAVE_STATUSES = ['Leave', 'Permission'];
const ABSENT_STATUSES = ['Absent', 'LOP'];

const PENDING_LEAVE_STATUSES = ['pending_manager', 'pending_hr'];

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** Month key "YYYY-MM" — the bucket key for every month-series below. */
function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The last `count` months ending with the month containing `end`, oldest first. */
function monthSpan(end: Date, count: number) {
  const out: Array<{ key: string; label: string; year: number; month: number }> = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    out.push({
      key: monthKey(d),
      label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const today = startOfDay(new Date());
  const weeksBack = 12;
  // 12 whole weeks ending today, aligned to today's weekday.
  const trendStart = addDays(today, -7 * weeksBack + 1);
  const months6 = monthSpan(today, 6);
  const months12 = monthSpan(today, 12);
  const leaveStart = new Date(Date.UTC(months6[0].year, months6[0].month - 1, 1));
  const exitStart = new Date(Date.UTC(months12[0].year, months12[0].month - 1, 1));

  const employeeScope = { employee: { companyId, deletedAt: null } };

  const [
    activeEmployees,
    todayRows,
    pendingLeave,
    pendingOt,
    pendingCompOff,
    trendRows,
    leaveRows,
    exitRows,
    runs,
  ] = await Promise.all([
    // Headcount + department split. Same shape as /api/reports/headcount so
    // the two never disagree.
    prisma.employee.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: {
        id: true,
        jobInfos: {
          where: { effectiveTo: null },
          take: 1,
          select: { department: { select: { name: true } } },
        },
      },
    }),
    prisma.dailyAttendance.groupBy({
      by: ['status'],
      where: { date: today, ...employeeScope },
      _count: { _all: true },
    }),
    prisma.leaveApplication.count({
      where: { status: { in: PENDING_LEAVE_STATUSES }, ...employeeScope },
    }),
    prisma.dailyAttendance.count({
      where: { otApprovalStatus: { in: PENDING_LEAVE_STATUSES }, ...employeeScope },
    }),
    prisma.compOffRequest.count({
      where: { status: 'pending', ...employeeScope },
    }),
    prisma.dailyAttendance.groupBy({
      by: ['date', 'status'],
      where: { date: { gte: trendStart, lte: today }, ...employeeScope },
      _count: { _all: true },
    }),
    prisma.leaveApplication.findMany({
      where: { fromDate: { gte: leaveStart }, ...employeeScope },
      select: { fromDate: true, status: true },
    }),
    prisma.exitInterview.findMany({
      where: { exitDate: { gte: exitStart }, ...employeeScope },
      select: { exitDate: true },
    }),
    prisma.payrollRun.findMany({
      where: { companyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 6,
      select: { id: true, year: true, month: true, status: true },
    }),
  ]);

  // ---- Headcount -----------------------------------------------------------
  const byDeptMap = new Map<string, number>();
  for (const e of activeEmployees) {
    const dept = e.jobInfos[0]?.department?.name ?? 'Unassigned';
    byDeptMap.set(dept, (byDeptMap.get(dept) ?? 0) + 1);
  }
  const byDepartment = Array.from(byDeptMap.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);
  const totalHeadcount = activeEmployees.length;

  // ---- Today's attendance --------------------------------------------------
  let present = 0;
  let onLeave = 0;
  let absent = 0;
  let markedToday = 0;
  for (const row of todayRows) {
    const n = row._count._all;
    markedToday += n;
    if (PRESENT_STATUSES.includes(row.status)) present += n;
    else if (LEAVE_STATUSES.includes(row.status)) onLeave += n;
    else if (ABSENT_STATUSES.includes(row.status)) absent += n;
  }

  // ---- Attendance % trend, bucketed into 12 weeks --------------------------
  const weekBuckets = Array.from({ length: weeksBack }, (_, i) => ({
    label: `W${i + 1}`,
    start: addDays(trendStart, i * 7),
    present: 0,
    counted: 0,
  }));
  for (const row of trendRows) {
    const offset = Math.floor(
      (startOfDay(row.date).getTime() - trendStart.getTime()) / (7 * 86400000)
    );
    const bucket = weekBuckets[offset];
    if (!bucket) continue;
    // Weekly-offs and holidays aren't attendance opportunities — excluding
    // them is what keeps the rate from sagging every weekend.
    if (row.status === 'WeeklyOff' || row.status === 'Holiday') continue;
    bucket.counted += row._count._all;
    if (PRESENT_STATUSES.includes(row.status)) bucket.present += row._count._all;
  }
  const attendanceTrend = weekBuckets
    .filter((b) => b.counted > 0)
    .map((b) => ({
      label: b.start.toISOString().slice(5, 10).replace('-', '/'),
      rate: Number(((b.present / b.counted) * 100).toFixed(1)),
    }));

  // ---- Leave applications by status, last 6 months -------------------------
  const leaveByMonth = new Map(
    months6.map((m) => [m.key, { label: m.label, approved: 0, pending: 0, rejected: 0 }])
  );
  for (const row of leaveRows) {
    const bucket = leaveByMonth.get(monthKey(row.fromDate));
    if (!bucket) continue;
    if (row.status === 'approved') bucket.approved += 1;
    else if (row.status === 'rejected') bucket.rejected += 1;
    else if (PENDING_LEAVE_STATUSES.includes(row.status)) bucket.pending += 1;
    // cancelled is deliberately not charted — it isn't an approval outcome.
  }
  const leaveByStatus = Array.from(leaveByMonth.values());
  const hasLeaveData = leaveByStatus.some((m) => m.approved + m.pending + m.rejected > 0);

  // ---- Payroll: cost trend, statutory, run pipeline ------------------------
  const runIds = runs.map((r) => r.id);
  const costRows = runIds.length
    ? await prisma.payrollLine.groupBy({
        by: ['payrollRunId'],
        where: { payrollRunId: { in: runIds } },
        _sum: { grossEarnings: true, netSalary: true, otAmount: true },
      })
    : [];

  const costByRun = new Map(costRows.map((r) => [r.payrollRunId, r._sum]));

  // The newest run is often an empty DRAFT that was opened for the month
  // ahead — reading statutory and "this month's cost" off it would report
  // zero while the last calculated run holds the real figures. The pipeline
  // panel still tracks runs[0], because an empty draft IS the current state
  // of payroll; only the money panels fall back to the last run with lines.
  const settledRun =
    runs.find((r) => Number(costByRun.get(r.id)?.grossEarnings ?? 0) > 0) ?? null;

  const [settledStatutory, latestLineStatus, holdGross] = await Promise.all([
    settledRun
      ? prisma.payrollLine.aggregate({
          where: { payrollRunId: settledRun.id },
          _sum: {
            pfEmployee: true, pfEmployer: true,
            esiEmployee: true, esiEmployer: true,
            professionalTax: true, tds: true,
          },
        })
      : null,
    runs.length
      ? prisma.payrollLine.groupBy({
          by: ['status'],
          where: { payrollRunId: runs[0].id },
          _count: { _all: true },
        })
      : [],
    runs.length
      ? prisma.payrollLine.aggregate({
          where: { payrollRunId: runs[0].id, status: 'HOLD' },
          _sum: { grossEarnings: true },
        })
      : null,
  ]);
  const salaryCost = runs
    .slice()
    .reverse()
    .map((r) => {
      const sums = costByRun.get(r.id);
      return {
        label: new Date(Date.UTC(r.year, r.month - 1, 1))
          .toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
        gross: Number(sums?.grossEarnings ?? 0),
        net: Number(sums?.netSalary ?? 0),
        ot: Number(sums?.otAmount ?? 0),
      };
    });

  const s = settledStatutory?._sum;
  const runLabel = (year: number, month: number) =>
    new Date(Date.UTC(year, month - 1, 1))
      .toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

  const statutory = s
    ? {
        pfEmployee: Number(s.pfEmployee ?? 0),
        pfEmployer: Number(s.pfEmployer ?? 0),
        esiEmployee: Number(s.esiEmployee ?? 0),
        esiEmployer: Number(s.esiEmployer ?? 0),
        professionalTax: Number(s.professionalTax ?? 0),
        tds: Number(s.tds ?? 0),
      }
    : null;

  const okLines = latestLineStatus.find((r) => r.status === 'OK')?._count._all ?? 0;
  const holdLines = latestLineStatus.find((r) => r.status === 'HOLD')?._count._all ?? 0;
  const latestRun = runs[0]
    ? {
        id: runs[0].id,
        year: runs[0].year,
        month: runs[0].month,
        status: runs[0].status,
        label: runLabel(runs[0].year, runs[0].month),
        totalLines: okLines + holdLines,
        clearedLines: okLines,
        holdLines,
        grossAtRisk: Number(holdGross?._sum.grossEarnings ?? 0),
      }
    : null;

  // ---- Attrition -----------------------------------------------------------
  // Denominator is today's active headcount, not a historical one — the schema
  // keeps no headcount snapshot, so the rate is "exits in the window against
  // headcount now". The UI labels it that way.
  const exitsByMonth = new Map(months12.map((m) => [m.key, 0]));
  for (const row of exitRows) {
    const key = monthKey(row.exitDate);
    if (exitsByMonth.has(key)) exitsByMonth.set(key, (exitsByMonth.get(key) ?? 0) + 1);
  }
  const attrition = months12.map((m) => ({
    label: m.label,
    exits: exitsByMonth.get(m.key) ?? 0,
  }));
  const totalExits12m = attrition.reduce((sum, m) => sum + m.exits, 0);
  const attritionRate =
    totalHeadcount > 0 ? Number(((totalExits12m / totalHeadcount) * 100).toFixed(1)) : 0;

  return NextResponse.json({
    asOf: new Date().toISOString(),
    headcount: { total: totalHeadcount, byDepartment },
    attendanceToday: {
      present,
      onLeave,
      absent,
      marked: markedToday,
      unmarked: Math.max(0, totalHeadcount - markedToday),
      rate: markedToday > 0 ? Number(((present / markedToday) * 100).toFixed(1)) : null,
    },
    pendingApprovals: {
      leave: pendingLeave,
      overtime: pendingOt,
      compOff: pendingCompOff,
      total: pendingLeave + pendingOt + pendingCompOff,
    },
    attendanceTrend,
    leaveByStatus: hasLeaveData ? leaveByStatus : [],
    salaryCost,
    statutory,
    settledRun: settledRun
      ? { id: settledRun.id, label: runLabel(settledRun.year, settledRun.month) }
      : null,
    payrollRun: latestRun,
    attrition: { months: attrition, totalExits12m, rate: attritionRate },
  });
}
